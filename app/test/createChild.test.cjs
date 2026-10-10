const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');const React=require('react');const {act,create}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
function fixture({family={id:'f'},failure=null,wait=null}={}){
 const calls=[];const module={exports:{}};const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../app/(parent)/children/create.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{module,exports:module.exports,console:{error(){}},require:name=>{
  if(['react','react/jsx-runtime','react-hook-form'].includes(name))return require(name);
  if(name==='react-native')return{...Object.fromEntries(['View','Text','TextInput','TouchableOpacity','ScrollView','ActivityIndicator','KeyboardAvoidingView'].map(n=>[n,n])),StyleSheet:{create:x=>x},Platform:{OS:'web'}};
  if(name==='react-native-safe-area-context')return{SafeAreaView:'SafeAreaView'};
  if(name==='expo-router')return{useRouter:()=>({replace:route=>calls.push({route}),back(){}})};
  if(name==='@/stores/familyStore')return{useFamilyStore:()=>({family})};
  if(name==='@/services/families')return{addChildProfile:async(familyId,data)=>{calls.push({familyId,data});if(wait)await wait;if(failure)throw failure;return'new-child';}};
  if(name==='@/components/shared/AvatarPicker')return{default:()=>null};throw Error(name);
 }});return{Screen:module.exports.default,calls};
}
const content=n=>typeof n==='string'?n:n.children.map(content).join('');
const fill=async(r,p,value)=>act(async()=>r.root.findByProps({placeholder:p}).props.onChangeText(value));
async function enter(r){await fill(r,'What do they like to be called?',' Second child ');await fill(r,'Enter 4-digit PIN','1234');await fill(r,'Re-enter 4-digit PIN','1234');}
const button=r=>r.root.findAllByType('TouchableOpacity').find(n=>content(n)==='Create Profile');
test('add another child saves the real form and returns to profiles on web without an Alert callback',async()=>{const f=fixture();let r;try{await act(async()=>{r=create(React.createElement(f.Screen));});await enter(r);await act(async()=>button(r).props.onPress());assert.equal(f.calls[0].familyId,'f');assert.equal(f.calls[0].data.nickname,'Second child');assert.equal(f.calls[0].data.ageGroup,'6-8');assert.equal(f.calls[1].route,'/profiles');}finally{if(r)await act(async()=>r.unmount());}});
test('save errors appear on-screen and preserve form values; no false navigation',async()=>{const f=fixture({failure:Object.assign(new Error('Denied'),{code:'functions/permission-denied'})});let r;try{await act(async()=>{r=create(React.createElement(f.Screen));});await enter(r);await act(async()=>button(r).props.onPress());assert.ok(r.root.findByProps({accessibilityRole:'alert'}).children.join('').includes('parent account'));assert.equal(r.root.findByProps({placeholder:'What do they like to be called?'}).props.value,' Second child ');assert.equal(f.calls.filter(c=>c.route).length,0);}finally{if(r)await act(async()=>r.unmount());}});
test('PIN mismatch and missing family cannot submit',async()=>{for(const options of [{},{family:null}]){const f=fixture(options);let r;try{await act(async()=>{r=create(React.createElement(f.Screen));});await enter(r);if(options.family!==null)await fill(r,'Re-enter 4-digit PIN','9999');await act(async()=>button(r).props.onPress());assert.equal(f.calls.length,0);}finally{if(r)await act(async()=>r.unmount());}}});
