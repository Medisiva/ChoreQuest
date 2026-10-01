const test = require('node:test'); const assert = require('node:assert/strict');
const { fixture } = require('./transactionFixture.cjs');
const auth = { uid: 'p' };
function questFixture() { const f = fixture(); f.docs.set('families/f/tasks/t', { title: 'Tidy', isActive: true, starValue: 5 }); return f; }
const claim = (f, operationId = 'claim') => ({ familyId: 'f', childId: 'c', taskId: 't', operationId, sessionToken: f.token });
const update = (f, status) => ({ familyId: 'f', childId: 'c', claimId: 'claim', sessionToken: f.token, status });

test('simultaneous quest claims serialize on task and child locks', async () => {
  const f = questFixture(); const results = await Promise.allSettled(['one', 'two'].map((id) => f.claimChildQuest({ auth, data: claim(f, id) })));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const winner = f.docs.get('families/f/tasks/t').activeClaimId;
  assert.equal(f.docs.get('families/f/childProfiles/c').activeQuestId, winner);
  await f.claimChildQuest({ auth, data: claim(f, winner) });
  assert.equal([...f.docs.keys()].filter((path) => path.includes('/taskClaims/')).length, 1);
});
test('release clears locks and permits a fresh claim', async () => {
  const f = questFixture(); await f.claimChildQuest({ auth, data: claim(f) });
  await f.updateChildQuest({ auth, data: update(f, 'released') });
  assert.equal(f.docs.get('families/f/tasks/t').activeClaimId, undefined);
  assert.equal(f.docs.get('families/f/childProfiles/c').activeQuestId, undefined);
  await f.claimChildQuest({ auth, data: claim(f, 'new') });
});
test('submitted quests cannot release, rejected quests can resubmit, reviews persist feedback', async () => {
  const f = questFixture(); await f.claimChildQuest({ auth, data: claim(f) });
  await f.updateChildQuest({ auth, data: update(f, 'submitted') });
  await assert.rejects(f.updateChildQuest({ auth, data: update(f, 'released') }), { code: 'failed-precondition' });
  await f.reviewChildQuests({ auth, data: { familyId: 'f', claimIds: ['claim'], decision: 'rejected', reason: 'Check the floor' } });
  assert.equal(f.docs.get('families/f/taskClaims/claim').rejectionReason, 'Check the floor');
  await f.updateChildQuest({ auth, data: update(f, 'submitted') });
  await f.reviewChildQuests({ auth, data: { familyId: 'f', claimIds: ['claim'], decision: 'approved' } });
  await assert.rejects(f.updateChildQuest({ auth, data: update(f, 'submitted') }), { code: 'failed-precondition' });
});
test('batch reviews make no partial changes when a claim has changed', async () => {
  const f = questFixture(); f.docs.set('families/f/taskClaims/a', { status: 'submitted' }); f.docs.set('families/f/taskClaims/b', { status: 'claimed' });
  await assert.rejects(f.reviewChildQuests({ auth, data: { familyId: 'f', claimIds: ['a', 'b'], decision: 'approved' } }), { code: 'failed-precondition' });
  assert.equal(f.docs.get('families/f/taskClaims/a').status, 'submitted');
});
test('missing PIN sessions and another child cannot change a quest', async () => {
  const f = questFixture(); await assert.rejects(f.claimChildQuest({ auth, data: { ...claim(f), sessionToken: '' } }), { code: 'unauthenticated' });
  await f.claimChildQuest({ auth, data: claim(f) }); f.docs.get('families/f/taskClaims/claim').childProfileId = 'other';
  await assert.rejects(f.updateChildQuest({ auth, data: update(f, 'released') }), { code: 'permission-denied' });
});
test('milestone claims start at step one and photo-required quests refuse empty proof', async () => {
  const f = questFixture(); Object.assign(f.docs.get('families/f/tasks/t'), { isMilestone: true, requiresPhoto: true });
  await f.claimChildQuest({ auth, data: claim(f) });
  assert.equal(f.docs.get('families/f/taskClaims/claim').currentMilestoneStep, 1);
  await assert.rejects(f.updateChildQuest({ auth, data: update(f, 'submitted') }), { code: 'invalid-argument' });
});

test('photo proof must use the current claim storage object', async () => {
  const f = questFixture(); f.docs.get('families/f/tasks/t').requiresPhoto = true;
  await f.claimChildQuest({ auth, data: claim(f) });
  await assert.rejects(f.updateChildQuest({ auth, data: { ...update(f, 'submitted'), photoProofUrl: 'https://example.com/fake.jpg' } }), { code: 'invalid-argument' });
  const path = encodeURIComponent('families/f/taskProofs/claim/proof.jpg');
  await f.updateChildQuest({ auth, data: { ...update(f, 'submitted'), photoProofUrl: `https://firebasestorage.googleapis.com/v0/b/test-bucket/o/${path}?alt=media&token=test` } });
  assert.equal(f.docs.get('families/f/taskClaims/claim').status, 'submitted');
});
