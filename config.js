// Public Supabase configuration. The publishable key is safe to expose;
// row-level security on the database controls what each role can do.
window.DOUZE = window.DOUZE || {};
window.DOUZE.SUPABASE_URL    = "https://sfavcvosruihezvgyjoj.supabase.co";
window.DOUZE.SUPABASE_KEY    = "sb_publishable_QrKXjcR2Tf6ycwzGqdbZ4g_NyxjuCFM";
window.DOUZE.STORAGE_BUCKET  = "photos";

// Returns the URL for a photo row { filename, bucket }.
window.DOUZE.photoUrl = function (row) {
  if (row.bucket === "legacy") return "images/" + row.filename;
  return `${window.DOUZE.SUPABASE_URL}/storage/v1/object/public/${window.DOUZE.STORAGE_BUCKET}/${row.filename}`;
};
