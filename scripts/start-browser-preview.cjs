const { spawn } = require('child_process');
const { mkdirSync } = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const config = require(path.join(root, 'app/eas.json')).build.preview.env;
for (const dir of ['work/metro-tmp', 'work/expo-cache']) {
  mkdirSync(path.join(root, dir), { recursive: true });
}

// Use the APK's public Firebase configuration instead of local emulator settings.
const child = spawn(process.execPath, [
  require.resolve('expo/bin/cli'),
  'start', '--web', '--localhost', '--port', '8081',
], {
  cwd: path.join(root, 'app'),
  env: {
    ...process.env,
    ...config,
    EXPO_NO_DOTENV: '1',
    EXPO_OFFLINE: '1',
    CI: '1',
    TMPDIR: path.join(root, 'work/metro-tmp'),
    __UNSAFE_EXPO_HOME_DIRECTORY: path.join(root, 'work/expo-cache'),
  },
  stdio: 'inherit',
});
child.on('exit', code => process.exit(code ?? 1));
