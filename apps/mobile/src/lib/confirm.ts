import { Alert, Platform } from 'react-native';

/**
 * Asks "are you sure?" and resolves to true/false.
 * React Native's Alert does nothing on web, so there we use the browser's.
 */
export function confirm(message: string, confirmLabel: string, cancelLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(message));
  }
  return new Promise((resolve) => {
    Alert.alert(message, undefined, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
