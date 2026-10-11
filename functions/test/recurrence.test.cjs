const test = require('node:test');
const assert = require('node:assert/strict');
const { getPeriodKey, localDate, buildRecurringInstance } = require('../lib/utils/recurrence');

test('daily recurrence follows family local dates rather than the UTC date', () => {
  const instant = new Date('2026-10-01T01:30:00Z');
  assert.equal(getPeriodKey('daily', instant, 'America/New_York'), '2026-09-30');
  assert.equal(getPeriodKey('daily', instant, 'Asia/Kolkata'), '2026-10-01');
});
test('weekly periods use Monday civil dates across year boundaries', () => {
  assert.equal(getPeriodKey('weekly', new Date('2027-01-01T12:00:00Z'), 'UTC'), '2026-12-28');
  assert.equal(getPeriodKey('weekly', new Date('2027-01-04T12:00:00Z'), 'UTC'), '2027-01-04');
});
test('monthly boundaries and DST use the family timezone', () => {
  assert.equal(getPeriodKey('monthly', new Date('2026-10-01T01:00:00Z'), 'America/New_York'), '2026-09');
  assert.equal(getPeriodKey('daily', new Date('2026-03-08T06:30:00Z'), 'America/New_York'), '2026-03-08');
  assert.equal(getPeriodKey('daily', new Date('2026-03-08T07:30:00Z'), 'America/New_York'), '2026-03-08');
  assert.equal(localDate(new Date('2026-10-04T12:00:00Z'), 'UTC').getUTCDay(), 0);
});
test('instances preserve app fields and cannot recursively generate or inherit old claims', () => {
  const instance = buildRecurringInstance({ title: 'Clean room', starValue: 5, category: 'Household', recurrenceType: 'daily', activeClaimId: 'old', deadline: 'old', isMilestone: true, milestoneSteps: 2, starsPerStep: 3, milestoneBonus: 4 }, 'f', 'template', '2026-10-01');
  assert.equal(instance.starValue, 5); assert.equal(instance.category, 'Household');
  assert.equal(instance.recurrenceType, 'none'); assert.equal(instance.sourceTaskId, 'template');
  assert.equal(instance.activeClaimId, undefined); assert.equal(instance.deadline, undefined);
  assert.equal(instance.milestoneBonus, 4); assert.equal(instance.familyAccountId, 'f');
});
test('invalid templates and invalid timezones fail instead of writing broken tasks', () => {
  assert.throws(() => buildRecurringInstance({ title: 'Clean', starsReward: 5 }, 'f', 't', 'period'), /starValue/);
  assert.throws(() => getPeriodKey('daily', new Date(), 'Not/AZone'), /time zone/i);
});

function schedulerFixture() {
  const fs = require('node:fs'); const vm = require('node:vm');
  const instances = new Map();
  const templates = [
    { id: 'template', ref:{update:async()=>{}}, data: () => ({ title: 'Clean room', category:'Household', starValue: 5, recurrenceType: 'daily', isActive: true, createdAt: { toDate: () => new Date('2020-01-01') } }) },
    { id: 'legacy', data: () => ({ title: 'Copy', starValue: 5, isInstance: true, recurrenceType: 'daily', isActive: true }) },
    { id: 'new', data: () => ({ title: 'New', starValue: 5, recurrenceType: 'daily', isActive: true, createdAt: { toDate: () => new Date() } }) },
  ];
  const tasks = { where: field => ({ where: () => ({ get: async () => ({ docs: field==='sourceTaskId' ? [] : templates }) }) }), doc: (id) => ({ id, get: async () => ({ exists: instances.has(id) }) }) };
  const db = {
    collection: (path) => path === 'families' ? { where: () => ({ get: async () => ({ docs: [{ id: 'f', data: () => ({ timezone: 'UTC' }) }] }) }) } : tasks,
    batch: () => { let pending; return { create: (ref, data) => { pending = [ref.id, data]; }, commit: async () => {
      if (instances.has(pending[0])) throw Object.assign(new Error('Already exists'), { code: 6 });
      instances.set(...pending);
    } }; },
  };
  const firestore = Object.assign(() => db, { FieldValue: { serverTimestamp: () => 'server-time' } });
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/scheduled/recurrenceGenerate'), 'utf8'), {
    module, exports: module.exports, Date, require: (name) => {
      if (name === 'firebase-functions/v2/scheduler') return { onSchedule: (_schedule, callback) => callback };
      if (name === 'firebase-functions') return { logger: { info() {}, error() {} } };
      if (name === 'firebase-admin/firestore') return firestore;
      if (name === 'firebase-admin') return { firestore };
      if (name === 'crypto') return require('node:crypto');
      if (name === '../utils/validation') return require('../lib/utils/validation');
      if (name === '../utils/recurrence') return require('../lib/utils/recurrence');
      throw new Error(name);
    },
  });
  return { run: module.exports.dailyRecurrenceGenerate, instances };
}

test('concurrent scheduled invocations and retries create one nonrecursive occurrence', async () => {
  const fixture = schedulerFixture();
  await Promise.all([fixture.run(), fixture.run()]);
  await fixture.run();
  assert.equal(fixture.instances.size, 1);
  const instance = [...fixture.instances.values()][0];
  assert.equal(instance.sourceTaskId, 'template');
  assert.equal(instance.recurrenceType, 'none');
  assert.equal(instance.starValue, 5);
});
