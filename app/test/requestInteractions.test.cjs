const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const text=n=>typeof n==='string'?n:n.children.map(text).join('');
function fixture(screen,{fail=false,wait=null}={}){
 const calls=[],module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,`../app/(child)/requests/${screen}.tsx`),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,console,Date,require:name=>{
  if(['react','react/jsx-runtime'].includes(name))return require(name);
  if(name==='react-native')return{...Object.fromEntries(['View','Text','TextInput','TouchableOpacity','ScrollView','ActivityIndicator','KeyboardAvoidingView'].map(n=>[n,n])),StyleSheet:{create:x=>x},Platform:{OS:'web'}};
  if(name==='react-native-safe-area-context')return{SafeAreaView:'SafeAreaView'};
  if(name==='@shopify/flash-list')return{FlashList:({data,renderItem})=>React.createElement('List',null,data.map(item=>React.createElement(React.Fragment,{key:item.id},renderItem({item}))))};
  if(name==='expo-router')return{useRouter:()=>({replace:route=>calls.push({route}),back(){}})};
  if(name==='@/stores/familyStore')return{useFamilyStore:()=>({family:{id:'f'}})};
  if(name==='@/stores/childSessionStore')return{useChildSessionStore:()=>({activeChildId:'c'})};
  if(name==='@/stores/requestStore')return{useRequestStore:()=>({requests:[{id:'r',requestedByChildId:'c',title:'Read with me',category:'Learning',suggestedStars:5,agreedStars:5,status:'completed'}]})};
  if(name==='@/services/requests')return{getWeeklyRequestAllowance:async()=>({count:0,limit:3}),createRequest:async(familyId,data)=>{calls.push({send:true,familyId,data});if(wait)await wait;return'r';},confirmRequestComplete:async(familyId,id)=>{calls.push({confirm:true,familyId,id});if(wait)await wait;if(fail)throw new Error('Retry confirmation');},returnRequestIncomplete:async(familyId,id)=>{calls.push({returned:true,familyId,id});}};
  if(name==='@/services/dialogs')return{default:{alert:(title,message)=>calls.push({alert:title,message})}};
  if(name==='@/services/errorMessage')return{errorMessage:e=>e.message};
  if(name==='@/services/firebase')return{db:{}};
  if(name==='firebase/firestore')return{collection:()=>({}),doc:()=>({id:'intent-1'})};
  throw new Error(name);
 }});return{Screen:module.exports.default,calls};
}
const press=async(r,label)=>act(async()=>{const b=r.root.findAllByType('TouchableOpacity').find(n=>text(n)===label);assert.ok(b,label);b.props.onPress();});
test('request Yes and Not yet buttons invoke the proper child-session service',async()=>{
 for(const [label,key]of[['Yes!','confirm'],['Not yet','returned']]){const f=fixture('index');let r;try{await act(async()=>{r=create(React.createElement(f.Screen));});await press(r,label);assert.equal(f.calls.filter(v=>v[key]).length,1);assert.equal(f.calls[0].familyId,'f');assert.equal(f.calls[0].id,'r');}finally{if(r)await act(async()=>r.unmount());}}
});
test('confirmation failure appears on screen and duplicate pending taps only send once',async()=>{
 let done;const wait=new Promise(resolve=>done=resolve),f=fixture('index',{wait,fail:true});let r;
 try{await act(async()=>{r=create(React.createElement(f.Screen));});await act(async()=>{const b=r.root.findAllByType('TouchableOpacity').find(n=>text(n)==='Yes!');b.props.onPress();b.props.onPress();});assert.equal(f.calls.length,1);await act(async()=>done());assert.match(text(r.root.findByProps({accessibilityRole:'alert'})),/Retry confirmation/);}finally{if(r)await act(async()=>r.unmount());}
});
test('request wizard double submit preserves one intent and leaves the send screen immediately on success',async()=>{
 let done;const wait=new Promise(resolve=>done=resolve),f=fixture('create',{wait});let r;
 try{await act(async()=>{r=create(React.createElement(f.Screen));});await press(r,'📚Learning');await act(async()=>r.root.findByProps({placeholder:'e.g. Take me to the park'}).props.onChangeText('Read with me'));await press(r,'Next');await act(async()=>{const b=r.root.findAllByType('TouchableOpacity').find(n=>text(n)==='Send Request');b.props.onPress();b.props.onPress();});assert.equal(f.calls.filter(v=>v.send).length,1);assert.equal(f.calls.find(v=>v.send).data.operationId,'intent-1');await act(async()=>done());assert.equal(f.calls.find(v=>v.route).route,'/(child)/requests');}finally{if(r)await act(async()=>r.unmount());}
});
