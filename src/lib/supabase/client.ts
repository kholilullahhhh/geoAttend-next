/**
 * Browser Supabase client.
 *
 * Uses only the **anon** key plus the signed-in user's session. There is
 * deliberately no service-role client anywhere in this app: RLS is the
 * enforcement path for every read and write, and a service-role client would
 * silently bypass the policies defined in
 * `supabase/migrations/..._rls_policies.sql`.
 */
'use client';

import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '../database.types';
import { requireEnv } from './config';

export function createClient() {
  return createBrowserClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  );
}