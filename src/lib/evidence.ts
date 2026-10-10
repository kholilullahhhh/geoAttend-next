/**
 * Evidence photo.
 *
 * The bucket is private, so no plain URL exists — the image can only be fetched
 * through a short-lived signed URL minted for the signed-in user. `storage.objects`
 * RLS then decides whether *this* user may mint one for *this* path, so a URL can
 * never be produced for someone else's evidence.
 *
 * The signed URL is requested server-side (5 minute TTL) and handed to the
 * browser as a plain `<img src>`; it is never persisted.
 */
import { createServerSupabaseClient } from '@/lib/supabase/server';

const EVIDENCE_BUCKET = 'attendance-evidence';
const TTL_SECONDS = 300;

export async function createEvidenceUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  // Retention purge replaces the object with a sentinel; never sign those.
  if (!path.startsWith('attendance/')) return null;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(path, TTL_SECONDS);

  if (error || !data) return null;
  return data.signedUrl;
}
