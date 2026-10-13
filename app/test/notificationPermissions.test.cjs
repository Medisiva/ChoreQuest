const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(platform, initial, requested = initial) {
  const calls = [];
  const module = { exports: {} };
  const notifications = {
    IosAuthorizationStatus: { AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
    AndroidImportance: { HIGH: 4 },
    setNotificationHandler() {},
    setNotificationChannelAsync: async () => calls.push('channel'),
    getPermissionsAsync: async () => { calls.push('get'); return initial; },
    requestPermissionsAsync: async () => { calls.push('request'); return requested; },
    getExpoPushTokenAsync: async () => { calls.push('token'); return { data: 'test-token' }; },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/services/notifications.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, {
    module, exports: module.exports, console: { warn() {} }, Date,
    require: name => {
      if (name === 'expo-notifications') return notifications;
      if (name === 'react-native') return { Platform: { OS: platform } };
      if (name === 'expo-constants') return { easConfig: { projectId: 'test-project' } };
      if (name === 'firebase/firestore') return { doc: () => ({}), setDoc: async () => calls.push('save') };
      if (name === './firebase') return { db: {} };
      throw new Error(name);
    },
  });
  return { ...module.exports, calls };
}

test('iOS authorized, provisional and ephemeral permissions enable alerts without another prompt', async () => {
  for (const status of [2, 3, 4]) {
    const f = fixture('ios', { status: status === 2 ? 'granted' : 'undetermined', canAskAgain: true, ios: { status } });
    assert.equal(await f.requestDeviceAlertsPermission(), true);
    assert.deepEqual(f.calls, ['get']);
  }
});

test('iOS denial uses the native authorization status and does not re-prompt a permanent denial', async () => {
  const f = fixture('ios', { status: 'granted', canAskAgain: false, ios: { status: 1 } });
  assert.equal(await f.requestDeviceAlertsPermission(), false);
  assert.deepEqual(f.calls, ['get']);
});

test('first iOS request accepts provisional permission and keeps denial disabled', async () => {
  for (const status of [1, 2, 3]) {
    const f = fixture('ios', { status: 'undetermined', canAskAgain: true, ios: { status: 0 } },
      { status: 'undetermined', canAskAgain: false, ios: { status } });
    assert.equal(await f.requestDeviceAlertsPermission(), status !== 1);
    assert.deepEqual(f.calls, ['get', 'request']);
  }
});

test('Android creates its channel before requesting permission; web does not call native APIs', async () => {
  const android = fixture('android', { status: 'undetermined', canAskAgain: true }, { status: 'granted' });
  assert.equal(await android.requestDeviceAlertsPermission(), true);
  assert.deepEqual(android.calls, ['channel', 'get', 'request']);
  const web = fixture('web', {});
  assert.equal(await web.requestDeviceAlertsPermission(), false);
  assert.deepEqual(web.calls, []);
});

test('denied iOS push registration never obtains or writes a token', async () => {
  const f = fixture('ios', { status: 'denied', canAskAgain: false, ios: { status: 1 } });
  assert.equal(await f.registerForPushNotifications('test-family', 'test-user'), null);
  assert.deepEqual(f.calls, ['get']);
});

test('provisional iOS push registration reuses permission and writes its token', async () => {
  const f = fixture('ios', { status: 'undetermined', canAskAgain: true, ios: { status: 3 } });
  assert.equal(await f.registerForPushNotifications('test-family', 'test-user'), 'test-token');
  assert.deepEqual(f.calls, ['get', 'token', 'save']);
});
