// Launch against disposable Firebase emulators without requiring private .env files.
const path = require('node:path');
const { spawnSync } = require('node:child_process');

if (process.argv.includes('--help')) {
  console.log('Start Firebase emulators for demo-chorequest first. Then run npm run app:ios:simulator -- --device and choose an iOS Simulator. Requires Xcode, an iOS runtime and CocoaPods.');
  process.exit(0);
}

const appDirectory = path.resolve(__dirname, '../app');
const preview = require('../app/eas.json').build.preview.env;
const env = {
  ...process.env,
  ...preview,
  EXPO_NO_DOTENV: '1',
  EXPO_PUBLIC_ENV: 'development',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo-chorequest',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-chorequest.firebaseapp.com',
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-chorequest.appspot.com',
  EXPO_PUBLIC_USE_EMULATORS: 'true',
  EXPO_PUBLIC_EMULATOR_HOST: 'localhost',
};
const expoCli = path.join(path.dirname(require.resolve('expo/package.json')), 'bin/cli');
console.log('Building ChoreQuest for iOS with demo-chorequest emulators on localhost.');
const result = spawnSync(process.execPath, [expoCli, 'run:ios', ...process.argv.slice(2)], {
  cwd: appDirectory,
  env,
  stdio: 'inherit',
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
