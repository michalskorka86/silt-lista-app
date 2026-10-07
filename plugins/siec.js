/**
 * Sieć Androida (OkHttp) bez „martwych” połączeń.
 *
 * Gdy aplikacja jest długo otwarta, telefon / tablet zmienia sieć (Wi-Fi ↔ LTE, uśpienie) i stare
 * połączenie z serwerem po cichu umiera. Domyślnie OkHttp trzyma je w puli i wysyła nim kolejne
 * zapytania, które wiszą do limitu czasu → „Brak połączenia z serwerem”, aż do zamknięcia aplikacji.
 * Tu: krótka pula (20 s bezczynności), ping co 15 s (wykrywa martwe HTTP/2), ponawianie połączenia.
 */
const { withMainApplication } = require('expo/config-plugins');

const ZNACZNIK = '// silt: siec';

const KOD = `    ${ZNACZNIK}
    com.facebook.react.modules.network.OkHttpClientProvider.setOkHttpClientFactory {
      com.facebook.react.modules.network.OkHttpClientProvider.createClientBuilder()
        .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
        .connectionPool(okhttp3.ConnectionPool(5, 20, java.util.concurrent.TimeUnit.SECONDS))
        .pingInterval(15, java.util.concurrent.TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()
    }
`;

module.exports = function siec(config) {
  return withMainApplication(config, (c) => {
    let src = c.modResults.contents;
    if (!src.includes(ZNACZNIK)) {
      const i = src.indexOf('super.onCreate()');
      if (i < 0) throw new Error('plugins/siec.js: nie znaleziono super.onCreate() w MainApplication');
      const koniecLinii = src.indexOf('\n', i) + 1;
      src = src.slice(0, koniecLinii) + KOD + src.slice(koniecLinii);
    }
    c.modResults.contents = src;
    return c;
  });
};
