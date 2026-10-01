const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm'); const crypto = require('node:crypto');
function fixture() {
  const token = 'a'.repeat(64); const hash = crypto.createHash('sha256').update(token).digest('hex');
  const timestamp = (ms) => ({ toMillis: () => ms });
  const docs = new Map([
    ['families/f', { isDeleted: false }], ['families/f/parentUsers/p', {}],
    ['families/f/childProfiles/c', { starBalance: 30, totalStarsEarned: 30, totalStarsRedeemed: 0 }],
    ['families/f/rewards/r', { isActive: true, starCost: 20, name: 'Movie' }],
    [`families/f/childSessions/${hash}`, { childProfileId: 'c', parentUid: 'p', createdAt: timestamp(Date.now() - 1000), expiresAt: timestamp(Date.now() + 100000) }],
  ]); let revision = 0;
  const db = { doc: (path) => ({ path, id: path.split('/').at(-1) }), runTransaction: async (callback) => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const observed = revision; const writes = [];
      const result = await callback({ get: async (ref) => { assert.equal(writes.length, 0, 'Reads precede writes'); return { exists: docs.has(ref.path), data: () => ({ ...docs.get(ref.path) }) }; }, update: (ref, data) => writes.push([ref.path, data, true]), create: (ref, data) => writes.push([ref.path, data, false]) });
      if (revision !== observed) continue;
      for (const [path, data, merge] of writes) { if (!merge) assert.equal(docs.has(path), false); docs.set(path, merge ? { ...docs.get(path), ...data } : data); }
      if (writes.length) revision++; return result;
    }
    throw new Error('Retry limit');
  } };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  let authorization;
  function load(file) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve(file), 'utf8'), { module, exports: module.exports, Date, require: (name) => {
      if (name === 'firebase-functions/v2/https') return { onCall: (callback) => callback, HttpsError };
      if (name === 'firebase-admin') return { firestore: Object.assign(() => db, { FieldValue: { serverTimestamp: () => 'server-time' } }) };
      if (name === '../utils/authorization') return authorization;
      if (name === 'crypto') return crypto;
      throw new Error(name);
    } }); return module.exports;
  }
  authorization = load('../lib/utils/authorization');
  return { docs, token, ...load('../lib/http/manageStars') };
}
const auth = { uid: 'p' };
const adjustment = { familyId: 'f', childId: 'c', amount: 5, reason: 'Helping', type: 'bonusStar', operationId: 'op' };
const redemption = (f, operationId = 'red') => ({ familyId: 'f', childId: 'c', rewardId: 'r', operationId, sessionToken: f.token });

test('simultaneous adjustment retries credit once and conflicting payloads fail', async () => {
  const f = fixture(); await Promise.all([f.adjustChildStars({ auth, data: adjustment }), f.adjustChildStars({ auth, data: adjustment })]);
  assert.equal(f.docs.get('families/f/childProfiles/c').starBalance, 35);
  await assert.rejects(f.adjustChildStars({ auth, data: { ...adjustment, amount: 10 } }), { code: 'already-exists' });
});
test('deductions floor balance and record actual delta; invalid amounts cannot create credits', async () => {
  const f = fixture(); await f.adjustChildStars({ auth, data: { ...adjustment, amount: 100, type: 'deduction' } });
  assert.equal(f.docs.get('families/f/childProfiles/c').starBalance, 0);
  assert.equal(f.docs.get('families/f/starTransactions/adjust-op').deltaStars, -30);
  await assert.rejects(f.adjustChildStars({ auth, data: { ...adjustment, amount: -10 } }), { code: 'invalid-argument' });
});
test('reward requests use server prices and approvals deduct exactly once', async () => {
  const f = fixture(); await f.requestChildRedemption({ auth, data: { ...redemption(f), starCost: 1 } });
  assert.equal(f.docs.get('families/f/redemptions/red').starCost, 20);
  const review = { familyId: 'f', redemptionId: 'red', status: 'approved' };
  await Promise.all([f.reviewChildRedemption({ auth, data: review }), f.reviewChildRedemption({ auth, data: review })]);
  assert.equal(f.docs.get('families/f/childProfiles/c').starBalance, 10);
  assert.equal(f.docs.get('families/f/childProfiles/c').totalStarsRedeemed, 20);
  assert.equal(f.docs.get('families/f/starTransactions/redemption-red').deltaStars, -20);
  await assert.rejects(f.reviewChildRedemption({ auth, data: { ...review, status: 'declined' } }), { code: 'failed-precondition' });
});
test('concurrent approvals of separate pending requests cannot overspend a child balance', async () => {
  const f = fixture(); await f.requestChildRedemption({ auth, data: redemption(f, 'one') }); await f.requestChildRedemption({ auth, data: redemption(f, 'two') });
  const results = await Promise.allSettled(['one', 'two'].map((redemptionId) => f.reviewChildRedemption({ auth, data: { familyId: 'f', redemptionId, status: 'approved' } })));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(f.docs.get('families/f/childProfiles/c').starBalance, 10);
});
test('PIN-reset revocation, expired and sibling sessions cannot request rewards', async () => {
  for (const kind of ['revoked', 'expired', 'sibling']) {
    const f = fixture(); const session = [...f.docs].find(([path]) => path.includes('/childSessions/'))[1];
    if (kind === 'revoked') f.docs.get('families/f/childProfiles/c').sessionsRevokedAt = { toMillis: () => Date.now() };
    if (kind === 'expired') session.expiresAt = { toMillis: () => 0 };
    if (kind === 'sibling') session.childProfileId = 'other';
    await assert.rejects(f.requestChildRedemption({ auth, data: redemption(f) }), { code: 'unauthenticated' });
    assert.equal(f.docs.has('families/f/redemptions/red'), false);
  }
});
test('nonmembers and deleted families cannot mutate stars or request rewards', async () => {
  const f = fixture(); await assert.rejects(f.adjustChildStars({ auth: { uid: 'other' }, data: adjustment }), { code: 'permission-denied' });
  f.docs.get('families/f').isDeleted = true;
  await assert.rejects(f.requestChildRedemption({ auth, data: redemption(f) }), { code: 'permission-denied' });
  assert.equal(f.docs.get('families/f/childProfiles/c').starBalance, 30);
});
