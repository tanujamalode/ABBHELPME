// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web build imports a .wasm file. The web preview uses the in-memory
// repository, but the module still has to bundle.
config.resolver.assetExts.push('wasm');

module.exports = config;
