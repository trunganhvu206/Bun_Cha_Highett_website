# Bún Chả Highett website

Website, table booking requests and an AI assistant for Bún Chả, 332 Highett Rd, Highett VIC 3190.

## Run it

Needs [Node.js](https://nodejs.org) 22.13 or newer.

```
npm install
npm start
```

- Website: http://localhost:3000
- Staff bookings page: http://localhost:3000/admin

The first time it runs, a staff password is created and saved in `admin-password.txt`
(any username works). To choose your own, set `ADMIN_PASSWORD`.

## How bookings work

1. A customer sends a **booking request** on the website (times every 30 minutes, last booking 8:30pm).
2. The customer gets a "request received – not confirmed yet" email/text, and the restaurant gets an email.
3. Staff open `/admin`, and **Confirm** or **Decline** it under "Waiting for approval".
4. The customer is emailed/texted automatically. If neither is set up, the staff page says to call them.

Requests waiting for approval hold their seats, so the restaurant never receives more requests than fit.

## Settings (environment variables)

Everything is optional – each feature switches on when its settings are present. `npm start` prints what's on.

| Setting | What it does |
|---|---|
| `ADMIN_PASSWORD` | Staff page password |
| `GMAIL_APP_PASSWORD` | Turns on booking emails, sent from bunchahighett@gmail.com. Create one in the Google account under Security → 2-Step Verification → App passwords |
| `GMAIL_USER` / `RESTAURANT_EMAIL` | Change the sending / notification address (default bunchahighett@gmail.com) |
| `SITE_URL` | The live website address, used in the staff email link (e.g. https://buncha-highett.com.au) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Turns on text messages to Australian mobiles ([Twilio](https://www.twilio.com), paid per SMS) |
| `ANTHROPIC_API_KEY` | Turns on the "Ask us" AI assistant (from [console.anthropic.com](https://console.anthropic.com), paid per use). Without it the assistant politely says it's unavailable |
| `GOOGLE_PLACES_API_KEY` | Shows the live Google rating and latest reviews (Google Cloud → Places API (New)). Without it, the site shows what's in `REVIEWS` in `public/data.js` |
| `DB_PATH` | Where the booking database is kept (default `bookings.db`) |
| `TRUST_PROXY=1` | Set when running behind a hosting provider's proxy |

## Editing content

Most things are in [public/data.js](public/data.js): address, phone, email, socials, Uber Eats link, opening
hours, booking rules (time slots, guests per slot, largest group, closed dates like Christmas), the three menus
and the fallback Google reviews. The AI assistant reads the same file, so it always knows the current menu and hours.

Page text (About us, signature dishes) is in [public/index.html](public/index.html). Photos are in `public/images/`.

### Colours

The colours (red & black, matching the logo) are set at the top of [public/styles.css](public/styles.css).

## Files

| Path | What it is |
|---|---|
| `public/` | The website |
| `admin/` | Staff bookings page (password protected) |
| `server.js` | Serves the site, stores bookings, reviews and assistant endpoints |
| `notify.js` | Booking emails and text messages |
| `chat.js` | The AI assistant |
| `bookings.db` | Booking database, created on first run – **back this up**, never commit it |

## Hosting

The site needs a host that runs Node.js **and keeps files between restarts** (so `bookings.db` isn't lost),
e.g. a small VPS, Railway or Render with a persistent disk, or Fly.io with a volume. Point `DB_PATH` at the
persistent disk and set the settings above.
