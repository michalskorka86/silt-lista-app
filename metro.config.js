// Metro: domyślna konfiguracja Expo + obsługa expo-sqlite w przeglądarce (podgląd ekranów na komputerze).
// Na tablecie (Android) te dodatki nic nie zmieniają.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite w przeglądarce działa na WebAssembly
config.resolver.assetExts.push('wasm');

// …i wymaga nagłówków COOP/COEP (SharedArrayBuffer) w serwerze deweloperskim
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = config;
