# SILT Lista — aplikacja na tablet

Aplikacja Android (React Native + Expo) dla instruktorów SILT Paintball —
następca PWA „SILT Lista” v19 (filedops.pl/lista).

- Plan i ustalenia: [docs/PLAN.md](docs/PLAN.md)
- Zasady pracy nad kodem: [CLAUDE.md](CLAUDE.md)

## Budowanie

- **Sprawdzenie kodu** — automatycznie przy każdej zmianie (zakładka *Actions* → „Sprawdź kod”).
- **APK do testów** — *Actions* → „Buduj aplikację” → *Run workflow* → profil `preview`.
  Link do pobrania APK pojawi się na expo.dev (projekt `silt-lista`).
- **Google Play** — profil `production` (paczka .aab do testu wewnętrznego).

Wymagany sekret repozytorium `EXPO_TOKEN` (token dostępu z expo.dev).
