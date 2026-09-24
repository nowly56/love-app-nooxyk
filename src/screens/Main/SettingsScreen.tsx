import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch,
  Platform, Animated, Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetBackdropProps, BottomSheetView } from '@gorhom/bottom-sheet';
import { Calendar, LocaleConfig } from 'react-native-calendars';

const { width } = Dimensions.get('window');

LocaleConfig.locales['ru'] = {
  monthNames: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
  monthNamesShort: ['Янв.','Фев.','Мар.','Апр.','Май','Июн.','Июл.','Авг.','Сен.','Окт.','Ноя.','Дек.'],
  dayNames: ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'],
  dayNamesShort: ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],
  today: 'Сегодня',
};
LocaleConfig.defaultLocale = 'ru';

// ─── Pulsing Status Dot ───────────────────────────────────────────────────────
type ConnectionStatus = 'online' | 'offline';

const PulsingStatus = ({ status }: { status: ConnectionStatus }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.7)).current;
  const isOnline = status === 'online';
  const color = isOnline ? '#7BC67E' : '#BBBBBB';

  useEffect(() => {
    if (!isOnline) { pulseAnim.setValue(1); opacityAnim.setValue(0.4); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, { toValue: 2.2, duration: 900, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(400),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isOnline]);

  return (
    <View style={[styles.statusPill, { backgroundColor: isOnline ? 'rgba(123,198,126,0.12)' : 'rgba(0,0,0,0.06)' }]}>
      <View style={styles.dotWrapper}>
        <Animated.View style={[styles.dotRing, { backgroundColor: color, transform: [{ scale: pulseAnim }], opacity: opacityAnim }]} />
        <View style={[styles.dotCore, { backgroundColor: color }]} />
      </View>
      <Text style={[styles.statusText, { color: isOnline ? '#4A7D4D' : '#999' }]}>
        {isOnline ? 'Связаны' : 'Нет связи'}
      </Text>
    </View>
  );
};

// ─── Avatar Stack ─────────────────────────────────────────────────────────────
const AvatarStack = () => (
  <View style={styles.avatarStack}>
    <View style={[styles.avatarCircle, styles.avatarLeft]}>
      <LinearGradient colors={['#fae1dd', '#f2b5a0']} style={StyleSheet.absoluteFill} />
      <Ionicons name="person" size={22} color="rgba(92,58,58,0.6)" />
    </View>
    <View style={[styles.avatarCircle, styles.avatarRight]}>
      <LinearGradient colors={['#e2d1c3', '#c9b8a8']} style={StyleSheet.absoluteFill} />
      <Ionicons name="person" size={22} color="rgba(92,58,58,0.6)" />
    </View>
    <View style={styles.heartBadge}>
      <Ionicons name="heart" size={10} color="#FF9A9E" />
    </View>
  </View>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDisplayDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

// ─── Profile Card ─────────────────────────────────────────────────────────────
type ProfileCardProps = {
  connectionStatus: ConnectionStatus;
  startDate: string | null;
  onEditDate: () => void;
};

const ProfileCard = ({ connectionStatus, startDate, onEditDate }: ProfileCardProps) => (
  <View style={styles.profileCardWrapper}>
    <LinearGradient colors={['rgba(255,248,244,0.95)', 'rgba(255,255,255,0.80)']} style={styles.profileCardGradient}>
      <BlurView intensity={40} tint="light" style={styles.profileCardBlur}>
        <AvatarStack />
        <View style={styles.profileInfo}>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>ИМЯ</Text>
            <Text style={styles.profileValue}>Михаил</Text>
          </View>
          <View style={styles.profileDivider} />
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>ИМЯ ПАРТНЕРА</Text>
            <Text style={styles.profileValue}>Александра</Text>
          </View>
          <View style={styles.profileDivider} />
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>СТАТУС</Text>
            <PulsingStatus status={connectionStatus} />
          </View>
          <View style={styles.profileDivider} />

          {/* Нажимаемая строка с датой */}
          <Pressable
            style={({ pressed }) => [styles.profileRow, pressed && { opacity: 0.55 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onEditDate();
            }}
            accessibilityLabel="Изменить дату начала"
          >
            <Text style={styles.profileLabel}>ДАТА НАЧАЛА</Text>
            <View style={styles.dateEditRow}>
              <Text style={styles.profileValue}>{formatDisplayDate(startDate)}</Text>
              <Ionicons name="pencil-outline" size={11} color="rgba(92,58,58,0.38)" style={{ marginLeft: 5 }} />
            </View>
          </Pressable>
        </View>
      </BlurView>
    </LinearGradient>
  </View>
);

// ─── Setting Row ──────────────────────────────────────────────────────────────
type RowProps = {
  icon: string; title: string; value?: string;
  type?: 'chevron' | 'switch'; switchValue?: boolean;
  onSwitchChange?: (v: boolean) => void; onPress?: () => void;
  color?: string; danger?: boolean;
};

const SettingRow = ({ icon, title, value, type = 'chevron', switchValue, onSwitchChange, onPress, color = '#5C3A3A', danger = false }: RowProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 12, useNativeDriver: true }),
    ]).start();
    onPress?.();
  };
  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.row, { transform: [{ scale: scaleAnim }] }]}>
        <BlurView intensity={50} tint="light" style={styles.rowBlur}>
          <LinearGradient
            colors={danger ? ['rgba(255,75,75,0.06)', 'rgba(255,255,255,0.55)'] : ['rgba(255,248,244,0.7)', 'rgba(255,255,255,0.5)']}
            style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          />
          <View style={[styles.rowIcon, { backgroundColor: (danger ? '#FF4B4B' : color) + '18' }]}>
            <Ionicons name={icon as any} size={19} color={danger ? '#FF4B4B' : color} />
          </View>
          <Text style={[styles.rowTitle, danger && { color: '#FF4B4B' }]}>{title}</Text>
          {type === 'chevron' && (
            <View style={styles.rowRight}>
              {value ? <Text style={styles.rowValue}>{value}</Text> : null}
              <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.2)" />
            </View>
          )}
          {type === 'switch' && (
            <Switch value={switchValue} onValueChange={onSwitchChange}
              trackColor={{ false: 'rgba(0,0,0,0.1)', true: '#5C3A3A' }}
              thumbColor={Platform.OS === 'ios' ? undefined : '#FFF'}
            />
          )}
        </BlurView>
      </Animated.View>
    </Pressable>
  );
};

const Section = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <View style={styles.section}>
    {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
    <View style={styles.sectionRows}>{children}</View>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
type Props = {
  startDate: string | null;
  onDateChange: (newDate: string) => void;
};

export default function SettingsScreen({ startDate, onDateChange }: Props) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState(true);
  const [connectionStatus] = useState<ConnectionStatus>('online'); // заглушка
  const [tempDate, setTempDate] = useState<string | null>(null);

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['75%'], []);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const openDatePicker = useCallback(() => {
    setTempDate(startDate);
    bottomSheetRef.current?.present();
  }, [startDate]);

  const handleConfirm = useCallback(async () => {
    if (!tempDate) return;
    try {
      await AsyncStorage.setItem('user_start_date', tempDate);
      onDateChange(tempDate);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error('Ошибка сохранения даты:', e);
    }
    bottomSheetRef.current?.dismiss();
  }, [tempDate, onDateChange]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ), []
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FDFCFB', '#F5EDE5', '#EDE0D5']} style={StyleSheet.absoluteFill} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={styles.header}>
            <Text style={styles.screenTitle}>Настройки</Text>
          </View>

          <ProfileCard connectionStatus={connectionStatus} startDate={startDate} onEditDate={openDatePicker} />

          <Section title="ПРИЛОЖЕНИЕ">
            <SettingRow icon="notifications-outline" title="Уведомления" type="switch" switchValue={notifications} onSwitchChange={setNotifications} />
            <SettingRow icon="lock-closed-outline" title="Код-пароль / Face ID" value="Выкл" />
            <SettingRow icon="color-palette-outline" title="Тема оформления" value="Кофейная" />
          </Section>

          <Section title="ПОДДЕРЖКА">
            <SettingRow icon="help-circle-outline" title="Помощь" />
            <SettingRow icon="star-outline" title="Оценить приложение" />
            <SettingRow icon="share-outline" title="Поделиться" />
          </Section>

          <Section>
            <SettingRow icon="heart-dislike-outline" title="Разорвать связь" danger />
          </Section>
        </Animated.View>
      </ScrollView>

      {/* BottomSheet: выбор даты */}
      <BottomSheetModal
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enablePanDownToClose
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Изменить дату начала</Text>
          <Text style={styles.sheetSubtitle}>Счётчик на главном экране обновится автоматически</Text>

          <Calendar
            onDayPress={(day: any) => {
              setTempDate(day.dateString);
              Haptics.selectionAsync();
            }}
            markedDates={tempDate ? { [tempDate]: { selected: true, selectedColor: '#FF9A9E' } } : {}}
            maxDate={todayStr}
            theme={{
              selectedDayBackgroundColor: '#FF9A9E',
              todayTextColor: '#5C3A3A',
              arrowColor: '#5C3A3A',
              dotColor: '#FF9A9E',
            }}
          />

          <Pressable
            style={[styles.confirmBtn, !tempDate && styles.confirmBtnDisabled]}
            disabled={!tempDate}
            onPress={handleConfirm}
          >
            <Text style={[styles.confirmText, !tempDate && { color: '#AAA' }]}>Сохранить</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 22 },

  header: { marginBottom: 28 },
  appName: { fontSize: 10, fontWeight: '800', color: '#5C3A3A', letterSpacing: 1.5, opacity: 0.55, marginBottom: 4 },
  screenTitle: { fontSize: 30, fontWeight: '300', color: '#2A2A2A' },

  profileCardWrapper: {
    borderRadius: 28, overflow: 'hidden', borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)', marginBottom: 32,
    shadowColor: '#5C3A3A', shadowOpacity: 0.08, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  profileCardGradient: { borderRadius: 28 },
  profileCardBlur: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 20 },

  avatarStack: { width: 72, height: 72, position: 'relative', flexShrink: 0 },
  avatarCircle: {
    width: 52, height: 52, borderRadius: 26, position: 'absolute',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)',
  },
  avatarLeft: { top: 0, left: 0, zIndex: 2 },
  avatarRight: { bottom: 0, right: 0, zIndex: 1 },
  heartBadge: {
    position: 'absolute', top: '50%', left: '50%',
    marginTop: -10, marginLeft: -10, width: 20, height: 20,
    borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center', alignItems: 'center', zIndex: 3,
    shadowColor: '#FF9A9E', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },

  profileInfo: { flex: 1 },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  profileDivider: { height: 1, backgroundColor: 'rgba(92,58,58,0.07)' },
  profileLabel: { fontSize: 9, fontWeight: '800', color: 'rgba(92,58,58,0.45)', letterSpacing: 1.2 },
  profileValue: { fontSize: 13, fontWeight: '500', color: '#2A2A2A' },
  dateEditRow: { flexDirection: 'row', alignItems: 'center' },

  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, gap: 6 },
  dotWrapper: { width: 10, height: 10, justifyContent: 'center', alignItems: 'center' },
  dotRing: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  dotCore: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 11, fontWeight: '600' },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 10, fontWeight: '800', color: 'rgba(92,58,58,0.4)', letterSpacing: 1.4, marginLeft: 6, marginBottom: 10 },
  sectionRows: { gap: 10 },

  row: {
    borderRadius: 22, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)', shadowColor: '#5C3A3A',
    shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  rowBlur: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  rowIcon: { width: 36, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '500', color: '#2A2A2A' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 13, color: 'rgba(0,0,0,0.35)', fontWeight: '500' },

  sheetBackground: { backgroundColor: '#FFF', borderTopLeftRadius: 40, borderTopRightRadius: 40 },
  sheetHandle: { backgroundColor: 'rgba(0,0,0,0.1)', width: 40 },
  sheetContent: { flex: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  sheetTitle: { fontSize: 20, fontWeight: '400', color: '#2A2A2A', textAlign: 'center', marginBottom: 6 },
  sheetSubtitle: { fontSize: 12, color: 'rgba(0,0,0,0.35)', textAlign: 'center', marginBottom: 20, lineHeight: 17 },
  confirmBtn: {
    marginTop: 20, paddingVertical: 18, borderRadius: 22,
    backgroundColor: '#2e1e00', flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  confirmBtnDisabled: { backgroundColor: 'rgba(0,0,0,0.1)' },
  confirmText: { color: '#FFF', fontSize: 17, fontWeight: '700' },

  version: { textAlign: 'center', color: 'rgba(92,58,58,0.3)', fontSize: 11, marginTop: 12, letterSpacing: 0.3 },
});
