import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import type { TextStyle } from 'react-native';

/**
 * Inter: the open font closest to Apple's SF Pro, identical on iPhone, Android
 * and web. Only the weights we use are bundled.
 */
export const FONT_ASSETS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
};

const FAMILY_BY_WEIGHT: Record<string, keyof typeof FONT_ASSETS> = {
  '400': 'Inter_400Regular',
  normal: 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  bold: 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
};

/**
 * With custom fonts, each weight is a separate font file. Android ignores
 * `fontWeight` for them, so we pick the file that matches the weight instead.
 */
export function fontFamilyFor(weight: TextStyle['fontWeight']): string {
  return FAMILY_BY_WEIGHT[String(weight ?? '400')] ?? 'Inter_400Regular';
}
