/**
 * Shared Supabase configuration (safe in any environment).
 *
 * Intentionally contains **no** server-only import, so client components may
 * read the public configuration without dragging `next/headers` into the
 * browser bundle.
 */

/**
 * NOTE ON THE STATIC LOOKUPS BELOW
 *
 * These must stay written as literal `process.env.NEXT_PUBLIC_*` member
 * expressions. Next.js inlines public variables by rewriting that exact syntax at
 * build time; it does not understand computed access. A helper like
 * `process.env[name]` compiles to a real property read against an object that is
 * empty in the browser bundle, so `requireEnv('NEXT_PUBLIC_SUPABASE_URL')`
 * threw "Missing environment variable NEXT_PUBLIC_SUPABASE_URL" on a file that
 * was configured perfectly.
 *
 * The keys are validated against a known list rather than read dynamically, so
 * the values stay statically analysable while call sites keep passing a name.
 */

/** The only public variables this module is allowed to resolve. */
const RESOLVERS = {
  NEXT_PUBLIC_SUPABASE_URL: () => process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const;

export type SupabaseEnvName = keyof typeof RESOLVERS;

export function requireEnv(name: SupabaseEnvName): string {
  const resolve = RESOLVERS[name] as (() => string | undefined) | undefined;
  const value = resolve ? resolve() : undefined;

  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in, then restart the dev server (NEXT_PUBLIC_* values are inlined at build time, so a running server will not pick up an edit).`,
    );
  }
  return value;
}

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}