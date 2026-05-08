// Public-facing photograph book — fetches plates from Supabase, renders them,
// then wires up scroll fade-in and the lightbox.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_KEY, photoUrl } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

/* ---- Plate sequencing rhythm ---------------------------------------- */
function variant(idx, w, h) {
  if (w && h && h > w) return "tall";
  if ((idx + 1) % 6 === 0) return "wide";
  if ((idx + 1) % 3 === 0) return "inset";
  return "default";
}

const numberWord = (n) => {
  // Simple "Seventy-four photographs"-style label up to small numbers; otherwise digits.
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

/* ---- Render --------------------------------------------------------- */
async function loadPhotos() {
  const { data, error } = await supabase
    .from("photos")
    .select("id, filename, bucket, position, caption, width, height")
    .order("position", { ascending: true });
  if (error) throw error;
  return data || [];
}

function renderPlates(photos) {
  const main = document.getElementById("plates");
  if (!photos.length) {
    main.innerHTML = `<p class="plates__loading">No photographs yet.</p>`;
    main.removeAttribute("aria-busy");
    return [];
  }
  main.innerHTML = photos.map((p, i) => {
    const v = variant(i, p.width, p.height);
    const r = roman(i + 1);
    const url = photoUrl(p);
    const w = p.width || 2048;
    const h = p.height || 1365;
    const cap = p.caption ? `<span class="plate__words">${escapeHtml(p.caption)}</span>` : "";
    return `
      <figure class="plate plate--${v}" data-id="${p.id}" data-index="${i}">
        <div class="plate__frame">
          <img src="${url}" alt="Douze Land, plate ${r}" loading="lazy" decoding="async" width="${w}" height="${h}">
        </div>
        <figcaption class="plate__caption">
          <span class="plate__num">${r}</span>
          <span class="plate__rule" aria-hidden="true"></span>
          <span class="plate__title">Douze Land</span>
          ${cap}
        </figcaption>
      </figure>`;
  }).join("");
  main.removeAttribute("aria-busy");
  return main.querySelectorAll(".plate");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
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
    const photos = await loadPhotos();
    updateCoverCount(photos.length);
    const plates = renderPlates(photos);
    observePlates(plates);
    setupLightbox(photos);
  } catch (err) {
    console.error("Failed to load photographs:", err);
    const main = document.getElementById("plates");
    main.innerHTML = `<p class="plates__loading">Couldn&rsquo;t load the photographs. Please try again.</p>`;
    main.removeAttribute("aria-busy");
  }
})();
