const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
const {create,act}=require('react-test-renderer');const {create:store}=require('zustand');global.IS_REACT_ACT_ENVIRONMENT=true;
const native={...Object.fromEntries(['View','Text','TextInput','TouchableOpacity','ActivityIndicator','KeyboardAvoidingView','ScrollView'].map(n=>[n,n])),StyleSheet:{create:v=>v},Platform:{OS:'web'}};
const content=n=>typeof n==='string'?n:n.children.map(content).join('');
function fixture(screen){
 let finish;const pending=new Promise(resolve=>finish=resolve),child=store(()=>({switching:false,isSessionValid:()=>false,setupBackgroundListener:()=>()=>{}}));
 const authState={user:null,role:null,familyId:null,parentProfile:null,loading:false,error:null,initialize:()=>()=>{}};
 const router={replace(){},push(){}};let Screen;
 function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module,exports:module.exports,console,require:name=>{
  if(['react','react/jsx-runtime','react-hook-form'].includes(name))return require(name);
  if(name==='expo-status-bar')return {StatusBar:()=>null};
  if(name==='react-native')return native;
  if(name==='react-native-safe-area-context')return{SafeAreaView:'SafeAreaView',SafeAreaProvider:'SafeAreaProvider'};
  if(name==='expo-router')return{router,useRouter:()=>router,useSegments:()=>['(auth)',screen],Slot:()=>React.createElement(Screen)};
  if(name==='@/stores/authStore')return{useAuthStore:()=>authState};
  if(name==='@/stores/childSessionStore')return{useChildSessionStore:child};
  if(name.startsWith('@/stores/'))return{[name.split('/').at(-1).replace(/^(\w)/,c=>'use'+c.toUpperCase())]:{getState:()=>({})}};
  if(name==='@/services/firebase')return{initializeFirebase:async()=>{}};
  if(name==='@/services/familySubscriptions')return{registerFamilySubscriptions:()=>()=>{}};
  if(name==='@/hooks/useDeviceRequestAlerts')return{useDeviceRequestAlerts(){}};
  if(name==='@/hooks/useNetworkStatus')return{useNetworkStatus:()=>({isOnline:true})};
  if(name.startsWith('@expo-google-fonts/'))return{useFonts:()=>[true]};
  if(name.startsWith('@/components/'))return{default:()=>null};
  if(name==='@/services/auth')return{[screen==='register'?'signUp':'signIn']:async()=>{child.setState({switching:true});await pending;child.setState({switching:false});return{success:false,message:screen==='register'?'An account with this email already exists.':'Invalid email or password.'};}};
  throw new Error(name);
 }});return module.exports.default;}
 Screen=load(`../app/(auth)/${screen}.tsx`);return{Root:load('../app/_layout.tsx'),finish,child};
}
for(const screen of ['login','register'])test(`${screen}: real root keeps inputs mounted through identity replacement and displays the returned failure`,async()=>{
 const f=fixture(screen);let r;
 try{await act(async()=>{r=create(React.createElement(f.Root));});const find=p=>r.root.findByProps({placeholder:p});
 await act(async()=>{find('you@example.com').props.onChangeText('parent@example.test');
  if(screen==='login')find('Enter your password').props.onChangeText('Test-only-invalid-password');
  else{find('Your parent name').props.onChangeText('Alex Test');find('Min. 8 characters').props.onChangeText('Test-only-invalid-password');find('Re-enter your password').props.onChangeText('Test-only-invalid-password');}
 });
 const originalInput=find('you@example.com');await act(async()=>{const button=r.root.findAllByType('TouchableOpacity').find(n=>content(n)===(screen==='login'?'Sign In':'Create Account'));assert.ok(button);void button.props.onPress();});
 assert.equal(f.child.getState().switching,true);assert.equal(find('you@example.com'),originalInput);assert.equal(find('you@example.com').props.value,'parent@example.test');
 await act(async()=>f.finish());assert.equal(find('you@example.com').props.value,'parent@example.test');assert.ok(r.root.findAllByType('Text').some(n=>content(n).includes(screen==='login'?'Invalid email or password':'already exists')));
 }finally{if(r)await act(async()=>r.unmount());}
});
