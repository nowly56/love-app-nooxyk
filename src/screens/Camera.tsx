import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
// Используем CameraView из новой версии expo-camera (SDK 50+)
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import Slider from '@react-native-community/slider';

export default function CameraScreen() {
  const cameraRef = useRef<CameraView>(null);
  
  // Expo Camera использует 'facing' вместо 'devicePosition'
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [zoom, setZoom] = useState(0); // 0 - 1

  // Хуки разрешений Expo
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  // Состояние для визуального квадрата фокуса
  const [focusBox, setFocusBox] = useState<{ x: number; y: number } | null>(null);

  // Запрашиваем разрешения при старте
  useEffect(() => {
    (async () => {
      if (!camPermission?.granted) await requestCamPermission();
      if (!micPermission?.granted) await requestMicPermission();
    })();
  }, []);

  // Пока разрешения загружаются
  if (!camPermission || !micPermission) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: 'white' }}>Loading permissions...</Text>
      </View>
    );
  }

  // Если разрешения не выданы
  if (!camPermission.granted || !micPermission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: 'white', marginBottom: 20 }}>
          Camera and Microphone permissions are required.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestCamPermission}>
          <Text style={styles.buttonText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Съёмка фото
  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      // takePictureAsync возвращает объект с uri фото
      const photo = await cameraRef.current.takePictureAsync();
      if (photo?.uri) {
        Alert.alert('Photo taken', `Saved to: ${photo.uri}`);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Переключение камеры
  const switchCamera = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  // Обработка тапа по экрану (Визуальный фокус)
  const handleFocus = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    
    // Показываем квадрат в месте тапа
    setFocusBox({ x: locationX, y: locationY });

    // Expo Camera автоматически фокусируется в месте тапа (на нативном уровне).
    // Поэтому нам нужно только убрать визуальный квадрат через 2 секунды.
    setTimeout(() => {
      setFocusBox(null);
    }, 2000);
  };

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        zoom={zoom}
        mode="picture"
        flash="off" // Отключаем вспышку, как в вашем коде
      >
        {/* Невидимая область для отслеживания тапов (должна быть под кнопками) */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleFocus}
        />

        {/* Визуальный квадрат фокуса */}
        {focusBox && (
          <View
            style={[
              styles.focusBox,
              {
                left: focusBox.x - 40, // Смещаем на половину ширины (80/2)
                top: focusBox.y - 40,  // Смещаем на половину высоты
              },
            ]}
          />
        )}

        {/* UI Controls */}
        <View style={styles.controls} pointerEvents="box-none">
          <TouchableOpacity onPress={switchCamera} style={styles.roundButton}>
            <Text style={styles.buttonText}>Flip</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={takePhoto} style={styles.roundButton}>
            <Text style={styles.buttonText}>Snap</Text>
          </TouchableOpacity>
        </View>

        {/* Zoom Slider */}
        <View style={styles.sliderContainer}>
          <Slider
            style={{ width: 200, height: 40 }}
            minimumValue={0}
            maximumValue={1}
            value={zoom}
            onValueChange={setZoom}
            minimumTrackTintColor="#FFFFFF"
            maximumTrackTintColor="#888888"
            thumbTintColor="#FFFFFF"
          />
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  controls: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    zIndex: 10, // Чтобы кнопки были поверх TouchableOpacity
  },
  roundButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 10,
  },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  focusBox: {
    width: 80,
    height: 80,
    borderWidth: 2,
    borderColor: '#FFD700', // Сделал желтым для наглядности
    borderRadius: 8,
    position: 'absolute',
    zIndex: 5,
  },
  sliderContainer: {
    position: 'absolute',
    right: -60, // Сдвинуто из-за поворота
    bottom: 150,
    transform: [{ rotate: '-90deg' }],
    zIndex: 10, // Чтобы ползунок был поверх тапов
  },
});