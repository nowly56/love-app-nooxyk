
import { supabase } from '../../lib/supabase';
import {
  createCouple,
  joinCouple,
  getCoupleByInviteCode,
  getProfile,
  upsertProfile,
} from './supabaseService';

// ...existing code...
// Краткие описания возвращаемых структур — можно расширять при необходимости
type PairResult = { invite_code?: string | null; start_date?: string | null; status?: string | null; users?: string[] };

// Получить текущую сессию / пользователя
export async function getCurrentSession() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    const user = data?.user ?? null;
    if (!user) return null;
    return {
      userId: user.id,
      email: (user.email ?? null),
      phone: (user.phone ?? null),
      name: (user.user_metadata?.name ?? user.user_metadata?.full_name) ?? null,
    };
  } catch {
    return null;
  }
}

// Создать пару (invite code + запись)
export async function createPair(ownerUserId: string, startDate: string) {
  const couple = await createCouple(ownerUserId, startDate);
  return {
    invite_code: couple?.invite_code ?? null,
    start_date: couple?.start_date ?? startDate,
    status: couple?.status ?? null,
  } as PairResult;
}

// Присоединиться к паре по коду
export async function joinPair(userId: string, inviteCode: string) {
  const couple = await joinCouple(userId, inviteCode);
  return {
    invite_code: couple?.invite_code ?? inviteCode,
    start_date: couple?.start_date ?? null,
    status: couple?.status ?? null,
    users: couple?.users ?? null,
  } as PairResult;
}

// Получить пару для пользователя (ищем по users array)
export async function getPairData(userId: string) {
  const { data, error } = await supabase
    .from('couples')
    .select('*')
    .contains('users', [userId])
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

// Создать пару только один раз для Telegram-пользователя.
export async function ensurePair(userId: string, startDate: string) {
  const existing = await getPairData(userId);
  if (existing) return existing;
  return createCouple(userId, startDate);
}

// Проверить валидность invite кода (exists)
export async function checkInviteCode(code: string) {
  const couple = await getCoupleByInviteCode(code);
  return { exists: !!couple };
}

// Получить воспоминания (простая реализация по таблице "memories")
export async function getMemories(userId: string) {
  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Загрузить новое воспоминание (сохраняем ссылку на изображение в поле image_url)
export async function uploadMemory(userId: string | null, imageUri: string) {
  if (!userId) throw new Error('AUTH_REQUIRED');
  const payload = {
    user_id: userId,
    image_url: imageUri,
    content: null,
    created_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('memories')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

// Обновить воспоминание
export async function updateMemory(userId: string | null, memoryId: string, updates: Record<string, any>) {
  if (!userId) throw new Error('AUTH_REQUIRED');
  const { data, error } = await supabase
    .from('memories')
    .update(updates)
    .eq('id', memoryId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

// Удалить воспоминание
export async function deleteMemory(userId: string | null, memoryId: string) {
  if (!userId) throw new Error('AUTH_REQUIRED');
  const { data, error } = await supabase
    .from('memories')
    .delete()
    .eq('id', memoryId);

  if (error) throw error;
  return data;
}

// Логаут
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  return true;
}

// Экспорт как объект, который ожидает App
export const api = {
  getCurrentSession,
  createPair,
  joinPair,
  getPairData,
  ensurePair,
  checkInviteCode,
  getMemories,
  uploadMemory,
  updateMemory,
  deleteMemory,
  logout,
  // optionally expose profile helpers
  getProfile,
  upsertProfile,
};

export default api;
