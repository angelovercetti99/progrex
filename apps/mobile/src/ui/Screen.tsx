import { SymbolView } from 'expo-symbols';
import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from './Text';
import { maxContentWidth, space, touch } from './theme';
import { useTheme } from './useTheme';

type ScreenProps = {
  title: string;
  /** Replaces the title text in the header (e.g. the logo). `title` stays as the accessible name. */
  header?: ReactNode;
  children: ReactNode;
  /** Shows the settings shortcut in the top-right corner. */
  showSettings?: boolean;
};

/** Base layout for every tab screen: safe area, title, centered column. */
export function Screen({ title, header, children, showSettings = true }: ScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <View style={styles.header}>
            {header ?? <Text variant="title">{title}</Text>}
            {showSettings && (
              <Link href="/settings" asChild>
                <Pressable accessibilityRole="button" hitSlop={8} style={styles.iconButton}>
                  <SymbolView
                    name={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
                    tintColor={theme.textMuted}
                    size={24}
                  />
                </Pressable>
              </Link>
            )}
          </View>
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
    // On web our tab bar floats over the content, so leave room for it.
    paddingBottom: Platform.OS === 'web' ? 112 : space.xxl,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    gap: space.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.lg,
  },
  iconButton: {
    width: touch.min,
    height: touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -space.md,
  },
});
