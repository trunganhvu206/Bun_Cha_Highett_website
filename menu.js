// Full menu page (menu.html). Uses the helpers in common.js.

const filters = new Set();

const FILTER_NOTES = {
  gf: "Gluten free includes dishes that can be made gluten free (GFO) – please ask when ordering.",
  vegan: "Vegan includes dishes with a vegan option (VGO) – please ask when ordering.",
  nutfree: "“No nuts” hides dishes marked N. Our kitchen uses nuts, so we can't guarantee any dish is nut free.",
};

function matchesFilters(item) {
  const codes = item.diet ? item.diet.split("/") : [];
  if (filters.has("gf") && !codes.some((c) => c === "GF" || c === "GFO")) return false;
  if (filters.has("vegan") && !codes.some((c) => c === "V" || c === "VGO")) return false;
  if (filters.has("nutfree") && codes.includes("N")) return false;
  return true;
}

// Price on the right is the dine in price (or the take away price for take-away-only dishes).
// Underneath: the take away price when it's different, or "Dine in only" / "Take away only".
function priceInfo(item) {
  if (item.taOnly) return { price: item.ta, line: `<span class="menu-tag">Take away only</span>` };
  if (item.ta === undefined) return { price: item.price, line: `<span class="menu-tag">Dine in only</span>` };
  if (item.ta !== item.price) return { price: item.price, line: `<span class="menu-ta">Take away ${fmtPrice(item.ta)}</span>` };
  return { price: item.price, line: "" };
}

const itemHtml = (item) => {
  const { price, line } = priceInfo(item);
  const extra = [line, item.taNote ? `<span class="menu-ta-note">${esc(item.taNote)}</span>` : ""].filter(Boolean).join(" ");
  return `
  <li class="menu-item">
    <div class="menu-item-head">
      <span class="menu-name">${esc(item.name)}${dietTags(item.diet)}${item.isNew ? `<span class="badge-new">New</span>` : ""}</span>
      <span class="menu-dots"></span>
      <span class="menu-price">${fmtPrice(price)}</span>
    </div>
    ${item.desc ? `<p class="menu-desc">${esc(item.desc)}</p>` : ""}
    ${item.options ? `<ul class="menu-options">${item.options.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
    ${extra ? `<p class="menu-extra">${extra}</p>` : ""}
  </li>`;
};

function renderMenu() {
  let shown = 0;
  document.getElementById("menu-body").innerHTML = MENU.map((cat) => {
    const items = cat.items.filter(matchesFilters);
    if (!items.length) return "";
    shown += items.length;
    return `
      <section class="menu-cat" id="${cat.id}" aria-labelledby="h-${cat.id}">
        <div class="menu-cat-head">
          <h2 id="h-${cat.id}">${esc(cat.title)}</h2>
          ${cat.badge ? `<span class="mo-badge">${esc(cat.badge)}</span>` : ""}
        </div>
        ${cat.note ? `<p class="menu-note">${esc(cat.note)}</p>` : ""}
        <ul class="menu-list">${items.map(itemHtml).join("")}</ul>
      </section>`;
  }).join("");

  document.getElementById("menu-empty").hidden = shown > 0;
  const noteEl = document.getElementById("filter-note");
  noteEl.textContent = [...filters].map((f) => FILTER_NOTES[f]).join(" ");
  noteEl.hidden = !filters.size;
  document.getElementById("menu-count").textContent = filters.size ? `Showing ${shown} matching dishes.` : "";
}

document.querySelectorAll(".menu-filters [data-filter]").forEach((chip) => {
  chip.addEventListener("click", () => {
    const f = chip.dataset.filter;
    const on = !filters.has(f);
    on ? filters.add(f) : filters.delete(f);
    chip.setAttribute("aria-pressed", on);
    renderMenu();
  });
});

// Jump links to each type of food
document.getElementById("cat-nav").innerHTML = MENU.map((cat) =>
  `<li><a href="#${cat.id}">${esc(cat.title)}</a></li>`).join("");

document.getElementById("price-info").textContent = MENU_INFO.prices;
document.getElementById("takeaway-info").innerHTML =
  `${esc(MENU_INFO.takeaway)} <a class="link" target="_blank" rel="noopener" href="${esc(RESTAURANT.uberEats)}">Order on Uber Eats →</a>`;

renderMenu();

// Arriving from the home page with e.g. menu.html#banhmi: jump to that section once it exists
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
