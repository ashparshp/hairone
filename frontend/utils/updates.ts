import { Alert } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Check for an OTA update and prompt the user before reloading.
 * Never force-reload mid-session without consent.
 */
export async function checkForAppUpdate(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) {
    return;
  }

  try {
    const update = await Updates.checkForUpdateAsync();
    if (!update.isAvailable) {
      return;
    }

    await Updates.fetchUpdateAsync();

    Alert.alert(
      'Update ready',
      'A new version has been downloaded. Restart now to apply it?',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Restart',
          onPress: () => {
            Updates.reloadAsync().catch(() => {});
          },
        },
      ],
    );
  } catch (error) {
    if (__DEV__) {
      console.log('OTA update check failed', error);
    }
  }
}
