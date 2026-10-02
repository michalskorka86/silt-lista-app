/**
 * Zadanie w tle (Android WorkManager): co jakiś czas, także przy zamkniętej aplikacji,
 * robi brakujące PDF-y. Android sam wybiera dokładną chwilę (zwykle gdy tablet się ładuje / stoi),
 * więc „ok. 3:00” oznacza: wczorajsza lista dostaje PDF przy pierwszym uruchomieniu zadania po 3:00.
 * Dodatkowo PDF-y dorabiają się przy każdym otwarciu aplikacji (AutomatPdf).
 */

import * as BackgroundTask from 'expo-background-task';
import * as SQLite from 'expo-sqlite';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';

import { DB_NAME, migrateDbIfNeeded } from '@/db/migrations';

import { zrobBrakujacePdf } from './automat';

export const ZADANIE_PDF = 'silt-pdf-dnia';

// Musi być zdefiniowane przy załadowaniu aplikacji (też gdy Android uruchamia samo zadanie w tle).
// Jedno połączenie na całe życie aplikacji (wcześniej każde uruchomienie zadania otwierało nowe i go nie zamykało).
let baza: Promise<SQLite.SQLiteDatabase> | null = null;
function polacz() {
  baza ??= SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
    await migrateDbIfNeeded(db);
    return db;
  });
  baza.catch(() => (baza = null));
  return baza;
}

TaskManager.defineTask(ZADANIE_PDF, async () => {
  try {
    // Aplikacja na ekranie robi PDF-y sama (AutomatPdf) — zadanie w tle jest tylko na noc / zamkniętą aplikację.
    if (AppState.currentState === 'active') return BackgroundTask.BackgroundTaskResult.Success;
    const db = await polacz();
    const w = await zrobBrakujacePdf(db);
    return w.bledy.length && !w.zrobione.length ? BackgroundTask.BackgroundTaskResult.Failed : BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Rejestruje zadanie (raz; kolejne wywołania nic nie zmieniają). Co ok. godzinę. */
export async function zarejestrujZadaniePdf(): Promise<void> {
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(ZADANIE_PDF)) return;
    await BackgroundTask.registerTaskAsync(ZADANIE_PDF, { minimumInterval: 60 });
  } catch {
    // brak zadania w tle = PDF-y i tak zrobią się przy otwarciu aplikacji
  }
}
