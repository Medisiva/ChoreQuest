const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// Expo 55's client-side virtual env module reads .env files independently of
// EXPO_NO_DOTENV. Keep live preview on its explicit EAS configuration without
// changing ignored local emulator settings or normal development behavior.
if (process.env.CHOREQUEST_LIVE_PREVIEW === '1') {
  const previous = config.resolver.blockList;
  config.resolver.blockList = [
    ...(Array.isArray(previous) ? previous : previous ? [previous] : []),
    /[/\\]\.env(?:\.[^/\\]*)?$/,
  ];
}

module.exports = config;
