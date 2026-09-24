import React, { useRef, useEffect } from 'react';
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  PixelRatio,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

// Нормализация размеров: базовая ширина 390px (iPhone 14)
const normalize = (size: number) => {
  const scale = width / 390;
  return Math.round(PixelRatio.roundToNearestPixel(size * scale));
};

// Укороченные подписи чтобы всегда влезали
const TABS = [
  { index: 0, label: 'Главная',  icon: 'heart-outline',    iconActive: 'heart' },
  { index: 1, label: 'Моменты',  icon: 'images-outline',   iconActive: 'images' },
  { index: 2, label: 'Настройки',icon: 'settings-outline', iconActive: 'settings' },
];

type Props = { activeTab: number; onTabChange: (index: number) => void; };
type TabItemProps = { tab: typeof TABS[0]; isActive: boolean; onPress: () => void; };

const TabItem = ({ tab, isActive, onPress }: TabItemProps) => {
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(isActive ? 1 : 0.45)).current;
  const dotAnim     = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: isActive ? 1.05 : 1, useNativeDriver: true, tension: 200, friction: 10 }),
      Animated.timing(opacityAnim, { toValue: isActive ? 1 : 0.5, duration: 200, useNativeDriver: true }),
      Animated.spring(dotAnim,     { toValue: isActive ? 1 : 0, useNativeDriver: true, tension: 200, friction: 12 }),
    ]).start();
  }, [isActive]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 70, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: isActive ? 1.05 : 1, useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
    onPress();
  };

  return (
    <Pressable style={styles.tabItem} onPress={handlePress} accessibilityLabel={tab.label}>
      <Animated.View style={[
        styles.tabInner,
        { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
      ]}>
        <Ionicons
          name={(isActive ? tab.iconActive : tab.icon) as any}
          size={normalize(22)}
          color={isActive ? '#5C3A3A' : '#8A7070'}
        />
        <Text
          style={[styles.tabLabel, isActive && styles.tabLabelActive]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {tab.label}
        </Text>
        <Animated.View style={[styles.dot, { transform: [{ scale: dotAnim }], opacity: dotAnim }]} />
      </Animated.View>
    </Pressable>
  );
};

export const TelegramStyleMenu = ({ activeTab, onTabChange }: Props) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const slideAnim       = useRef(new Animated.Value(100)).current;
  const cameraScaleAnim = useRef(new Animated.Value(1)).current;

  const bottomPad = Math.max(insets.bottom, 12);
  // Размер кнопки камеры = высота таб-бара
  // innerBorder paddingVertical(10) × 2 + tabInner paddingVertical(6) × 2 + icon(22) + gap(3) + text(10) + gap(3) + dot(4) ≈ 74
  const CAM_SIZE = normalize(74);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true,
      tension: 120, friction: 14, delay: 300,
    }).start();
  }, []);

  const handleCameraPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(cameraScaleAnim, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(cameraScaleAnim, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    navigation.navigate('Camera');
  };

  return (
    <Animated.View style={[styles.wrapper, { paddingBottom: bottomPad, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.row}>

        {/* Таб-бар */}
        <BlurView intensity={70} tint="light" style={styles.blurContainer}>
          <View style={styles.innerBorder}>
            {TABS.map((tab) => (
              <TabItem
                key={tab.index}
                tab={tab}
                isActive={activeTab === tab.index}
                onPress={() => onTabChange(tab.index)}
              />
            ))}
          </View>
        </BlurView>

        {/* Кнопка камеры */}
        <Animated.View style={{ transform: [{ scale: cameraScaleAnim }] }}>
          <Pressable onPress={handleCameraPress} accessibilityLabel="Открыть камеру">
            <BlurView
              intensity={70}
              tint="light"
              style={[styles.cameraBtn, { width: CAM_SIZE, height: CAM_SIZE, borderRadius: CAM_SIZE / 2 }]}
            >
              <Ionicons name="camera" size={normalize(24)} color="#5C3A3A" />
            </BlurView>
          </Pressable>
        </Animated.View>

      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    zIndex: 100,
    paddingHorizontal: normalize(16),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: normalize(10),
  },
  blurContainer: {
    flex: 1,
    borderRadius: normalize(36),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(253,247,242,0.35)',
    shadowColor: '#5C3A3A',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },
  innerBorder: {
    flexDirection: 'row',
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(4),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabInner: {
    alignItems: 'center',
    paddingVertical: normalize(6),
    paddingHorizontal: normalize(8),
    borderRadius: normalize(18),
    gap: 3,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  tabLabel: {
    fontSize: normalize(10),
    fontWeight: '600',
    color: '#8A7070',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#5C3A3A',
    fontWeight: '700',
  },
  dot: {
    width: normalize(4),
    height: normalize(4),
    borderRadius: normalize(2),
    backgroundColor: '#FF9A9E',
  },
  cameraBtn: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(253,247,242,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5C3A3A',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -2 },
    elevation: 20,
  },
});
