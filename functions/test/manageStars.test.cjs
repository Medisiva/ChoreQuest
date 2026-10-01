const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm'); const crypto = require('node:crypto');
const { fixture } = require('./transactionFixture.cjs');

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
