/**
 * Naprawa „zawieszonego” ekranu powitalnego (SILT LISTA zostaje na wierzchu, a aplikacja pod nim działa).
 *
 * Android 12–13: expo-splash-screen animuje zniknięcie ekranu powitalnego (SplashScreenView). Gdy aplikacja
 * zostanie w tym momencie zatrzymana (start tabletu w trybie kiosku, ekran blokady, przycisk Home),
 * animacja się nie kończy i widok zostaje na wierzchu na zawsze — dotyk przechodzi pod spód.
 * Przy każdym powrocie aplikacji na ekran usuwamy taki pozostawiony widok.
 */
const { withMainActivity } = require('expo/config-plugins');

const ZNACZNIK = '// silt: naprawa ekranu powitalnego';

const KOD = `
  ${ZNACZNIK}
  override fun onResume() {
    super.onResume()
    window.decorView.postDelayed({ usunZawieszonySplash() }, 1500)
  }

  private fun usunZawieszonySplash() {
    if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.S) return
    val decor = window.decorView as? android.view.ViewGroup ?: return
    for (i in decor.childCount - 1 downTo 0) {
      val v = decor.getChildAt(i)
      if (v is android.window.SplashScreenView) runCatching { v.remove() }
    }
  }
`;

module.exports = function splashNaprawa(config) {
  return withMainActivity(config, (c) => {
    let src = c.modResults.contents;
    if (!src.includes(ZNACZNIK)) {
      const koniec = src.lastIndexOf('}');
      src = src.slice(0, koniec) + KOD + src.slice(koniec);
    }
    c.modResults.contents = src;
    return c;
  });
};
