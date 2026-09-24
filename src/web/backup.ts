import { defaultPreferences, type Moment, type Preferences } from "./models.ts";
import { validDate } from "./dates.ts";

export type ArchiveBackup = { preferences: Preferences; moments: Moment[] };
const MAX_BACKUP_BYTES = 200 * 1024 * 1024;
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const MAX_MOMENTS = 5000;

export function parseBackup(input: unknown, today: string): ArchiveBackup {
  if (!input || typeof input !== "object")
    throw new Error("Файл не похож на резервную копию Love Archive.");
  const record = input as Record<string, unknown>;
  if (
    record.version !== 1 ||
    !record.preferences ||
    typeof record.preferences !== "object" ||
    !Array.isArray(record.moments)
  ) {
    throw new Error("Формат резервной копии не поддерживается.");
  }
  if (record.moments.length > MAX_MOMENTS)
    throw new Error(
      `В одной копии может быть не больше ${MAX_MOMENTS} моментов.`,
    );

  const source = record.preferences as Partial<Preferences>;
  if (
    typeof source.startDate !== "string" ||
    (source.startDate && !validDate(source.startDate)) ||
    source.startDate > today
  ) {
    throw new Error("В резервной копии указана неверная дата начала.");
  }
  if (
    typeof source.name !== "string" ||
    source.name.length > 40 ||
    !["auto", "light", "dark"].includes(source.theme ?? "") ||
    typeof source.haptics !== "boolean"
  ) {
    throw new Error("Не удалось прочитать настройки профиля из копии.");
  }

  const ids = new Set<string>();
  const moments = record.moments.map((value, index): Moment => {
    if (!value || typeof value !== "object")
      throw new Error(`Момент ${index + 1} повреждён.`);
    const moment = value as Record<string, unknown>;
    if (
      typeof moment.id !== "string" ||
      !/^[\w-]{1,80}$/.test(moment.id) ||
      ids.has(moment.id)
    ) {
      throw new Error(
        `У момента ${index + 1} неверный или повторяющийся идентификатор.`,
      );
    }
    ids.add(moment.id);
    if (
      typeof moment.date !== "string" ||
      !validDate(moment.date) ||
      moment.date > today
    ) {
      throw new Error(`У момента ${index + 1} неверная дата.`);
    }
    if (
      typeof moment.caption !== "string" ||
      moment.caption.length > 500 ||
      typeof moment.favorite !== "boolean"
    ) {
      throw new Error(
        `Подпись или отметка избранного в моменте ${index + 1} повреждены.`,
      );
    }
    if (typeof moment.photo !== "string")
      throw new Error(`В моменте ${index + 1} отсутствует фотография.`);
    const image = moment.photo.match(
      /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]*={0,2})$/,
    );
    if (!image || image[2].length > Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 4) {
      throw new Error(
        `Фотография ${index + 1} имеет неподдерживаемый формат или слишком велика.`,
      );
    }
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      const binary = atob(image[2]);
      if (binary.length > MAX_PHOTO_BYTES) throw new Error();
      const buffer = new ArrayBuffer(binary.length);
      bytes = new Uint8Array(buffer);
      for (let offset = 0; offset < binary.length; offset++) {
        bytes[offset] = binary.charCodeAt(offset);
      }
    } catch {
      throw new Error(`Фотография ${index + 1} повреждена.`);
    }
    const validSignature =
      image[1] === "image/jpeg"
        ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : image[1] === "image/png"
          ? bytes[0] === 0x89 &&
            bytes[1] === 0x50 &&
            bytes[2] === 0x4e &&
            bytes[3] === 0x47
          : bytes[0] === 0x52 &&
            bytes[1] === 0x49 &&
            bytes[2] === 0x46 &&
            bytes[3] === 0x46 &&
            bytes[8] === 0x57 &&
            bytes[9] === 0x45 &&
            bytes[10] === 0x42 &&
            bytes[11] === 0x50;
    if (!validSignature)
      throw new Error(
        `Содержимое фотографии ${index + 1} не соответствует её формату.`,
      );
    return {
      id: moment.id,
      date: moment.date,
      caption: moment.caption,
      favorite: moment.favorite,
      photo: new Blob([bytes.buffer], { type: image[1] }),
    };
  });

  return {
    preferences: { ...defaultPreferences, ...source, name: source.name.trim() },
    moments,
  };
}

export async function readBackup(
  file: File,
  today: string,
): Promise<ArchiveBackup> {
  if (file.size > MAX_BACKUP_BYTES)
    throw new Error("Размер резервной копии превышает 200 МБ.");
  let input: unknown;
  try {
    input = JSON.parse(await file.text());
  } catch {
    throw new Error("Файл повреждён или не является JSON-копией Love Archive.");
  }
  return parseBackup(input, today);
}
