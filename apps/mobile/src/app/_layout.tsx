import '@/i18n';

import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

import { DatabaseGate } from '@/db/DatabaseGate';
import { FONT_ASSETS, fontFamilyFor } from '@/ui/fonts';
import { colors } from '@/ui/theme';
import { ThemeModeProvider, useColorMode } from '@/ui/ThemeMode';

export default function RootLayout() {
  // The splash screen stays up until fonts (here) and the database (DatabaseGate) are ready.
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  if (!fontsLoaded) {
    return null;
  }
  return (
    <ThemeModeProvider>
      <AppNavigator />
    </ThemeModeProvider>
  );
}

function AppNavigator() {
  const { t } = useTranslation();
  const mode = useColorMode();
  const palette = colors[mode];
  const baseTheme = mode === 'dark' ? DarkTheme : DefaultTheme;

  // Feed our colors and font into the navigation theme so headers match.
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: palette.background,
      card: palette.background,
      text: palette.text,
      border: palette.border,
      primary: palette.accentText,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <DatabaseGate>
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            headerTitleStyle: { fontFamily: fontFamilyFor('600') },
            contentStyle: { backgroundColor: palette.background },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
          <Stack.Screen name="locations/index" options={{ title: t('locations.title') }} />
          <Stack.Screen name="locations/[id]" />
          <Stack.Screen
            name="select-location"
            options={{ title: t('locations.choose'), presentation: 'modal' }}
          />
          <Stack.Screen name="workout/[id]" />
          <Stack.Screen name="history/index" options={{ title: t('history.title') }} />
          <Stack.Screen name="history/[id]" />
          <Stack.Screen name="summary/[id]" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen
            name="add-exercise"
            options={{ title: t('addExercise.title'), presentation: 'modal' }}
          />
        </Stack>
      </DatabaseGate>
    </ThemeProvider>
  );
}
