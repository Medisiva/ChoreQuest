const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture({ member = false, deleted = false } = {}) {
  const reads = [];
  const admin = {
    auth: () => ({ verifyIdToken: async () => ({ uid: 'caller' }) }),
    firestore: () => ({ doc: (ref) => ({ get: async () => {
      reads.push(ref);
      if (ref.endsWith('/parentUsers/caller')) return { exists: member };
      if (ref === 'families/family') return { exists: true, data: () => ({ isDeleted: deleted }) };
      throw new Error('Child data must not be read for an unauthorized request');
    } }) }),
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../lib/http/verifyChildPin.js'), 'utf8'), {
    exports: module.exports, module,
    require: (name) => {
      if (name === 'firebase-functions/v2/https') return { onRequest: (handler) => handler };
      if (name === 'firebase-functions') return { logger: { info() {}, error() {} } };
      if (name === 'firebase-admin') return admin;
      if (name === 'bcrypt') return { compare: () => { throw new Error('Unexpected PIN comparison'); } };
      return require(name);
    },
  });
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  return { handler: module.exports.verifyChildPin, response, reads };
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
