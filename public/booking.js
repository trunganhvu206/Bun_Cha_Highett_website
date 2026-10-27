// Table booking form. Talks to the booking server (server.js).
// Uses esc() and fmtTime() from script.js.

const form = document.getElementById("booking-form");
const timeSelect = document.getElementById("time-select");
const errorEl = document.getElementById("booking-error");
const successEl = document.getElementById("booking-success");

const melbourneToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne" }).format(new Date());

function addDays(date, n) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const fmtDate = (date) =>
  new Date(date + "T00:00:00Z").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

// Shown under the time box, and read out to screen reader users without moving focus.
const announce = (msg) => (document.getElementById("slot-status").textContent = msg);

// Replace the time dropdown with a single placeholder option (and disable it).
function timePlaceholder(text, statusMsg = "") {
  timeSelect.innerHTML = `<option value="">${esc(text)}</option>`;
  timeSelect.disabled = true;
  announce(statusMsg);
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = !msg;
}

function showOffline() {
  form.hidden = true;
  document.getElementById("booking-offline").hidden = false;
}

// ---- Setup ----
document.querySelectorAll("[data-max-party]").forEach((el) => (el.textContent = BOOKING.maxPartySize));

form.guests.max = BOOKING.maxPartySize;

// Number typed in the Guests box (NaN while it's empty).
const partySize = () => parseInt(form.guests.value, 10);

// − / + buttons next to the Guests box
document.querySelectorAll(".stepper-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const n = (partySize() || 0) + Number(btn.dataset.step);
    form.guests.value = Math.min(Math.max(n, 1), BOOKING.maxPartySize + 1);
    loadSlots();
  });
});

function partySizeError() {
  const n = partySize();
  if (!Number.isInteger(n) || n < 1) return "Please enter the number of guests.";
  if (n > BOOKING.maxPartySize) return `For groups of more than ${BOOKING.maxPartySize}, please call us on ${RESTAURANT.phone}.`;
  return "";
}

form.date.min = melbourneToday();
form.date.max = addDays(form.date.min, BOOKING.daysAhead);
form.date.value = form.date.min;

// ---- Time slots ----
let loadToken = 0;

async function loadSlots() {
  const date = form.date.value;
  const guests = partySize();
  const previous = timeSelect.value;
  showError("");

  if (!date) return timePlaceholder("Pick a date first");
  if (partySizeError()) {
    return timePlaceholder("Enter the number of guests first", form.guests.value ? partySizeError() : "");
  }
  timePlaceholder("Checking availability…");

  const token = ++loadToken;
  let data;
  try {
    const res = await fetch(`/api/availability?date=${encodeURIComponent(date)}`);
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
  } catch {
    return showOffline();
  }
  if (token !== loadToken) return; // a newer request has started

  if (!data.slots.length) {
    return timePlaceholder("No times available",
      `No bookings available on ${fmtDate(date)} – we may be closed or fully booked. Please choose another day.`);
  }

  const open = data.slots.filter((s) => s.remaining >= guests);
  if (!open.length) {
    return timePlaceholder("Fully booked", `Fully booked for ${guests} guests on this day – try another day or call us.`);
  }

  // Full times stay in the list (greyed out) so people can see the day's times at a glance.
  timeSelect.innerHTML = `<option value="">Choose a time</option>` + data.slots.map(({ time, remaining }) => {
    const full = remaining < guests;
    return `<option value="${time}"${full ? " disabled" : ""}${time === previous && !full ? " selected" : ""}>${fmtTime(time)}${full ? " – full" : ""}</option>`;
  }).join("");
  timeSelect.disabled = false;
  announce(`${open.length} ${open.length === 1 ? "time" : "times"} available on ${fmtDate(date)}, last booking ${fmtTime(data.slots[data.slots.length - 1].time)}.`);
}

form.date.addEventListener("change", loadSlots);
let typingTimer;
form.guests.addEventListener("input", () => {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(loadSlots, 400);
});

// ---- Submit ----
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(form));
  body.guests = partySize();

  if (!body.date) return showError("Please choose a date.");
  if (partySizeError()) return showError(partySizeError());
  if (!body.time) return showError("Please choose a time.");
  if (!body.name.trim()) return showError("Please enter your name.");
  if (!body.phone.trim()) return showError("Please enter your phone number so we can contact you.");

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Sending…";
  showError("");

  try {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(data.error || "Something went wrong. Please call us to book.");
      errorEl.scrollIntoView({ block: "nearest" });
      if (res.status === 409) loadSlots();
      return;
    }
    form.hidden = true;
    successEl.hidden = false;
    const via = { email: "email", sms: "text message" };
    const contact = (data.contact || []).map((c) => via[c]).join(" and ");
    successEl.innerHTML = `
      <h3 tabindex="-1">Request received!</h3>
      <p><strong>${esc(fmtDate(data.date))} at ${fmtTime(data.time)}</strong><br>
         ${data.guests} ${data.guests === 1 ? "guest" : "guests"} · under ${esc(data.name)}</p>
      <p>Your booking is <strong>not confirmed yet</strong>. Our staff will check availability and
         ${contact ? `confirm with you by ${contact}` : "call you to confirm"} shortly.</p>
      <p>Booking reference: <strong class="ref">${esc(data.ref)}</strong></p>
      <p class="muted">Questions? Call us on <a class="link" href="${telHref}">${esc(RESTAURANT.phone)}</a> and quote your reference.</p>
      <button type="button" class="btn btn-sm" id="book-another">Make another booking</button>`;
    successEl.querySelector("h3").focus(); // so keyboard and screen reader users land on the confirmation
    document.getElementById("book-another").addEventListener("click", () => {
      form.reset();
      form.date.value = form.date.min;
      form.guests.value = "2";
      successEl.hidden = true;
      form.hidden = false;
      form.date.focus();
      loadSlots();
    });
  } catch {
    showError("Couldn't reach the booking system. Please call us to book.");
  } finally {
    button.disabled = false;
    button.textContent = "Send booking request";
  }
});

loadSlots();
