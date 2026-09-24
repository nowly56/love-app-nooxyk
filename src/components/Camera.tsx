import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';

// Экспортируем сразу здесь
export default function CameraScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Camera screen</Text>
      <Pressable style={styles.button} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>Закрыть</Text>
      </Pressable>
    </View>
  );
}

// Стили оставляем внизу
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
  },
});