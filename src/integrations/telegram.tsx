import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

type TelegramWebApp = {
  initData?: string;
  initDataUnsafe?: {
    user?: TelegramUser;
    start_param?: string;
    query_id?: string;
  };
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  openTelegramLink?: (url: string) => void;
  close?: () => void;
  HapticFeedback?: {
    impactOccurred?: (style: 'light' | 'medium' | 'heavy') => void;
  };
};

type TelegramContextValue = {
  isTelegram: boolean;
  isReady: boolean;
  isVerified: boolean;
  user: TelegramUser | null;
  startParam: string | null;
  initData: string | null;
  webApp: TelegramWebApp | null;
};

const TelegramContext = createContext<TelegramContextValue>({
  isTelegram: false,
  isReady: false,
  isVerified: false,
  user: null,
  startParam: null,
  initData: null,
  webApp: null,
});

const getEnv = (name: string): string => {
  const processEnv = (globalThis as any)?.process?.env;
  const expoValue = typeof process !== 'undefined'
    ? name === 'EXPO_PUBLIC_TELEGRAM_API_URL'
      ? process.env.EXPO_PUBLIC_TELEGRAM_API_URL
      : name === 'EXPO_PUBLIC_TELEGRAM_BOT_USERNAME'
        ? process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME
        : undefined
    : undefined;
  const value = expoValue ?? processEnv?.[name];
  return typeof value === 'string' ? value.trim() : '';
};

export const getTelegramWebApp = (): TelegramWebApp | null => {
  if (Platform.OS !== 'web') return null;
  const telegram = (globalThis as any)?.Telegram;
  return telegram?.WebApp ?? null;
};

const loadTelegramScript = (): Promise<void> => new Promise((resolve) => {
  if (getTelegramWebApp()) {
    resolve();
    return;
  }

  const documentObject = (globalThis as any)?.document;
  if (!documentObject) {
    resolve();
    return;
  }

  const existingScript = documentObject.querySelector('script[data-telegram-web-app]');
  if (existingScript) {
    existingScript.addEventListener('load', () => resolve(), { once: true });
    existingScript.addEventListener('error', () => resolve(), { once: true });
    return;
  }

  const script = documentObject.createElement('script');
  script.src = 'https://telegram.org/js/telegram-web-app.js';
  script.async = true;
  script.dataset.telegramWebApp = 'true';
  script.onload = () => resolve();
  script.onerror = () => resolve();
  documentObject.head?.appendChild(script);
});

const getApiBaseUrl = (): string => {
  const configured = getEnv('EXPO_PUBLIC_TELEGRAM_API_URL');
  if (configured) return configured.replace(/\/$/, '');

  const location = (globalThis as any)?.location;
  return location?.origin && location.origin !== 'null' ? location.origin : '';
};

async function verifyInitData(initData: string): Promise<TelegramUser | null> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl || typeof fetch !== 'function') return null;

  try {
    const response = await fetch(`${apiBaseUrl}/api/telegram/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.ok && payload.user ? payload.user : null;
  } catch {
    return null;
  }
}

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TelegramContextValue>({
    isTelegram: false,
    isReady: false,
    isVerified: false,
    user: null,
    startParam: null,
    initData: null,
    webApp: null,
  });

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      await loadTelegramScript();
      if (cancelled) return;

      const webApp = getTelegramWebApp();
      if (!webApp) {
        setState((current) => ({ ...current, isReady: true }));
        return;
      }

      webApp.ready?.();
      webApp.expand?.();
      webApp.setHeaderColor?.('#FDF7F2');
      webApp.setBackgroundColor?.('#FDF7F2');

      const initData = webApp.initData || null;
      const localUser = webApp.initDataUnsafe?.user ?? null;
      const location = (globalThis as any)?.location;
      const queryInvite = location?.search
        ? new URLSearchParams(location.search).get('invite')
        : null;
      const startParam = webApp.initDataUnsafe?.start_param ?? queryInvite ?? null;

      setState({
        isTelegram: true,
        isReady: !initData,
        isVerified: false,
        user: localUser,
        startParam,
        initData,
        webApp,
      });

      if (initData) {
        const verifiedUser = await verifyInitData(initData);
        if (cancelled) return;
        setState((current) => ({
          ...current,
          isReady: true,
          isVerified: Boolean(verifiedUser),
          user: verifiedUser ?? current.user,
        }));
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}

export const useTelegram = () => useContext(TelegramContext);

export const getTelegramBotUsername = (): string => getEnv('EXPO_PUBLIC_TELEGRAM_BOT_USERNAME').replace(/^@/, '');

export const createTelegramInviteLink = (inviteCode: string): string | null => {
  const botUsername = getTelegramBotUsername();
  if (!botUsername || !inviteCode) return null;
  return `https://t.me/${botUsername}?startapp=${encodeURIComponent(inviteCode)}`;
};

export async function shareTelegramInvite(inviteCode: string): Promise<boolean> {
  const inviteLink = createTelegramInviteLink(inviteCode);
  if (!inviteLink) return false;

  const navigatorObject = (globalThis as any)?.navigator;
  if (typeof navigatorObject?.share === 'function') {
    try {
      await navigatorObject.share({
        title: 'Love Archive',
        text: 'Присоединись к нашей истории в Love Archive 💛',
        url: inviteLink,
      });
      return true;
    } catch {
      // Пользователь мог закрыть системное меню шаринга.
    }
  }

  const webApp = getTelegramWebApp();
  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(inviteLink);
    return true;
  }

  if (typeof navigatorObject?.clipboard?.writeText === 'function') {
    await navigatorObject.clipboard.writeText(inviteLink);
    return true;
  }

  return false;
}

export const telegramHaptic = (style: 'light' | 'medium' | 'heavy' = 'light') => {
  getTelegramWebApp()?.HapticFeedback?.impactOccurred?.(style);
};
