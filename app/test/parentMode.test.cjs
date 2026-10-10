const test = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs'); const vm = require('node:vm'); const path = require('node:path'); const ts = require('typescript');
function transpile(file) { return ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText; }
function fixture({readDenied=false,flushDenied=false}={}) {
  let state; const storeModule = { exports: {} };
  vm.runInNewContext(transpile('../src/stores/childSessionStore.ts'), { module: storeModule, exports: storeModule.exports, Date, setTimeout, clearTimeout, require: (name) => {
    if (name === 'zustand') return { create: (factory) => { state = factory((patch) => { state = { ...state, ...patch }; }, () => state); return { getState: () => state }; } };
    if (name === 'react-native') return { AppState: { addEventListener: () => ({ remove() {} }) } };
    throw new Error(name);
  } });
  const identityEvents = [];
  const firebase = { restartFirestoreForIdentityChange: async () => {identityEvents.push('flush-and-restart-db');if(flushDenied)throw new Error('Pending writes could not finish');}, auth: { currentUser: { uid: 'parent', email: 'parent@example.com' } } };
  const authModule = { exports: {} };
  vm.runInNewContext(transpile('../src/services/auth.ts'), { module: authModule, exports: authModule.exports, require: (name) => {
    if (name === 'firebase/firestore') return { disableNetwork: async () => {identityEvents.push("network-off");}, enableNetwork: async () => {identityEvents.push("network-on");}, doc:()=>({}),getDocFromServer:async()=>{identityEvents.push('server-auth-check');if(readDenied)throw Object.assign(new Error('Family read denied'),{code:'permission-denied'});return{exists:()=>true};} };
    if (name === './familySubscriptions') return { stopFamilySubscriptions() {identityEvents.push("stop-subscriptions");} };
    if (name === './firebase') return firebase;
    if (name === '../stores/childSessionStore') return storeModule.exports;
    if (name === 'firebase/auth') return { signOut: async () => { identityEvents.push('sign-out'); firebase.auth.currentUser = null; }, signInWithCustomToken: async () => { identityEvents.push('child-sign-in'); assert.equal(firebase.auth.currentUser, null); firebase.auth.currentUser = { uid: 'child-c', email: null, getIdToken: async () => {identityEvents.push('force-token-refresh');},getIdTokenResult:async()=>({claims:{role:'child',familyId:'f'}}) }; return {user:firebase.auth.currentUser}; }, signInWithEmailAndPassword: async (_auth, email, password) => { if (password !== 'correct') throw Object.assign(new Error('Wrong password'), { code: 'auth/invalid-credential' }); firebase.auth.currentUser = { uid: 'parent', email }; }, EmailAuthProvider: { credential: (_email, password) => ({ password }) }, reauthenticateWithCredential: async (_user, credential) => { if (credential.password !== 'correct') throw Object.assign(new Error('Wrong password'), { code: 'auth/invalid-credential' }); } };
    throw new Error(name);
  } });
  return { store: storeModule.exports.useChildSessionStore, auth: authModule.exports, firebase, identityEvents };
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

test('a child can replace its child identity after another PIN without exposing parent privilege',async()=>{
 const f=fixture();f.store.getState().unlockParent();await f.auth.enterChildMode('c','session','custom-token');f.store.getState().endSession();
 await f.auth.enterChildMode('c2','new-session','new-custom-token');assert.equal(f.firebase.auth.currentUser.email,null);assert.equal(f.store.getState().activeChildId,'c2');assert.equal(f.store.getState().parentLocked,true);await assert.rejects(f.auth.unlockParentMode('wrong'));
});

test('identity replacement stops old listeners and resets the database before child sign-in',async()=>{
 const f=fixture();await f.auth.enterChildMode('c','session','custom-token');assert.deepEqual(f.identityEvents,['stop-subscriptions','flush-and-restart-db','sign-out','child-sign-in','force-token-refresh','server-auth-check']);
});

test('a denied server family read does not start a child session or unlock adult access',async()=>{
 const f=fixture({readDenied:true});await assert.rejects(f.auth.enterChildMode('c','session','custom-token'),/Family read denied/);assert.equal(f.store.getState().activeChildId,null);assert.equal(f.store.getState().parentLocked,true);assert.equal(f.store.getState().switching,false);assert.equal(f.firebase.auth.currentUser,null);
});

 test('a failed pending-write flush preserves the original identity and refuses the switch',async()=>{
 const f=fixture({flushDenied:true});await assert.rejects(f.auth.enterChildMode('c','session','custom-token'),/Pending writes/);assert.equal(f.firebase.auth.currentUser.uid,'parent');assert.equal(f.store.getState().activeChildId,null);assert.equal(f.store.getState().switching,false);assert.deepEqual(f.identityEvents,['stop-subscriptions','flush-and-restart-db']);
 });
