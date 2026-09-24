import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { useFonts } from 'expo-font';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TamaguiProvider, Theme, Paragraph, YStack, Button } from 'tamagui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import tamaguiConfig from './tamagui.config';

import RegistrationScreen from './src/screens/Auth/RegistrationScreen';
import PartnerCodeScreen from './src/screens/Auth/PartnerScreen';
import CameraScreen from './src/screens/Camera';
import MainLayout from './src/screens/MainLayout';
import { TelegramProvider, useTelegram } from './src/integrations/telegram';

const Stack = createNativeStackNavigator();

if (Platform.OS === 'web') {
  require('./tamagui-web.css');
}

type InitialRouteName = 'Auth' | 'PartnerScreen' | 'Main';

export default function App() {
  const [loaded] = useFonts({
    Inter: require('@tamagui/font-inter/otf/Inter-Medium.otf'),
    InterBold: require('@tamagui/font-inter/otf/Inter-Bold.otf'),
  });

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <TelegramProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
            <Theme name="light">
              <BottomSheetModalProvider>
                <AppNavigator />
              </BottomSheetModalProvider>
              <StatusBar style="auto" />
            </Theme>
          </TamaguiProvider>
        </GestureHandlerRootView>
      </TelegramProvider>
    </SafeAreaProvider>
  );
}

function AppNavigator() {
  const { isReady, startParam } = useTelegram();
  const [initialRouteName, setInitialRouteName] = useState<InitialRouteName | null>(null);

  useEffect(() => {
    if (!isReady) return;

    AsyncStorage.getItem('user_start_date').then((savedDate) => {
      if (startParam) {
        setInitialRouteName('PartnerScreen');
      } else if (savedDate) {
        setInitialRouteName('Main');
      } else {
        setInitialRouteName('Auth');
      }
    });
  }, [isReady, startParam]);

  if (!initialRouteName) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="#FDF7F2">
        <Paragraph color="#5C3A3A">Подготавливаем Love Archive…</Paragraph>
      </YStack>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRouteName}>
        <Stack.Screen
          name="Auth"
          component={RegistrationScreen}
          options={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }}
        />
        <Stack.Screen
          name="PartnerScreen"
          component={PartnerCodeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Main" component={MainLayout} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Details" component={DetailsScreen} />
        <Stack.Screen name="Camera" component={CameraScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function HomeScreen({ navigation }: any) {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" gap="$4">
      <Paragraph size="$5">Главная</Paragraph>
      <Button onPress={() => navigation.navigate('Details')}>Открыть детали</Button>
      <Button onPress={() => navigation.navigate('Main')}>Открыть Love Space</Button>
    </YStack>
  );
}

function DetailsScreen() {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" gap="$4">
      <Paragraph size="$5">Детали</Paragraph>
      <Button>Кнопка</Button>
    </YStack>
  );
}
