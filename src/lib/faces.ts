import type { SupabaseClient } from "@supabase/supabase-js";

export const FACES_BUCKET = "family-photos";

/** An hour is long enough for a page, short enough for a photo. */
const GOOD_FOR = 3600;

/**
 * Family photographs are private, so every one is asked for by name and
 * comes back as a link good for an hour. Several are asked for at once,
 * because a family page shows a whole row of faces.
 */
export async function signedFaces(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  paths: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => !!p))];
  if (wanted.length === 0) return {};

  const { data } = await supabase.storage.from(FACES_BUCKET).createSignedUrls(wanted, GOOD_FOR);

  const urls: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) urls[row.path] = row.signedUrl;
  }
  return urls;
}

/** Where a member's photo is filed, under the family it belongs to. */
export function memberFacePath(kutumbhId: string, userId: string): string {
  return `${kutumbhId}/${userId}-${Date.now()}.jpg`;
}

/** Where the family's own photograph is filed. */
export function familyFacePath(kutumbhId: string): string {
  return `${kutumbhId}/family-${Date.now()}.jpg`;
}
