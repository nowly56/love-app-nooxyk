import { createLocalArchive } from "./storage";
import type { Moment, Preferences } from "./models";

/** Data boundary used by the UI; replace this factory when the API is ready. */
export interface ArchiveRepository {
  preferences(): Promise<Preferences>;
  savePreferences(value: Preferences): Promise<void>;
  moments(): Promise<Moment[]>;
  saveMoment(value: Moment): Promise<void>;
  deleteMoment(id: string): Promise<void>;
  restoreArchive(preferences: Preferences, moments: Moment[]): Promise<void>;
}

export function createArchiveRepository(scope: string): ArchiveRepository {
  return createLocalArchive(scope);
}
