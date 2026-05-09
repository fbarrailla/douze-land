// Public-facing photograph book — fetches plates from Supabase, renders them,
// then wires up scroll fade-in, the lightbox, and likes/comments.
const { SUPABASE_URL, SUPABASE_KEY, photoUrl } = window.DOUZE;
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ---- Roman numerals -------------------------------------------------- */
const ROMAN = [
  [1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],
  [50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"],
];
function roman(n) {
  let out = "";
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}

const numberWord = (n) => {
  const small = ["zero","one","two","three","four","five","six","seven","eight","nine","ten",
                 "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen",
                 "eighteen","nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  if (n < 20) return cap(small[n]);
  if (n < 100) {
    const t = Math.floor(n / 10), o = n % 10;
    return o ? `${tens[t]}-${small[o]}` : tens[t];
  }
  return String(n);
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

/* ---- Anonymous client identity (for like dedupe + comment authorship) ---- */
function fingerprint() {
  let fp = localStorage.getItem("douze_fp");
  if (!fp) {
    fp = (crypto.randomUUID && crypto.randomUUID()) || (Date.now() + "-" + Math.random().toString(36).slice(2));
    localStorage.setItem("douze_fp", fp);
  }
  return fp;
}
const FP = fingerprint();

/* ---- Time-ago ------------------------------------------------------- */
function timeAgo(iso) {
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60)        return "just now";
  if (s < 3600)      return Math.floor(s / 60) + "m";
  if (s < 86400)     return Math.floor(s / 3600) + "h";
  if (s < 86400 * 7) return Math.floor(s / 86400) + "d";
  return new Date(iso).toLocaleDateString();
}

/* ---- Data ----------------------------------------------------------- */
async function loadAll() {
  const [photosRes, likesRes, commentsRes] = await Promise.all([
    sb.from("photos").select("id, filename, bucket, position, caption, width, height").order("position"),
    sb.from("likes").select("photo_id, fingerprint"),
    sb.from("comments").select("id, photo_id, author, body, created_at").order("created_at"),
  ]);
  if (photosRes.error)   throw photosRes.error;
  if (likesRes.error)    throw likesRes.error;
  if (commentsRes.error) throw commentsRes.error;

  // Group by photo_id
  const likesByPhoto    = new Map();    // photo_id -> Set(fingerprint)
  const commentsByPhoto = new Map();    // photo_id -> [comment]
  for (const l of likesRes.data || []) {
    if (!likesByPhoto.has(l.photo_id)) likesByPhoto.set(l.photo_id, new Set());
    likesByPhoto.get(l.photo_id).add(l.fingerprint);
  }
  for (const c of commentsRes.data || []) {
    if (!commentsByPhoto.has(c.photo_id)) commentsByPhoto.set(c.photo_id, []);
    commentsByPhoto.get(c.photo_id).push(c);
  }
  return { photos: photosRes.data || [], likesByPhoto, commentsByPhoto };
}

/* ---- Render --------------------------------------------------------- */
function renderPlates(photos, likesByPhoto, commentsByPhoto) {
  const main = document.getElementById("plates");
  if (!photos.length) {
    main.innerHTML = `<p class="plates__loading">No photographs yet.</p>`;
    main.removeAttribute("aria-busy");
    return [];
  }
  main.innerHTML = photos.map((p, i) => {
    const r = roman(i + 1);
    const url = photoUrl(p);
    const w = p.width || 2048;
    const h = p.height || 1365;
    const cap = p.caption ? `<span class="plate__words">${escapeHtml(p.caption)}</span>` : "";
    const likeSet = likesByPhoto.get(p.id) || new Set();
    const liked = likeSet.has(FP);
    const likeCount = likeSet.size;
    const commentCount = (commentsByPhoto.get(p.id) || []).length;
    return `
      <figure class="plate" data-id="${p.id}" data-index="${i}">
        <div class="plate__frame">
          <img src="${url}" alt="Douze Land, plate ${r}" loading="lazy" decoding="async" width="${w}" height="${h}">
        </div>
        <figcaption class="plate__caption">
          <span class="plate__num">${r}</span>
          <span class="plate__rule" aria-hidden="true"></span>
          <span class="plate__title">Douze Land</span>
          ${cap}
          <span class="plate__social">
            <button type="button" class="plate__btn plate__like ${liked ? "is-liked" : ""}" data-action="like" aria-pressed="${liked}" aria-label="Like">
              ${heartSvg()}
              <span class="plate__count" data-count="like">${likeCount || ""}</span>
            </button>
            <button type="button" class="plate__btn plate__comment-toggle" data-action="toggle-comments" aria-expanded="false" aria-label="Comments">
              ${bubbleSvg()}
              <span class="plate__count" data-count="comment">${commentCount || ""}</span>
            </button>
          </span>
        </figcaption>
        <div class="plate__comments" hidden>
          <ul class="plate__comments-list"></ul>
          <form class="plate__comment-form" novalidate>
            <input class="plate__field plate__field--name" name="author" type="text" placeholder="Your name" maxlength="60" required>
            <textarea class="plate__field plate__field--body" name="body" placeholder="A few words…" maxlength="600" rows="2" required></textarea>
            <div class="plate__form-row">
              <span class="plate__form-hint" data-role="hint"></span>
              <button class="plate__post" type="submit">Post</button>
            </div>
          </form>
        </div>
      </figure>`;
  }).join("");
  main.removeAttribute("aria-busy");
  return main.querySelectorAll(".plate");
}

function heartSvg() {
  return `<svg class="plate__icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path d="M12 21s-7.5-4.6-9.6-9.1C.7 8.6 2.7 5 6.1 5c2 0 3.4 1.1 4.1 2.4 .8 1.4 .8 1.4 1.6 0C12.5 6.1 13.9 5 15.9 5c3.4 0 5.4 3.6 3.7 6.9C19.5 16.4 12 21 12 21z" fill="currentColor"/>
  </svg>`;
}
function bubbleSvg() {
  return `<svg class="plate__icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  </svg>`;
}

/* ---- Like ----------------------------------------------------------- */
async function toggleLike(plateEl, photoId) {
  const btn = plateEl.querySelector(".plate__like");
  const countEl = plateEl.querySelector('[data-count="like"]');
  const wasLiked = btn.classList.contains("is-liked");

  // Optimistic UI
  btn.classList.toggle("is-liked", !wasLiked);
  btn.setAttribute("aria-pressed", String(!wasLiked));
  const cur = parseInt(countEl.textContent || "0", 10) || 0;
  const next = cur + (wasLiked ? -1 : 1);
  countEl.textContent = next > 0 ? next : "";

  if (wasLiked) {
    const { error } = await sb.from("likes").delete().eq("photo_id", photoId).eq("fingerprint", FP);
    if (error) revertLike(btn, countEl, true);
  } else {
    const { error } = await sb.from("likes").insert({ photo_id: photoId, fingerprint: FP });
    if (error && !/duplicate/i.test(error.message)) revertLike(btn, countEl, false);
  }
}
function revertLike(btn, countEl, wasLiked) {
  btn.classList.toggle("is-liked", wasLiked);
  btn.setAttribute("aria-pressed", String(wasLiked));
  const cur = parseInt(countEl.textContent || "0", 10) || 0;
  const next = cur + (wasLiked ? 1 : -1);
  countEl.textContent = next > 0 ? next : "";
}

/* ---- Comments ------------------------------------------------------- */
function renderCommentItem(c) {
  return `<li class="comment">
    <div class="comment__head">
      <span class="comment__author">${escapeHtml(c.author)}</span>
      <span class="comment__when">${timeAgo(c.created_at)}</span>
    </div>
    <p class="comment__body">${escapeHtml(c.body)}</p>
  </li>`;
}

function fillComments(panel, list) {
  const ul = panel.querySelector(".plate__comments-list");
  if (!list.length) {
    ul.innerHTML = `<li class="comment comment--empty">Be the first to leave a word.</li>`;
  } else {
    ul.innerHTML = list.map(renderCommentItem).join("");
  }
}

function toggleComments(plateEl, photoId, commentsByPhoto) {
  const panel  = plateEl.querySelector(".plate__comments");
  const toggle = plateEl.querySelector(".plate__comment-toggle");
  const willOpen = panel.hidden;
  panel.hidden = !willOpen;
  toggle.setAttribute("aria-expanded", String(willOpen));
  if (willOpen) {
    fillComments(panel, commentsByPhoto.get(photoId) || []);
    // Restore name from localStorage if available
    const savedName = localStorage.getItem("douze_name");
    if (savedName) panel.querySelector('[name="author"]').value = savedName;
  }
}

async function postComment(form, plateEl, photoId, commentsByPhoto) {
  const author = form.author.value.trim();
  const body   = form.body.value.trim();
  const hint   = form.querySelector('[data-role="hint"]');
  hint.textContent = "";
  if (!author || !body) {
    hint.textContent = "Add a name and a few words.";
    return;
  }
  form.querySelector('button[type="submit"]').disabled = true;
  const { data, error } = await sb.from("comments").insert({
    photo_id: photoId, author, body, fingerprint: FP,
  }).select().single();
  form.querySelector('button[type="submit"]').disabled = false;
  if (error) {
    hint.textContent = "Couldn't post: " + error.message;
    return;
  }
  // Persist name choice
  localStorage.setItem("douze_name", author);

  // Append to the local cache and re-render
  const list = commentsByPhoto.get(photoId) || [];
  list.push(data);
  commentsByPhoto.set(photoId, list);

  fillComments(plateEl.querySelector(".plate__comments"), list);
  // Update counter
  const countEl = plateEl.querySelector('[data-count="comment"]');
  countEl.textContent = list.length;

  form.body.value = "";
  hint.textContent = "Posted.";
  setTimeout(() => { if (hint.textContent === "Posted.") hint.textContent = ""; }, 2400);
}

/* ---- Wire interactions ---------------------------------------------- */
function wirePlates(plates, commentsByPhoto) {
  plates.forEach((plate) => {
    const photoId = plate.dataset.id;
    plate.addEventListener("click", (e) => {
      const target = e.target.closest("[data-action]");
      if (!target) return;
      e.stopPropagation();
      const action = target.dataset.action;
      if (action === "like") {
        toggleLike(plate, photoId);
      } else if (action === "toggle-comments") {
        toggleComments(plate, photoId, commentsByPhoto);
      }
    });
    const form = plate.querySelector(".plate__comment-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        postComment(form, plate, photoId, commentsByPhoto);
      });
    }
  });
}

/* ---- Scroll fade-in ------------------------------------------------- */
function observePlates(plates) {
  if (!("IntersectionObserver" in window)) {
    plates.forEach(p => p.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("is-visible");
        io.unobserve(e.target);
      }
    }
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 });
  plates.forEach(p => io.observe(p));
}

/* ---- Lightbox ------------------------------------------------------- */
function setupLightbox(photos) {
  const lb       = document.getElementById("lightbox");
  const lbImg    = lb.querySelector(".lightbox__img");
  const lbCap    = lb.querySelector(".lightbox__caption");
  const btnClose = lb.querySelector(".lightbox__close");
  const btnPrev  = lb.querySelector(".lightbox__nav--prev");
  const btnNext  = lb.querySelector(".lightbox__nav--next");

  let current = -1;
  const total = photos.length;

  const renderCap = (n) => {
    const p = photos[n];
    const captionLine = p.caption ? `<span class="lightbox__words">${escapeHtml(p.caption)}</span>` : "";
    return `<span class="num">${roman(n + 1)}</span><span>Plate ${n + 1} / ${total}</span>${captionLine}`;
  };

  function open(idx) {
    if (idx < 0 || idx >= total) return;
    current = idx;
    const p = photos[idx];
    lbImg.src = photoUrl(p);
    lbImg.alt = `Douze Land, plate ${roman(idx + 1)}`;
    lbCap.innerHTML = renderCap(idx);
    lb.hidden = false;
    requestAnimationFrame(() => lb.classList.add("is-open"));
    document.body.style.overflow = "hidden";
    lb.setAttribute("aria-hidden", "false");
    btnClose.focus({ preventScroll: true });
  }

  function close() {
    lb.classList.remove("is-open");
    lb.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    setTimeout(() => { lb.hidden = true; lbImg.removeAttribute("src"); }, 250);
  }

  function step(d) {
    open((current + d + total) % total);
  }

  document.querySelectorAll(".plate__frame").forEach((frame) => {
    frame.addEventListener("click", () => {
      const idx = Number(frame.closest(".plate")?.dataset.index ?? -1);
      if (idx >= 0) open(idx);
    });
  });

  btnClose.addEventListener("click", close);
  btnPrev.addEventListener("click", () => step(-1));
  btnNext.addEventListener("click", () => step(1));
  lb.addEventListener("click", (e) => { if (e.target === lb) close(); });

  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft")  step(-1);
    else if (e.key === "ArrowRight") step( 1);
  });

  let touchX = null;
  lb.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    touchX = null;
  });
}

/* ---- Cover meta count ----------------------------------------------- */
function updateCoverCount(n) {
  const el = document.querySelector(".cover__meta-count");
  if (el) el.textContent = `${numberWord(n)} photographs`;
}

/* ---- Boot ----------------------------------------------------------- */
(async () => {
  try {
    const { photos, likesByPhoto, commentsByPhoto } = await loadAll();
    updateCoverCount(photos.length);
    const plates = renderPlates(photos, likesByPhoto, commentsByPhoto);
    wirePlates(plates, commentsByPhoto);
    observePlates(plates);
    setupLightbox(photos);
  } catch (err) {
    console.error("Failed to load photographs:", err);
    const main = document.getElementById("plates");
    main.innerHTML = `<p class="plates__loading">Couldn&rsquo;t load the photographs. Please try again.</p>`;
    main.removeAttribute("aria-busy");
  }
})();
