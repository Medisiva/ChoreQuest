const test = require('node:test'); const assert = require('node:assert/strict');
const { fixture } = require('./transactionFixture.cjs');
test('consequence clearing is idempotent and preserves the original evaluation', async () => {
  const f = fixture(); const path = 'families/f/activeConsequences/cons';
  f.docs.set(path, { childProfileId: 'c', name: 'Extra chore', level: 'Yellow' });
  const request = { auth: { uid: 'p' }, data: { familyId: 'f', consequenceId: 'cons', level: 'Red' } };
  await Promise.all([f.clearConsequence(request), f.clearConsequence(request)]);
  assert.equal(f.docs.get(path).level, 'Yellow'); assert.equal(f.docs.get(path).clearedByParentId, 'p');
});
test('anonymous, unrelated parents and deleted families cannot clear consequences', async () => {
  const f = fixture(); const data = { familyId: 'f', consequenceId: 'cons' };
  await assert.rejects(f.clearConsequence({ data }), { code: 'unauthenticated' });
  await assert.rejects(f.clearConsequence({ auth: { uid: 'other' }, data }), { code: 'permission-denied' });
  f.docs.set('families/f', { isDeleted: true });
  await assert.rejects(f.clearConsequence({ auth: { uid: 'p' }, data }), { code: 'permission-denied' });
});

test('restricted child principal cannot clear consequences even with a valid child session', async () => {
  const f = fixture();
  await assert.rejects(f.clearConsequence({ auth: { uid: 'child-c' }, data: { familyId: 'f', consequenceId: 'cons' } }), { code: 'permission-denied' });
});
