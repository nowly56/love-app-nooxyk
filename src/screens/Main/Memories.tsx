import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Animated,
  Dimensions, Image, Modal, StatusBar, TextInput, KeyboardAvoidingView,
  Platform, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const CARD_SIZE = (width - 48 - 12) / 2;

// ─── Types ────────────────────────────────────────────────────────────────────
type Author = 'me' | 'partner';
type Reaction = '❤️' | '🔥' | '😘' | null;

type Memory = {
  id: string;
  uri: string;
  date: string;
  caption?: string;
  author: Author;
  reaction?: Reaction;   // реакция ДРУГОГО партнёра
  isNew?: boolean;       // добавлено пока тебя не было
};

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_MEMORIES: Memory[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDate   = (d: string) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const getMonthKey  = (d: string) => d.slice(0, 7); // "2024-02"
const formatMonth  = (key: string) => {
  const [y, m] = key.split('-');
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  return `${months[parseInt(m) - 1]} ${y}`;
};

// ─── Skeleton Card ────────────────────────────────────────────────────────────
const SkeletonCard = () => {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.8] });
  return (
    <Animated.View style={[styles.memoryCard, { opacity, backgroundColor: 'rgba(92,58,58,0.08)' }]} />
  );
};

// ─── Avatar badge ─────────────────────────────────────────────────────────────
const AuthorAvatar = ({ author }: { author: Author }) => (
  <View style={[styles.avatar, author === 'partner' && styles.avatarPartner]}>
    <LinearGradient
      colors={author === 'me' ? ['#fae1dd', '#f2b5a0'] : ['#e2d1c3', '#c9b8a8']}
      style={StyleSheet.absoluteFill}
    />
    <Ionicons name="person" size={9} color="rgba(92,58,58,0.7)" />
  </View>
);

// ─── Reaction Picker ──────────────────────────────────────────────────────────
const REACTIONS: Reaction[] = ['❤️', '🔥', '😘'];

const ReactionPicker = ({
  current, onSelect,
}: { current?: Reaction; onSelect: (r: Reaction) => void }) => {
  const scaleAnims = REACTIONS.map(() => useRef(new Animated.Value(1)).current);

  const handlePress = (r: Reaction, idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleAnims[idx], { toValue: 1.5, duration: 100, useNativeDriver: true }),
      Animated.spring(scaleAnims[idx], { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    onSelect(current === r ? null : r);
  };

  return (
    <View style={styles.reactionRow}>
      {REACTIONS.map((r, i) => (
        <Pressable key={r} onPress={() => handlePress(r, i)}>
          <Animated.Text
            style={[styles.reactionEmoji, { transform: [{ scale: scaleAnims[i] }] }, current === r && styles.reactionActive]}
          >
            {r}
          </Animated.Text>
        </Pressable>
      ))}
    </View>
  );
};

// ─── Memory Card ──────────────────────────────────────────────────────────────
const MemoryCard = ({
  item, onPress, onReact, onEditCaption,
}: {
  item: Memory;
  onPress: () => void;
  onReact: (r: Reaction) => void;
  onEditCaption: () => void;
}) => {
  const scaleAnim   = useRef(new Animated.Value(0.85)).current;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, tension: 120, friction: 12, useNativeDriver: true }).start();
  }, []);

  return (
    <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}>
      {({ pressed }) => (
        <Animated.View style={[styles.memoryCard, { transform: [{ scale: pressed ? 0.96 : scaleAnim }] }]}>

          {/* Skeleton пока грузится */}
          {!loaded && <SkeletonCard />}

          <Image
            source={{ uri: item.uri }}
            style={[styles.cardImage, !loaded && { opacity: 0 }]}
            resizeMode="cover"
            onLoad={() => setLoaded(true)}
          />

          <LinearGradient colors={['transparent', 'rgba(20,10,10,0.7)']} style={styles.cardOverlay} />

          {/* Аватар автора */}
          <View style={styles.cardTopRow}>
            <AuthorAvatar author={item.author} />
            {item.isNew && <View style={styles.newDot} />}
          </View>

          {/* Мета снизу */}
          <View style={styles.cardMeta}>
            <View style={styles.cardMetaTop}>
              <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
              {/* Карандашик только на своих фото */}
              {item.author === 'me' && (
                <Pressable
                  hitSlop={8}
                  onPress={(e) => { e.stopPropagation?.(); onEditCaption(); }}
                  style={styles.pencilBtn}
                >
                  <Ionicons name="pencil" size={10} color="rgba(255,255,255,0.6)" />
                </Pressable>
              )}
            </View>
            {item.caption
              ? <Text style={styles.cardCaption} numberOfLines={2}>{item.caption}</Text>
              : item.author === 'me'
                ? <Text style={styles.cardNoCaption}>Добавить описание...</Text>
                : null
            }

            {/* Реакции — только на фото партнёра */}
            {item.author === 'partner' && (
              <ReactionPicker current={item.reaction} onSelect={onReact} />
            )}
            {/* Своя реакция если уже есть */}
            {item.author === 'me' && item.reaction && (
              <Text style={styles.myReaction}>{item.reaction}</Text>
            )}
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
};

// ─── Caption Modal ────────────────────────────────────────────────────────────
const CaptionModal = ({
  visible, initialCaption, imageUri, onSave, onClose,
}: {
  visible: boolean; initialCaption?: string; imageUri?: string;
  onSave: (c: string) => void; onClose: () => void;
}) => {
  const [text, setText] = useState(initialCaption || '');
  const slideAnim = useRef(new Animated.Value(80)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => { setText(initialCaption || ''); }, [initialCaption, visible]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 160, friction: 14, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(80);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <Animated.View style={[styles.captionBg, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Animated.View style={[styles.captionSheet, { transform: [{ translateY: slideAnim }] }]}>
              <BlurView intensity={90} tint="light" style={styles.captionBlur}>
                {imageUri && <Image source={{ uri: imageUri }} style={styles.captionPreview} resizeMode="cover" />}
                <View style={styles.captionBody}>
                  <Text style={styles.captionLabel}>ОПИСАНИЕ</Text>
                  <TextInput
                    style={styles.captionInput}
                    value={text}
                    onChangeText={setText}
                    placeholder="Напишите что-то тёплое..."
                    placeholderTextColor="rgba(92,58,58,0.3)"
                    multiline maxLength={200} autoFocus
                  />
                  <Text style={styles.captionCounter}>{text.length}/200</Text>
                  <View style={styles.captionActions}>
                    <Pressable style={styles.captionCancel} onPress={onClose}>
                      <Text style={styles.captionCancelText}>Отмена</Text>
                    </Pressable>
                    <Pressable style={styles.captionSave} onPress={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      onSave(text); onClose();
                    }}>
                      <Text style={styles.captionSaveText}>Сохранить</Text>
                    </Pressable>
                  </View>
                </View>
              </BlurView>
            </Animated.View>
          </KeyboardAvoidingView>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// ─── Lightbox ─────────────────────────────────────────────────────────────────
const LightboxModal = ({
  memory, visible, onClose, onEditCaption,
}: { memory: Memory | null; visible: boolean; onClose: () => void; onEditCaption: () => void }) => {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 180, friction: 14, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0); scaleAnim.setValue(0.92);
    }
  }, [visible]);

  if (!memory) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <StatusBar hidden />
      <Animated.View style={[styles.lightboxBg, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.lightboxContent, { transform: [{ scale: scaleAnim }] }]}>
          <Image source={{ uri: memory.uri }} style={styles.lightboxImage} resizeMode="contain" />
          <BlurView intensity={80} tint="dark" style={styles.lightboxMeta}>
            <View style={styles.lightboxMetaRow}>
              <AuthorAvatar author={memory.author} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.lightboxAuthor}>
                  {memory.author === 'me' ? 'Вы' : 'Партнёр'} · {formatDate(memory.date)}
                </Text>
                {memory.caption
                  ? <Text style={styles.lightboxCaption}>{memory.caption}</Text>
                  : <Text style={styles.lightboxNoCaption}>Без описания</Text>
                }
              </View>
              {memory.author === 'me' && (
                <Pressable style={styles.editCaptionBtn} onPress={() => { onEditCaption(); }}>
                  <Ionicons name="pencil-outline" size={16} color="rgba(255,255,255,0.7)" />
                </Pressable>
              )}
            </View>
          </BlurView>
        </Animated.View>
        <Pressable style={styles.closeBtn} onPress={onClose}>
          <BlurView intensity={60} tint="dark" style={styles.closeBtnInner}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.9)" />
          </BlurView>
        </Pressable>
      </Animated.View>
    </Modal>
  );
};

// ─── Month Section ────────────────────────────────────────────────────────────
const MonthSection = ({
  monthKey, items, onPress, onReact, onEditCaption,
}: {
  monthKey: string; items: Memory[];
  onPress: (m: Memory) => void;
  onReact: (id: string, r: Reaction) => void;
  onEditCaption: (m: Memory) => void;
}) => {
  const leftCol  = items.filter((_, i) => i % 2 === 0);
  const rightCol = items.filter((_, i) => i % 2 !== 0);

  return (
    <View style={styles.monthSection}>
      <View style={styles.monthHeader}>
        <Text style={styles.monthTitle}>{formatMonth(monthKey)}</Text>
        <Text style={styles.monthCount}>{items.length} фото</Text>
      </View>
      <View style={styles.grid}>
        <View style={styles.column}>
          {leftCol.map(m => (
            <MemoryCard key={m.id} item={m}
              onPress={() => onPress(m)}
              onReact={r => onReact(m.id, r)}
              onEditCaption={() => onEditCaption(m)}
            />
          ))}
        </View>
        <View style={styles.column}>
          {rightCol.map(m => (
            <MemoryCard key={m.id} item={m}
              onPress={() => onPress(m)}
              onReact={r => onReact(m.id, r)}
              onEditCaption={() => onEditCaption(m)}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MemoriesScreen() {
  const insets = useSafeAreaInsets();
  const [memories, setMemories]           = useState<Memory[]>(DEMO_MEMORIES);
  const [selected, setSelected]           = useState<Memory | null>(null);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [captionVisible, setCaptionVisible]   = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  // Новые от партнёра
  const newFromPartner = useMemo(
    () => memories.filter(m => m.author === 'partner' && m.isNew),
    [memories]
  );

  // Группировка по месяцам (без isNew секции)
  const monthGroups = useMemo(() => {
    const groups: Record<string, Memory[]> = {};
    memories.forEach(m => {
      const key = getMonthKey(m.date);
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [memories]);

  const handleAddPhoto = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const newM: Memory = {
        id: `user_${Date.now()}`,
        uri: result.assets[0].uri,
        date: new Date().toISOString().split('T')[0],
        author: 'me',
      };
      setMemories(prev => [newM, ...prev]);
      setSelected(newM);
      setCaptionVisible(true);
    }
  }, []);

  const handleReact = useCallback((id: string, reaction: Reaction) => {
    setMemories(prev => prev.map(m => m.id === id ? { ...m, reaction } : m));
  }, []);

  const saveCaption = useCallback((caption: string) => {
    if (!selected) return;
    setMemories(prev => prev.map(m => m.id === selected.id ? { ...m, caption } : m));
    setSelected(prev => prev ? { ...prev, caption } : prev);
  }, [selected]);

  const openLightbox = (m: Memory) => { setSelected(m); setLightboxVisible(true); };
  const closeLightbox = () => { setLightboxVisible(false); setTimeout(() => setSelected(null), 300); };
  const openCaption = (m: Memory) => { setSelected(m); setCaptionVisible(true); };

  // Пометить «новые» как просмотренные при открытии
  useEffect(() => {
    const timer = setTimeout(() => {
      setMemories(prev => prev.map(m => ({ ...m, isNew: false })));
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FDFCFB', '#F2E2D2', '#E2D1C3']} style={StyleSheet.absoluteFill} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.screenTitle}>Моменты</Text>
          <Pressable onPress={handleAddPhoto} style={styles.iconBtn}>
            <BlurView intensity={60} tint="light" style={styles.iconBtnInner}>
              <Ionicons name="add" size={22} color="#5C3A3A" />
            </BlurView>
          </Pressable>
        </Animated.View>

        {/* Новое от партнёра */}
        {newFromPartner.length > 0 && (
          <Animated.View style={[styles.newSection, { opacity: fadeAnim }]}>
            <BlurView intensity={50} tint="light" style={styles.newSectionBlur}>
              <View style={styles.newSectionHeader}>
                <View style={styles.pulseWrapper}>
                  <View style={styles.pulseDot} />
                </View>
                <Text style={styles.newSectionTitle}>Новое от партнёра</Text>
                <Text style={styles.newSectionCount}>{newFromPartner.length}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newPhotosRow}>
                {newFromPartner.map(m => (
                  <Pressable key={m.id} onPress={() => openLightbox(m)} style={styles.newPhotoThumb}>
                    <Image source={{ uri: m.uri }} style={styles.newPhotoImg} resizeMode="cover" />
                    {m.caption && (
                      <LinearGradient colors={['transparent', 'rgba(20,10,10,0.6)']} style={StyleSheet.absoluteFill} />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </BlurView>
          </Animated.View>
        )}

        {/* Empty state */}
        {memories.length === 0 && (
          <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>Ваша история ещё не началась</Text>
            <Text style={styles.emptySubtitle}>Добавьте первый момент — пусть это будет что-то тёплое</Text>
            <Pressable style={styles.emptyBtn} onPress={handleAddPhoto}>
              <Text style={styles.emptyBtnText}>Добавить первый момент</Text>
              <Ionicons name="camera-outline" size={16} color="#FFF" style={{ marginLeft: 8 }} />
            </Pressable>
          </Animated.View>
        )}

        {/* Timeline по месяцам */}
        {monthGroups.map(([key, items]) => (
          <Animated.View key={key} style={{ opacity: fadeAnim }}>
            <MonthSection
              monthKey={key}
              items={items}
              onPress={openLightbox}
              onReact={handleReact}
              onEditCaption={openCaption}
            />
          </Animated.View>
        ))}
      </ScrollView>

      <LightboxModal
        memory={selected}
        visible={lightboxVisible}
        onClose={closeLightbox}
        onEditCaption={() => { setLightboxVisible(false); setTimeout(() => setCaptionVisible(true), 200); }}
      />

      <CaptionModal
        visible={captionVisible}
        initialCaption={selected?.caption}
        imageUri={selected?.uri}
        onSave={saveCaption}
        onClose={() => setCaptionVisible(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  screenTitle: { fontSize: 26, fontWeight: '300', fontStyle: 'italic', color: '#2A2A2A' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  iconBtnInner: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)' },

  // Новое от партнёра
  newSection: { marginBottom: 28, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' },
  newSectionBlur: { backgroundColor: 'rgba(255,255,255,0.2)' },
  newSectionHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingBottom: 10 },
  pulseWrapper: { width: 10, height: 10, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF9A9E' },
  newSectionTitle: { flex: 1, fontSize: 12, fontWeight: '700', color: '#5C3A3A', letterSpacing: 0.3 },
  newSectionCount: {
    fontSize: 11, fontWeight: '700', color: '#FFF',
    backgroundColor: '#FF9A9E', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  newPhotosRow: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  newPhotoThumb: { width: 90, height: 90, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(92,58,58,0.08)' },
  newPhotoImg: { width: '100%', height: '100%' },

  // Month sections
  monthSection: { marginBottom: 32 },
  monthHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 },
  monthTitle: { fontSize: 17, fontWeight: '500', color: '#2A2A2A', letterSpacing: 0.2 },
  monthCount: { fontSize: 11, fontWeight: '600', color: 'rgba(92,58,58,0.4)', letterSpacing: 0.5 },

  // Grid
  grid: { flexDirection: 'row', gap: 10 },
  column: { flex: 1, gap: 10 },

  // Card
  memoryCard: {
    width: '100%', height: CARD_SIZE, borderRadius: 18, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#5C3A3A', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
    marginBottom: 0,
  },
  cardImage: { ...StyleSheet.absoluteFillObject },
  cardOverlay: { ...StyleSheet.absoluteFillObject },

  cardTopRow: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: {
    width: 20, height: 20, borderRadius: 10, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarPartner: { borderColor: 'rgba(255,200,200,0.9)' },
  newDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF9A9E' },

  cardMeta: { position: 'absolute', bottom: 8, left: 10, right: 10 },
  cardMetaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  cardDate: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  pencilBtn: { padding: 3 },
  cardCaption: { fontSize: 11, color: 'rgba(255,255,255,0.9)', lineHeight: 15, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  cardNoCaption: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },

  // Reactions
  reactionRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  reactionEmoji: { fontSize: 16, opacity: 0.5 },
  reactionActive: { opacity: 1 },
  myReaction: { fontSize: 14, marginTop: 4 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 14 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '400', color: '#5C3A3A', opacity: 0.8, textAlign: 'center' },
  emptySubtitle: { fontSize: 13, color: '#8A7070', textAlign: 'center', lineHeight: 19, paddingHorizontal: 20 },
  emptyBtn: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#2e1e00', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 20,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

  // Lightbox
  lightboxBg: { flex: 1, backgroundColor: 'rgba(10,5,5,0.93)', justifyContent: 'center', alignItems: 'center' },
  lightboxContent: { width: width - 32, borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  lightboxImage: { width: '100%', height: height * 0.5, backgroundColor: '#1a1010' },
  lightboxMeta: { padding: 16, backgroundColor: 'rgba(20,10,10,0.5)' },
  lightboxMetaRow: { flexDirection: 'row', alignItems: 'center' },
  lightboxAuthor: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600', letterSpacing: 0.4, marginBottom: 3 },
  lightboxCaption: { fontSize: 15, color: 'rgba(255,255,255,0.9)', fontWeight: '300', fontStyle: 'italic' },
  lightboxNoCaption: { fontSize: 13, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' },
  editCaptionBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 56, right: 24, width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  closeBtnInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Caption modal
  captionBg: { flex: 1, backgroundColor: 'rgba(10,5,5,0.6)', justifyContent: 'flex-end' },
  captionSheet: { borderTopLeftRadius: 36, borderTopRightRadius: 36, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  captionBlur: {},
  captionPreview: { width: '100%', height: 160 },
  captionBody: { padding: 24 },
  captionLabel: { fontSize: 9, fontWeight: '800', color: 'rgba(92,58,58,0.45)', letterSpacing: 1.5, marginBottom: 12 },
  captionInput: { fontSize: 15, color: '#2A2A2A', minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: 'rgba(92,58,58,0.12)', borderRadius: 14, padding: 12, backgroundColor: 'rgba(255,255,255,0.5)', lineHeight: 22 },
  captionCounter: { fontSize: 11, color: 'rgba(92,58,58,0.35)', textAlign: 'right', marginTop: 6, marginBottom: 18 },
  captionActions: { flexDirection: 'row', gap: 12 },
  captionCancel: { flex: 1, paddingVertical: 15, borderRadius: 16, backgroundColor: 'rgba(92,58,58,0.08)', alignItems: 'center' },
  captionCancelText: { fontSize: 14, fontWeight: '600', color: '#8A7070' },
  captionSave: { flex: 2, paddingVertical: 15, borderRadius: 16, backgroundColor: '#2e1e00', alignItems: 'center' },
  captionSaveText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
