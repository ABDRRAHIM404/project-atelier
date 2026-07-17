import 'server-only';

import { requireApplicationEnvironment, type ApplicationEnvironment } from './environment-schema';

export function getServerEnvironment(): ApplicationEnvironment {
  return requireApplicationEnvironment({ APP_ENV: process.env.APP_ENV });
}
