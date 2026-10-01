/// <reference types="node" />
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { Baza, Parametr } from '../src/db/zapis';

/** node:sqlite udający bazę expo-sqlite (te same metody, których używa aplikacja). */
export class BazaNode implements Baza {
  d = new DatabaseSync(':memory:');
  async runAsync(sql: string, ...p: Parametr[]) {
    return this.d.prepare(sql).run(...(p as SQLInputValue[]));
  }
  async getAllAsync<T>(sql: string, ...p: Parametr[]) {
    return this.d.prepare(sql).all(...(p as SQLInputValue[])) as T[];
  }
  async getFirstAsync<T>(sql: string, ...p: Parametr[]) {
    return (this.d.prepare(sql).get(...(p as SQLInputValue[])) as T | undefined) ?? null;
  }
  async execAsync(sql: string) {
    this.d.exec(sql);
  }
  async withExclusiveTransactionAsync(task: (tx: Baza) => Promise<void>) {
    this.d.exec('BEGIN');
    try {
      await task(this);
      this.d.exec('COMMIT');
    } catch (e) {
      this.d.exec('ROLLBACK');
      throw e;
    }
  }
}

