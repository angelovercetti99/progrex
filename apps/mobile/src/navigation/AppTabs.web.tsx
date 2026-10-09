import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import { forwardRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/ui/Text';
import { maxContentWidth, radius, space, touch } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** Web: a floating bottom bar, like on the phone (native tabs render at the top on web). */
export function AppTabs() {
  const { t } = useTranslation();

  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <TabBar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon="fitness_center" label={t('tabs.today')} />
          </TabTrigger>
          <TabTrigger name="plan" href="/plan" asChild>
            <TabButton icon="calendar_month" label={t('tabs.plan')} />
          </TabTrigger>
          <TabTrigger name="progress" href="/progress" asChild>
            <TabButton icon="show_chart" label={t('tabs.progress')} />
          </TabTrigger>
        </TabBar>
      </TabList>
    </Tabs>
  );
}

function TabBar({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.barContainer}>
      <View style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {children}
      </View>
    </View>
  );
}

type TabButtonProps = TabTriggerSlotProps & { icon: AndroidSymbol; label: string };

// forwardRef: TabTrigger (with asChild) needs to pass a ref down to the button.
const TabButton = forwardRef<View, TabButtonProps>(function TabButton(
  { icon, label, isFocused, ...props },
  ref
) {
  const theme = useTheme();
  const color = isFocused ? theme.accentText : theme.textMuted;

  return (
    <Pressable ref={ref} {...props} style={styles.button}>
      <SymbolView name={{ web: icon }} tintColor={color} size={24} />
      <Text variant="caption" color={isFocused ? 'text' : 'textMuted'} style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  slot: {
    height: '100%',
  },
  barContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: space.lg,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: maxContentWidth,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.xs,
  },
  button: {
    flex: 1,
    minHeight: touch.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontWeight: '600',
  },
});
