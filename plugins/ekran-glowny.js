/**
 * Tryb kiosku: SILT Lista jako ekran główny tabletu.
 *
 * Kategoria HOME NIE może być na MainActivity — Android robi wtedy drugą kopię MainActivity
 * (osobne zadanie „ekranu głównego”), obie podpięte do tego samego JS, i nawigacja trafia
 * do niewidocznej kopii. Dlatego HOME dostaje malutka, przezroczysta „przekładka”, która tylko
 * przywołuje zwykłe okno aplikacji (jak stuknięcie ikony) i od razu się zamyka.
 */
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const NAZWA = 'EkranGlownyActivity';

const kod = (pakiet) => `package ${pakiet}

import android.app.Activity
import android.content.Intent
import android.os.Bundle

/** Ekran główny tabletu (tryb kiosku): przywołuje okno SILT Lista i znika. Generowane przez plugins/ekran-glowny.js. */
class ${NAZWA} : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val i = packageManager.getLaunchIntentForPackage(packageName)
    if (i != null) {
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
      startActivity(i)
    }
    finish()
    overridePendingTransition(0, 0)
  }
}
`;

module.exports = function ekranGlowny(config) {
  config = withAndroidManifest(config, (c) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    app.activity = (app.activity ?? []).filter((a) => a.$['android:name'] !== `.${NAZWA}`);
    app.activity.push({
      $: {
        'android:name': `.${NAZWA}`,
        'android:exported': 'true',
        'android:launchMode': 'singleTask',
        'android:noHistory': 'true',
        'android:excludeFromRecents': 'true',
        'android:taskAffinity': '',
        'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
          category: [
            { $: { 'android:name': 'android.intent.category.HOME' } },
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
          ],
        },
      ],
    });
    return c;
  });
  return withDangerousMod(config, [
    'android',
    (c) => {
      const pakiet = c.android.package;
      const katalog = path.join(c.modRequest.platformProjectRoot, 'app/src/main/java', ...pakiet.split('.'));
      fs.mkdirSync(katalog, { recursive: true });
      fs.writeFileSync(path.join(katalog, `${NAZWA}.kt`), kod(pakiet));
      return c;
    },
  ]);
};
