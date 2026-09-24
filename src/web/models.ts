export type Preferences = {
  startDate: string;
  name: string;
  theme: "auto" | "light" | "dark";
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
  theme: "auto",
  haptics: true,
};
