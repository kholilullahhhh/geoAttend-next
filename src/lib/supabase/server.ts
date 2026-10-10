/**
 * Server-side Supabase client bound to the request cookies.
 *
 * Because the session cookie is forwarded, PostgREST evaluates every query
 * against the signed-in user's JWT, so RLS applies exactly as it would from the
 * mobile app. This is what makes the dashboard's authorization real rather than
 * merely conventional.
 *
 * `server-only` is a compile-time guard: importing this module from a client
 * component fails the build instead of leaking session handling into the bundle.
 */
import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '../database.types';
import { requireEnv } from './config';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components render with read-only cookies. `middleware`
            // performs the token refresh, so swallowing this is correct.
          }
        },
      },
    },
  );
}