const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function fmtTime(t) {
  const [h, m] = t.split(":").map(Number);
  const h12 = h % 12 || 12;
  return `${h12}${m ? ":" + String(m).padStart(2, "0") : ""}${h >= 12 ? "pm" : "am"}`;
}

const fmtDate = (date, opts = { weekday: "short", day: "numeric", month: "short" }) =>
  new Date(date + "T00:00:00Z").toLocaleDateString("en-AU", { ...opts, timeZone: "UTC" });

const melbourneToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(new Date());

function addDays(date, n) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function addMonths(month, n) {
  const d = new Date(month + "-01T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const STATUS_LABELS = { pending: "Waiting for approval", confirmed: "Confirmed", declined: "Declined", cancelled: "Cancelled" };

const toast = document.getElementById("toast");

async function api(path, options = {}) {
  // Full address without any login details, so it also works when the page was opened as http://user:pass@…
  const res = await fetch(new URL(path, location.origin), { headers: { "Content-Type": "application/json" }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => (toast.hidden = true), 6000);
}

// ---------- Menu / views ----------
// The address bar keeps the current view: #calendar/2026-11, #day/2026-10-28, #requests, #reports/2026-10, #settings
const VIEWS = ["calendar", "day", "requests", "reports", "settings"];
const state = { view: "calendar", month: melbourneToday().slice(0, 7), date: melbourneToday(), reportMonth: melbourneToday().slice(0, 7) };

function readHash() {
  const [view, arg] = location.hash.slice(1).split("/");
  if (view === "day") { state.view = "day"; if (arg) state.date = arg; }
  else if (view === "reports") { state.view = "reports"; if (arg) state.reportMonth = arg; }
  else if (view === "requests" || view === "settings") state.view = view;
  else { state.view = "calendar"; if (arg) state.month = arg; }
}

function go(hash) {
  if (location.hash === hash) render(); else location.hash = hash;
}

function render() {
  readHash();
  for (const v of VIEWS) document.getElementById("view-" + v).hidden = v !== state.view;
  document.querySelectorAll(".admin-menu a").forEach((a) => {
    if (a.dataset.view === state.view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  document.querySelector('.admin-menu a[data-view="day"]').href = `#day/${state.date}`;
  document.querySelector('.admin-menu a[data-view="calendar"]').href = `#calendar/${state.month}`;
  if (state.view === "calendar") loadCalendar();
  if (state.view === "day") loadDay();
  if (state.view === "requests") loadPending();
  if (state.view === "reports") loadReports();
  if (state.view === "settings" && !settingsDirty) loadSettings();
}

window.addEventListener("hashchange", render);

// ---------- Calendar ----------
async function loadCalendar() {
  const month = state.month;
  document.getElementById("cal-title").textContent =
    new Date(month + "-01T00:00:00Z").toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });

  let data;
  try { data = await api(`/api/admin/month?month=${month}`); }
  catch (err) { document.getElementById("cal-days").innerHTML = `<p class="empty">Couldn't load: ${esc(err.message)}</p>`; return; }
  if (month !== state.month) return; // user moved on

  const dates = Object.keys(data.days);
  const firstDow = (new Date(dates[0] + "T00:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
  const blanks = Array.from({ length: firstDow }, () => `<span class="cal-blank"></span>`).join("");

  document.getElementById("cal-days").innerHTML = blanks + dates.map((date) => {
    const d = data.days[date];
    const lines = [];
    if (!d.open) lines.push(`<span class="cal-note lg-closed-text">Closed</span>`);
    else {
      if (d.guests) lines.push(`<span class="cal-note cal-guests">${plural(d.guests, "guest")}<span class="cal-sub"> · ${plural(d.confirmed, "booking")}</span></span>`);
      if (d.pending) lines.push(`<span class="cal-note cal-pending">${d.pending} waiting</span>`);
      if (d.dayBlocked) lines.push(`<span class="cal-note cal-full">Online closed</span>`);
      else if (d.blockedTimes) lines.push(`<span class="cal-note cal-full">${plural(d.blockedTimes, "time")} full</span>`);
    }
    const label = `${fmtDate(date, { weekday: "long", day: "numeric", month: "long" })}: ` +
      (d.open ? `${plural(d.guests, "guest")}, ${plural(d.confirmed, "confirmed booking")}${d.pending ? `, ${d.pending} waiting for approval` : ""}` : "closed");
    return `<button type="button" class="cal-day${date === data.today ? " is-today" : ""}${date < data.today ? " is-past" : ""}${d.open ? "" : " is-closed"}"
      data-date="${date}" aria-label="${esc(label)}">
      <span class="cal-num">${Number(date.slice(8))}</span>${lines.join("")}
    </button>`;
  }).join("");
}

document.getElementById("cal-days").addEventListener("click", (e) => {
  const day = e.target.closest(".cal-day");
  if (day) go(`#day/${day.dataset.date}`);
});
document.getElementById("cal-prev").addEventListener("click", () => go(`#calendar/${addMonths(state.month, -1)}`));
document.getElementById("cal-next").addEventListener("click", () => go(`#calendar/${addMonths(state.month, 1)}`));
document.getElementById("cal-today").addEventListener("click", () => go(`#calendar/${melbourneToday().slice(0, 7)}`));

// ---------- Booking rows (used by the day view and requests) ----------
function actions(b) {
  const who = `${esc(b.name)} at ${fmtTime(b.time)} on ${fmtDate(b.date)}`;
  const btn = (status, label, cls = "") =>
    `<button class="row-btn ${cls}" data-id="${b.id}" data-status="${status}" aria-label="${label} booking for ${who}">${label}</button>`;
  if (b.status === "pending") return btn("confirmed", "Confirm", "row-btn-yes") + btn("declined", "Decline");
  if (b.status === "confirmed") return btn("cancelled", "Cancel");
  return btn("confirmed", "Restore");
}

const bookingRow = (b, { showDate = false } = {}) => `
  <li class="bk ${b.status}">
    <div class="bk-time">${showDate ? `<span class="bk-date">${fmtDate(b.date)}</span>` : ""}${fmtTime(b.time)}</div>
    <div class="bk-main">
      <strong>${esc(b.name)}</strong> <span class="src">${b.source === "staff" ? "Added by staff" : "Online"} · ${esc(b.ref)}</span><br>
      <a class="link" href="tel:${esc(b.phone.replace(/[^\d+]/g, ""))}">${esc(b.phone)}</a>
      ${b.email ? ` · <a href="mailto:${esc(b.email)}">${esc(b.email)}</a>` : ""}
      ${b.notes ? `<p class="bk-notes">${esc(b.notes)}</p>` : ""}
    </div>
    <div class="bk-guests"><span>${b.guests}</span>${b.guests === 1 ? "guest" : "guests"}</div>
    <div class="bk-status">
      <span class="status status-${b.status}">${STATUS_LABELS[b.status] || esc(b.status)}</span>
      <div class="row-actions">${actions(b)}</div>
    </div>
  </li>`;

// ---------- Day view ----------
const dayInput = document.getElementById("day");
const addForm = document.getElementById("add-form");
const addError = document.getElementById("add-error");

async function loadDay() {
  const date = state.date;
  dayInput.value = date;
  document.getElementById("day-title").textContent =
    (date === melbourneToday() ? "Today · " : "") + fmtDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  let data;
  try { data = await api(`/api/admin/bookings?date=${date}`); }
  catch (err) { document.getElementById("rows").innerHTML = `<li class="empty">Couldn't load bookings: ${esc(err.message)}</li>`; return; }
  if (date !== state.date) return;

  const confirmed = data.bookings.filter((b) => b.status === "confirmed");
  const pending = data.bookings.filter((b) => b.status === "pending");
  const guests = confirmed.reduce((sum, b) => sum + b.guests, 0);
  document.getElementById("summary").textContent = data.slots.length
    ? `${plural(confirmed.length, "confirmed booking")} · ${plural(guests, "guest")}` + (pending.length ? ` · ${pending.length} waiting for approval` : "")
    : "Closed this day";

  // Requests waiting for approval first, then confirmed, then declined / cancelled – each by time
  const ORDER = { pending: 0, confirmed: 1, declined: 2, cancelled: 2 };
  const sorted = [...data.bookings].sort((a, b) => (ORDER[a.status] ?? 3) - (ORDER[b.status] ?? 3) || a.time.localeCompare(b.time));
  document.getElementById("rows").innerHTML = sorted.length
    ? sorted.map((b, i) => (b.status === "pending" && i === 0 ? `<li class="bk-group">Waiting for approval</li>` : "") +
        (b.status !== "pending" && (i === 0 || sorted[i - 1].status === "pending") && pending.length ? `<li class="bk-group">Other bookings</li>` : "") +
        bookingRow(b)).join("")
    : `<li class="empty">No bookings yet for this day.</li>`;

  // Right side: add booking + online times
  const open = data.slots.length > 0;
  document.getElementById("add-booking").hidden = !open;
  document.getElementById("times-panel").hidden = !open;
  const chosenTime = addForm.time.value; // keep the staff member's choice when the page refreshes
  addForm.time.innerHTML = data.slots.map((t) => `<option value="${t}">${fmtTime(t)}</option>`).join("");
  if (data.slots.includes(chosenTime)) addForm.time.value = chosenTime;

  document.getElementById("day-blocked").checked = data.dayBlocked;
  document.getElementById("time-list").innerHTML = data.times.map((t) => {
    const full = data.dayBlocked || t.blocked || t.guests >= data.capacity;
    const why = data.dayBlocked ? "Day closed online" : t.blocked ? "Marked full" : t.guests >= data.capacity ? "Fully booked" : "Open online";
    return `<li class="time-row${full ? " is-full" : ""}">
      <span class="time-at">${fmtTime(t.time)}</span>
      <span class="time-load"><span class="time-bar"><i style="width:${Math.min(100, (t.guests / data.capacity) * 100)}%"></i></span>${t.guests}/${data.capacity}</span>
      <button type="button" class="time-toggle" data-time="${t.time}" aria-pressed="${t.blocked}" ${data.dayBlocked ? "disabled" : ""}
        aria-label="${fmtTime(t.time)}: ${why}. ${t.blocked ? "Open it again" : "Mark as full"}">${t.blocked ? "Full" : "Open"}</button>
    </li>`;
  }).join("");
}

async function setBlocked(time, blocked) {
  try {
    await api("/api/admin/blocks", { method: "POST", body: JSON.stringify({ date: state.date, time, blocked }) });
    showToast(time === "*"
      ? (blocked ? "Online bookings stopped for this day." : "Online bookings open again for this day.")
      : `${fmtTime(time)} is now ${blocked ? "full – customers can't request it online" : "open for online requests"}.`);
  } catch (err) {
    alert(err.message);
  }
  loadDay();
}

document.getElementById("time-list").addEventListener("click", (e) => {
  const btn = e.target.closest(".time-toggle");
  if (btn) setBlocked(btn.dataset.time, btn.getAttribute("aria-pressed") !== "true");
});
document.getElementById("day-blocked").addEventListener("change", (e) => setBlocked("*", e.target.checked));

dayInput.addEventListener("change", () => dayInput.value && go(`#day/${dayInput.value}`));
document.getElementById("prev-day").addEventListener("click", () => go(`#day/${addDays(state.date, -1)}`));
document.getElementById("next-day").addEventListener("click", () => go(`#day/${addDays(state.date, 1)}`));
document.getElementById("today").addEventListener("click", () => go(`#day/${melbourneToday()}`));

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  addError.hidden = true;
  try {
    await api("/api/admin/bookings", {
      method: "POST",
      body: JSON.stringify({ ...Object.fromEntries(new FormData(addForm)), date: state.date }),
    });
    addForm.reset();
    showToast("Booking added.");
    loadDay();
  } catch (err) {
    addError.textContent = err.message;
    addError.hidden = false;
  }
});

// ---------- Requests ----------
async function loadPending() {
  let data;
  try { data = await api("/api/admin/pending"); } catch { return; }
  const n = data.bookings.length;
  const badge = document.getElementById("pending-count");
  badge.textContent = n;
  badge.hidden = !n;
  if (state.view === "requests") {
    document.getElementById("pending-list").innerHTML = n
      ? data.bookings.map((b) => bookingRow(b, { showDate: true })).join("")
      : `<li class="empty">No requests waiting – you're all caught up.</li>`;
  }
}

// ---------- Reports ----------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const fmtNum = (n) => new Intl.NumberFormat("en-AU").format(n);

// Round the top of an axis up to a clean number: 37 -> 40, 130 -> 200
function niceMax(v) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((s) => s * p).find((s) => s >= v);
}

const tile = (label, value, note = "") =>
  `<div class="tile"><span class="tile-label">${label}</span><span class="tile-value">${value}</span>${note ? `<span class="tile-note">${note}</span>` : ""}</div>`;

function tiles(t) {
  const avg = t.bookings ? (t.guests / t.bookings).toFixed(1) : "–";
  const online = t.bookings ? Math.round((t.online / t.bookings) * 100) + "%" : "–";
  return tile("Guests", fmtNum(t.guests)) +
    tile("Bookings", fmtNum(t.bookings), "confirmed") +
    tile("Average group", avg, "guests per booking") +
    tile("Booked online", online, `${fmtNum(t.staff)} added by staff`) +
    tile("Declined / cancelled", fmtNum(t.declined + t.cancelled), t.pending ? `${t.pending} still waiting` : "");
}

// Column chart: items = [{ key, label, short, value, note }]. One colour; the picked column is darker.
function columnChart(el, items, { selected, showTick = () => true } = {}) {
  const peak = Math.max(0, ...items.map((i) => i.value));
  const max = niceMax(peak);
  const grid = [1, 0.5, 0].map((f) => `<span class="cc-grid" style="bottom:${f * 100}%"><i>${fmtNum(max * f)}</i></span>`).join("");
  let labelledPeak = false;
  el.innerHTML = `<div class="cc-plot">${grid}${items.map((it, n) => {
    const isPeak = it.value === peak && peak > 0 && !labelledPeak && (labelledPeak = true);
    return `<button type="button" class="cc-col${selected === it.key ? " is-selected" : ""}" data-key="${it.key}"
        aria-label="${esc(it.label)}: ${plural(it.value, "guest")}${it.note ? ", " + esc(it.note) : ""}">
      <span class="cc-bar" style="height:${(it.value / max) * 100}%">${isPeak ? `<b class="cc-val">${fmtNum(it.value)}</b>` : ""}</span>
      <span class="cc-tip" aria-hidden="true">${esc(it.label)}<strong>${plural(it.value, "guest")}</strong>${it.note ? esc(it.note) : ""}</span>
      <span class="cc-x" aria-hidden="true">${showTick(it, n) ? esc(it.short) : ""}</span>
    </button>`;
  }).join("")}</div>`;
}

// Horizontal bar chart for ranked lists: items = [{ label, value }]
function barChart(el, items, emptyText) {
  const max = Math.max(1, ...items.map((i) => i.value));
  el.innerHTML = items.some((i) => i.value)
    ? items.map((it) => `<div class="hb-row">
        <span class="hb-label">${esc(it.label)}</span>
        <span class="hb-track"><span class="hb-bar" style="width:${(it.value / max) * 100}%"></span></span>
        <span class="hb-val">${fmtNum(it.value)}</span>
      </div>`).join("")
    : `<p class="muted">${emptyText}</p>`;
}

const table = (head, rows) =>
  `<table class="data-table"><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>
   <tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`)).join("")}</tr>`).join("")}</tbody></table>`;

async function loadReports() {
  const [year, month] = state.reportMonth.split("-");
  document.getElementById("rep-title").textContent = `Reports ${year}`;
  let s;
  try { s = await api(`/api/admin/stats?year=${year}&month=${month}`); }
  catch (err) { document.getElementById("year-tiles").innerHTML = `<p class="empty">Couldn't load: ${esc(err.message)}</p>`; return; }

  const monthName = new Date(`${year}-${month}-01T00:00:00Z`).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
  document.getElementById("year-tiles").innerHTML = tiles(s.yearTotals);
  document.getElementById("rep-month-title").textContent = monthName;
  document.getElementById("month-tiles").innerHTML = tiles(s.monthTotals);
  document.getElementById("days-sub").textContent = `Confirmed guests each day in ${monthName}. Tap a day to open its bookings.`;

  columnChart(document.getElementById("chart-months"),
    s.months.map((m, i) => ({ key: `${year}-${String(i + 1).padStart(2, "0")}`, label: `${MONTHS[i]} ${year}`, short: MONTHS[i], value: m.guests, note: plural(m.bookings, "booking") })),
    { selected: state.reportMonth });
  document.getElementById("table-months").innerHTML = table(["Month", "Guests", "Bookings", "Online", "Staff", "Declined", "Cancelled"],
    s.months.map((m, i) => [MONTHS[i], m.guests, m.bookings, m.online, m.staff, m.declined, m.cancelled]));

  columnChart(document.getElementById("chart-days"),
    s.days.map((d, i) => {
      const date = `${year}-${month}-${String(i + 1).padStart(2, "0")}`;
      return { key: date, label: fmtDate(date, { weekday: "short", day: "numeric", month: "short" }), short: String(i + 1), value: d.guests, note: plural(d.bookings, "booking") };
    }),
    { showTick: (it, n) => n === 0 || (n + 1) % 5 === 0 });
  document.getElementById("table-days").innerHTML = table(["Day", "Guests", "Bookings"],
    s.days.map((d, i) => [fmtDate(`${year}-${month}-${String(i + 1).padStart(2, "0")}`), d.guests, d.bookings]));

  barChart(document.getElementById("chart-weekdays"), s.weekdays.map((w, i) => ({ label: WEEKDAYS[i], value: w.guests })), "No bookings this month yet.");
  barChart(document.getElementById("chart-times"),
    [...s.times].sort((a, b) => b.guests - a.guests).slice(0, 8).map((t) => ({ label: fmtTime(t.time), value: t.guests })),
    "No bookings this month yet.");
}

// Tap a month column to see that month; tap a day column to open that day
document.getElementById("chart-months").addEventListener("click", (e) => {
  const col = e.target.closest(".cc-col");
  if (col) go(`#reports/${col.dataset.key}`);
});
document.getElementById("chart-days").addEventListener("click", (e) => {
  const col = e.target.closest(".cc-col");
  if (col) go(`#day/${col.dataset.key}`);
});
document.getElementById("rep-prev").addEventListener("click", () => go(`#reports/${Number(state.reportMonth.slice(0, 4)) - 1}-12`));
document.getElementById("rep-next").addEventListener("click", () => go(`#reports/${Number(state.reportMonth.slice(0, 4)) + 1}-01`));

// ---------- Settings ----------
const settingsForm = document.getElementById("settings-form");
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
let closedDates = [];
let settingsDirty = false; // don't overwrite unsaved changes when the page refreshes

async function loadSettings() {
  let s;
  try { s = await api("/api/admin/settings"); } catch (err) { showToast(err.message); return; }
  document.getElementById("hours-rows").innerHTML = DAY_ORDER.map((d) => {
    const [open, close] = (s.hours[d] || [])[0] || ["17:00", "21:00"];
    const isOpen = (s.hours[d] || []).length > 0;
    return `<tr data-day="${d}">
      <th scope="row">${DAY_NAMES[d]}</th>
      <td><input type="checkbox" class="h-open" aria-label="Open on ${DAY_NAMES[d]}" ${isOpen ? "checked" : ""} /></td>
      <td><input type="time" class="h-from" aria-label="${DAY_NAMES[d]} opening time" value="${open}" ${isOpen ? "" : "disabled"} /></td>
      <td><input type="time" class="h-to" aria-label="${DAY_NAMES[d]} closing time" value="${close}" ${isOpen ? "" : "disabled"} /></td>
    </tr>`;
  }).join("");
  closedDates = [...s.closedDates];
  renderClosed();
  for (const [k, v] of Object.entries(s.booking)) settingsForm.elements[k].value = v;
  settingsForm.elements.phone.value = s.phone;
  settingsForm.elements.email.value = s.email;
  settingsDirty = false;
}

// Group back-to-back dates into periods: ["2026-12-24","2026-12-25","2026-12-31"] -> [[24, 25], [31, 31]]
function closedPeriods(dates) {
  const periods = [];
  for (const d of dates) {
    const last = periods[periods.length - 1];
    if (last && addDays(last[1], 1) === d) last[1] = d;
    else periods.push([d, d]);
  }
  return periods;
}

function renderClosed() {
  const today = melbourneToday();
  const long = { weekday: "short", day: "numeric", month: "short", year: "numeric" };
  document.getElementById("closed-list").innerHTML = closedDates.length
    ? closedPeriods(closedDates).map(([from, to]) => {
        const days = Math.round((new Date(to) - new Date(from)) / 864e5) + 1;
        const text = from === to ? fmtDate(from, long) : `${fmtDate(from, long)} – ${fmtDate(to, long)} <span class="muted">(${days} days)</span>`;
        return `<li class="${to < today ? "is-past" : ""}">
          ${text}
          <button type="button" class="closed-remove" data-from="${from}" data-to="${to}"
            aria-label="Remove closed ${from === to ? "day" : "days"} ${fmtDate(from)}${from === to ? "" : " to " + fmtDate(to)}">×</button>
        </li>`;
      }).join("")
    : `<li class="muted">No extra closed days.</li>`;
}

settingsForm.addEventListener("input", () => (settingsDirty = true));
document.getElementById("hours-rows").addEventListener("change", (e) => {
  if (!e.target.classList.contains("h-open")) return;
  e.target.closest("tr").querySelectorAll('input[type="time"]').forEach((i) => (i.disabled = !e.target.checked));
});
document.getElementById("closed-add").addEventListener("click", () => {
  const fromInput = document.getElementById("closed-from");
  const toInput = document.getElementById("closed-to");
  const err = document.getElementById("closed-error");
  const from = fromInput.value;
  const to = toInput.value || from;
  err.hidden = true;
  if (!from) return fromInput.focus();
  const show = (msg) => { err.textContent = msg; err.hidden = false; };
  if (to < from) return show("The “To” date is before the “From” date.");
  const added = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    added.push(d);
    if (added.length > 366) return show("Please add at most one year at a time.");
  }
  closedDates = [...new Set([...closedDates, ...added])].sort();
  fromInput.value = toInput.value = "";
  settingsDirty = true;
  renderClosed();
  showToast(`${plural(added.length, "day")} added – press “Save settings” to keep the change.`);
});
document.getElementById("closed-list").addEventListener("click", (e) => {
  const btn = e.target.closest(".closed-remove");
  if (!btn) return;
  const { from, to } = btn.dataset;
  closedDates = closedDates.filter((d) => d < from || d > to);
  settingsDirty = true;
  renderClosed();
});
// Picking a From date makes the To picker start from that date
document.getElementById("closed-from").addEventListener("change", (e) => (document.getElementById("closed-to").min = e.target.value));

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = document.getElementById("settings-error");
  err.hidden = true;
  const hours = {};
  document.querySelectorAll("#hours-rows tr").forEach((tr) => {
    hours[tr.dataset.day] = tr.querySelector(".h-open").checked
      ? [[tr.querySelector(".h-from").value, tr.querySelector(".h-to").value]] : [];
  });
  const f = settingsForm.elements;
  const booking = Object.fromEntries(["maxGuestsPerSlot", "maxPartySize", "slotMinutes", "lastBookingBeforeClose", "daysAhead", "minNoticeMinutes"]
    .map((k) => [k, Number(f[k].value)]));
  try {
    await api("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify({ hours, closedDates, booking, phone: f.phone.value, email: f.email.value }),
    });
    settingsDirty = false;
    showToast("Settings saved – the website is updated.");
    loadSettings();
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
  }
});

// ---------- Confirm / decline / cancel buttons (any view) ----------
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-id]");
  if (!btn) return;
  const status = btn.dataset.status;
  if (status === "cancelled" && !confirm("Cancel this booking? The customer will be told.")) return;
  if (status === "declined" && !confirm("Decline this request? The customer will be told.")) return;
  btn.disabled = true;
  try {
    const { booking, notified } = await api(`/api/admin/bookings/${btn.dataset.id}`, {
      method: "PATCH", body: JSON.stringify({ status }),
    });
    const how = { email: "email", sms: "text" };
    showToast(`${booking.name}: ${STATUS_LABELS[booking.status].toLowerCase()}. ` + (notified.length
      ? `Customer notified by ${notified.map((n) => how[n]).join(" and ")}.`
      : `Couldn't notify automatically – please call ${booking.phone}.`));
  } catch (err) {
    alert(err.message);
  }
  render();
  loadPending();
});

// ---------- Start ----------
render();
loadPending();
setInterval(() => { render(); loadPending(); }, 60_000); // pick up new online requests
