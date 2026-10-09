// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite on web runs SQLite compiled to WebAssembly (.wasm).
config.resolver.assetExts.push('wasm');

// Drizzle migrations are .sql files bundled into the app as code.
config.resolver.sourceExts.push('sql');

// SQLite on web needs SharedArrayBuffer, which browsers only allow when the
// page is "cross-origin isolated" via these two headers.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

module.exports = config;
