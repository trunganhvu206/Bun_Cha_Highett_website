// ============================================================
//  EDIT THIS FILE to update the restaurant details and menus.
// ============================================================

const RESTAURANT = {
  name: "Bún Chả",
  address: "332 Highett Rd, Highett VIC 3190",
  phone: "03 9078 3030",
  email: "bunchahighett@gmail.com",
  instagram: "buncha.332highett",
  facebook: "BUN CHA Highett",
  facebookUrl: "https://www.facebook.com/profile.php?id=100090623097861",
  uberEats: "https://www.ubereats.com/au/store/bun-cha/NNNVYIBOVneTmg4A2tZvKQ",
  // Day index: 0 = Sunday ... 6 = Saturday. Use [] for closed.
  hours: {
    1: [["17:00", "21:00"]],
    2: [],                                   // Tuesday – closed
    3: [["17:00", "21:00"]],
    4: [["17:00", "21:00"]],
    5: [["17:00", "21:00"]],
    6: [["12:00", "21:00"]],
    0: [["12:00", "21:00"]],
  },
};

// Google reviews. When the server has a Google Places API key, the live rating and reviews are shown
// automatically. Without one, the site uses what's filled in here (copy it from your Google listing).
const REVIEWS = {
  googleUrl: "https://www.google.com/search?q=bun+cha+highett",
  rating: 4.6,
  count: 145,     // number of Google ratings
  items: [
    { name: "Ruby Boundy", stars: 5, when: "September 2026", text: "The Bun Cha was exceptional with lots of delicious grilled pork! Since coming back from travelling Vietnam I've been missing my daily Salted Coffee, and omg this is the place for it!! It really was spot on and perfectly balanced. Will definitely be coming back for more!! 10/10." },
    { name: "Nao Yama", stars: 5, when: "September 2026", text: "Lamb shank curry was absolutely stunning." },
    { name: "Kylie Sparkles", stars: 5, when: "2025", text: "Our food was delicious, the attention we received when we requested staff was infallible … absolutely highly recommend Bun Cha Highett!" },
  ],
};

// Online table bookings (times are Melbourne time)
const BOOKING = {
  slotMinutes: 15,             // a booking time every 15 minutes (6:00, 6:15, 6:30 …)
  lastBookingBeforeClose: 30,  // last booking 30 minutes before closing (8:30pm)
  minNoticeMinutes: 60,        // same-day bookings need 1 hour notice
  maxGuestsPerSlot: 20,        // total guests that can start at the same time
  maxPartySize: 20,            // biggest group that can book online – bigger groups must call
  daysAhead: 60,               // how far ahead people can book
  closedDates: [],             // extra closed days, e.g. ["2026-12-25", "2027-01-01"]
};

// ---------------- The menu ----------------
// One menu, grouped by type of food. Each dish:
//   name, desc?, diet?, isNew?, options?
//   price    – dine in price
//   ta       – take away price (leave out if the dish is dine in only)
//   taOnly   – true if the dish is only sold as take away (then `ta` is its price)
//   taNote   – how the take away version differs, if it does
//   n        – number on the printed take away menu (used when ordering by phone)
//   diet     – codes separated by "/": GF, GFO, V, VGO, N
const MENU = [
  {
    id: "share",
    title: "To Share",
    items: [
      { name: "Crab Spring Rolls (4pcs)", diet: "GF", desc: "Crab, pork and prawn, vegetables, with fish sauce", price: 16, ta: 16, n: "1" },
      { name: "Southern Style Spring Rolls (4pcs)", desc: "Choice of pork or vegetarian", price: 12, ta: 12, n: "2, 3" },
      { name: "Rice Paper Rolls (2pcs)", diet: "N/GF", desc: "Choice of prawn, grilled chicken, or vegan", price: 9, ta: 9, n: "4, 5, 6", options: ["Extra piece (dine in): $5"] },
      { name: "Smoky Corn Ribs", diet: "GF/V", desc: "Chilli salt mayo, green onion, smoked paprika", price: 14, ta: 14, n: "7" },
      { name: "Crispy Popcorn Chicken", diet: "GF", price: 18, ta: 18, n: "8, 9", options: ["Kombu salt & pepper (with homemade tartar sauce)", "Caramelised fish sauce (GF/N)"], taNote: "Take away: salt & pepper, or garlic & chilli (GF/N)" },
      { name: "Kombu Salt & Pepper Calamari", diet: "GF", desc: "Served with crispy shallot and homemade tartar sauce", price: 18, ta: 18, n: "10" },
      { name: "Roast Pork Bao Buns (2pcs)", desc: "Sriracha mayo, pickles, cucumber, mint", price: 15, ta: 15, n: "11", options: ["Extra piece (dine in): $8"] },
      { name: "Lettuce Wraps (4pcs)", diet: "GF/N", desc: "Fine vermicelli, pickles, crispy shallot, scallion oil. Choice of beef betel leaf or roast pork", price: 16, ta: 16, n: "13", taNote: "Take away: beef betel leaf" },
      { name: "Grilled Chicken Skewers (2pcs)", diet: "N", desc: "Served with satay sauce, arugula slaw", price: 14, ta: 14, n: "12" },
    ],
  },
  {
    id: "salads",
    title: "Salads & Vermicelli",
    items: [
      { name: "Vermicelli Bowl", diet: "GF/N", desc: "Fresh salad, crispy shallot, peanuts, fish sauce. Choice of grilled pork, wok stir fried beef, grilled chicken or lemongrass tofu (vegan)", price: 23, ta: 22, n: "28, 29, 31, 32", options: ["Extra spring roll: $2"] },
      { name: "“La Vong” Style Vermicelli Bowl", diet: "GF/N", desc: "Turmeric fish with dill and green onion on vermicelli", taOnly: true, ta: 26, n: "30" },
      { name: "Papaya Salad", diet: "GF/N", desc: "Green papaya, carrot, mint, crispy shallot, tangy tamarind dressing", price: 15, ta: 24, n: "14", options: ["Add grilled chicken or prawn: $10"], taNote: "Take away comes with grilled chicken (contains nuts)" },
      { name: "Cucumber Salad", diet: "GF", desc: "Sliced cucumber, pickles, mint, red onions, red chilli dressing", price: 15, ta: 24, n: "15, 16", options: ["Add roast pork or stir fried beef: $10"], taNote: "Take away comes with roast pork or stir fried beef" },
    ],
  },
  {
    id: "buncha",
    title: "Bún Chả",
    note: "Our signature – charcoal grilled pork with vermicelli, herbs, pickles and dipping fish sauce.",
    items: [
      { name: "Bun Cha Hanoi", diet: "GF", desc: "Charcoal grilled pork, herbs, pickles, umami-rich dipping fish sauce", price: 23, ta: 22, n: "26", options: ["Extra crab spring roll: $3"] },
      { name: "Bun Cha Nem", diet: "GF", isNew: true, desc: "4pcs of crab spring roll, herbs, pickles, umami-rich dipping fish sauce", price: 23, ta: 22, n: "27" },
    ],
  },
  {
    id: "mains",
    title: "Mains",
    items: [
      { name: "Chả Cá Lã Vọng", diet: "N/GF", desc: "Turmeric marinated rockling fish, green onion, dill, vermicelli", price: 27 },
      { name: "Lemongrass Chicken", diet: "GF", desc: "Wok stir fried, with capsicum, onion, lemongrass chilli sauce", price: 26, ta: 25, n: "39" },
      { name: "Prawn & Broccoli", diet: "GF/VGO", desc: "Wok stir fried with special house-made sauce", price: 26, ta: 25, n: "33" },
      { name: "Tofu & Broccoli", diet: "GF/V", desc: "Wok stir fried with special house-made sauce", taOnly: true, ta: 23, n: "34" },
      { name: "Sweet and Sour Prawn & Broccoli", diet: "GF/N", isNew: true, desc: "Wok stir fried with Thai basil sweet and sour sauce", price: 27, ta: 26, n: "35" },
      { name: "Thai Style Crispy Fried Tilapia", diet: "GF/N", desc: "Papaya salad, tamarind sauce, crispy shallot", price: 27 },
      { name: "Bo Luc Lac (Shaking Beef)", diet: "GF", desc: "Shaking beef, soy & oyster sauce, capsicum, mushroom", price: 26, ta: 25, n: "36" },
      { name: "Lamb Shank Curry", diet: "GFO", desc: "2 hours braised, served with potato, carrot, roti bread", price: 26, ta: 25, n: "37" },
      { name: "Green Curry", diet: "V/GF", desc: "King oyster mushroom, eggplant, broccoli, okra, tofu", price: 24, ta: 26, n: "38", options: ["Add chicken: $7"], taNote: "Take away comes with steamed rice" },
    ],
  },
  {
    id: "rice",
    title: "Rice",
    items: [
      { name: "Grilled Char-Siu Chicken on Rice", diet: "GF", isNew: true, desc: "Fried egg, arugula slaw, fish sauce", price: 23, ta: 22, n: "43" },
      { name: "Grilled Char-Siu Pork on Rice", diet: "GF", desc: "Fried egg, arugula slaw, fish sauce", price: 23, ta: 22, n: "42" },
      { name: "XO Crab Fried Rice", diet: "GF", desc: "XO sauce, crab meat, crispy shallot, green onion", price: 22, ta: 21, n: "40" },
      { name: "Garlic Fried Rice", diet: "GF", desc: "Egg, garlic, green onion, crispy shallot", price: 15, ta: 14, n: "41" },
    ],
  },
  {
    id: "soups",
    title: "Soups",
    items: [
      { name: "Beef Pho", diet: "GFO", desc: "Tender beef slices", price: 19, ta: 18, n: "17" },
      { name: "Hanoi Beef Pho", diet: "GFO", desc: "Wok stir fried beef with garlic", price: 19, ta: 18, n: "18" },
      { name: "Chicken Pho", diet: "GFO", desc: "Shredded poached chicken", price: 19, ta: 18, n: "19" },
      { name: "Vegan Pho", diet: "GFO", desc: "Broccoli, braised king oyster mushroom, tofu", price: 19, ta: 18, n: "20" },
    ],
  },
  {
    id: "banhmi",
    title: "Bánh Mì",
    badge: "Weekend lunch",
    note: "Only available for lunch on Saturdays & Sundays. All come with homemade pâté, pickled carrots and radishes, cucumber, coriander, chilli, confit garlic aioli and five spice hoisin sauce.",
    items: [
      { name: "Grilled Pork Bánh Mì", price: 15, ta: 15 },
      { name: "Crispy Roasted Pork Bánh Mì", price: 15, ta: 15 },
      { name: "Grilled Chicken Bánh Mì", price: 15, ta: 15 },
      { name: "Black Pepper Steak Bánh Mì", desc: "With Thai basil chimichurri", price: 15, ta: 15 },
      { name: "Lemongrass Tofu Bánh Mì", desc: "Vegetarian option", price: 15, ta: 15 },
      { name: "Add a fried egg", price: 2, ta: 2 },
      { name: "Add a soft drink", desc: "Coke, Coke Zero or Sprite", price: 3, ta: 3 },
    ],
  },
  {
    id: "sides",
    title: "Sides",
    items: [
      { name: "Steam Rice", diet: "GF", price: 3, ta: 3, n: "21" },
      { name: "Steam Broccoli", price: 8, ta: 8, n: "22" },
      { name: "Roti Bread", price: 3, ta: 3, n: "24" },
      { name: "Little Pho", diet: "GFO", price: 8, ta: 8, n: "23" },
      { name: "Extra Vermicelli / Pho Noodle", price: 3, ta: 3, n: "25" },
      { name: "Prawn Cracker", diet: "GF", price: 3 },
    ],
  },
  {
    id: "desserts",
    title: "Desserts",
    items: [
      { name: "Cardamom Chocolate Mousse", diet: "V/GF/N", isNew: true, desc: "54% dark chocolate, green cardamom, almond and coconut crumble", price: 16, ta: 15, n: "44" },
      { name: "Banana Fritter", desc: "Vanilla ice cream, berries, maple syrup", price: 12 },
    ],
  },
];

// Shown at the top of the full menu
const MENU_INFO = {
  prices: "Prices are for dine in. Where the take away price is different, it's shown under the dish.",
  takeaway: "Take away: order by phone or on Uber Eats. Take away containers 50¢ each.",
};
