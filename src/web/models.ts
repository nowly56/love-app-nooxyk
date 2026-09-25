export type Preferences = {
  startDate: string;
  name: string;
  haptics: boolean;
};

export type Moment = {
  id: string;
  date: string;
  caption: string;
  photo: Blob;
  favorite: boolean;
};

export const defaultPreferences: Preferences = {
  startDate: "",
  name: "",
  haptics: true,
};

export function normalizePreferences(value: unknown): Preferences {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    startDate: typeof source.startDate === "string" ? source.startDate : "",
    name: typeof source.name === "string" ? source.name : "",
    haptics: typeof source.haptics === "boolean" ? source.haptics : true,
  };
}
