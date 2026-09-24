
import { supabase } from '../../lib/supabase';

/**
 * Создать новую пару (couple) и вернуть созданную запись.
 * Возвращает объект couple или бросает ошибку.
 */
export async function createCouple(ownerUserId: string, startDate: string) {
  const invite_code = generateInviteCode();
  const payload = {
    start_date: startDate,
    invite_code,
    users: [ownerUserId],
    status: 'pending',
  };

  const { data, error } = await supabase
    .from('couples')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Получить пару по invite code.
 * Возвращает запись или null.
 */
export async function getCoupleByInviteCode(inviteCode: string) {
  const { data, error } = await supabase
    .from('couples')
    .select('*')
    .eq('invite_code', inviteCode)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // single() возвращает ошибку, если нет — обрабатываем как null
    throw error;
  }
  return data ?? null;
}

/**
 * Попытаться присоединить пользователя к паре по invite code.
 * Возвращает обновлённую запись пары.
 */
export async function joinCouple(userId: string, inviteCode: string) {
  // Получаем пару
  const couple = await getCoupleByInviteCode(inviteCode);
  if (!couple) {
    throw new Error('Invite code not found');
  }

  const existingUsers = Array.isArray(couple.users) ? couple.users : [];
  if (existingUsers.includes(userId)) {
    return couple; // уже в паре
  }

  // простая логика проверки на "полноту" пары — если уже 2 участников, отклоняем
  if (existingUsers.length >= 2) {
    throw new Error('Pair is full');
  }

  const updatedUsers = [...existingUsers, userId];
  const newStatus = updatedUsers.length >= 2 ? 'together' : couple.status || 'pending';

  const { data, error } = await supabase
    .from('couples')
    .update({ users: updatedUsers, status: newStatus })
    .eq('id', couple.id)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Получить профиль по user_id
 */
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data ?? null;
}

/**
 * Upsert профиля (создать или обновить)
 */
export async function upsertProfile(profile: any) {
  // supabase upsert требует уникальное поле user_id в таблице profiles
  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Генерация уникального invite code
 */
function generateInviteCode(): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `LOVE-${rand}`;
}
