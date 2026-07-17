import type arMessages from '../../messages/ar.json';
import type { AppLocale } from '../shared/kernel';

declare module 'next-intl' {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof arMessages;
  }
}
