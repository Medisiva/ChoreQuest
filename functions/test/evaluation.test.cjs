const test = require('node:test'); const assert = require('node:assert/strict');
const { closedPeriod, evaluationOutcome } = require('../lib/utils/evaluation');
test('closed weeks use actual family midnight and adjust DST duration', () => {
  const period = closedPeriod('weekly', new Date('2026-03-09T12:00:00Z'), 'America/New_York');
  assert.equal(period.key, '2026-03-02');
  assert.equal(period.start.toISOString(), '2026-03-02T05:00:00.000Z');
  assert.equal(period.end.toISOString(), '2026-03-09T04:00:00.000Z');
  assert.equal(period.end - period.start, 167 * 3600000);
});
test('monthly evaluation waits for local month close and handles year rollover', () => {
  const period = closedPeriod('monthly', new Date('2026-01-01T01:00:00Z'), 'America/Los_Angeles');
  assert.equal(period.key, '2025-11');
  assert.equal(period.end.toISOString(), '2025-12-01T08:00:00.000Z');
  assert.equal(closedPeriod('monthly', new Date('2026-01-01T12:00:00Z'), 'America/Los_Angeles').key, '2025-12');
});
test('weekly outcomes honor configured bonuses and reset miss/streak counters', () => {
  const child = { weeklyTargetStars: 10, currentStreakWeeks: 2, consecutiveMissWeeks: 2, streakThreshold: 3, streakBonusStars: 7 };
  const met = evaluationOutcome(child, 'weekly', 10);
  assert.equal(met.bonus, 7); assert.equal(met.streak, 3); assert.equal(met.misses, 0);
  const missed = evaluationOutcome(child, 'weekly', 9);
  assert.equal(missed.streak, 0); assert.equal(missed.level, 'Red'); assert.equal(missed.bonus, 0);
});
test('zero targets disable evaluation and monthly outcomes preserve weekly streak', () => {
  assert.equal(evaluationOutcome({ weeklyTargetStars: 0 }, 'weekly', 5).enabled, false);
  const monthly = evaluationOutcome({ monthlyTargetStars: 20, currentStreakWeeks: 5, monthlyConsecutiveMisses: 1 }, 'monthly', 2);
  assert.equal(monthly.streak, 5); assert.equal(monthly.level, 'Orange'); assert.equal(monthly.bonus, 0);
});
test('scheduler retries leave one canonical log and one atomic streak award', async () => {
  const fs = require('node:fs'); const vm = require('node:vm');
  const records = new Map([
    ['families/f', { timezone: 'UTC', isDeleted: false }],
    ['families/f/childProfiles/c', { createdAt: { toMillis: () => 0 }, weeklyTargetStars: 10, currentStreakWeeks: 3, streakThreshold: 4, streakBonusStars: 5, starBalance: 2, totalStarsEarned: 20 }],
    ['families/f/starTransactions/task', { childProfileId: 'c', deltaStars: 10, transactionType: 'taskApproval' }],
  ]);
  const snapshot = (path) => ({ id: path.split('/').at(-1), ref: ref(path), exists: records.has(path), data: () => records.get(path) });
  function ref(path) { return { path, doc: (id) => ref(`${path}/${id}`), collection: (name) => ref(`${path}/${name}`), orderBy() { return this; }, limit() { return this; }, where() { return this; }, async get() { const docs = [...records.keys()].filter((key) => key.startsWith(`${path}/`) && key.slice(path.length + 1).split('/').length === 1).map(snapshot); return { docs, empty: !docs.length, size: docs.length }; } }; }
  let fail = true;
  const db = { collection: ref, async runTransaction(callback) {
    const pending = [];
    await callback({ get: (reference) => reference.path.split('/').length % 2 === 0 ? Promise.resolve(snapshot(reference.path)) : reference.get(), create: (reference, data) => pending.push(['create', reference.path, data]), update: (reference, data) => pending.push(['update', reference.path, data]) });
    if (fail) { fail = false; throw new Error('simulated commit failure'); }
    for (const [operation, path, data] of pending) { if (operation === 'create') assert.equal(records.has(path), false); records.set(path, operation === 'update' ? { ...records.get(path), ...data } : data); }
  } };
  const moduleFixture = { exports: {} };
  const timestamp = { fromDate: (date) => date, fromMillis: (millis) => new Date(millis) };
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../lib/scheduled/evaluateFamilies.js'), 'utf8'), { module: moduleFixture, exports: moduleFixture.exports, Date, require: (name) => name === 'firebase-admin' ? { firestore: () => db } : name === 'firebase-admin/firestore' ? { FieldPath: { documentId: () => 'id' }, Timestamp: timestamp } : require('../lib/utils/evaluation') });
  const run = () => moduleFixture.exports.evaluateFamilies('weekly', new Date('2026-10-05T12:00:00Z'));
  await assert.rejects(run(), /commit failure/);
  assert.equal(records.get('families/f/childProfiles/c').starBalance, 2);
  await run(); await run();
  assert.equal(records.get('families/f/childProfiles/c').starBalance, 7);
  assert.equal(records.get('families/f/childProfiles/c').totalStarsEarned, 25);
  assert.equal([...records.keys()].filter((key) => key.includes('/accountabilityLogs/')).length, 1);
  assert.equal([...records.keys()].filter((key) => key.includes('/starTransactions/streak-')).length, 1);
});
