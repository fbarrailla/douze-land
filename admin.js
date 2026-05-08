// Admin panel — Supabase Auth + photo CRUD.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_KEY, STORAGE_BUCKET, photoUrl } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

const $ = (sel) => document.querySelector(sel);
const els = {
  login:        $("#login"),
  loginForm:    $("#login-form"),
  loginError:   $("#login-error"),
  app:          $("#app"),
  who:          $("#who"),
  logout:       $("#btn-logout"),
  upload:       $("#upload"),
  saveOrder:    $("#btn-save-order"),
  refresh:      $("#btn-refresh"),
  photos:       $("#photos"),
  empty:        $("#empty"),
  count:        $("#count"),
  toast:        $("#toast"),
};

let photos = [];   // local copy of rows
let dirty = false; // order changed since last save

/* ---- Toast ------------------------------------------------------- */
let toastTimer = null;
function toast(msg, kind = "") {
  els.toast.textContent = msg;
  els.toast.className = "toast" + (kind ? " toast--" + kind : "");
  els.toast.hidden = false;
  requestAnimationFrame(() => els.toast.classList.add("is-show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove("is-show");
    setTimeout(() => { els.toast.hidden = true; }, 250);
  }, 2400);
}

/* ---- Auth -------------------------------------------------------- */
async function refreshUI() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    els.login.hidden = true;
    els.app.hidden = false;
    els.who.textContent = session.user.email || "";
    await loadPhotos();
  } else {
    els.app.hidden = true;
    els.login.hidden = false;
  }
}

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.loginError.hidden = true;
  const fd = new FormData(els.loginForm);
  const { error } = await supabase.auth.signInWithPassword({
    email:    fd.get("email"),
    password: fd.get("password"),
  });
  if (error) {
    els.loginError.textContent = error.message;
    els.loginError.hidden = false;
    return;
  }
  els.loginForm.reset();
  refreshUI();
});

els.logout.addEventListener("click", async () => {
  await supabase.auth.signOut();
  refreshUI();
});

supabase.auth.onAuthStateChange((_evt, _session) => { refreshUI(); });

/* ---- Load -------------------------------------------------------- */
async function loadPhotos() {
  els.photos.setAttribute("aria-busy", "true");
  els.photos.innerHTML = "";
  const { data, error } = await supabase
    .from("photos")
    .select("id, filename, bucket, position, caption, width, height")
    .order("position", { ascending: true });
  els.photos.removeAttribute("aria-busy");
  if (error) {
    toast("Load failed: " + error.message, "error");
    return;
  }
  photos = data || [];
  render();
}

function render() {
  els.empty.hidden = photos.length > 0;
  els.count.textContent = `${photos.length} photograph${photos.length === 1 ? "" : "s"}`;
  els.photos.innerHTML = "";
  for (let i = 0; i < photos.length; i++) {
    els.photos.appendChild(photoCard(photos[i], i));
  }
  dirty = false;
  els.saveOrder.disabled = true;
}

function photoCard(p, idx) {
  const li = document.createElement("li");
  li.className = "photo";
  li.draggable = true;
  li.dataset.id = p.id;
  li.dataset.idx = idx;
  li.innerHTML = `
    <span class="photo__pos">${idx + 1}</span>
    <span class="photo__src photo__src--${p.bucket === "legacy" ? "legacy" : "storage"}">${p.bucket === "legacy" ? "legacy" : "storage"}</span>
    <img class="photo__img" src="${photoUrl(p)}" alt="" loading="lazy" decoding="async">
    <div class="photo__body">
      <textarea class="photo__caption" rows="1" placeholder="Add a caption…">${escapeHtml(p.caption || "")}</textarea>
      <div class="photo__row">
        <span class="photo__meta">${p.width || "?"}×${p.height || "?"}</span>
        <button type="button" class="btn btn--danger btn--small" data-action="delete">Delete</button>
      </div>
    </div>
  `;
  // Caption save on blur (only if changed)
  const ta = li.querySelector(".photo__caption");
  let original = p.caption || "";
  ta.addEventListener("blur", async () => {
    const next = ta.value.trim();
    if (next === original) return;
    const { error } = await supabase.from("photos").update({ caption: next || null }).eq("id", p.id);
    if (error) {
      toast("Caption save failed: " + error.message, "error");
      ta.value = original;
      return;
    }
    original = next;
    p.caption = next;
    toast("Caption saved", "success");
  });

  // Delete
  li.querySelector('[data-action="delete"]').addEventListener("click", async () => {
    if (!confirm("Delete this photograph permanently?")) return;
    await deletePhoto(p);
  });

  // DnD
  li.addEventListener("dragstart", onDragStart);
  li.addEventListener("dragover", onDragOver);
  li.addEventListener("dragleave", onDragLeave);
  li.addEventListener("drop", onDrop);
  li.addEventListener("dragend", onDragEnd);
  return li;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

/* ---- Delete ------------------------------------------------------ */
async function deletePhoto(p) {
  // If stored in Supabase Storage, remove the file too
  if (p.bucket !== "legacy") {
    const { error: stErr } = await supabase.storage.from(STORAGE_BUCKET).remove([p.filename]);
    if (stErr && stErr.message && !/Not found/i.test(stErr.message)) {
      toast("Storage remove failed: " + stErr.message, "error");
      return;
    }
  }
  const { error } = await supabase.from("photos").delete().eq("id", p.id);
  if (error) { toast("Delete failed: " + error.message, "error"); return; }
  photos = photos.filter(x => x.id !== p.id);
  // Re-number positions to keep them dense
  await renumber();
  render();
  toast("Deleted", "success");
}

async function renumber() {
  const updates = photos.map((p, i) => ({ id: p.id, position: i + 1 }));
  // Update only the rows whose position changed
  const changed = updates.filter((u, i) => photos[i].position !== u.position);
  for (const c of changed) {
    const row = photos.find(p => p.id === c.id);
    row.position = c.position;
    const { error } = await supabase.from("photos").update({ position: c.position }).eq("id", c.id);
    if (error) toast("Renumber failed: " + error.message, "error");
  }
}

/* ---- Drag & drop reorder ---------------------------------------- */
let dragId = null;
function onDragStart(e) {
  dragId = e.currentTarget.dataset.id;
  e.currentTarget.classList.add("is-dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", dragId);
}
function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  const li = e.currentTarget;
  if (li.dataset.id === dragId) return;
  const rect = li.getBoundingClientRect();
  const before = (e.clientX - rect.left) < rect.width / 2;
  li.classList.toggle("drop-before", before);
  li.classList.toggle("drop-after", !before);
}
function onDragLeave(e) {
  e.currentTarget.classList.remove("drop-before", "drop-after");
}
function onDrop(e) {
  e.preventDefault();
  const li = e.currentTarget;
  if (li.dataset.id === dragId) return;
  const rect = li.getBoundingClientRect();
  const before = (e.clientX - rect.left) < rect.width / 2;
  li.classList.remove("drop-before", "drop-after");

  const fromIdx = photos.findIndex(p => p.id === dragId);
  const toAnchor = photos.findIndex(p => p.id === li.dataset.id);
  if (fromIdx < 0 || toAnchor < 0) return;
  const insertIdx = before ? toAnchor : toAnchor + 1;
  const [moved] = photos.splice(fromIdx, 1);
  // adjust insertIdx if removing earlier element
  const adjusted = fromIdx < insertIdx ? insertIdx - 1 : insertIdx;
  photos.splice(adjusted, 0, moved);
  dirty = true;
  els.saveOrder.disabled = false;
  render();
}
function onDragEnd(e) {
  e.currentTarget.classList.remove("is-dragging");
  document.querySelectorAll(".photo").forEach(el => el.classList.remove("drop-before", "drop-after"));
}

els.saveOrder.addEventListener("click", async () => {
  els.saveOrder.disabled = true;
  await renumber();
  dirty = false;
  toast("Order saved", "success");
});

/* ---- Upload ------------------------------------------------------ */
els.upload.addEventListener("change", async () => {
  const files = Array.from(els.upload.files || []);
  if (!files.length) return;
  els.upload.value = "";
  for (const file of files) {
    await uploadOne(file);
  }
  await loadPhotos();
});

async function uploadOne(file) {
  if (!/^image\//.test(file.type)) {
    toast(`${file.name}: not an image`, "error");
    return;
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const safeExt = ["jpg","jpeg","png","webp","gif","avif"].includes(ext) ? ext : "jpg";
  // unique filename: timestamp + random
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

  toast(`Uploading ${file.name}…`);

  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filename, file, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (upErr) { toast(`Upload failed: ${upErr.message}`, "error"); return; }

  // Read intrinsic dimensions
  const { width, height } = await readDims(file).catch(() => ({ width: null, height: null }));

  const nextPos = (photos[photos.length - 1]?.position || 0) + 1;
  const { error: insErr } = await supabase.from("photos").insert({
    filename, bucket: STORAGE_BUCKET, position: nextPos, width, height,
  });
  if (insErr) {
    toast(`Insert failed: ${insErr.message}`, "error");
    await supabase.storage.from(STORAGE_BUCKET).remove([filename]);
    return;
  }
  toast(`${file.name} uploaded`, "success");
}

function readDims(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

/* ---- Refresh ----------------------------------------------------- */
els.refresh.addEventListener("click", () => loadPhotos());

/* ---- Boot -------------------------------------------------------- */
refreshUI();
