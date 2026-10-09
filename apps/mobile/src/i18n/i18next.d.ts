import 'i18next';

import type pt from './pt.json';

// Teaches TypeScript which translation keys exist, so `t('tabs.todya')`
// is flagged as an error in the editor instead of showing a raw key at runtime.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof pt;
    };
  }
}
