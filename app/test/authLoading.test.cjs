const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
function fixture(){
 let state, authCallback;const profiles=[];const module={exports:{}};
 const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/stores/authStore.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(source,{module,exports:module.exports,setTimeout:()=>1,clearTimeout:()=>{},require:name=>{
  if(name==='zustand')return{create:factory=>{state=factory(patch=>{state={...state,...patch};});return{getState:()=>state}}};
  if(name==='firebase/auth')return{onAuthStateChanged:(_auth,cb)=>{authCallback=cb;return()=>{}}};
  if(name==='firebase/firestore')return{doc:(_db,...p)=>p.join('/'),onSnapshot:(ref,options,next,error)=>{assert.equal(options.includeMetadataChanges,true);profiles.push({ref,next,error});return()=>{}}};
  if(name==='../services/firebase')return{auth:{},db:{}};throw Error(name);
 }});
 module.exports.useAuthStore.getState().initialize();
 return{state:()=>state,profiles,signIn:async uid=>authCallback({uid,getIdTokenResult:async()=>({claims:{}})})};
}
test('empty local cache does not send a returning parent into setup before server confirmation',async()=>{
 const f=fixture();await f.signIn('parent');
 f.profiles[0].next({exists:()=>false,metadata:{fromCache:true}});
 assert.equal(f.state().loading,true);assert.equal(f.state().error,null);
 f.profiles[0].next({exists:()=>true,metadata:{fromCache:false},data:()=>({familyAccountId:'saved-family'})});
 assert.equal(f.state().familyId,'saved-family');assert.equal(f.state().loading,false);
});
test('profile read failure is an error rather than confirmed missing family',async()=>{
 const f=fixture();await f.signIn('parent');f.profiles[0].error(new Error('Permission denied'));
 assert.equal(f.state().loading,false);assert.match(f.state().error,/Failed to load/);
});
test('late errors from an old account cannot overwrite the next account state',async()=>{
 const f=fixture();await f.signIn('first');const old=f.profiles[0];await f.signIn('second');
 f.profiles[1].next({exists:()=>true,metadata:{fromCache:false},data:()=>({familyAccountId:'second-family'})});
 old.error(new Error('Old failure'));assert.equal(f.state().familyId,'second-family');assert.equal(f.state().error,null);
});
