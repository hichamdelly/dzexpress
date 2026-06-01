// Notification sonore + vibration pour les nouveaux messages
// Pour activer le son : placer un fichier notification.wav dans assets/sounds/

import { Audio } from 'expo-av';
import { Vibration, Platform } from 'react-native';

let _sound = null;

export async function playNotifSound() {
  // Vibration (fonctionne toujours)
  if (Platform.OS === 'android') {
    Vibration.vibrate([0, 80, 40, 80]);
  } else {
    Vibration.vibrate(180);
  }

  // Son (optionnel — nécessite assets/sounds/notification.wav)
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: false });
    if (_sound) {
      await _sound.unloadAsync();
      _sound = null;
    }
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/sounds/notification.wav'),
      { shouldPlay: true, volume: 0.7 }
    );
    _sound = sound;
    sound.setOnPlaybackStatusUpdate(s => {
      if (s.didJustFinish) {
        sound.unloadAsync();
        _sound = null;
      }
    });
  } catch (_) {
    // Fichier son absent — la vibration couvre le feedback
  }
}
