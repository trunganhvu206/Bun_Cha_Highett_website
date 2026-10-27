const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// "17:00" -> "5pm", "21:30" -> "9:30pm"
function fmtTime(t) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
}

const toMinutes = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

// ---- Contact details ----
const telHref = "tel:" + RESTAURANT.phone.replace(/[^\d+]/g, "");
document.querySelectorAll("[data-phone]").forEach((el) => (el.textContent = RESTAURANT.phone));
document.querySelectorAll("[data-phone-link]").forEach((el) => (el.href = telHref));
document.querySelectorAll("[data-address]").forEach((el) => (el.textContent = RESTAURANT.address));
document.querySelectorAll("[data-maps-link]").forEach(
  (el) => (el.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(RESTAURANT.address))
);
document.getElementById("year").textContent = new Date().getFullYear();

// ---- Opening hours ----
function renderHours() {
  const today = new Date().getDay();
  document.getElementById("hours").innerHTML = WEEK_ORDER.map((d) => {
    const slots = RESTAURANT.hours[d] || [];
    const text = slots.length ? slots.map(([a, b]) => `${fmtTime(a)} – ${fmtTime(b)}`).join("<br>") : "Closed";
    return `<tr class="${d === today ? "today" : ""}"><th>${DAY_NAMES[d]}</th><td>${text}</td></tr>`;
  }).join("");
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

// ---- Menu ----
const TAG_LABELS = { signature: "House favourite", v: "Vegetarian", spicy: "Spicy" };

function renderMenu(key) {
  document.getElementById("menu-body").innerHTML = MENUS[key].map((section) => `
    <div class="menu-section">
      <h3>${esc(section.title)}</h3>
      ${section.note ? `<p class="menu-note">${esc(section.note)}</p>` : ""}
      <ul>
        ${section.items.map((item) => `
          <li class="menu-item">
            <div class="menu-item-head">
              <span class="menu-name">${esc(item.name)}</span>
              <span class="menu-dots"></span>
              <span class="menu-price">$${item.price.toFixed(2)}</span>
            </div>
            ${item.vi ? `<p class="menu-vi">${esc(item.vi)}${item.tag ? ` <span class="tag tag-${item.tag}">${TAG_LABELS[item.tag]}</span>` : ""}</p>` : ""}
            ${item.desc ? `<p class="menu-desc">${esc(item.desc)}</p>` : ""}
          </li>`).join("")}
      </ul>
    </div>`).join("");
}

document.querySelectorAll(".tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", b === btn));
    renderMenu(btn.dataset.menu);
  });
});

renderHours();
renderOpenStatus();
renderMenu("dinein");
