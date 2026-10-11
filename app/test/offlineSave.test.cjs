const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function network(state,platform='android'){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/services/network.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,require:name=>name==='react-native'?{Platform:{OS:platform}}:{default:{fetch:async()=>state}}});return module.exports.requireOnline;}
test('offline saves reject disconnected and unreachable networks with an actionable message',async()=>{
 for(const state of [{isConnected:false,isInternetReachable:null},{isConnected:true,isInternetReachable:false}])await assert.rejects(network(state)(),/offline.*Reconnect/);
 await network({isConnected:true,isInternetReachable:true})();
 await network({isConnected:null,isInternetReachable:null})();
});

test('browser reachability probe failure does not falsely block a connected browser',async()=>{await network({isConnected:true,isInternetReachable:false},'web')();await assert.rejects(network({isConnected:false,isInternetReachable:false},'web')(),/offline/);});
