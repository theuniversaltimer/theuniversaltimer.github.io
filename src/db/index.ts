import Dexie, { type Table } from "dexie";
import type { Timer } from "../types";

class TimerDB extends Dexie {
  timers!: Table<Timer, string>;

  constructor() {
    super("universal-timer-db");
    this.version(1).stores({
      timers: "id"
    });
  }
}

export const db = new TimerDB();

export const loadTimers = async (): Promise<Timer[]> => {
  return db.timers.toArray();
};

export const saveTimer = async (timer: Timer) => {
  await db.timers.put(timer);
};

export const deleteTimerById = async (id: string) => {
  await db.timers.delete(id);
};
