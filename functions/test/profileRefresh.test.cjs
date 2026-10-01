const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm');
test('profile refresh ignores retries, out-of-order events and deleted families', async () => {
  const family = { isDeleted: false }; let updates = 0;
  const timestamp = (date) => ({ toMillis: () => date.getTime() });
  const db = { doc: (path) => ({ path }), runTransaction: async (callback) => callback({
    get: async () => ({ exists: true, data: () => family }),
    update: (_ref, data) => { Object.assign(family, data); updates++; },
  }) };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/triggers/onProfileChanged'), 'utf8'), { module, exports: module.exports, Date, require: (name) => {
    if (name === 'firebase-functions/v2/firestore') return { onDocumentWritten: (_path, callback) => callback };
    if (name === 'firebase-admin/firestore') return { Timestamp: { fromDate: timestamp } };
    if (name === 'firebase-admin') return { firestore: Object.assign(() => db, { Timestamp: { fromDate: timestamp } }) };
    throw new Error(name);
  } });
  const event = (time) => ({ params: { familyId: 'f' }, time });
  await module.exports.onChildProfileChanged(event('2026-10-01T00:00:00Z'));
  await module.exports.onChildProfileChanged(event('2026-10-01T00:00:00Z'));
  await module.exports.onParentProfileChanged(event('2026-09-30T00:00:00Z'));
  assert.equal(updates, 1);
  await module.exports.onParentProfileChanged(event('2026-10-02T00:00:00Z'));
  assert.equal(updates, 2);
  family.isDeleted = true;
  await module.exports.onChildProfileChanged(event('2026-10-03T00:00:00Z'));
  assert.equal(updates, 2);
});
