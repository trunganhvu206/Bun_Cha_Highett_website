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
  const later = slots.find(([a]) => toMinutes(a) > mins);
  const text = current ? `Open now · until ${fmtTime(current[1])}`
    : later ? `Closed now · opens ${fmtTime(later[0])} today` : "Closed now";
  document.getElementById("open-status").innerHTML = `<span class="dot${current ? " open" : ""}"></span>${text}`;
  // Same line in the Hours & Location panel
  const v = document.getElementById("visit-open");
  v.textContent = current ? `Open now until ${fmtTime(current[1])}` : later ? `Opens today at ${fmtTime(later[0])}` : "Closed now";
  v.classList.toggle("is-open", !!current);
}

// ---- Hero slideshow: changes photo by itself every 6 seconds ----
const slides = [...document.querySelectorAll(".hero-slide")];
let slideIndex = 0;
setInterval(() => {
  if (document.hidden) return;
  slideIndex = (slideIndex + 1) % slides.length;
  slides.forEach((s, n) => s.classList.toggle("is-active", n === slideIndex));
}, 6000);

// The Bún Chả Signature slideshow lives in signature.js

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
          <div class="rv-head">
            <span class="rv-avatar" aria-hidden="true">${esc((r.name || "?").trim().charAt(0).toUpperCase())}</span>
            <div class="rv-who">
              <strong>${r.authorUrl ? `<a href="${esc(r.authorUrl)}" target="_blank" rel="noopener">${esc(r.name)}</a>` : esc(r.name)}</strong>
              <span class="rv-meta">${r.when ? esc(r.when) : "Google review"}</span>
            </div>
            <span class="rv-g" aria-hidden="true">G</span>
          </div>
          ${stars(r.stars)}
          <blockquote>${esc(r.text)}</blockquote>
        </figure>
      </li>`).join("")
    : `<li class="rv-empty muted">See what our guests are saying about us on Google – and tell us about your visit!</li>`;
  updateReviewNav();
}

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
