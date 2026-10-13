const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

function screen(mode, bottom, authorized = true) {
  const module = { exports: {} };
  const Tabs = Object.assign(props => React.createElement('Tabs', props, props.children), { Screen: 'TabScreen' });
  const child = { activeChildId: authorized ? 'test-child' : null, sessionExpiry: new Date(Date.now() + 60000), parentLocked: !authorized, endSession() {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(`../app/(${mode})/_layout.tsx`), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    module, exports: module.exports, Date, setTimeout: () => 1, clearTimeout() {},
    require: name => {
      if (['react', 'react/jsx-runtime'].includes(name)) return require(name);
      if (name === 'react-native') return { View: 'View', StyleSheet: { create: value => value } };
      if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, bottom, left: 0, right: 0 }) };
      if (name === 'expo-router') return { Tabs, Redirect: 'Redirect' };
      if (name === 'lucide-react-native') return {};
      if (name === '@/constants/tokens') return { colors: {}, layout: { tabBarHeight: 80 }, typography: { caption: {} } };
      if (name === '@/stores/childSessionStore') return { useChildSessionStore: selector => selector ? selector(child) : child };
      if (name === '@/stores/authStore') return { useAuthStore: selector => selector({ role: authorized ? 'parent' : 'child' }) };
      throw new Error(name);
    },
  });
  return module.exports.default;
}

test('parent and child tabs keep content height while clearing iPhone and iPad bottom insets', async () => {
  for (const mode of ['parent', 'child']) {
    for (const bottom of [0, 20, 34]) {
      let renderer;
      try {
        await act(async () => { renderer = create(React.createElement(screen(mode, bottom))); });
        const styles = renderer.root.findByType('Tabs').props.screenOptions.tabBarStyle;
        const style = Object.assign({}, ...styles);
        assert.ok(style.paddingBottom >= bottom, `${mode}: bottom inset ${bottom}`);
        assert.equal(style.height - style.paddingBottom, 64, 'usable tab content height stays constant');
      } finally { if (renderer) await act(async () => renderer.unmount()); }
    }
  }
});

test('safe-area changes preserve parent and child authorization redirects', async () => {
  for (const mode of ['parent', 'child']) {
    let renderer;
    try {
      await act(async () => { renderer = create(React.createElement(screen(mode, 34, false))); });
      assert.equal(renderer.root.findByType('Redirect').props.href, mode === 'parent' ? '/parent-unlock' : '/profiles');
    } finally { if (renderer) await act(async () => renderer.unmount()); }
  }
});
