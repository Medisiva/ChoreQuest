const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm');
function fixture({ uid = 'p', authTime = Date.now() / 1000, failStorage = false } = {}) {
  const docs = new Map([['families/f', { memberIds: ['p'], isDeleted: false }], ['families/f/parentUsers/p', {}], ['parentProfiles/p', { familyAccountId: 'f' }], ['families/f/childProfiles/c', { nickname: 'Kid', pinHash: 'secret', lockedUntil: 'lock', failedPinAttempts: 2 }]]);
  const deletedAuth = []; let storageCalls = 0;
  const timestamp = (date) => ({ toMillis: () => date.getTime(), toDate: () => date });
  const ref = (path) => ({ path, id: path.split('/').at(-1), collection: (name) => collection(`${path}/${name}`), get: async () => snapshot(path), delete: async () => docs.delete(path) });
  const snapshot = (path) => ({ exists: docs.has(path), id: path.split('/').at(-1), ref: ref(path), data: () => docs.get(path) });
  const collection = (path, filters = []) => ({ doc: (id) => ref(`${path}/${id}`), where: (...filter) => collection(path, [...filters, filter]), limit: () => collection(path, filters), get: async () => ({ docs: [...docs].filter(([key, value]) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/') && filters.every(([field, operator, wanted]) => operator === '==' ? value[field] === wanted : value[field]?.toMillis() <= wanted.toMillis())).map(([key]) => snapshot(key)) }) });
  const db = { doc: ref, collection, runTransaction: async (callback) => {
    const writes = []; const result = await callback({ get: async (ref) => snapshot(ref.path), update: (ref, value) => writes.push([ref.path, { ...docs.get(ref.path), ...value }]), create: (ref, value) => writes.push([ref.path, value]) });
    writes.forEach(([path, value]) => docs.set(path, value)); return result;
  }, recursiveDelete: async (ref) => { for (const path of docs.keys()) if (path === ref.path || path.startsWith(`${ref.path}/`)) docs.delete(path); } };
  const admin = { firestore: Object.assign(() => db, { Timestamp: { now: () => timestamp(new Date()), fromMillis: (ms) => timestamp(new Date(ms)) } }), auth: () => ({ verifyIdToken: async () => ({ uid, auth_time: authTime }), deleteUser: async (user) => deletedAuth.push(user) }), storage: () => ({ bucket: () => ({ deleteFiles: async ({ prefix }) => { assert.equal(prefix, 'families/f/'); storageCalls++; if (failStorage) throw new Error('Storage unavailable'); } }) }) };
  const load = (file) => {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve(file), 'utf8'), { module, exports: module.exports, Date, require: (name) => {
      if (name === 'firebase-functions/v2/https') return { onRequest: (handler) => handler };
      if (name === 'firebase-functions/v2/scheduler') return { onSchedule: (_schedule, handler) => handler };
      if (name === 'firebase-functions') return { logger: { error() {}, info() {} } };
      if (name === 'firebase-admin') return admin;
      throw new Error(name);
    } }); return module.exports;
  };
  return { docs, deletedAuth, get storageCalls() { return storageCalls; }, ...load('../lib/http/exportFamilyData'), ...load('../lib/http/deleteFamilyAccount'), ...load('../lib/scheduled/purgeDeletedFamilies') };
}
const request = (body = { familyId: 'f', confirmText: 'DELETE' }) => ({ method: 'POST', headers: { authorization: 'Bearer test' }, body });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, set() {} });

test('export includes settings and excludes PIN credentials and session records', async () => {
  const f = fixture(); f.docs.set('families/f/settings/config', { leaderboardEnabled: true });
  f.docs.set('families/f/childSessions/hash', { token: 'secret' });
  const res = response(); await f.exportFamilyData(request(), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.data.settings.length, 1);
  assert.equal(res.body.data.childProfiles[0].nickname, 'Kid');
  assert.equal(res.body.data.childProfiles[0].pinHash, undefined);
  assert.equal(res.body.data.childProfiles[0].lockedUntil, undefined);
  assert.equal(res.body.data.childSessions, undefined);
});
test('export and deletion reject another family and malformed paths', async () => {
  const f = fixture({ uid: 'other' });
  for (const handler of [f.exportFamilyData, f.deleteFamilyAccount]) {
    const res = response(); await handler(request(), res); assert.equal(res.statusCode, 403);
    const invalid = response(); await handler(request({ familyId: 'f/child', confirmText: 'DELETE' }), invalid); assert.equal(invalid.statusCode, 400);
  }
  assert.equal(f.docs.get('families/f').isDeleted, false);
});
test('deletion requires recent authentication and family ownership', async () => {
  const old = fixture({ authTime: Date.now() / 1000 - 600 }); const res = response();
  await old.deleteFamilyAccount(request(), res); assert.equal(res.statusCode, 401);
  const f = fixture({ uid: 'q' }); f.docs.set('families/f/parentUsers/q', {});
  const denied = response(); await f.deleteFamilyAccount(request(), denied); assert.equal(denied.statusCode, 403);
});
test('deletion queues once, blocks access immediately and purges all persisted family data', async () => {
  const f = fixture(); const first = response(); await f.deleteFamilyAccount(request(), first);
  const retry = response(); await f.deleteFamilyAccount(request(), retry);
  assert.equal(first.statusCode, 200); assert.equal(retry.body.purgeAfter, first.body.purgeAfter);
  assert.equal(f.docs.get('families/f').isDeleted, true);
  assert.equal(f.deletedAuth.length, 0);
  f.docs.get('familyDeletionQueue/f').purgeAfter = { toMillis: () => 0 };
  await f.purgeDeletedFamilies(); await f.purgeDeletedFamilies();
  assert.equal(f.docs.size, 0); assert.deepEqual(f.deletedAuth, ['p']); assert.equal(f.storageCalls, 1);
});
test('storage cleanup failure retains the retry marker and all family data', async () => {
  const f = fixture({ failStorage: true }); await f.deleteFamilyAccount(request(), response());
  f.docs.get('familyDeletionQueue/f').purgeAfter = { toMillis: () => 0 };
  await assert.rejects(f.purgeDeletedFamilies(), /Storage unavailable/);
  assert.ok(f.docs.has('familyDeletionQueue/f')); assert.ok(f.docs.has('families/f/childProfiles/c'));
  assert.equal(f.deletedAuth.length, 0);
});
