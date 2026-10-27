// Shared by every page (home and full menu): helpers, contact details, socials, phone navigation menu.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// "17:00" -> "5pm", "21:30" -> "9:30pm"
function fmtTime(t) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
}

const toMinutes = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmtPrice = (p) => (Number.isInteger(p) ? `$${p}` : `$${p.toFixed(2)}`);

// ---- Dietary codes ----
const DIET_LABELS = { GF: "Gluten free", GFO: "Gluten free option", V: "Vegan", VGO: "Vegan option", N: "Contains nuts" };

const dietTags = (diet) =>
  diet
    ? diet.split("/").map((d) =>
        `<abbr class="diet" title="${DIET_LABELS[d] || d}"><span aria-hidden="true">${esc(d)}</span><span class="sr-only">${DIET_LABELS[d] || d}</span></abbr>`
      ).join("")
    : "";

// ---- Contact details & socials ----
const telHref = "tel:" + RESTAURANT.phone.replace(/[^\d+]/g, "");
const mailHref = "mailto:" + RESTAURANT.email;
const fill = (sel, fn) => document.querySelectorAll(sel).forEach(fn);

fill("[data-phone]", (el) => (el.textContent = RESTAURANT.phone));
fill("[data-phone-link]", (el) => (el.href = telHref));
fill("[data-email]", (el) => (el.textContent = RESTAURANT.email));
fill("[data-email-link]", (el) => (el.href = mailHref));
fill("[data-address]", (el) => (el.textContent = RESTAURANT.address));
fill("[data-maps-link]", (el) => (el.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(RESTAURANT.address)));
fill("[data-ubereats]", (el) => (el.href = RESTAURANT.uberEats));
fill("[data-google-reviews]", (el) => (el.href = REVIEWS.googleUrl));
fill("[data-instagram]", (el) => {
  el.href = `https://www.instagram.com/${RESTAURANT.instagram}/`;
  el.textContent = "@" + RESTAURANT.instagram;
});
fill("[data-facebook]", (el) => {
  el.href = RESTAURANT.facebookUrl;
  el.textContent = RESTAURANT.facebook;
});
fill("[data-year]", (el) => (el.textContent = new Date().getFullYear()));

// ---- Phone navigation menu ----
const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.getElementById("site-nav");

function setNavOpen(open) {
  navToggle.setAttribute("aria-expanded", open);
  siteNav.classList.toggle("open", open);
}

navToggle.addEventListener("click", () => setNavOpen(navToggle.getAttribute("aria-expanded") !== "true"));
siteNav.addEventListener("click", (e) => { if (e.target.closest("a")) setNavOpen(false); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && siteNav.classList.contains("open")) {
    setNavOpen(false);
    navToggle.focus();
  }
});
