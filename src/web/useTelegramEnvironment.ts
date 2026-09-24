import { useEffect, useState } from "react";
import { loadTelegram, type TelegramApp } from "./telegram";

export function useTelegramEnvironment() {
  const [telegram, setTelegram] = useState<TelegramApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheme, setScheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    let active = true;
    void loadTelegram().then((app) => {
      if (!active) return;
      const verifiedSessionAvailable = Boolean(app?.initData);
      const miniApp = verifiedSessionAvailable ? app : null;
      setTelegram(miniApp);
      miniApp?.ready();
      miniApp?.expand();
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      setScheme(telegram?.colorScheme ?? (media.matches ? "dark" : "light"));
      const root = document.documentElement;
      for (const edge of ["top", "bottom", "left", "right"] as const) {
        root.style.setProperty(
          `--tg-inset-${edge}`,
          `${(telegram?.safeAreaInset?.[edge] ?? 0) + (telegram?.contentSafeAreaInset?.[edge] ?? 0)}px`,
        );
      }
      if (telegram?.viewportHeight)
        root.style.setProperty("--app-height", `${telegram.viewportHeight}px`);
    };
    update();
    media.addEventListener("change", update);
    const events = [
      "themeChanged",
      "viewportChanged",
      "safeAreaChanged",
      "contentSafeAreaChanged",
    ];
    events.forEach((event) => telegram?.onEvent(event, update));
    return () => {
      media.removeEventListener("change", update);
      events.forEach((event) => telegram?.offEvent(event, update));
    };
  }, [telegram]);

  return { telegram, telegramLoading: loading, scheme };
}
