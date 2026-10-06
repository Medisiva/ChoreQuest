const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path'); const ts = require('typescript');
function transpile(file) { return ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText; }
function fixture() {
  let state; const storeModule = { exports: {} };
  vm.runInNewContext(transpile('../src/stores/childSessionStore.ts'), { module: storeModule, exports: storeModule.exports, Date, setTimeout, clearTimeout, require: (name) => {
    if (name === 'zustand') return { create: (factory) => { state = factory((patch) => { state = { ...state, ...patch }; }, () => state); return { getState: () => state }; } };
    if (name === 'react-native') return { AppState: { addEventListener: () => ({ remove() {} }) } };
    throw new Error(name);
  } });
  const firebase = { auth: { currentUser: { uid: 'parent', email: 'parent@example.com' } } };
  const authModule = { exports: {} };
  vm.runInNewContext(transpile('../src/services/auth.ts'), { module: authModule, exports: authModule.exports, require: (name) => {
    if (name === './firebase') return firebase;
    if (name === '../stores/childSessionStore') return storeModule.exports;
    if (name === 'firebase/auth') return { signOut: async () => { firebase.auth.currentUser = null; }, signInWithCustomToken: async () => { assert.equal(firebase.auth.currentUser, null); firebase.auth.currentUser = { uid: 'child-c', email: null }; }, signInWithEmailAndPassword: async (_auth, email, password) => { if (password !== 'correct') throw Object.assign(new Error('Wrong password'), { code: 'auth/invalid-credential' }); firebase.auth.currentUser = { uid: 'parent', email }; }, EmailAuthProvider: { credential: (_email, password) => ({ password }) }, reauthenticateWithCredential: async (_user, credential) => { if (credential.password !== 'correct') throw Object.assign(new Error('Wrong password'), { code: 'auth/invalid-credential' }); } };
    throw new Error(name);
  } });
  return { store: storeModule.exports.useChildSessionStore, auth: authModule.exports, firebase };
}
test('leaving child mode keeps parent access locked until password reauthentication succeeds', async () => {
  const f = fixture(); f.store.getState().unlockParent();
  f.store.getState().startSession('c', 'token'); assert.equal(f.store.getState().parentLocked, true);
  f.store.getState().endSession(); assert.equal(f.store.getState().parentLocked, true);
  await assert.rejects(f.auth.unlockParentMode('wrong'), /Invalid email or password/);
  assert.equal(f.store.getState().parentLocked, true);
  await f.auth.unlockParentMode('correct'); assert.equal(f.store.getState().parentLocked, false);
  assert.equal(f.store.getState().sessionToken, null);
});

test('child mode replaces parent Firebase identity and requires password to return', async () => {
  const f = fixture(); f.store.getState().unlockParent();
  await f.auth.enterChildMode('c', 'session', 'custom-token');
  assert.equal(f.firebase.auth.currentUser.uid, 'child-c');
  assert.equal(f.store.getState().parentLocked, true);
  assert.equal(f.store.getState().parentEmail, 'parent@example.com');
  assert.equal(f.store.getState().switching, false);
  await assert.rejects(f.auth.unlockParentMode('wrong'));
  assert.equal(f.firebase.auth.currentUser.uid, 'child-c');
  await f.auth.unlockParentMode('correct');
  assert.equal(f.firebase.auth.currentUser.uid, 'parent');
  assert.equal(f.store.getState().activeChildId, null);
});
