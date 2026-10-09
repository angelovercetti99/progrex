import { AppTabs } from '@/navigation/AppTabs';

// The tab bar differs per platform: native tabs on iOS/Android,
// a custom bottom bar on web (see AppTabs.tsx / AppTabs.web.tsx).
export default function TabsLayout() {
  return <AppTabs />;
}
