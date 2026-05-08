// Public Supabase configuration. The publishable key is safe to expose;
// row-level security on the database controls what each role can do.
export const SUPABASE_URL = "https://sfavcvosruihezvgyjoj.supabase.co";
export const SUPABASE_KEY = "sb_publishable_QrKXjcR2Tf6ycwzGqdbZ4g_NyxjuCFM";
export const STORAGE_BUCKET = "photos";

// Returns the URL for a photo row { filename, bucket }.
export function photoUrl(row) {
  if (row.bucket === "legacy") return "images/" + row.filename;
  return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${row.filename}`;
}
