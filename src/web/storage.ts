import { todayLocal, validDate } from "./dates.ts";
import { defaultPreferences, type Moment, type Preferences } from "./models.ts";
import type { ArchiveRepository } from "./repository";

export function createLocalArchive(scope: string): ArchiveRepository {
  let database: Promise<IDBDatabase> | undefined;
  const open = () =>
    (database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open("love-archive-v1", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("preferences");
        request.result.createObjectStore("moments");
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(
          new Error("Закройте другие вкладки приложения и повторите попытку."),
        );
    }));
  async function run<T>(
    store: string,
    mode: IDBTransactionMode,
    operation: (s: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const request = operation(transaction.objectStore(store));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Не удалось сохранить данные."));
    });
  }
  return {
    preferences: async () => {
      const saved = await run<Preferences | undefined>(
        "preferences",
        "readonly",
        (s) => s.get(scope),
      );
      if (saved) return { ...defaultPreferences, ...saved };

      // Migrate the date saved by the previous Expo web build, when it shares this origin.
      if (scope === "browser" && typeof localStorage !== "undefined") {
        let previousDate: string | null;
        try {
          previousDate = localStorage.getItem("user_start_date");
        } catch {
          // A blocked legacy localStorage must not prevent opening the IndexedDB archive.
          previousDate = null;
        }
        if (
          previousDate &&
          validDate(previousDate) &&
          previousDate <= todayLocal()
        ) {
          const migrated = { ...defaultPreferences, startDate: previousDate };
          await run("preferences", "readwrite", (s) => s.put(migrated, scope));
          return migrated;
        }
      }
      return defaultPreferences;
    },
    savePreferences: async (value) => {
      await run("preferences", "readwrite", (s) => s.put(value, scope));
    },
    moments: async () => {
      const rows = await run<(Moment & { scope: string })[]>(
        "moments",
        "readonly",
        (s) => s.getAll(IDBKeyRange.bound(`${scope}:`, `${scope}:\uffff`)),
      );
      return rows
        .filter((m) => m.scope === scope)
        .sort(
          (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
        );
    },
    saveMoment: async (value) => {
      await run("moments", "readwrite", (s) =>
        s.put({ ...value, scope }, `${scope}:${value.id}`),
      );
    },
    deleteMoment: async (id) => {
      await run("moments", "readwrite", (s) => s.delete(`${scope}:${id}`));
    },
    restoreArchive: async (nextPreferences, importedMoments) => {
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(
          ["preferences", "moments"],
          "readwrite",
        );
        transaction.objectStore("preferences").put(nextPreferences, scope);
        const store = transaction.objectStore("moments");
        for (const moment of importedMoments)
          store.put({ ...moment, scope }, `${scope}:${moment.id}`);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () =>
          reject(
            transaction.error ?? new Error("Не удалось восстановить архив."),
          );
      });
    },
  };
}

export async function compressPhoto(file: File): Promise<Blob> {
  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ].includes(file.type)
  ) {
    throw new Error("Выберите фотографию JPG, PNG, WebP или HEIC.");
  }
  if (file.size > 25 * 1024 * 1024)
    throw new Error("Фотография должна быть меньше 25 МБ.");
  const url = URL.createObjectURL(file);
  try {
    const picture = new Image();
    picture.src = url;
    await picture.decode().catch(() => {
      throw new Error("Не удалось открыть фото. Попробуйте JPG или PNG.");
    });
    const scale = Math.min(
      1,
      1800 / Math.max(picture.naturalWidth, picture.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Обработка фотографий недоступна в этом браузере.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(picture, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Не удалось обработать фото.")),
        "image/jpeg",
        0.85,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
