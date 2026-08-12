import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a storage path or an asset URL to a public URL that works on both 
 * Lovable Preview and Vercel/Production environments.
 */
export function getPublicUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return "";
  
  // If it's already an absolute URL (http/https), return it
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  
  // Lovable asset paths (/__l5e/) are internal to the platform and should be avoided 
  // in independent deploys. If they appear, we return them as is, but project 
  // assets should use standard imports.
  if (pathOrUrl.startsWith("/__l5e/")) return pathOrUrl;

  // Otherwise, assume it's a Supabase storage path and get the public URL
  // This assumes the bucket is 'assets' - adjust if needed
  const { data } = supabase.storage.from("assets").getPublicUrl(pathOrUrl);
  return data.publicUrl;
}
