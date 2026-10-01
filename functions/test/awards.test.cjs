const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture(trigger, initial) {
  const documents = new Map([['families/f', { isDeleted: false }], ...Object.entries(initial)]);
  const deleted = Symbol('delete');
  let writes = 0;
  const snapshot = (ref) => ({ exists: documents.has(ref.path), data: () => documents.get(ref.path) });
  const database = {
    doc: (documentPath) => ({ path: documentPath }),
    runTransaction: async (callback) => {
      const pending = [];
      let hasWritten = false;
      await callback({
        get: async (ref) => { assert.equal(hasWritten, false, 'Firestore requires reads before writes'); return snapshot(ref); },
        update: (ref, data) => { hasWritten = true; pending.push(() => {
          assert.ok(documents.has(ref.path), `Missing update document: ${ref.path}`);
          const next = { ...documents.get(ref.path), ...data };
          for (const [key, value] of Object.entries(next)) if (value === deleted) delete next[key];
          documents.set(ref.path, next); writes++;
        }); },
        set: (ref, data) => { hasWritten = true; pending.push(() => { documents.set(ref.path, data); writes++; }); },
      });
      pending.forEach((commit) => commit());
    },
  };
  const firestore = Object.assign(() => database, { FieldValue: { serverTimestamp: () => 'timestamp', delete: () => deleted } });
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../lib/triggers/${trigger}.js`), 'utf8'), {
    exports: module.exports, module,
    require: (name) => {
      if (name === 'firebase-functions/v2/firestore') return { onDocumentUpdated: (_pattern, handler) => handler };
      if (name === 'firebase-functions') return { logger: { info() {}, error() {}, warn() {} } };
      if (name === 'firebase-admin') return { firestore };
      return require(name);
    },
  });
  return { handler: module.exports[trigger], documents, writeCount: () => writes };
}
function event(before, after, params) {
  return { params, data: { before: { data: () => before }, after: { data: () => after } } };
}
const childPath = 'families/f/childProfiles/c';
const taskPath = 'families/f/tasks/t';
const claimPath = 'families/f/taskClaims/q';
function taskFixture(task = {}) {
  return fixture('onTaskClaimApproved', {
    [childPath]: { starBalance: 10, totalStarsEarned: 20 },
    [taskPath]: { title: 'Make bed', starValue: 5, isMilestone: false, activeClaimId: 'q', ...task },
    [claimPath]: { status: 'approved' },
  });
}
const claimEvent = (step) => event({ status: 'submitted' }, { status: 'approved', taskId: 't', childProfileId: 'c', ...(step !== undefined ? { currentMilestoneStep: step } : {}) }, { familyId: 'f', claimId: 'q' });

test('retrying task approval credits once and releases the task lock', async () => {
  const f = taskFixture(); await f.handler(claimEvent()); await f.handler(claimEvent());
  assert.equal(f.documents.get(childPath).starBalance, 15);
  assert.equal(f.documents.get(childPath).totalStarsEarned, 25);
  assert.equal(f.documents.get(taskPath).activeClaimId, undefined);
  assert.equal(f.documents.get(taskPath).isActive, false);
  assert.equal(f.documents.get('families/f/starTransactions/claim-q-step-0').deltaStars, 5);
});
test('milestone awards each approved step once and adds the bonus only on the final step', async () => {
  const f = taskFixture({ isMilestone: true, milestoneSteps: 2, starsPerStep: 3, milestoneBonus: 7 });
  await f.handler(claimEvent(1)); await f.handler(claimEvent(1));
  assert.equal(f.documents.get(childPath).starBalance, 13);
  assert.equal(f.documents.get(claimPath).status, 'claimed');
  assert.equal(f.documents.get(taskPath).activeClaimId, 'q');
  await f.handler(claimEvent(2)); await f.handler(claimEvent(2));
  assert.equal(f.documents.get(childPath).starBalance, 23);
  assert.equal(f.documents.get(taskPath).activeClaimId, undefined);
});
test('invalid milestone progress awards nothing', async () => {
  const f = taskFixture({ isMilestone: true, milestoneSteps: 2, starsPerStep: 3 });
  await assert.rejects(f.handler(claimEvent(3)), /Invalid milestone progress/);
  assert.equal(f.writeCount(), 0);
});
test('negative task awards cannot alter a balance', async () => {
  const f = taskFixture({ starValue: -10 });
  await assert.rejects(f.handler(claimEvent()), /Invalid star award/);
  assert.equal(f.writeCount(), 0);
});
test('confirming a family request uses the app schema and credits parent once on retry', async () => {
  const parentPath = 'families/f/parentUsers/p';
  const f = fixture('onRequestConfirmed', { [parentPath]: { starBalance: 2, totalStarsEarned: 4 } });
  const e = event({ status: 'completed' }, { status: 'confirmed', acceptedByParentId: 'p', agreedStars: 6, title: 'Park' }, { familyId: 'f', requestId: 'r' });
  await f.handler(e); await f.handler(e);
  assert.equal(f.documents.get(parentPath).starBalance, 8);
  const ledger = f.documents.get('families/f/parentStarTransactions/request-r');
  assert.equal(ledger.parentUserId, 'p'); assert.equal(ledger.source, 'requestCompletion'); assert.equal(ledger.familyRequestId, 'r');
});
test('requests with invalid rewards or parent IDs perform no writes', async () => {
  for (const data of [{ acceptedByParentId: 'p', agreedStars: -1 }, { acceptedByParentId: '../p', agreedStars: 3 }, { parentUid: 'p', agreedStars: 3 }]) {
    const f = fixture('onRequestConfirmed', {});
    await f.handler(event({ status: 'completed' }, { status: 'confirmed', ...data }, { familyId: 'f', requestId: 'r' }));
    assert.equal(f.writeCount(), 0);
  }
});

test('recurring source quests retain their completed lock until a fresh instance is generated', async () => {
  const f = taskFixture({ recurrenceType: 'daily', isActive: true });
  await f.handler(claimEvent());
  assert.equal(f.documents.get(taskPath).activeClaimId, 'q');
  assert.equal(f.documents.get(taskPath).isActive, true);
});

test('late approval events cannot recreate balances in a deleted family', async () => {
  const f = taskFixture(); f.documents.get('families/f').isDeleted = true;
  await f.handler(claimEvent()); assert.equal(f.writeCount(), 0);
});
