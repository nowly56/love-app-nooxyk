import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  View, Text, Pressable, StyleSheet, ImageBackground, TextInput,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard,
  Animated, LayoutAnimation, UIManager
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTelegram } from '../../integrations/telegram';

// Включаем LayoutAnimation на Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function PartnerCodeScreen() {
  const [code, setCode] = useState('');
  const [myCode, setMyCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user: telegramUser, startParam } = useTelegram();

  const colorAnim = useRef(new Animated.Value(0)).current;
  const heartAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(1)).current;

  // --- Автоформатирование кода ---
  const formatCode = (text: string) => {
    let cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (cleaned.length > 4) cleaned = cleaned.slice(0,4) + '-' + cleaned.slice(4,8);
    return cleaned;
  };

  useEffect(() => {
    AsyncStorage.getItem('user_invite_code').then(setMyCode);
    if (startParam) setCode(formatCode(startParam));
  }, [startParam]);

  // --- Анимация цвета кнопки и сердца ---
  useEffect(() => {
    const isActive = code.length === 9;
    let pulse: Animated.CompositeAnimation | undefined;

    Animated.timing(colorAnim, {
      toValue: isActive ? 1 : 0,
      duration: 400,
      useNativeDriver: false,
    }).start();

    if (isActive) {
      pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(heartAnim, { toValue: 1.3, duration: 300, useNativeDriver: true }),
          Animated.timing(heartAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        ])
      );
      pulse.start();
    } else {
      heartAnim.setValue(1);
    }

    return () => pulse && pulse.stop();
  }, [code]);

  // --- Shake animation при неверном коде ---
  const handleConnect = useCallback(async () => {
    if (code.length === 9) {
      setErrorMessage('Подключение партнёра появится позже. Сейчас архив хранится только на этом устройстве.');
    } else {
      setErrorMessage('Введите код в формате LOVE-1234.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [code, telegramUser?.id, navigation]);

  // --- Копирование кода ---
  const handleCopyCode = useCallback(async () => {
    if (!myCode) return;
    await Clipboard.setStringAsync(myCode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [myCode]);

  // --- Плавное исчезновение заголовка при клавиатуре ---
  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      Animated.timing(titleAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    });
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      Animated.timing(titleAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const backgroundColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#AAA', '#FF4D6D'],
  });

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <LinearGradient colors={['#FDFCFB', '#F2E2D2', '#E2D1C3']} style={StyleSheet.absoluteFill} />
        <ImageBackground
          source={{ uri: 'https://www.transparenttextures.com/patterns/tactile-noise-light.png' }}
          style={{ opacity: 0.2, zIndex: 1, ...StyleSheet.absoluteFillObject }}
          resizeMode="repeat" 
        />

        {/* Кнопка назад вне KeyboardAvoidingView */}
        <Pressable 
          style={[styles.backButton, { top: 20 + insets.top }]} 
          onPress={() => { Haptics.selectionAsync(); navigation.goBack(); }}
          accessibilityLabel="Назад"
        >
          <Ionicons name="chevron-back" size={24} color="rgba(0,0,0,0.5)" />
        </Pressable>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
          keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 70} 
          style={styles.content}
        >
          <View style={styles.centerBlock}>
            <Animated.Text style={[styles.mainTitle, { opacity: titleAnim, transform: [{ scale: titleAnim }] }]}>
              Связь с партнером
            </Animated.Text>

            <Animated.View style={[styles.glassWrapper, { transform: [{ translateX: shakeAnim }] }]}>
              <BlurView intensity={90} tint="light" style={styles.liquidGlassCard}>
                <Text style={styles.label}>ВВЕДИТЕ УНИКАЛЬНЫЙ КОД</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="XXXX-XXXX"
                    placeholderTextColor="rgba(0,0,0,0.2)"
                    value={code}
                    onChangeText={(text) => setCode(formatCode(text))}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={9}
                    keyboardType="default"
                    returnKeyType="done"
                  />
                </View>
                <Text style={styles.helperText}>
                  Попросите партнера отправить вам код из его приложения, чтобы объединить ваши аккаунты.
                </Text>

                <Animated.View style={[styles.connectBtn, { backgroundColor }]}>
                  <Pressable
                    style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%' }}
                    disabled={code.length !== 9 || isConnecting}
                    onPress={handleConnect}
                  >
                    <Text style={styles.connectText}>{isConnecting ? 'Подключение…' : 'Связаться'}</Text>
                    <Animated.View style={{ transform: [{ scale: heartAnim }] }}>
                      <Ionicons name="heart" size={20} color="#FFF" style={{ marginLeft: 8 }} />
                    </Animated.View>
                  </Pressable>
                </Animated.View>
              </BlurView>
            </Animated.View>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <View style={{ marginTop: 40, alignItems: 'center' }}>
              <Text style={styles.myCodeLabel}>Ваш код для партнера:</Text>
              <Pressable style={styles.myCodeBadge} onPress={handleCopyCode} accessibilityLabel="Скопировать код">
                <Text style={styles.myCodeText}>{myCode || 'Сначала сохраните дату'}</Text>
                <Ionicons name="copy-outline" size={16} color="#444" style={{ marginLeft: 10 }} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 30, justifyContent: 'center', zIndex: 2 },
  backButton: { position: 'absolute', left: 20, padding: 10, zIndex: 10 },
  centerBlock: { alignItems: 'center', width: '100%' },
  mainTitle: { fontSize: 28, fontWeight: '200', color: '#1a1a1a', marginBottom: 40, textAlign: 'center' },
  glassWrapper: { width: '100%', borderRadius: 45, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  liquidGlassCard: { width: '100%', padding: 30, alignItems: 'center' },
  label: { fontSize: 10, fontWeight: '800', color: 'rgba(0,0,0,0.3)', letterSpacing: 2, marginBottom: 20 },
  inputContainer: { width: '100%', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 22, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  input: { paddingVertical: 18, paddingHorizontal: 20, fontSize: 18, textAlign: 'center', color: '#333', fontWeight: '600', letterSpacing: 2 },
  helperText: { fontSize: 13, color: 'rgba(0,0,0,0.4)', textAlign: 'center', lineHeight: 18, marginBottom: 25, paddingHorizontal: 10 },
  connectBtn: { width: '100%', paddingVertical: 18, borderRadius: 22, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  connectText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  errorText: { color: '#B42318', fontSize: 13, textAlign: 'center', marginTop: 14, paddingHorizontal: 16 },
  myCodeLabel: { fontSize: 12, color: 'rgba(0,0,0,0.4)', marginBottom: 10 },
  myCodeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.4)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  myCodeText: { fontSize: 16, fontWeight: '700', color: '#444', letterSpacing: 1 },
});
