// Booking emails (Gmail) and text messages (Twilio).
// Each channel only runs when its settings are present – see README "Notifications".

const nodemailer = require("nodemailer");

const GMAIL_USER = process.env.GMAIL_USER || "bunchahighett@gmail.com";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const RESTAURANT_EMAIL = process.env.RESTAURANT_EMAIL || GMAIL_USER;
const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const TWILIO = {
  sid: process.env.TWILIO_ACCOUNT_SID,
  token: process.env.TWILIO_AUTH_TOKEN,
  from: process.env.TWILIO_FROM,
};

const mailer = GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } })
  : null;
const smsEnabled = Boolean(TWILIO.sid && TWILIO.token && TWILIO.from);

const fmtDate = (date) =>
  new Date(date + "T00:00:00Z").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function fmtTime(t) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""}${h >= 12 ? "pm" : "am"}`;
}

// Australian mobile number in international format, or null if it can't receive texts.
function toMobile(phone) {
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+61")) digits = "0" + digits.slice(3);
  else if (digits.startsWith("61")) digits = "0" + digits.slice(2);
  return /^04\d{8}$/.test(digits) ? "+61" + digits.slice(1) : null;
}

async function sendEmail(to, subject, text) {
  if (!mailer || !to) return false;
  await mailer.sendMail({ from: `"Bún Chả Highett" <${GMAIL_USER}>`, to, subject, text, replyTo: RESTAURANT_EMAIL });
  return true;
}

async function sendSms(phone, body) {
  const to = smsEnabled && toMobile(phone);
  if (!to) return false;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO.sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${TWILIO.sid}:${TWILIO.token}`).toString("base64") },
    body: new URLSearchParams({ To: to, From: TWILIO.from, Body: body }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  return true;
}

// What the customer is told for each booking status.
function customerMessage(b, status, restaurantPhone) {
  const when = `${fmtDate(b.date)} at ${fmtTime(b.time)} for ${b.guests} ${b.guests === 1 ? "guest" : "guests"}`;
  const ref = `Ref: ${b.ref}`;
  switch (status) {
    case "pending":
      return {
        subject: `We've received your booking request (${b.ref})`,
        text: `Hi ${b.name},\n\nThanks for your booking request at Bún Chả Highett – ${when}.\n\nThis is NOT confirmed yet. Our staff will check availability and let you know shortly.\n\n${ref}\nQuestions? Call us on ${restaurantPhone}.\n\nBún Chả, 332 Highett Rd, Highett`,
        sms: `Bún Chả Highett: we've received your booking request for ${when}. Not confirmed yet – we'll text you shortly. ${ref}`,
      };
    case "confirmed":
      return {
        subject: `Your booking is confirmed (${b.ref})`,
        text: `Hi ${b.name},\n\nGood news – your table at Bún Chả Highett is confirmed for ${when}.\n\n${ref}\nNeed to change or cancel? Call us on ${restaurantPhone}.\n\nSee you soon!\nBún Chả, 332 Highett Rd, Highett`,
        sms: `Bún Chả Highett: your booking is CONFIRMED for ${when}. ${ref}. To change, call ${restaurantPhone}.`,
      };
    case "declined":
      return {
        subject: `About your booking request (${b.ref})`,
        text: `Hi ${b.name},\n\nSorry – we can't take your booking for ${when}.\n\nPlease call us on ${restaurantPhone} and we'll do our best to find another time.\n\n${ref}\nBún Chả, 332 Highett Rd, Highett`,
        sms: `Bún Chả Highett: sorry, we can't take your booking for ${when}. Please call ${restaurantPhone} to find another time. ${ref}`,
      };
    case "cancelled":
      return {
        subject: `Your booking has been cancelled (${b.ref})`,
        text: `Hi ${b.name},\n\nYour booking at Bún Chả Highett for ${when} has been cancelled.\n\nIf this is a mistake, please call us on ${restaurantPhone}.\n\n${ref}\nBún Chả, 332 Highett Rd, Highett`,
        sms: `Bún Chả Highett: your booking for ${when} has been cancelled. Questions? Call ${restaurantPhone}. ${ref}`,
      };
  }
}

// Tell the customer about their booking. Returns the channels that worked, e.g. ["email", "sms"].
async function notifyCustomer(b, status, restaurantPhone) {
  const msg = customerMessage(b, status, restaurantPhone);
  const sent = [];
  try { if (await sendEmail(b.email, msg.subject, msg.text)) sent.push("email"); }
  catch (err) { console.error(`Email to ${b.ref} failed:`, err.message); }
  try { if (await sendSms(b.phone, msg.sms)) sent.push("sms"); }
  catch (err) { console.error(`SMS to ${b.ref} failed:`, err.message); }
  return sent;
}

// Let staff know a new online request is waiting for approval.
async function notifyRestaurant(b) {
  try {
    await sendEmail(
      RESTAURANT_EMAIL,
      `New booking request: ${fmtDate(b.date)} ${fmtTime(b.time)}, ${b.guests} guests`,
      `New online booking request – please confirm or decline:\n\n` +
        `${fmtDate(b.date)} at ${fmtTime(b.time)}\n${b.guests} guests\n${b.name}\n${b.phone}\n${b.email || "(no email)"}\n` +
        (b.notes ? `Notes: ${b.notes}\n` : "") +
        `Ref: ${b.ref}\n\nOpen the staff page: ${SITE_URL}/admin/`
    );
  } catch (err) {
    console.error("Restaurant email failed:", err.message);
  }
}

module.exports = { notifyCustomer, notifyRestaurant, emailEnabled: Boolean(mailer), smsEnabled };
