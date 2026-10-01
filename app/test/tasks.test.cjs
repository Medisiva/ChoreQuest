const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm'); const ts = require('typescript');
function fixture(valid = true) {
  const calls = []; const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/tasks.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: (name) => {
    if (name === './firebase') return { db: {}, functions: {} };
    if (name === './firestore') return {};
    if (name === 'firebase/firestore') return { doc: () => ({ id: 'operation' }), collection: () => ({}) };
    if (name === 'firebase/functions') return { httpsCallable: (_functions, name) => async (data) => { calls.push({ name, data }); return { data: { claimId: 'claim' } }; } };
    if (name === '../stores/childSessionStore') return { useChildSessionStore: { getState: () => ({ isSessionValid: () => valid, activeChildId: 'c', sessionToken: 'session' }) } };
    throw new Error(name);
  } }); return { calls, services: module.exports };
}
test('quest transport includes active child session and never sends a client balance write', async () => {
  const f = fixture(); assert.equal(await f.services.claimTask('f', 't', 'c'), 'claim');
  assert.equal(f.calls[0].name, 'claimChildQuest'); assert.equal(f.calls[0].data.sessionToken, 'session');
  assert.equal(f.calls[0].data.childId, 'c'); assert.equal(f.calls[0].data.operationId, 'operation');
});
test('expired sessions and mismatched child IDs fail before calling backend', async () => {
  const f = fixture(false); await assert.rejects(f.services.claimTask('f', 't', 'c'), /PIN/); assert.equal(f.calls.length, 0);
  const sibling = fixture(); await assert.rejects(sibling.services.claimTask('f', 't', 'other'), /PIN/); assert.equal(sibling.calls.length, 0);
});
