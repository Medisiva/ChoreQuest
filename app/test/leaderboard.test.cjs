const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm'); const ts = require('typescript');
const moduleFixture = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/utils/leaderboard.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: moduleFixture, exports: moduleFixture.exports, Intl, Date });
const { periodKey, earnedInPeriod } = moduleFixture.exports;
test('weekly scores use Monday in family timezone across year and UTC boundaries', () => {
  assert.equal(periodKey(new Date('2026-01-01T01:00:00Z'), 'America/Los_Angeles', 'weekly'), '2025-12-29');
  assert.equal(periodKey(new Date('2026-10-05T00:30:00Z'), 'America/Los_Angeles', 'weekly'), '2026-09-28');
  assert.equal(periodKey(new Date('2026-10-05T00:30:00Z'), 'UTC', 'weekly'), '2026-10-05');
});
test('monthly earnings exclude redemptions, deductions, other months and future awards', () => {
  const record = (deltaStars, date) => ({ deltaStars, createdAt: { toDate: () => new Date(date) } });
  const records = [record(5, '2026-10-01T00:30:00Z'), record(7, '2026-10-01T08:00:00Z'), record(-3, '2026-10-01T08:00:00Z'), record(100, '2026-10-03T08:00:00Z')];
  assert.equal(earnedInPeriod(records, 'America/Los_Angeles', 'monthly', new Date('2026-10-02T12:00:00Z')), 7);
});
