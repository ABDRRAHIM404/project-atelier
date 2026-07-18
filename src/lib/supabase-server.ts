import { createClient } from '@supabase/supabase-js';

import { createHash } from 'node:crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

export function getSupabaseServerClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_CONFIGURATION_MISSING');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_CONFIGURATION_MISSING');
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function productImageStoragePath(productId: string, file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const uuid = createHash('sha1').update(`${productId}:${file.name}:${Date.now()}`).digest('hex').slice(0, 12);
  return `products/${productId}/${uuid}.${extension}`;
}
