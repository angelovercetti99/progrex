import { FadeIn, FadeInDown, type BaseAnimationBuilder } from 'react-native-reanimated';

/**
 * Motion tokens (docs/decisoes.md §53): every animation in the app uses these,
 * so everything moves with the same character. Short and soft: motion
 * confirms what happened and guides the eye, never makes you wait.
 */

/** A press: quick to go in, a little bounce to come back. */
export const SPRING = { damping: 18, stiffness: 320, mass: 0.6 } as const;

export const DURATION = {
  fast: 160,
  base: 260,
  slow: 420,
} as const;

/** Lists come in one row after another (capped, so long lists don't wait). */
export function stagger(index: number): BaseAnimationBuilder {
  return FadeInDown.delay(Math.min(index, 8) * 45)
    .duration(DURATION.base)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] });
}

/** A screen's content, once its data is ready: no pop-in. */
export const screenEnter = FadeIn.duration(DURATION.base);
