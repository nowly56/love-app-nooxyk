import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, StatusBar } from 'react-native';
// Удаляем BlurView и LinearGradient, они больше не нужны для нового дизайна
// import { BlurView } from 'expo-blur';
import { Calendar, LocaleConfig } from 'react-native-calendars';
// import { LinearGradient } from 'expo-linear-gradient';
// import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetBackdropProps, BottomSheetView } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

LocaleConfig.locales['ru'] = {
  monthNames: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
  monthNamesShort: ['Янв.','Фев.','Мар.','Апр.','Май','Июн.','Июл.','Авг.','Сен.','Окт.','Ноя.','Дек.'],
  dayNames: ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'],
  dayNamesShort: ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],
  today: 'Сегодня',
};
LocaleConfig.defaultLocale = 'ru';

type RootStackParamList = {
  Registration: undefined;
  PartnerScreen: undefined;
  Main: undefined;
};

type RegistrationScreenProp = NativeStackNavigationProp<
  RootStackParamList,
  'Registration'
>;

export default function RegistrationScreen() {
  const [date, setDate] = useState<string | null>(null);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['90%'], []);
  const lastHaptic = useRef<number>(0);
  const navigation = useNavigation<RegistrationScreenProp>();

  const hapticSelection = useCallback(() => {
    const now = Date.now();
    if (now - lastHaptic.current > 250) {
      lastHaptic.current = now;
      Haptics.selectionAsync();
    }
  }, []);

  const closeCalendar = useCallback(
    () => bottomSheetModalRef.current?.dismiss(),
    []
  );
  const openCalendar = useCallback(
    () => bottomSheetModalRef.current?.present(),
    []
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );

  const displayDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  const relationDurationLabel = useMemo(() => {
    if (!date) return null;

    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const diff = currentDate.getTime() - selectedDate.getTime();
    const dayMs = 1000 * 60 * 60 * 24;
    const days = Math.floor(diff / dayMs);

    if (days <= 0) return 'Это сегодня ✨';
    if (days === 1) return 'Вместе уже 1 день';
    if (days < 5) return `Вместе уже ${days} дня`;
    return `Вместе уже ${days} дней`;
  }, [date]);

  const setRelativeDate = useCallback((offsetInDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() - offsetInDays);
    setDate(d.toISOString().split('T')[0]);
    hapticSelection();
  }, [hapticSelection]);

  // Сохраняем анимацию шума, но сделаем непрозрачность более тонкой для соответствия дизайну
  const noiseOpacity = useSharedValue(0.1); 
  useEffect(() => {
    noiseOpacity.value = withRepeat(
      withTiming(0.2, { duration: 5000, easing: Easing.linear }),
      -1,
      true
    );
  }, []);
  const noiseAnimatedStyle = useAnimatedStyle(() => ({
    opacity: noiseOpacity.value,
  }));

  const handleContinue = async () => {
    if (!date) return;

    try {
      await AsyncStorage.setItem('user_start_date', date);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
      navigation.replace('Main');
    } catch (e) {
      console.error('Ошибка при сохранении даты:', e);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Анимированный шум — заменен на более тонкую текстуру, как в дизайне */}
      <Animated.Image
        source={{ uri: 'https://www.transparenttextures.com/patterns/microfabrics.png' }} 
        resizeMode="repeat"
        style={[styles.noiseOverlay, noiseAnimatedStyle]}
      />

      <View style={styles.content}>
        {/* Верхний мета-текст — Технический, моноширинный */}
        <Text style={styles.appName}>01 // ARCHIVE GENESIS</Text>

        <View style={styles.mainGroup}>
          {/* Главный заголовок — Огромный, жирный, черный */}
          <Text style={styles.mainTitle}>Когда всё началось?</Text>
          <Text style={styles.subtitle}>Выберите день, с которого хотите считать вашу историю.</Text>

          {/* Центральный блок выбора даты — Простой, без фона и размытия */}
          <View style={styles.dateBlock}>
            <Text style={styles.label}>ДАТА НАЧАЛА ОТНОШЕНИЙ</Text>

            {/* Кнопка выбора даты: стилизована как белая кнопка с контуром */}
            <Pressable
              style={({ pressed }) => [
                styles.dateSelectBtn,
                pressed && { opacity: 0.7 },
              ]}
              onPress={openCalendar}
            >
              <Text style={[styles.dateSelectText, !date && styles.placeholderText]}>
                {date ? displayDate(date) : 'Выбрать дату'}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            <View style={styles.quickDatesRow}>
              <Pressable style={styles.quickDateChip} onPress={() => setRelativeDate(0)}>
                <Text style={styles.quickDateText}>Сегодня</Text>
              </Pressable>
              <Pressable style={styles.quickDateChip} onPress={() => setRelativeDate(1)}>
                <Text style={styles.quickDateText}>Вчера</Text>
              </Pressable>
            </View>

            {relationDurationLabel && (
              <View style={styles.hintCard}>
                <Text style={styles.hintLabel}>ВАША ИСТОРИЯ</Text>
                <Text style={styles.hintText}>{relationDurationLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Группа кнопок внизу — Горизонтальная, как на изображении */}
        <View style={styles.buttonGroup}>
          {/* Левая кнопка — Главная, черная, стадионная. Это кнопка продолжения. */}
          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              !date && styles.disabledBtn,
              pressed && date && { transform: [{ scale: 0.98 }] },
            ]}
            disabled={!date}
            onPress={handleContinue}
          >
            <Text style={styles.continueText}>Сохранить</Text>
            {/* Иконку удаляем, в дизайне ее нет */}
          </Pressable>

          {/* Правая кнопка — Вспомогательная, белая с контуром, стадионная. Кнопка партнерского кода. */}
          <Pressable
            style={styles.partnerCodeBtn}
            onPress={() => navigation.navigate('PartnerScreen')}
          >
            <Text style={styles.partnerText}>Партнерский код</Text>
          </Pressable>
        </View>
      </View>

      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handle}
        enablePanDownToClose
      >
        <BottomSheetView style={styles.sheetContent}>
          <Text style={styles.modalTitle}>Когда всё началось?</Text>

          <Calendar
            onDayPress={(day: any) => {
              setDate(day.dateString);
              hapticSelection();
            }}
            markedDates={
              date
                ? { [date]: { selected: true, selectedColor: '#000000' } } // Изменяем цвет выделения на черный
                : {}
            }
            maxDate={todayStr}
            theme={{
              selectedDayBackgroundColor: '#000000',
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: '#000000',
              arrowColor: '#000000',
              monthTextColor: '#111111',
              textMonthFontWeight: '700',
              textDayHeaderFontWeight: '600',
              textDayFontWeight: '500',
            }}
          />

          <Pressable style={styles.modalConfirmBtn} onPress={closeCalendar}>
            <Text style={styles.modalConfirmText}>Готово</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' }, // Чисто белый фон
  content: { flex: 1, paddingHorizontal: 30, justifyContent: 'space-between', paddingVertical: 80, zIndex: 5 },
  appName: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Courier', // Моноширинный стиль
    color: '#000000',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 40,
  },
  mainGroup: { alignItems: 'flex-start', width: '100%', paddingBottom: 60 },
  mainTitle: {
    fontSize: 56, // Огромный шрифт
    fontWeight: '900', // Очень жирный
    color: '#000000',
    lineHeight: 64,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    color: 'rgba(0,0,0,0.55)',
    marginBottom: 32,
    maxWidth: 300,
  },
  dateBlock: { width: '100%' },
  label: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Courier', // Моноширинный стиль
    color: 'rgba(0,0,0,0.3)',
    letterSpacing: 2,
    marginBottom: 15,
  },
  dateSelectBtn: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 999, // Полностью скругленная стадионная форма
    borderWidth: 1.5,
    borderColor: '#000000', // Черный контур
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    marginBottom: 0,
  },
  dateSelectText: { fontSize: 16, fontWeight: '600', color: '#000000' },
  placeholderText: { color: 'rgba(0,0,0,0.45)' },
  chevron: { fontSize: 26, color: '#000000', marginTop: -2 },
  quickDatesRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  quickDateChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.14)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
  },
  quickDateText: { fontSize: 13, fontWeight: '600', color: '#111' },
  hintCard: {
    marginTop: 16,
    backgroundColor: '#F6F6F6',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hintLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Courier',
    color: 'rgba(0,0,0,0.35)',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  hintText: { fontSize: 15, fontWeight: '700', color: '#0D0D0D' },

  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    // Позиционируем кнопки внизу
    position: 'absolute',
    bottom: 40,
    left: 30,
    right: 30,
  },
  continueBtn: {
    width: '48%',
    paddingVertical: 20,
    borderRadius: 999, // Стадионная форма
    backgroundColor: '#000000', // Полностью черная кнопка
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledBtn: { backgroundColor: 'rgba(0,0,0,0.1)' },
  continueText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginRight: 0 },

  partnerCodeBtn: {
    width: '48%',
    paddingVertical: 20,
    borderRadius: 999, // Стадионная форма
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.15)', // Тонкий контур
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerText: { fontSize: 14, color: '#000000', fontWeight: '600' },

  sheetBackground: { backgroundColor: '#FFF', borderTopLeftRadius: 40, borderTopRightRadius: 40 },
  sheetContent: { flex: 1, padding: 24 },
  handle: { backgroundColor: 'rgba(0,0,0,0.1)', width: 40 },
  modalTitle: { fontSize: 20, fontWeight: '400', textAlign: 'center', marginBottom: 20, color: '#333' },
  modalConfirmBtn: { marginTop: 20, paddingVertical: 18, borderRadius: 22, backgroundColor: '#111', alignItems: 'center' },
  modalConfirmText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  noiseOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 4, opacity: 0.1 }, // Снижена непрозрачность для более тонкого эффекта
});
