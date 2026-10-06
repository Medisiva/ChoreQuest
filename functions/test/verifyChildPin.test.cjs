const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture({ member = false, deleted = false, profile, correct = false } = {}) {
  const writes = new Map(); let revision = 0; const deletedField = Symbol('delete'); const credentials = { ...profile };
  const reads = [];
  const admin = {
    auth: () => ({ verifyIdToken: async () => ({ uid: 'caller' }), createCustomToken: async () => 'custom-token' }),
    firestore: Object.assign(() => ({
      doc: (ref) => ({ path: ref, get: async () => {
        reads.push(ref);
        if (ref.endsWith('/parentUsers/caller')) return { exists: member };
        if (ref === 'families/family') return { exists: true, data: () => ({ isDeleted: deleted }) };
        throw new Error('Child data must not be read for an unauthorized request');
      } }),
      runTransaction: async (callback) => {
        for (let attempt = 0; attempt < 10; attempt++) {
          const observed = revision; const pending = [];
          const result = await callback({
            get: async (ref) => ({ exists: !!profile, data: () => ({ ...(ref.path.includes('/childCredentials/') ? credentials : profile) }) }),
            update: (ref, data) => pending.push([ref, data, true]),
            set: (ref, data) => pending.push([ref, data, false]),
          });
          if (revision !== observed) continue;
          for (const [ref, data, update] of pending) {
            if (ref.path.includes('/childCredentials/')) Object.assign(credentials, data);
            else if (update) { Object.assign(profile, data); for (const key of Object.keys(profile)) if (profile[key] === deletedField) delete profile[key]; }
            else writes.set(ref.path, data);
          }
          if (pending.length) revision++;
          return result;
        }
        throw new Error('Transaction retry limit');
      },
    }), { FieldValue: { delete: () => deletedField }, Timestamp: {
      now: () => ({ toMillis: () => Date.now() }),
      fromDate: (date) => ({ toMillis: () => date.getTime(), toDate: () => date }),
    } }),
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../lib/http/verifyChildPin.js'), 'utf8'), {
    exports: module.exports, module,
    require: (name) => {
      if (name === 'firebase-functions/v2/https') return { onRequest: (handler) => handler };
      if (name === 'firebase-functions') return { logger: { info() {}, error() {} } };
      if (name === 'firebase-admin/firestore') return admin.firestore;
      if (name === 'firebase-admin') return admin;
      if (name === 'bcrypt') return { compare: async () => correct };
      return require(name);
    },
  });
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  return { handler: module.exports.verifyChildPin, response, reads, writes, credentials };
}
const request = (body = { familyId: 'family', childProfileId: 'child', pin: '1234' }) => ({ method: 'POST', headers: { authorization: 'Bearer token' }, body });

test('rejects callers outside the requested family before reading child data', async () => {
  const f = fixture(); await f.handler(request(), f.response);
  assert.equal(f.response.statusCode, 403);
  assert.ok(f.reads.every((p) => !p.includes('childProfiles')));
});
test('rejects access to deleted families', async () => {
  const f = fixture({ member: true, deleted: true }); await f.handler(request(), f.response);
  assert.equal(f.response.statusCode, 403);
});
test('rejects malformed PINs and document paths before reading Firestore', async () => {
  for (const body of [{ familyId: 'family/other', childProfileId: 'child', pin: '1234' }, { familyId: 'family', childProfileId: 'child', pin: 1234 }, { familyId: 'family', childProfileId: 'child', pin: '12' }]) {
    const f = fixture(); await f.handler(request(body), f.response);
    assert.equal(f.response.statusCode, 400); assert.deepEqual(f.reads, []);
  }
});
test('rejects unauthenticated calls', async () => {
  const f = fixture(); await f.handler({ ...request(), headers: {} }, f.response);
  assert.equal(f.response.statusCode, 401); assert.deepEqual(f.reads, []);
});

test('parallel failed guesses share an atomic lockout counter', async () => {
  const profile = { pinHash: '$2b$12$test', failedPinAttempts: 0, lockedUntil: null };
  const f = fixture({ member: true, profile });
  const responses = Array.from({ length: 4 }, () => ({ ...f.response }));
  await Promise.all(responses.map((response) => f.handler(request(), response)));
  assert.equal(f.credentials.failedPinAttempts, 3);
  assert.ok(f.credentials.lockedUntil.toMillis() > Date.now());
  assert.equal(responses.filter((response) => response.statusCode === 403).length, 2);
});
test('successful verification records only a hashed token bound to parent and child', async () => {
  const profile = { pinHash: '$2b$12$test', failedPinAttempts: 2, lockedUntil: null };
  const f = fixture({ member: true, profile, correct: true });
  await f.handler(request(), f.response);
  assert.equal(f.response.statusCode, 200);
  const token = f.response.body.sessionToken.token;
  const hash = require('node:crypto').createHash('sha256').update(token).digest('hex');
  const session = f.writes.get(`families/family/childSessions/${hash}`);
  assert.equal(session.parentUid, 'caller'); assert.equal(session.childProfileId, 'child');
  assert.equal(session.token, undefined); assert.equal(f.credentials.failedPinAttempts, 0);
  assert.equal(profile.pinHash, undefined);
});
test('legacy demo hashes require a parent reset instead of pretending to verify', async () => {
  const f = fixture({ member: true, profile: { pinHash: 'demo-hash', failedPinAttempts: 0 } });
  await f.handler(request(), f.response);
  assert.equal(f.response.statusCode, 409); assert.equal(f.writes.size, 0);
});
