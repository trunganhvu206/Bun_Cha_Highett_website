// Home page. Uses the helpers in common.js.
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// ---- Opening hours ----
function renderHours() {
  const today = new Date().getDay();
  document.getElementById("hours").innerHTML = WEEK_ORDER.map((d) => {
    const slots = RESTAURANT.hours[d] || [];
    const text = slots.length ? slots.map(([a, b]) => `${fmtTime(a)} – ${fmtTime(b)}`).join("<br>") : "Closed";
    return `<tr class="${d === today ? "today" : ""}"><th scope="row">${DAY_NAMES[d]}</th><td>${text}</td></tr>`;
  }).join("");

  // Extra closed days (holidays) coming up in the next 2 months, set on the staff Settings page
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(new Date());
  const soon = new Date(Date.now() + 62 * 864e5).toISOString().slice(0, 10);
  const upcoming = BOOKING.closedDates.filter((d) => d >= todayIso && d <= soon);
  const nextDay = (d) => new Date(Date.parse(d + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
  const periods = []; // back-to-back days become one period: "Wed 24 Dec – Fri 2 Jan"
  for (const d of upcoming) {
    const last = periods[periods.length - 1];
    if (last && nextDay(last[1]) === d) last[1] = d; else periods.push([d, d]);
  }
  const fmt = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const note = document.getElementById("closed-note");
  note.hidden = !periods.length;
  note.innerHTML = `<strong>Also closed:</strong> ` + periods.map(([a, b]) => (a === b ? fmt(a) : `${fmt(a)} – ${fmt(b)}`)).join(", ");
}

function renderOpenStatus() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const slots = RESTAURANT.hours[now.getDay()] || [];
  const current = slots.find(([a, b]) => mins >= toMinutes(a) && mins < toMinutes(b));
  const el = document.getElementById("open-status");
  if (current) {
    el.innerHTML = `<span class="dot open"></span>Open now · until ${fmtTime(current[1])}`;
    return;
  }
  const later = slots.find(([a]) => toMinutes(a) > mins);
  el.innerHTML = later
    ? `<span class="dot"></span>Closed now · opens ${fmtTime(later[0])} today`
    : `<span class="dot"></span>Closed now`;
}

// ---- Hero slideshow ----
const slides = [...document.querySelectorAll(".hero-slide")];
const dotsEl = document.getElementById("hero-dots");
const pauseBtn = document.getElementById("hero-pause");
let slideIndex = 0;
let slideTimer = null;

dotsEl.innerHTML = slides.map((_, i) =>
  `<button type="button" class="hero-dot" aria-label="Show photo ${i + 1} of ${slides.length}"></button>`
).join("");
const dots = [...dotsEl.children];

function showSlide(i) {
  slideIndex = (i + slides.length) % slides.length;
  slides.forEach((s, n) => s.classList.toggle("is-active", n === slideIndex));
  dots.forEach((d, n) => d.setAttribute("aria-current", n === slideIndex ? "true" : "false"));
}

function setPlaying(play) {
  clearInterval(slideTimer);
  slideTimer = play ? setInterval(() => showSlide(slideIndex + 1), 6000) : null;
  pauseBtn.classList.toggle("is-paused", !play);
  pauseBtn.setAttribute("aria-label", play ? "Pause slideshow" : "Play slideshow");
}

dots.forEach((d, i) => d.addEventListener("click", () => { showSlide(i); setPlaying(false); }));
pauseBtn.addEventListener("click", () => setPlaying(!slideTimer));
showSlide(0);
setPlaying(!reducedMotion); // never auto-play for people who've asked for less motion

// ---- Signature dishes: tap a photo to read its story ----
const dishDialog = document.getElementById("dish-dialog");

document.querySelectorAll(".sig-tile").forEach((tile) => {
  tile.addEventListener("click", () => {
    const t = document.getElementById("dish-" + tile.dataset.dish);
    document.getElementById("dish-img").src = t.dataset.img;
    document.getElementById("dish-img").alt = t.dataset.alt;
    document.getElementById("dish-title").textContent = t.dataset.title;
    document.getElementById("dish-sub").textContent = t.dataset.sub;
    document.getElementById("dish-text").replaceChildren(t.content.cloneNode(true));
    dishDialog.showModal();
    dishDialog.scrollTop = 0;
  });
});
document.getElementById("dish-close").addEventListener("click", () => dishDialog.close());
// Clicking the dark backdrop outside the box closes it too
dishDialog.addEventListener("click", (e) => { if (e.target === dishDialog) dishDialog.close(); });

// ---- Menu overview: one card per type of food, each linking to that part of the full menu ----
function renderMenuOverview() {
  document.getElementById("menu-overview").innerHTML = MENU.map((cat) => {
    const dishes = cat.items.filter((i) => !/^Add /.test(i.name)); // leave out add-ons like "Add a fried egg"
    const from = Math.min(...dishes.map((i) => (i.taOnly ? i.ta : i.price)));
    const examples = dishes.slice(0, 3).map((i) => esc(i.name)).join(" · ") + (dishes.length > 3 ? " …" : "");
    return `<li><a class="mo-card" href="menu.html#${cat.id}">
      <span class="mo-head"><span class="mo-title">${esc(cat.title)}</span>${cat.badge ? `<span class="mo-badge">${esc(cat.badge)}</span>` : ""}</span>
      <span class="mo-items">${examples}</span>
      <span class="mo-foot"><span>${dishes.length} ${dishes.length === 1 ? "dish" : "dishes"}</span><span>from ${fmtPrice(from)}</span></span>
    </a></li>`;
  }).join("");
}

// ---- Google reviews ----
// Five stars, filled to `value` out of 5 (e.g. 4.6 fills 92%).
const stars = (value) =>
  `<span class="stars" role="img" aria-label="${value} out of 5 stars"><span style="width:${(value / 5) * 100}%"></span></span>`;

function renderReviews(data) {
  const googleUrl = data.googleUrl || REVIEWS.googleUrl;
  document.querySelectorAll("[data-google-reviews]").forEach((el) => (el.href = googleUrl));
  document.getElementById("write-review").href = data.writeReviewUrl || googleUrl;

  document.getElementById("rating-summary").innerHTML = data.rating ? `
    <span class="rating-number">${Number(data.rating).toFixed(1)}</span>
    <span>${stars(data.rating)}<br>
      <span class="muted">${data.count ? `${data.count} reviews on Google` : "on Google"}</span></span>` : "";

  const items = data.items || [];
  document.getElementById("review-list").innerHTML = items.length
    ? items.map((r, i) => `
      <li class="rv-card" aria-roledescription="slide" aria-label="Review ${i + 1} of ${items.length}">
        <figure>
          <div class="rv-text">
            <span class="rv-quote" aria-hidden="true">“</span>
            <blockquote>${esc(r.text)}</blockquote>
            <figcaption>
              <strong>${r.authorUrl ? `<a href="${esc(r.authorUrl)}" target="_blank" rel="noopener">${esc(r.name)}</a>` : esc(r.name)}</strong>
              <span class="rv-meta">${stars(r.stars)} Google review${r.when ? ` · ${esc(r.when)}` : ""}</span>
            </figcaption>
          </div>
          <img class="rv-img" src="${REVIEW_PHOTOS[i % REVIEW_PHOTOS.length]}" alt="" loading="lazy" />
        </figure>
      </li>`).join("")
    : `<li class="rv-empty muted">See what our guests are saying about us on Google – and tell us about your visit!</li>`;
  updateReviewNav();
}

// Food photos shown beside each review card
const REVIEW_PHOTOS = ["images/bun-cha-hanoi.jpg", "images/gallery-feast.jpg", "images/gallery-rice-paper-rolls.jpg",
  "images/gallery-skewers.jpg", "images/gallery-cha-ca.jpg", "images/gallery-vermicelli-beef.jpg"];

// ‹ › buttons slide one card at a time; swiping and scrolling work too
const rvTrack = document.getElementById("review-list");
const rvPrev = document.getElementById("rv-prev");
const rvNext = document.getElementById("rv-next");

function updateReviewNav() {
  const max = rvTrack.scrollWidth - rvTrack.clientWidth - 4;
  rvPrev.hidden = rvTrack.scrollLeft <= 4;
  rvNext.hidden = rvTrack.scrollLeft >= max;
}

function slideReviews(dir) {
  const card = rvTrack.querySelector(".rv-card");
  if (!card) return;
  const gap = parseFloat(getComputedStyle(rvTrack).columnGap) || 0;
  rvTrack.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: reducedMotion ? "auto" : "smooth" });
}

rvPrev.addEventListener("click", () => slideReviews(-1));
rvNext.addEventListener("click", () => slideReviews(1));
rvTrack.addEventListener("scroll", updateReviewNav, { passive: true });
window.addEventListener("resize", updateReviewNav);

// Small pop-up in the corner that shows one Google review at a time.
// Starts after a few seconds, changes every 8 seconds, and stays away once closed.
const reviewPop = document.getElementById("review-pop");
const reviewPopBody = document.getElementById("review-pop-body");
let popTimer = null;

function startReviewPopups(data) {
  clearTimeout(popTimer);
  const items = (data.items || []).filter((r) => r.stars >= 4 && r.text);
  try { if (sessionStorage.getItem("hideReviewPop")) return; } catch {}
  if (!items.length) return;

  let i = 0;
  const show = () => {
    const r = items[i++ % items.length];
    const text = r.text.length > 140 ? r.text.slice(0, 137).replace(/\s+\S*$/, "") + "…" : r.text;
    reviewPopBody.innerHTML = `
      <span class="review-pop-top">${stars(r.stars)}<span class="review-pop-g">Google review</span></span>
      <span class="review-pop-text">“${esc(text)}”</span>
      <span class="review-pop-name">— ${esc(r.name)}${data.rating ? ` · ${Number(data.rating).toFixed(1)}★ on Google` : ""}</span>`;
    reviewPop.hidden = false;
    reviewPop.classList.remove("is-out");
    popTimer = setTimeout(hide, 8000);
  };
  const hide = () => {
    reviewPop.classList.add("is-out");
    popTimer = setTimeout(show, 5000);
  };
  popTimer = setTimeout(show, 4000);
}

document.getElementById("review-pop-close").addEventListener("click", () => {
  clearTimeout(popTimer);
  reviewPop.hidden = true;
  try { sessionStorage.setItem("hideReviewPop", "1"); } catch {}
});
// Pause while someone is reading it
reviewPop.addEventListener("mouseenter", () => clearTimeout(popTimer));
reviewPop.addEventListener("mouseleave", () => { if (!reviewPop.hidden) popTimer = setTimeout(() => reviewPop.classList.add("is-out"), 3000); });

renderReviews(REVIEWS);
fetch("/api/reviews")
  .then((res) => (res.ok ? res.json() : null))
  .then((data) => {
    const best = data && (data.items || []).length ? data : REVIEWS;
    if (data) renderReviews(best);
    startReviewPopups(best);
  })
  .catch(() => startReviewPopups(REVIEWS)); // site opened without the server – use the reviews from data.js

renderHours();
renderOpenStatus();
renderMenuOverview();
