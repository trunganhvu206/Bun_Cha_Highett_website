// Bún Chả website + table booking server.
// Run with:  npm start   (then open http://localhost:3000, staff page at /admin)

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const notify = require("./notify");
const chat = require("./chat");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const ADMIN_DIR = path.join(__dirname, "admin");
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "bookings.db");
const TIME_ZONE = "Australia/Melbourne";
const TRUST_PROXY = process.env.TRUST_PROXY === "1";

// ---------- Staff password ----------
// Set ADMIN_PASSWORD in the environment, otherwise one is generated once and kept in admin-password.txt.
const PASSWORD_FILE = path.join(__dirname, "admin-password.txt");
function loadAdminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (fs.existsSync(PASSWORD_FILE)) return fs.readFileSync(PASSWORD_FILE, "utf8").trim();
  const generated = crypto.randomBytes(8).toString("base64url");
  fs.writeFileSync(PASSWORD_FILE, generated + "\n");
  return generated;
}
const ADMIN_PASSWORD = loadAdminPassword();
const sha256 = (s) => crypto.createHash("sha256").update(s).digest();

function isAdmin(req) {
  const m = /^Basic (.+)$/.exec(req.headers.authorization || "");
  if (!m) return false;
  const decoded = Buffer.from(m[1], "base64").toString("utf8");
  const password = decoded.slice(decoded.indexOf(":") + 1);
  return crypto.timingSafeEqual(sha256(password), sha256(ADMIN_PASSWORD));
}

// ---------- Restaurant data (shared with the website) ----------
// public/data.js plus any changes saved on the staff Settings page (stored in the database).
// Read fresh on every request so edits apply without a restart.
function dataJsSource() {
  const src = fs.readFileSync(path.join(PUBLIC_DIR, "data.js"), "utf8");
  const s = savedSettings();
  if (!s) return src;
  return src + `
// ---- Settings saved on the staff page (these replace the values above) ----
Object.assign(RESTAURANT, ${JSON.stringify({ hours: s.hours, phone: s.phone, email: s.email })});
Object.assign(BOOKING, ${JSON.stringify({ ...s.booking, closedDates: s.closedDates })});
`;
}

function siteData() {
  return vm.runInNewContext(dataJsSource() + "\n;({ RESTAURANT, BOOKING, MENU, MENU_INFO, REVIEWS });");
}

// ---------- Database ----------
const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ref        TEXT NOT NULL UNIQUE,
    date       TEXT NOT NULL,
    time       TEXT NOT NULL,
    guests     INTEGER NOT NULL,
    name       TEXT NOT NULL,
    phone      TEXT NOT NULL,
    email      TEXT,
    notes      TEXT,
    status     TEXT NOT NULL DEFAULT 'confirmed',
    source     TEXT NOT NULL DEFAULT 'online',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS bookings_by_date ON bookings (date, time);
  -- Times staff have marked as full, so online customers can't request them. time '*' = the whole day.
  CREATE TABLE IF NOT EXISTS blocked_slots (
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    PRIMARY KEY (date, time)
  );
  -- Opening hours, closed days and booking rules changed on the staff Settings page
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

const getSetting = db.prepare("SELECT value FROM settings WHERE key = ?");
const putSetting = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
const savedSettings = () => {
  const row = getSetting.get("site");
  return row ? JSON.parse(row.value) : null;
};

const BOOKING_RULES = {
  maxGuestsPerSlot: { min: 1, max: 500, label: "Guests per time slot" },
  maxPartySize: { min: 1, max: 200, label: "Largest online group" },
  lastBookingBeforeClose: { min: 0, max: 240, label: "Last booking before closing" },
  slotMinutes: { min: 15, max: 60, label: "Time between booking slots", allowed: [15, 30, 60] },
  daysAhead: { min: 1, max: 365, label: "Days ahead customers can book" },
  minNoticeMinutes: { min: 0, max: 1440, label: "Notice needed for same-day bookings" },
};

// Check everything sent from the Settings page; throws a friendly message for the first problem.
function cleanSettings(body) {
  const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
  const hours = {};
  for (let d = 0; d < 7; d++) {
    const ranges = body.hours?.[d] ?? body.hours?.[String(d)];
    if (!Array.isArray(ranges) || ranges.length > 2) throw new HttpError(400, "Invalid opening hours.");
    hours[d] = ranges.map(([open, close]) => {
      if (!timeRe.test(open) || !timeRe.test(close) || toMinutes(open) >= toMinutes(close)) {
        throw new HttpError(400, "Each opening time must be before its closing time.");
      }
      return [open, close];
    });
  }
  const booking = {};
  for (const [key, rule] of Object.entries(BOOKING_RULES)) {
    const n = Number(body.booking?.[key]);
    if (!Number.isInteger(n) || n < rule.min || n > rule.max || (rule.allowed && !rule.allowed.includes(n))) {
      throw new HttpError(400, `${rule.label}: please enter a whole number between ${rule.min} and ${rule.max}.`);
    }
    booking[key] = n;
  }
  const closedDates = [...new Set(body.closedDates || [])].filter(isValidDate).sort();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim();
  if (!/^\+?[\d\s()-]{8,20}$/.test(phone)) throw new HttpError(400, "Please enter a valid phone number.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Please enter a valid email address.");
  return { hours, booking, closedDates, phone, email };
}

const q = {
  bookedBySlot: db.prepare(
    // Requests waiting for approval hold their seats too, so staff never get more requests than fit.
    "SELECT time, SUM(guests) AS guests FROM bookings WHERE date = ? AND status IN ('confirmed', 'pending') GROUP BY time"
  ),
  insert: db.prepare(
    `INSERT INTO bookings (ref, date, time, guests, name, phone, email, notes, source, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ),
  byDate: db.prepare("SELECT * FROM bookings WHERE date = ? ORDER BY time, created_at"),
  pendingFrom: db.prepare("SELECT * FROM bookings WHERE status = 'pending' AND date >= ? ORDER BY date, time"),
  byId: db.prepare("SELECT * FROM bookings WHERE id = ?"),
  setStatus: db.prepare("UPDATE bookings SET status = ? WHERE id = ?"),
  refExists: db.prepare("SELECT 1 FROM bookings WHERE ref = ?"),
  monthTotals: db.prepare(
    `SELECT date, status, COUNT(*) AS bookings, SUM(guests) AS guests FROM bookings
     WHERE date BETWEEN ? AND ? AND status IN ('confirmed', 'pending') GROUP BY date, status`
  ),
  blockedOn: db.prepare("SELECT time FROM blocked_slots WHERE date = ?"),
  blockedBetween: db.prepare("SELECT date, time FROM blocked_slots WHERE date BETWEEN ? AND ?"),
  block: db.prepare("INSERT OR IGNORE INTO blocked_slots (date, time) VALUES (?, ?)"),
  unblock: db.prepare("DELETE FROM blocked_slots WHERE date = ? AND time = ?"),
};

const blockedTimes = (date) => new Set(q.blockedOn.all(date).map((r) => r.time));

// ---------- Dates & times (always Melbourne time) ----------
const toMinutes = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const fromMinutes = (n) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

function melbourneNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}

function addDays(date, n) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// "2026-10" -> "2026-11", "2026-12" -> "2027-01"
function nextMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

// All bookable start times for a date, ignoring capacity and notice.
function slotsFor(date, { RESTAURANT, BOOKING }) {
  if (BOOKING.closedDates.includes(date)) return [];
  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  const slots = [];
  for (const [open, close] of RESTAURANT.hours[dow] || []) {
    const last = toMinutes(close) - BOOKING.lastBookingBeforeClose;
    for (let t = toMinutes(open); t <= last; t += BOOKING.slotMinutes) slots.push(fromMinutes(t));
  }
  return slots;
}

function bookedGuests(date) {
  return Object.fromEntries(q.bookedBySlot.all(date).map((r) => [r.time, r.guests]));
}

// Public availability: future slots only, with how many seats remain.
// Times (or the whole day) that staff marked as full have no seats left.
function availability(date, data) {
  const now = melbourneNow();
  const booked = bookedGuests(date);
  const blocked = blockedTimes(date);
  const slots = slotsFor(date, data)
    .filter((t) => date !== now.date || toMinutes(t) >= now.minutes + data.BOOKING.minNoticeMinutes)
    .map((time) => ({
      time,
      remaining: blocked.has("*") || blocked.has(time) ? 0 : Math.max(0, data.BOOKING.maxGuestsPerSlot - (booked[time] || 0)),
    }));
  return { date, slots };
}

// ---------- Bookings ----------
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function newRef() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ref;
  do {
    ref = Array.from(crypto.randomBytes(6), (b) => alphabet[b % alphabet.length]).join("");
  } while (q.refExists.get(ref));
  return ref;
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function createBooking(body, { admin }) {
  const data = siteData();
  const { BOOKING } = data;

  const booking = {
    date: str(body.date, 10),
    time: str(body.time, 5),
    guests: Number(body.guests),
    name: str(body.name, 80),
    phone: str(body.phone, 20),
    email: str(body.email, 120),
    notes: str(body.notes, 500),
  };

  if (!booking.name) throw new HttpError(400, "Please enter your name.");
  if (!/^\+?[\d\s()-]{8,20}$/.test(booking.phone)) throw new HttpError(400, "Please enter a valid phone number.");
  if (booking.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email)) throw new HttpError(400, "Please enter a valid email address.");
  const maxParty = admin ? 100 : BOOKING.maxPartySize;
  if (!Number.isInteger(booking.guests) || booking.guests < 1 || booking.guests > maxParty) {
    throw new HttpError(400, `Online bookings are for 1–${BOOKING.maxPartySize} guests. For larger groups please call us.`);
  }
  if (!isValidDate(booking.date)) throw new HttpError(400, "Please choose a date.");

  if (admin) {
    // Staff can book any opening time on any day and may overbook.
    if (!slotsFor(booking.date, data).includes(booking.time)) throw new HttpError(400, "That time is outside opening hours.");
  } else {
    const today = melbourneNow().date;
    if (booking.date < today || booking.date > addDays(today, BOOKING.daysAhead)) {
      throw new HttpError(400, `Bookings can be made up to ${BOOKING.daysAhead} days ahead.`);
    }
    const slot = availability(booking.date, data).slots.find((s) => s.time === booking.time);
    if (!slot) throw new HttpError(409, "That time is no longer available. Please choose another.");
    if (slot.remaining < booking.guests) throw new HttpError(409, "Sorry, that time just filled up. Please choose another.");
  }

  // Online bookings are requests until staff confirm them; staff-entered bookings are confirmed straight away.
  // DatabaseSync is synchronous, so the capacity check above and this insert cannot interleave with another request.
  const ref = newRef();
  const status = admin ? "confirmed" : "pending";
  q.insert.run(ref, booking.date, booking.time, booking.guests, booking.name, booking.phone,
    booking.email || null, booking.notes || null, admin ? "staff" : "online", status);
  return { ref, status, ...booking };
}

// ---------- Reports ----------
const statsQ = {
  byDate: db.prepare(
    `SELECT date, status, source, COUNT(*) AS bookings, SUM(guests) AS guests
     FROM bookings WHERE date LIKE ? GROUP BY date, status, source`
  ),
  byTime: db.prepare(
    "SELECT time, COUNT(*) AS bookings, SUM(guests) AS guests FROM bookings WHERE date LIKE ? AND status = 'confirmed' GROUP BY time ORDER BY time"
  ),
};

function bookingStats(year, month) {
  const emptyTotals = () => ({ bookings: 0, guests: 0, online: 0, staff: 0, pending: 0, declined: 0, cancelled: 0 });
  const months = Array.from({ length: 12 }, emptyTotals);
  const monthKey = `${year}-${month}`;
  const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, () => ({ bookings: 0, guests: 0 }));
  const weekdays = Array.from({ length: 7 }, () => ({ bookings: 0, guests: 0 })); // Monday first
  const monthTotals = emptyTotals();

  for (const r of statsQ.byDate.all(`${year}-%`)) {
    const m = months[Number(r.date.slice(5, 7)) - 1];
    const inMonth = r.date.startsWith(monthKey);
    for (const t of inMonth ? [m, monthTotals] : [m]) {
      if (r.status === "confirmed") {
        t.bookings += r.bookings; t.guests += r.guests; t[r.source === "staff" ? "staff" : "online"] += r.bookings;
      } else if (t[r.status] !== undefined) t[r.status] += r.bookings;
    }
    if (inMonth && r.status === "confirmed") {
      const day = days[Number(r.date.slice(8)) - 1];
      day.bookings += r.bookings; day.guests += r.guests;
      const w = weekdays[(new Date(r.date + "T00:00:00Z").getUTCDay() + 6) % 7];
      w.bookings += r.bookings; w.guests += r.guests;
    }
  }
  return {
    year, month, months, days, weekdays, monthTotals,
    times: statsQ.byTime.all(`${monthKey}-%`),
    yearTotals: months.reduce((a, m) => { for (const k in a) a[k] += m[k]; return a; }, emptyTotals()),
  };
}

// Simple per-IP limits to stop spam: successful online bookings, and assistant questions.
const recentBookingsByIp = new Map();
const recentChatsByIp = new Map();
function recentHits(map, ip, windowMs) {
  const cutoff = Date.now() - windowMs;
  const hits = (map.get(ip) || []).filter((t) => t > cutoff);
  map.set(ip, hits);
  return hits;
}

const clientIp = (req) => (TRUST_PROXY && req.headers["x-forwarded-for"]?.split(",")[0].trim()) || req.socket.remoteAddress;

// ---------- Google rating & reviews ----------
// With GOOGLE_PLACES_API_KEY set, the live rating and latest reviews come from Google (cached for 6 hours).
// Otherwise the site shows what's filled in under REVIEWS in public/data.js.
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACE_QUERY = process.env.GOOGLE_PLACE_QUERY || "Bun Cha, 332 Highett Rd, Highett VIC 3190";
let reviewsCache = { at: 0, data: null };

async function googleReviews() {
  if (!PLACES_KEY) return null;
  if (reviewsCache.data && Date.now() - reviewsCache.at < 6 * 60 * 60 * 1000) return reviewsCache.data;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": PLACES_KEY,
      "X-Goog-FieldMask": "places.id,places.rating,places.userRatingCount,places.googleMapsUri,places.reviews",
    },
    body: JSON.stringify({ textQuery: PLACE_QUERY, languageCode: "en" }),
  });
  if (!res.ok) throw new Error(`Google Places ${res.status}: ${await res.text()}`);
  const place = (await res.json()).places?.[0];
  if (!place) return null;
  const data = {
    source: "google",
    rating: place.rating ?? null,
    count: place.userRatingCount ?? null,
    googleUrl: place.googleMapsUri,
    writeReviewUrl: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(place.id)}`,
    items: (place.reviews || []).filter((r) => r.text?.text).map((r) => ({
      name: r.authorAttribution?.displayName || "Google user",
      authorUrl: r.authorAttribution?.uri || null,
      photo: r.authorAttribution?.photoUri || null,
      stars: r.rating,
      text: r.text.text,
      when: r.relativePublishTimeDescription || "",
    })),
  };
  reviewsCache = { at: Date.now(), data };
  return data;
}

// ---------- HTTP helpers ----------
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

function sendFile(res, baseDir, urlPath, extraHeaders = {}) {
  const file = path.normalize(path.join(baseDir, decodeURIComponent(urlPath)));
  if (!file.startsWith(baseDir + path.sep)) return sendJson(res, 404, { error: "Not found" });
  fs.readFile(file, (err, buf) => {
    if (err) return sendJson(res, 404, { error: "Not found" });
    // no-cache: browsers always check for the latest version, so changes show up on a normal refresh
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
      ...extraHeaders,
    });
    res.end(buf);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > 40_000) { reject(new HttpError(413, "Request too large.")); req.destroy(); }
      else chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch { reject(new HttpError(400, "Invalid request.")); }
    });
    req.on("error", reject);
  });
}

function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Bun Cha staff", charset="UTF-8"', "Content-Type": "text/plain" });
  res.end("Staff login required.");
  return false;
}

// ---------- Routes ----------
async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  const p = url.pathname;
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Public API
  if (p === "/api/availability" && req.method === "GET") {
    const date = url.searchParams.get("date") || "";
    const data = siteData();
    const today = melbourneNow().date;
    if (!isValidDate(date) || date < today || date > addDays(today, data.BOOKING.daysAhead)) {
      return sendJson(res, 200, { date, slots: [] });
    }
    return sendJson(res, 200, availability(date, data));
  }

  if (p === "/api/bookings" && req.method === "POST") {
    const body = await readJson(req);
    if (body.website) throw new HttpError(400, "Invalid request."); // honeypot field filled by bots
    const hits = recentHits(recentBookingsByIp, clientIp(req), 10 * 60 * 1000);
    if (hits.length >= 5) throw new HttpError(429, "Too many bookings from this device. Please call us instead.");
    const b = createBooking(body, { admin: false });
    hits.push(Date.now());
    console.log(`New booking request ${b.ref}: ${b.date} ${b.time}, ${b.guests} guests, ${b.name}`);
    // Sent in the background so the customer isn't kept waiting.
    const phone = siteData().RESTAURANT.phone;
    notify.notifyCustomer(b, "pending", phone);
    notify.notifyRestaurant(b);
    return sendJson(res, 201, {
      ref: b.ref, date: b.date, time: b.time, guests: b.guests, name: b.name,
      contact: [b.email && notify.emailEnabled && "email", notify.smsEnabled && "sms"].filter(Boolean),
    });
  }

  if (p === "/api/chat" && req.method === "POST") {
    const hits = recentHits(recentChatsByIp, clientIp(req), 10 * 60 * 1000);
    if (hits.length >= 30) throw new HttpError(429, "You've asked a lot of questions – please call us for more help.");
    const { messages } = await readJson(req);
    const valid = Array.isArray(messages) && messages.length > 0 && messages.length <= 20 &&
      messages.every((m, i) => m && (m.role === (i % 2 ? "assistant" : "user")) && typeof m.content === "string" && m.content.trim() && m.content.length <= 1500) &&
      messages.length % 2 === 1;
    if (!valid) throw new HttpError(400, "Invalid request.");
    hits.push(Date.now());
    try {
      return sendJson(res, 200, { reply: await chat.answer(messages, siteData()) });
    } catch (err) {
      if (err instanceof chat.ChatError) throw new HttpError(err.status, err.message);
      throw err;
    }
  }

  if (p === "/api/reviews" && req.method === "GET") {
    try {
      const live = await googleReviews();
      if (live) return sendJson(res, 200, live);
    } catch (err) {
      console.error("Google reviews:", err.message);
    }
    return sendJson(res, 200, { source: "manual", ...siteData().REVIEWS });
  }

  // Staff area
  if (p === "/admin" || p.startsWith("/admin/") || p.startsWith("/api/admin/")) {
    if (!requireAdmin(req, res)) return;

    if (p === "/api/admin/bookings" && req.method === "GET") {
      const date = url.searchParams.get("date") || melbourneNow().date;
      if (!isValidDate(date)) throw new HttpError(400, "Invalid date.");
      const data = siteData();
      const booked = bookedGuests(date);
      const blocked = blockedTimes(date);
      return sendJson(res, 200, {
        date,
        capacity: data.BOOKING.maxGuestsPerSlot,
        dayBlocked: blocked.has("*"),
        slots: slotsFor(date, data),
        times: slotsFor(date, data).map((time) => ({ time, guests: booked[time] || 0, blocked: blocked.has(time) })),
        bookings: q.byDate.all(date),
      });
    }

    // Calendar: totals for every day of a month (YYYY-MM)
    if (p === "/api/admin/month" && req.method === "GET") {
      const month = url.searchParams.get("month") || melbourneNow().date.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, "Invalid month.");
      const first = `${month}-01`;
      const last = addDays(`${nextMonth(month)}-01`, -1);
      const data = siteData();
      const days = {};
      for (let d = first; d <= last; d = addDays(d, 1)) {
        days[d] = { open: slotsFor(d, data).length > 0, confirmed: 0, guests: 0, pending: 0, pendingGuests: 0, blockedTimes: 0, dayBlocked: false };
      }
      for (const r of q.monthTotals.all(first, last)) {
        if (r.status === "confirmed") Object.assign(days[r.date], { confirmed: r.bookings, guests: r.guests });
        else Object.assign(days[r.date], { pending: r.bookings, pendingGuests: r.guests });
      }
      for (const r of q.blockedBetween.all(first, last)) {
        if (r.time === "*") days[r.date].dayBlocked = true;
        else days[r.date].blockedTimes++;
      }
      return sendJson(res, 200, { month, today: melbourneNow().date, days });
    }

    // Settings page: opening hours, closed days, booking rules, contact details
    if (p === "/api/admin/settings" && req.method === "GET") {
      const { RESTAURANT, BOOKING } = siteData();
      const booking = Object.fromEntries(Object.keys(BOOKING_RULES).map((k) => [k, BOOKING[k]]));
      return sendJson(res, 200, {
        hours: RESTAURANT.hours, closedDates: BOOKING.closedDates, booking,
        phone: RESTAURANT.phone, email: RESTAURANT.email, rules: BOOKING_RULES,
      });
    }
    if (p === "/api/admin/settings" && req.method === "PUT") {
      const clean = cleanSettings(await readJson(req));
      putSetting.run("site", JSON.stringify(clean));
      return sendJson(res, 200, clean);
    }

    // Reports: a year by month, one month by day, plus busiest times and weekdays for that month
    if (p === "/api/admin/stats" && req.method === "GET") {
      const year = url.searchParams.get("year") || melbourneNow().date.slice(0, 4);
      const month = url.searchParams.get("month") || melbourneNow().date.slice(5, 7);
      if (!/^\d{4}$/.test(year) || !/^(0[1-9]|1[0-2])$/.test(month)) throw new HttpError(400, "Invalid period.");
      return sendJson(res, 200, bookingStats(year, month));
    }

    // Mark a time (or the whole day, time "*") as full / open again for online bookings
    if (p === "/api/admin/blocks" && req.method === "POST") {
      const { date, time, blocked } = await readJson(req);
      if (!isValidDate(date)) throw new HttpError(400, "Invalid date.");
      if (time !== "*" && !slotsFor(date, siteData()).includes(time)) throw new HttpError(400, "Invalid time.");
      (blocked ? q.block : q.unblock).run(date, time);
      return sendJson(res, 200, { date, time, blocked: Boolean(blocked) });
    }

    if (p === "/api/admin/pending" && req.method === "GET") {
      return sendJson(res, 200, { bookings: q.pendingFrom.all(melbourneNow().date) });
    }

    if (p === "/api/admin/bookings" && req.method === "POST") {
      const b = createBooking(await readJson(req), { admin: true });
      return sendJson(res, 201, b);
    }

    const m = /^\/api\/admin\/bookings\/(\d+)$/.exec(p);
    if (m && req.method === "PATCH") {
      const { status } = await readJson(req);
      if (!["confirmed", "declined", "cancelled"].includes(status)) throw new HttpError(400, "Invalid status.");
      const before = q.byId.get(Number(m[1]));
      if (!before) throw new HttpError(404, "Booking not found.");
      q.setStatus.run(status, before.id);
      const booking = q.byId.get(before.id);
      // Tell the customer whenever the status actually changes.
      const notified = before.status === status ? [] : await notify.notifyCustomer(booking, status, siteData().RESTAURANT.phone);
      return sendJson(res, 200, { booking, notified });
    }

    if (p === "/admin") { res.writeHead(302, { Location: "/admin/" }); return res.end(); }
    if (req.method === "GET") {
      return sendFile(res, ADMIN_DIR, p === "/admin/" ? "index.html" : p.slice("/admin/".length), { "Cache-Control": "no-store" });
    }
    return sendJson(res, 404, { error: "Not found" });
  }

  // Website. data.js includes any changes saved on the staff Settings page.
  if (p === "/data.js" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": TYPES[".js"], "Cache-Control": "no-cache" });
    return res.end(dataJsSource());
  }
  if (req.method === "GET") return sendFile(res, PUBLIC_DIR, p === "/" ? "index.html" : p);
  return sendJson(res, 404, { error: "Not found" });
}

http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    if (!(err instanceof HttpError)) console.error(err);
    if (!res.headersSent) sendJson(res, err.status || 500, { error: err.status ? err.message : "Something went wrong. Please call us." });
  });
}).listen(PORT, () => {
  console.log(`Bún Chả website:  http://localhost:${PORT}`);
  console.log(`Staff bookings:   http://localhost:${PORT}/admin`);
  console.log(process.env.ADMIN_PASSWORD
    ? "Staff password:   (from ADMIN_PASSWORD)"
    : `Staff password:   ${ADMIN_PASSWORD}   (saved in admin-password.txt)`);
  console.log(`Booking emails:   ${notify.emailEnabled ? "on" : "off (set GMAIL_APP_PASSWORD)"}`);
  console.log(`Booking texts:    ${notify.smsEnabled ? "on" : "off (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM)"}`);
  console.log(`Google reviews:   ${PLACES_KEY ? "live from Google" : "from public/data.js (set GOOGLE_PLACES_API_KEY for live)"}`);
});
