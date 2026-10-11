import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import type { TextStyle } from 'react-native';

/**
 * Two faces (decisoes.md §46), identical on iPhone, Android and web:
 * - Archivo, wide and heavy, for what you read at a glance (titles, big
 *   numbers, buttons): it gives the app its strength;
 * - Inter for everything else: neutral and easy to read in sentences.
 * Only the weights we use are bundled.
 */
export const FONT_ASSETS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  // Archivo at width 118 (see assets/fonts/README.md).
  ArchivoWide_700Bold: require('../../assets/fonts/ArchivoWide-700.ttf'),
  ArchivoWide_800ExtraBold: require('../../assets/fonts/ArchivoWide-800.ttf'),
};

export type FontFace = 'text' | 'display';

const FILES: Record<FontFace, Record<string, keyof typeof FONT_ASSETS>> = {
  text: {
    '400': 'Inter_400Regular',
    '500': 'Inter_500Medium',
    '600': 'Inter_600SemiBold',
    '700': 'Inter_700Bold',
    '800': 'Inter_800ExtraBold',
  },
  display: {
    '400': 'ArchivoWide_700Bold',
    '500': 'ArchivoWide_700Bold',
    '600': 'ArchivoWide_700Bold',
    '700': 'ArchivoWide_700Bold',
    '800': 'ArchivoWide_800ExtraBold',
  },
};

/**
 * With custom fonts, each weight is a separate font file. Android ignores
 * `fontWeight` for them, so we pick the file that matches the weight instead.
 */
export function fontFamilyFor(weight: TextStyle['fontWeight'], face: FontFace = 'text'): string {
  const key =
    weight === 'normal' || weight === undefined ? '400' : weight === 'bold' ? '700' : String(weight);
  return FILES[face][key] ?? FILES[face]['400'];
}
