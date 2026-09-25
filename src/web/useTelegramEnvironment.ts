import { useEffect, useState } from "react";
import { loadTelegram, type TelegramApp } from "./telegram";

export function useTelegramEnvironment() {
  const [telegram, setTelegram] = useState<TelegramApp | null>(null);
  const [loading, setLoading] = useState(true);

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
    const update = () => {
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
    const events = [
      "viewportChanged",
      "safeAreaChanged",
      "contentSafeAreaChanged",
    ];
    events.forEach((event) => telegram?.onEvent(event, update));
    return () => {
      events.forEach((event) => telegram?.offEvent(event, update));
    };
  }, [telegram]);

  return { telegram, telegramLoading: loading };
}
