const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm');
function fixture() {
  const documents = new Map(); let next = 0; let revision = 0;
  const ref = (path) => ({ path, id: path.split('/').at(-1), collection: (name) => ({ doc: (id = `id${++next}`) => ref(`${path}/${name}/${id}`) }), get: async () => snapshot(ref(path)) });
  const snapshot = (ref) => ({ exists: documents.has(ref.path), ref, data: () => documents.get(ref.path) });
  const db = { doc: ref, collection: (path) => ({ doc: (id = `id${++next}`) => ref(`${path}/${id}`) }), runTransaction: async (callback) => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const observed = revision; const writes = [];
      const result = await callback({ get: async (ref) => { assert.equal(writes.length, 0); return snapshot(ref); }, create: (ref, data) => writes.push([ref.path, data, false]), update: (ref, data) => writes.push([ref.path, data, true]) });
      if (observed !== revision) continue;
      for (const [path, , update] of writes) if (!update) assert.equal(documents.has(path), false, 'Create must not overwrite');
      for (const [path, data, update] of writes) documents.set(path, update ? { ...documents.get(path), ...data } : data);
      if (writes.length) revision++;
      return result;
    }
    throw new Error('Retry limit');
  } };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/http/setupFamily'), 'utf8'), { module, exports: module.exports, Intl, require: (name) => {
    if (name === 'firebase-functions/v2/https') return { onCall: (callback) => callback, HttpsError };
    if (name === 'firebase-admin') return { firestore: Object.assign(() => db, { FieldValue: { serverTimestamp: () => 'server-time' } }) };
    if (name === 'bcrypt') return require('bcrypt');
    throw new Error(name);
  } });
  return { ...module.exports, documents };
}
const auth = { uid: 'p', token: { name: 'Parent' } };
const child = { nickname: 'Kid', avatarId: 'avatar-01', ageGroup: '6-8', pin: '1234' };
const data = { familyName: 'Team', timezone: 'America/New_York', child, task: { title: 'Tidy', category: 'Household', starValue: 5 }, childRewards: [{ name: 'Movie', starCost: 20 }] };

test('bootstrap persists canonical config, mapping and bcrypt PIN without plaintext', async () => {
  const f = fixture(); const result = await f.setupFamily({ auth, data });
  assert.equal(f.documents.get('parentProfiles/p').familyAccountId, result.familyId);
  assert.ok(f.documents.has(`families/${result.familyId}/settings/config`));
  const profile = [...f.documents].find(([path]) => path.includes('/childProfiles/'))[1];
  assert.equal(profile.pin, undefined); assert.match(profile.pinHash, /^\$2b\$12\$/);
  assert.equal(await require('bcrypt').compare('1234', profile.pinHash), true);
  assert.ok(f.documents.has(`leaderboard/${result.familyId}`));
});
test('concurrent bootstrap and retries retain one family', async () => {
  const f = fixture(); const minimal = { familyName: 'Team', timezone: 'UTC' };
  const results = await Promise.all([f.setupFamily({ auth, data: minimal }), f.setupFamily({ auth, data: minimal })]);
  const retry = await f.setupFamily({ auth, data: minimal });
  assert.equal(results[0].familyId, results[1].familyId); assert.equal(retry.familyId, results[0].familyId);
  assert.equal([...f.documents.keys()].filter((path) => /^families\/[^/]+$/.test(path)).length, 1);
});
test('invalid setup and anonymous callers write nothing', async () => {
  const f = fixture();
  await assert.rejects(f.setupFamily({ data }), { code: 'unauthenticated' });
  for (const invalid of [{ ...data, timezone: 'Bad/Zone' }, { ...data, child: { ...child, pin: '12' } }, { ...data, task: { ...data.task, starValue: -5 } }]) {
    await assert.rejects(f.setupFamily({ auth, data: invalid }), { code: 'invalid-argument' });
  }
  assert.equal(f.documents.size, 0);
});
test('child creation rejects another family and deleted families', async () => {
  const f = fixture();
  await assert.rejects(f.createChildProfile({ auth, data: { familyId: 'other', ...child } }), { code: 'permission-denied' });
  f.documents.set('families/f/parentUsers/p', { firebaseUid: 'p' });
  f.documents.set('families/f', { isDeleted: true });
  await assert.rejects(f.createChildProfile({ auth, data: { familyId: 'f', ...child } }), { code: 'permission-denied' });
  assert.equal([...f.documents.keys()].filter((path) => path.includes('/childProfiles/')).length, 0);
});

test('parent PIN reset replaces demo hashes, clears lockouts and records session revocation', async () => {
  const f = fixture();
  f.documents.set('families/f', { isDeleted: false });
  f.documents.set('families/f/parentUsers/p', { firebaseUid: 'p' });
  f.documents.set('families/f/childProfiles/c', { pinHash: 'demo', failedPinAttempts: 3, lockedUntil: 'locked', starBalance: 10 });
  await f.resetChildPin({ auth, data: { familyId: 'f', childId: 'c', pin: '5678' } });
  const profile = f.documents.get('families/f/childProfiles/c');
  assert.equal(await require('bcrypt').compare('5678', profile.pinHash), true);
  assert.equal(profile.failedPinAttempts, 0); assert.equal(profile.lockedUntil, null);
  assert.equal(profile.sessionsRevokedAt, 'server-time'); assert.equal(profile.starBalance, 10);
  await assert.rejects(f.resetChildPin({ auth: { uid: 'other' }, data: { familyId: 'f', childId: 'c', pin: '1234' } }), { code: 'permission-denied' });
});
