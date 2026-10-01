const test = require('node:test'); const assert = require('node:assert/strict');
const { fixture } = require('./transactionFixture.cjs'); const auth = { uid: 'p' };
const input = (f, operationId = 'req') => ({ familyId: 'f', childId: 'c', operationId, sessionToken: f.token, title: 'Read with me', category: 'Learning', suggestedStars: 5 });
const action = (status, fields = {}) => ({ familyId: 'f', requestId: 'req', status, ...fields });
test('simultaneous requests cannot exceed the server weekly quota and retries count once', async () => {
  const f = fixture(); f.docs.set('families/f/settings/config', { weeklyRequestLimitPerChild: { c: 1 } });
  const results = await Promise.allSettled(['one', 'two'].map((id) => f.createFamilyRequest({ auth, data: input(f, id) })));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const winning = results.find((result) => result.status === 'fulfilled').value.requestId;
  await f.createFamilyRequest({ auth, data: input(f, winning) });
  assert.equal((await f.getChildRequestCount({ auth, data: input(f) })).count, 1);
});
test('requests follow accept, parent completion and child confirmation; acceptance price is immutable', async () => {
  const f = fixture(); await f.createFamilyRequest({ auth, data: input(f) });
  await assert.rejects(f.updateFamilyRequest({ auth, data: action('confirmed', { sessionToken: f.token }) }), { code: 'failed-precondition' });
  await f.updateFamilyRequest({ auth, data: action('accepted', { agreedStars: 7, parentId: 'forged' }) });
  assert.equal(f.docs.get('families/f/familyRequests/req').acceptedByParentId, 'p');
  await assert.rejects(f.updateFamilyRequest({ auth, data: action('accepted', { agreedStars: 100 }) }), { code: 'failed-precondition' });
  await f.updateFamilyRequest({ auth, data: action('completed') });
  await assert.rejects(f.updateFamilyRequest({ auth, data: action('confirmed', { sessionToken: '' }) }), { code: 'unauthenticated' });
  await f.updateFamilyRequest({ auth, data: action('confirmed', { sessionToken: f.token }) });
  await f.updateFamilyRequest({ auth, data: action('confirmed', { sessionToken: f.token }) });
  assert.equal(f.docs.get('families/f/familyRequests/req').status, 'confirmed');
});
test('expired sessions, negative prices, blank declines and invalid snoozes are denied', async () => {
  const f = fixture();
  await assert.rejects(f.createFamilyRequest({ auth, data: { ...input(f), sessionToken: '' } }), { code: 'unauthenticated' });
  await assert.rejects(f.createFamilyRequest({ auth, data: { ...input(f), suggestedStars: -1 } }), { code: 'invalid-argument' });
  await f.createFamilyRequest({ auth, data: input(f) });
  await assert.rejects(f.updateFamilyRequest({ auth, data: action('declined', { reason: '' }) }), { code: 'invalid-argument' });
  await assert.rejects(f.updateFamilyRequest({ auth, data: action('snoozed', { snoozeDays: -1 }) }), { code: 'invalid-argument' });
  assert.equal(f.docs.get('families/f/familyRequests/req').status, 'pending');
});
test('only the accepting parent can mark a request completed and sibling sessions cannot confirm', async () => {
  const f = fixture(); await f.createFamilyRequest({ auth, data: input(f) });
  await f.updateFamilyRequest({ auth, data: action('accepted', { agreedStars: 5 }) });
  f.docs.set('families/f/parentUsers/q', {});
  await assert.rejects(f.updateFamilyRequest({ auth: { uid: 'q' }, data: action('completed') }), { code: 'permission-denied' });
  await f.updateFamilyRequest({ auth, data: action('completed') });
  [...f.docs].find(([path]) => path.includes('/childSessions/'))[1].childProfileId = 'sibling';
  await assert.rejects(f.updateFamilyRequest({ auth, data: action('confirmed', { sessionToken: f.token }) }), { code: 'unauthenticated' });
});
