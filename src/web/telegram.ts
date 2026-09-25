export type TelegramApp = {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      photo_url?: string;
    };
    start_param?: string;
  };
  colorScheme: "light" | "dark";
  viewportHeight: number;
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  ready(): void;
  expand(): void;
  isVersionAtLeast(version: string): boolean;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  onEvent(event: string, callback: () => void): void;
  offEvent(event: string, callback: () => void): void;
  BackButton: {
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  HapticFeedback?: {
    selectionChanged(): void;
    notificationOccurred(type: "success" | "error"): void;
  };
};
declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramApp };
  }
}
let sdk: Promise<TelegramApp | null> | undefined;
export function loadTelegram(): Promise<TelegramApp | null> {
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);
  const telegramLaunch =
    /Telegram/i.test(navigator.userAgent) ||
    /(?:^|[?#&])tgWebAppPlatform(?:=|&|$)/.test(location.href);
  if (!telegramLaunch) return Promise.resolve(null);
  return (sdk ??= new Promise((resolve) => {
    const script = document.createElement("script");
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(window.Telegram?.WebApp ?? null);
    };
    const timer = setTimeout(done, 5000);
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    script.onload = done;
    script.onerror = done;
    document.head.appendChild(script);
  }));
}
