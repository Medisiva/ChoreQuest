const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function fixture(failFlush = false) {
  const instances = []; const events = []; const module = { exports: {} };
  const firestore = {
    getFirestore: () => { const db = { id: instances.length }; instances.push(db); return db; },
    waitForPendingWrites: async db => { events.push(['flush', db.id]); if (failFlush) throw new Error('offline'); },
    terminate: async db => { events.push(['terminate', db.id]); },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/firebase.ts'), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {
    module, exports: module.exports, process: {env:{}}, __DEV__: false, setTimeout, clearTimeout,
    require: name => {
      if (name === 'firebase/app') return {getApps:()=>[], initializeApp:()=>({})};
      if (name === './platformAuth') return {initializePlatformAuth:()=>({})};
      if (name === 'firebase/auth') return {};
      if (name === 'react-native') return {Platform:{OS:'web'}};
      if (name === 'firebase/firestore') return firestore;
      if (name === 'firebase/storage') return {getStorage:()=>({})};
      if (name === 'firebase/functions') return {getFunctions:()=>({})};
      throw new Error(name);
    },
  });
  return {service:module.exports, instances, events};
}
test('identity reset flushes pending writes before terminating and exports the new instance', async () => {
  const f=fixture(); const original=f.service.db;
  await f.service.restartFirestoreForIdentityChange();
  assert.deepEqual(f.events,[['flush',0],['terminate',0]]);
  assert.notEqual(f.service.db,original); assert.equal(f.service.db,f.instances[1]);
});
test('an unsuccessful flush leaves the database instance and pending writes intact', async () => {
  const f=fixture(true);const original=f.service.db;
  await assert.rejects(f.service.restartFirestoreForIdentityChange(),/offline/);
  assert.equal(f.service.db,original);assert.deepEqual(f.events,[['flush',0]]);assert.equal(f.instances.length,1);
});
