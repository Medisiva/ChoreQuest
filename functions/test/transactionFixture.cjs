const assert = require('node:assert/strict'); const fs = require('node:fs'); const vm = require('node:vm'); const crypto = require('node:crypto');
function fixture() {
  const token = 'a'.repeat(64); const hash = crypto.createHash('sha256').update(token).digest('hex');
  const timestamp = (ms) => ({ toMillis: () => ms });
  const docs = new Map([
    ['families/f', { isDeleted: false }], ['families/f/parentUsers/p', {}],
    ['families/f/childProfiles/c', { starBalance: 30, totalStarsEarned: 30, totalStarsRedeemed: 0 }],
    ['families/f/rewards/r', { isActive: true, starCost: 20, name: 'Movie' }],
    [`families/f/childSessions/${hash}`, { childProfileId: 'c', parentUid: 'p', createdAt: timestamp(Date.now() - 1000), expiresAt: timestamp(Date.now() + 100000) }],
  ]); let revision = 0;
  const deleted = Symbol('deleted');
  const collection = (path, filters = []) => ({ path, filters, where: (...filter) => collection(path, [...filters, filter]), limit: () => collection(path, filters) });
  const db = { collection, doc: (path) => ({ path, id: path.split('/').at(-1) }), runTransaction: async (callback) => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const observed = revision; const writes = [];
      const result = await callback({ get: async (ref) => { assert.equal(writes.length, 0, 'Reads precede writes'); if (ref.filters) { const matches = [...docs].filter(([path, data]) => path.startsWith(ref.path + '/') && ref.filters.every(([field, operator, value]) => operator === 'in' ? value.includes(data[field]) : data[field] === value)); return { empty: matches.length === 0 }; } return { ref, exists: docs.has(ref.path), data: () => ({ ...docs.get(ref.path) }) }; }, update: (ref, data) => writes.push([ref.path, data, true]), create: (ref, data) => writes.push([ref.path, data, false]) });
      if (revision !== observed) continue;
      for (const [path, data, merge] of writes) { if (!merge) assert.equal(docs.has(path), false); const updated = merge ? { ...docs.get(path), ...data } : { ...data }; for (const key of Object.keys(updated)) if (updated[key] === deleted) delete updated[key]; docs.set(path, updated); }
      if (writes.length) revision++; return result;
    }
    throw new Error('Retry limit');
  } };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  let authorization;
  function load(file) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(require.resolve(file), 'utf8'), { module, exports: module.exports, Date, URL, process: { env: {} }, require: (name) => {
      if (name === 'firebase-functions/v2/https') return { onCall: (callback) => callback, HttpsError };
      if (name === 'firebase-admin') return { storage: () => ({ bucket: () => ({ name: 'test-bucket', file: () => ({ exists: async () => [true] }) }) }), firestore: Object.assign(() => db, { Timestamp: { fromMillis: (ms) => ({ toMillis: () => ms }) }, FieldValue: { serverTimestamp: () => 'server-time', delete: () => deleted } }) };
      if (name === '../utils/recurrence') return require('../lib/utils/recurrence');
      if (name === '../utils/authorization') return authorization;
      if (name === 'crypto') return crypto;
      throw new Error(name);
    } }); return module.exports;
  }
  authorization = load('../lib/utils/authorization');
  return { docs, token, ...load('../lib/http/manageStars'), ...load('../lib/http/manageQuests'), ...load('../lib/http/manageRequests') };
}
module.exports = { fixture };
