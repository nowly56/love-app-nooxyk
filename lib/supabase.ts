import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://pdhlcvzxdthcjdjtaszh.supabase.co';
const supabaseAnonKey = 'sb_publishable_GLTWbd64ifgZ-Mgf8lU1kQ_o4WPoZX6';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Добавляем минимальные типы для записей (можно расширять по схеме таблиц)
export type CoupleRecord = {
  id: string;
  start_date: string | null;
  invite_code: string | null;
  users?: string[] | null;
  status?: string | null;
  created_at?: string | null;
};

export type ProfileRecord = {
  id?: string;
  user_id: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
};

// Небольшая утилита для генерации читаемого invite-кода (пример)
export const generateInviteCode = (prefix = 'LOVE'): string => {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${rand}`;
};