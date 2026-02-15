import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import LogRocket from '@logrocket/react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';



const PawPalLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    background: Colors.backgroundLight,
    card: Colors.cardLight,
    text: Colors.textPrimary,
    border: Colors.border,
  },
};

const PawPalDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.primary,
    background: Colors.backgroundDark,
    card: Colors.cardDark,
    text: Colors.textLight,
    border: Colors.borderDark,
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    try {
      LogRocket.init('elfuy9/paw-pal');
      LogRocket.getSessionURL(url => {
        console.log('LogRocket session URL: ' + url);
      });
    } catch (e) {
      // LogRocket only works in native builds, fail silently in Expo Go
      console.log('LogRocket disabled in this environment');
    }
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? PawPalDarkTheme : PawPalLightTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider >
  );
}
