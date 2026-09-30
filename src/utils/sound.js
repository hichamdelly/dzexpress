// Notification sonore + vibration pour les nouveaux messages
// Pour activer le son : placer un fichier notification.wav dans assets/sounds/

import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
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
    await setAudioModeAsync({ playsInSilentMode: false });
    if (_sound) {
      _sound.remove();
      _sound = null;
    }
    const player = createAudioPlayer(require('../../assets/sounds/notification.wav'));
    player.volume = 0.7;
    _sound = player;
    player.addListener('playbackStatusUpdate', s => {
      if (s.didJustFinish) {
        player.remove();
        if (_sound === player) _sound = null;
      }
    });
    player.play();
  } catch (_) {
    // Fichier son absent — la vibration couvre le feedback
  }
}
