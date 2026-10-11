import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AnimatedNumber } from './AnimatedNumber';
import { fontFamilyFor } from './fonts';
import { PressableScale } from './PressableScale';
import { formatNumber } from './Stepper';
import { Text } from './Text';
import { radius, space, typography } from './theme';
import { useTheme } from './useTheme';

type BigStepperProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
};

const BUTTON = 60;
/** Holding − or +: first repeat after this, then faster and faster. */
const HOLD_DELAY_MS = 380;
const HOLD_START_MS = 140;
const HOLD_FASTEST_MS = 45;

/**
 * The main numbers of a set (weight, reps), big enough to read at arm's length
 * between sets: ( − )   20 kg   ( + )
 * The number rolls when it changes. Hold − or + to move fast; tap the number to type it.
 */
export function BigStepper({ label, value, onChange, step = 1, min = 0, max = 999, unit }: BigStepperProps) {
  const theme = useTheme();
  // Big jumps (0 → 60 kg) are faster typed than tapped: tap the number to type it.
  const [draft, setDraft] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);

  // While holding a button, the repeats need the latest value, not the one of the first render.
  const latest = useRef({ value, onChange });
  useEffect(() => {
    latest.current = { value, onChange };
  });
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  // After a hold, releasing the finger is not one more tap.
  const held = useRef(false);
  useEffect(() => stopHold, []);

  // Applied while typing: the iPhone number pad has no "done" key, and tapping
  // "Complete set" right away must already use the typed value.
  function type(text: string) {
    setDraft(text);
    const parsed = Number(text.replace(',', '.'));
    if (text.trim() !== '' && Number.isFinite(parsed)) {
      onChange(Math.min(max, Math.max(min, Math.round(parsed * 100) / 100)));
    }
  }

  function commit() {
    setDraft(null);
  }

  /** One step. Returns false at the limit (so holding stops). */
  function change(delta: number): boolean {
    const current = latest.current.value;
    const next = Math.round((current + delta) * 100) / 100;
    if (next < min || next > max) return false;
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setDirection(delta > 0 ? 1 : -1);
    latest.current.value = next;
    latest.current.onChange(next);
    return true;
  }

  function startHold(delta: number) {
    stopHold();
    held.current = false;
    let interval = HOLD_START_MS;
    const tick = () => {
      held.current = true;
      if (!change(delta)) return;
      interval = Math.max(HOLD_FASTEST_MS, interval * 0.85);
      hold.current = setTimeout(tick, interval);
    };
    hold.current = setTimeout(tick, HOLD_DELAY_MS);
  }

  function tap(delta: number) {
    if (held.current) {
      held.current = false;
      return;
    }
    change(delta);
  }

  function stopHold() {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  }

  return (
    <View style={styles.container}>
      <Text variant="caption" color="textMuted" align="center">
        {label}
      </Text>
      <View style={styles.row}>
        <RoundButton
          symbol="−"
          label="decrease"
          onPress={() => tap(-step)}
          onHoldStart={() => startHold(-step)}
          onHoldEnd={stopHold}
          disabled={value - step < min}
          background={theme.surfaceMuted}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${formatNumber(value)}`}
          onPress={() => setDraft(formatNumber(value))}
          style={styles.value}>
          {draft === null ? (
            <AnimatedNumber text={formatNumber(value)} direction={direction} />
          ) : (
            <TextInput
              autoFocus
              selectTextOnFocus
              keyboardType="decimal-pad"
              returnKeyType="done"
              value={draft}
              onChangeText={type}
              onSubmitEditing={commit}
              onBlur={commit}
              style={[
                typography.display,
                styles.input,
                { color: theme.text, fontFamily: fontFamilyFor('700', 'display'), fontWeight: undefined },
              ]}
            />
          )}
          {unit ? (
            <Text variant="heading" color="textMuted">
              {unit}
            </Text>
          ) : null}
        </Pressable>
        <RoundButton
          symbol="+"
          label="increase"
          onPress={() => tap(step)}
          onHoldStart={() => startHold(step)}
          onHoldEnd={stopHold}
          disabled={value + step > max}
          background={theme.surfaceMuted}
        />
      </View>
    </View>
  );
}

type RoundButtonProps = {
  symbol: string;
  label: string;
  onPress: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  disabled: boolean;
  background: string;
};

function RoundButton({
  symbol,
  label,
  onPress,
  onHoldStart,
  onHoldEnd,
  disabled,
  background,
}: RoundButtonProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onHoldStart}
      onPressOut={onHoldEnd}
      scaleTo={0.9}
      style={[styles.button, { backgroundColor: background }, disabled && styles.disabled]}>
      <Text variant="title" style={styles.symbol}>
        {symbol}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  value: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: space.xs,
  },
  input: {
    minWidth: 80,
    textAlign: 'center',
    padding: 0,
  },
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: {
    fontWeight: '400',
    lineHeight: 34,
  },
  disabled: {
    opacity: 0.3,
  },
});
