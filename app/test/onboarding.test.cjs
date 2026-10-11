const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const transpile = (file) => ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function fixture() {
  const calls = [], storage = new Map(), user = { uid: "test-parent", displayName: "Alex Test" };
  const load = (file) => {
    const module = { exports: {} };
    vm.runInNewContext(transpile(file), { module, exports: module.exports, console, setTimeout, clearTimeout, Intl, require: (name) => {
      if (name === 'react' || name === 'react/jsx-runtime' || name === 'react-hook-form') return require(name);
      if (name === 'react-native') return { ...Object.fromEntries(['View','Text','TextInput','TouchableOpacity','ScrollView','KeyboardAvoidingView','ActivityIndicator'].map(n => [n,n])), Platform: { OS: 'android' }, StyleSheet: { create: x => x }, Alert: { alert: (title, message) => calls.push({ alert: title, message }) } };
      if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
      if (name === 'expo-router') return { useRouter: () => ({ replace: route => calls.push({ route }) }) };
      if(name==='@/services/errorMessage')return{errorMessage:e=>e.message};
      if (name === '@/services/dialogs') return { default: { alert: (title, message) => calls.push({ alert: title, message }) } };
      if (name === '@/services/families') return { setupFamily: async payload => calls.push({ payload }) };
      if (name === '@/stores/authStore') return { useAuthStore: () => ({ user }) };
      if (name === '@/components/shared/PlaygroundHero') return { default: () => null };
      if (name === '@/components/shared/AvatarPicker') return { default: ({ onSelect }) => React.createElement('AvatarPicker', { onSelect }) };
      if (name === '@/constants/tokens') return load('../src/constants/tokens.ts');
      if (name === '@/services/onboardingDraft') return load('../src/services/onboardingDraft.ts');
      if (name === '@react-native-async-storage/async-storage') return { default: { getItem: async key => storage.get(key) ?? null, setItem: async (key,value) => storage.set(key,value), removeItem: async key => storage.delete(key) } };
      throw new Error(name);
    } }); return module.exports;
  };
  return { Screen: load('../app/(onboarding)/index.tsx').default, calls, storage, user };
}
const text = node => typeof node === 'string' ? node : node.children.map(text).join('');
async function press(renderer, label) { const button = renderer.root.findAllByType('TouchableOpacity').find(n => text(n) === label); assert.ok(button, label); await act(async () => button.props.onPress()); }
async function fill(renderer, placeholder, value) { await act(async () => renderer.root.findByProps({ placeholder }).props.onChangeText(value)); }
async function enterChild(renderer) {
  await fill(renderer,'The Smiths','Regression Family'); await press(renderer,'Next');
  await fill(renderer,'e.g. Alex','Regression child');
  await act(async () => renderer.root.findByType('AvatarPicker').props.onSelect('avatar-01'));
  await fill(renderer,'Enter PIN','1234'); await fill(renderer,'Confirm PIN','1234');
  await press(renderer,'Next');
}
test('wizard retains child, family and both reward groups across step unmounts and saves once', async () => {
  const f=fixture(); let renderer;
  try {
    await act(async () => { renderer=create(React.createElement(f.Screen)); });
    await enterChild(renderer);
    await press(renderer,'Next'); await press(renderer,'Post this Quest');
    await press(renderer,'Next'); await press(renderer,'Next'); await press(renderer,'Next');
    await press(renderer,'Go to Dashboard');
    const payload=f.calls.find(x => x.payload)?.payload;
    assert.ok(payload); assert.equal(payload.familyName,'Regression Family');
    assert.equal(payload.child.nickname,'Regression child'); assert.equal(payload.child.pin,'1234');
    assert.equal(payload.childRewards.length,2); assert.equal(payload.parentRewards.length,2);
    assert.equal(f.calls.filter(x=>x.payload).length,1); assert.equal(f.storage.size,0);
  } finally { if(renderer)await act(async()=>renderer.unmount()); }
});
test('unfinished setup survives remount for the same account without persisting PINs', async () => {
  const f=fixture(); let renderer;
  try {
    await act(async()=>{renderer=create(React.createElement(f.Screen));});
    await enterChild(renderer);
    const serialized=[...f.storage.values()][0];assert.ok(serialized);
    assert.equal(serialized.includes('childPin'),false);assert.equal(serialized.includes('1234'),false);
    await act(async()=>renderer.unmount());
    await act(async()=>{renderer=create(React.createElement(f.Screen));});
    assert.equal(renderer.root.findByProps({placeholder:'e.g. Alex'}).props.value,'Regression child');
    assert.equal(renderer.root.findByProps({placeholder:'Enter PIN'}).props.value,'');
    await press(renderer,'Back');
    assert.equal(renderer.root.findByProps({placeholder:'The Smiths'}).props.value,'Regression Family');
  } finally {if(renderer)await act(async()=>renderer.unmount());}
});
test('changing accounts does not restore or write another parent’s setup',async()=>{
 const f=fixture();let renderer;
 try{
  await act(async()=>{renderer=create(React.createElement(f.Screen));});await enterChild(renderer);
  f.user.uid='different-parent';await act(async()=>renderer.update(React.createElement(f.Screen)));
  assert.equal(renderer.root.findByProps({placeholder:'The Smiths'}).props.value,'');
  const draft=JSON.parse(f.storage.get('chorequest:onboarding:v1:different-parent'));
  assert.equal(draft.values.childNickname,'');assert.equal(draft.values.familyName,'');
 }finally{if(renderer)await act(async()=>renderer.unmount());}
});

test('target step rejects oversized and inconsistent targets before continuing',async()=>{
 const f=fixture();let r;try{
  await act(async()=>{r=create(React.createElement(f.Screen));});await enterChild(r);
  const inputs=()=>r.root.findAllByType('TextInput').filter(n=>n.props.keyboardType==='number-pad');
  await act(async()=>inputs()[0].props.onChangeText('99999'));await press(r,'Next');assert.equal(f.calls.at(-1).alert,'Invalid');assert.equal(inputs()[0].props.value,'99999');
  await act(async()=>inputs()[0].props.onChangeText('20'));await act(async()=>inputs()[1].props.onChangeText('10'));await press(r,'Next');assert.equal(f.calls.at(-1).alert,'Invalid');assert.equal(inputs()[1].props.value,'10');assert.equal(f.calls.filter(v=>v.payload).length,0);
 }finally{if(r)await act(async()=>r.unmount());}
});
