const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
for (const [file, exported, subscribe, collections] of [
 ['taskStore','useTaskStore','subscribeToTasks',['tasks','claims']],
 ['requestStore','useRequestStore','subscribeToRequests',['requests']],
 ['rewardStore','useRewardStore','subscribeToRewards',['childRewards','parentRewards','redemptions']],
]) {
 test(`${file}: an old account's queued callbacks cannot overwrite a newly selected family`, () => {
  const listeners=[];const module={exports:{}};
  const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/stores',file+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,console,require:name=>{
   if(name==='zustand')return require(name);
   if(name==='../services/firebase')return{db:{}};
   if(name==='firebase/firestore')return{collection:(_, ...parts)=>parts.join('/'),query:ref=>ref,where:()=>({}),orderBy:()=>({}),onSnapshot:(ref,next,error)=>{listeners.push({next,error});return()=>{};}};
   return require(name);
  }});
  const store=module.exports[exported];const stop=store.getState()[subscribe]('old');
  listeners[0].next({docs:[{id:'old-document',data:()=>({title:'Previous family'})}]});stop();
  const next=store.getState()[subscribe]('new');
  try {
   for(const listener of listeners.slice(0,collections.length)){listener.next({docs:[{id:'late-document',data:()=>({title:'Stale family'})}]});listener.error(new Error('Late denial during sign-out'));}
   for(const key of collections)assert.equal(store.getState()[key].length,0);
   assert.equal(store.getState().error,null);
  }finally{next();}
 });
}
