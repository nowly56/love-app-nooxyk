import React, { useRef, useEffect, useMemo } from 'react';
import { 
  View, Text, Pressable, StyleSheet, ImageBackground, 
  Animated, Dimensions 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp } from '@react-navigation/native';
import { shareTelegramInvite, telegramHaptic } from '../../integrations/telegram';

type RootStackParamList = {
  LoveSpace: { startDate: string; inviteCode?: string | null };
};

type LoveSpaceScreenRouteProp = RouteProp<RootStackParamList, 'LoveSpace'>;

// ПУЛЬСИРУЮЩАЯ ТОЧКА СТАТУСА
const PulsingDot = ({ color = '#FFD700' }: { color?: string }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
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
  }, []);

  return (
    <View style={pulsingStyles.wrapper}>
      <Animated.View style={[pulsingStyles.ring, { backgroundColor: color, transform: [{ scale: pulseAnim }], opacity: opacityAnim }]} />
      <View style={[pulsingStyles.core, { backgroundColor: color }]} />
    </View>
  );
};

const pulsingStyles = StyleSheet.create({
  wrapper: { width: 10, height: 10, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  ring: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  core: { width: 7, height: 7, borderRadius: 3.5 },
});

// ОПТИМИЗИРОВАННЫЙ ПРОГРЕСС БАР (Работает в 60 FPS)
const ProgressBar = ({ progress = 0 }: { progress?: number }) => {
  const scaleXAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(scaleXAnim, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: true, // Теперь работает аппаратно
    }).start();
  }, [progress]);

  return (
    <View style={styles.progressContainer}>
      <Animated.View style={[styles.progressBar, { transform: [{ scaleX: scaleXAnim }] }]}>
        <LinearGradient
           colors={['#fae1dd', '#e5e6ea']} 
           start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
           style={StyleSheet.absoluteFill} 
        />
      </Animated.View>
    </View>
  );
};

export function LoveSpaceScreen({ route }: { route: LoveSpaceScreenRouteProp }) {
  const insets = useSafeAreaInsets();
  
  // Получаем дату из параметров навигации (с экрана RegistrationScreen)
  const { startDate, inviteCode } = route.params;
  
  // НАДЕЖНЫЙ ПОДСЧЕТ ДНЕЙ 
  const loveDays = useMemo(() => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0); // Обнуляем часы (защита от часовых поясов)
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); 
    
    const diffTime = today.getTime() - start.getTime();
    if (diffTime < 0) return 0; // Если дата из будущего
    
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }, [startDate]);

  // Расчет до следующего юбилея (кратное 50)
  const { nextMilestone, daysLeftToMilestone, milestoneProgress } = useMemo(() => {
    const next = Math.ceil((loveDays + 1) / 50) * 50; 
    const left = Math.max(next - loveDays, 0);
    const progress = Math.min(loveDays / next, 1);
    return { nextMilestone: next, daysLeftToMilestone: left, milestoneProgress: progress };
  }, [loveDays]);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []); // Анимация только при первом открытии экрана

  const handlePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    telegramHaptic('light');
    if (inviteCode) {
      await shareTelegramInvite(inviteCode);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FDFCFB', '#F2E2D2', '#E2D1C3']} style={StyleSheet.absoluteFill} />
      
      <ImageBackground
        source={{ uri: 'https://www.transparenttextures.com/patterns/tactile-noise-light.png' }}
        style={{ opacity: 0.15, zIndex: 1, ...StyleSheet.absoluteFillObject }}
        resizeMode="repeat" 
      />

      <View style={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]}>
        
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <View>
          </View>
          
          <View style={styles.headerRight}>
            <View style={styles.statusBadge}>
              <PulsingDot color="#FFD700" />
              <Text style={styles.statusText}>ЖДЕМ ПАРТНЕРА</Text>
            </View>
            <Pressable onPress={handlePress} style={styles.inviteButton}>
              <Text style={styles.inviteText}>ПРИГЛАСИТЬ</Text>
              <Ionicons name="chevron-forward" size={12} color="#000000" style={{marginLeft: 4}}/>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View style={[styles.counterContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Отображаем динамическое количество дней */}
          <Text style={styles.mainNumber}>{loveDays}</Text>
          <Text style={styles.mainLabel}>ДНЕЙ ЛЮБВИ</Text>
        </Animated.View>

        <Animated.View style={[styles.glassWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <BlurView intensity={70} tint="light" style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>СЛЕДУЮЩИЙ ЮБИЛЕЙ</Text>
              <Ionicons name="star-outline" size={18} color="rgba(0,0,0,0.3)" />
            </View>
            
            <Text style={styles.cardTitle}>{nextMilestone} Дней</Text>
            
            <ProgressBar progress={milestoneProgress} />

            <View style={styles.cardFooter}>
              <Text style={styles.footerText}>{daysLeftToMilestone} ДНЕЙ ОСТАЛОСЬ</Text>
              <Text style={styles.footerPercent}>{Math.round(milestoneProgress * 100)}%</Text>
            </View>
          </BlurView>
        </Animated.View>

        <View style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, zIndex: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 },
  appName: { fontSize: 10, fontWeight: '800', color: '#5C3A3A', letterSpacing: 1.5, opacity: 0.7 },
  appSubName: { fontSize: 20, fontWeight: '400', fontStyle: 'italic', color: '#3A2A2A', marginTop: 2 },
  headerRight: { alignItems: 'flex-end', gap: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.4)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFD700', marginRight: 6 },
  statusText: { fontSize: 10, fontWeight: '700', color: '#5C3A3A', letterSpacing: 0.5 },
  inviteButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  inviteText: { fontSize: 10, fontWeight: '700', color: '#5C3A3A', letterSpacing: 0.5 },
  counterContainer: { alignItems: 'center', marginTop: 20, marginBottom: 50 },
  mainNumber: { fontSize: 140, fontWeight: '200', color: '#2A2A2A', lineHeight: 150, includeFontPadding: false },
  mainLabel: { fontSize: 12, fontWeight: '600', color: '#5C3A3A', letterSpacing: 4, textTransform: 'uppercase', opacity: 0.7 },
  glassWrapper: { width: '100%', borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 20, shadowOffset: {width: 0, height: 10} },
  cardContent: { padding: 24 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardLabel: { fontSize: 11, fontWeight: '800', color: '#5C3A3A', letterSpacing: 1.5, opacity: 0.6 },
  cardTitle: { fontSize: 22, fontWeight: '600', color: '#2A2A2A', marginBottom: 20 },
  progressContainer: { height: 8, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 4, width: '100%', overflow: 'hidden', marginBottom: 16 },
  progressBar: { height: '100%', borderRadius: 4, transformOrigin: 'left' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 12, color: '#5C3A3A', opacity: 0.6 },
  footerPercent: { fontSize: 12, color: '#5C3A3A', fontWeight: '700', opacity: 0.8 },
});
