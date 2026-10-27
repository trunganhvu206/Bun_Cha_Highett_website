// ============================================================
//  EDIT THIS FILE to update the restaurant details and menus.
//  Everything below is PLACEHOLDER content – replace with real info.
// ============================================================

const RESTAURANT = {
  name: "Bún Chả",
  address: "332 Highett Rd, Highett VIC 3190",
  phone: "(03) 0000 0000", // TODO: real phone number
  // Day index: 0 = Sunday ... 6 = Saturday. Use [] for closed.
  hours: {
    1: [],                                   // Monday – closed
    2: [["11:00", "15:00"], ["17:00", "21:00"]],
    3: [["11:00", "15:00"], ["17:00", "21:00"]],
    4: [["11:00", "15:00"], ["17:00", "21:00"]],
    5: [["11:00", "15:00"], ["17:00", "21:30"]],
    6: [["11:00", "21:30"]],
    0: [["11:00", "20:30"]],
  },
};

// Each menu: list of sections → items { name, vi, desc, price, tag? }
// tag options: "signature", "v" (vegetarian), "spicy"
const MENUS = {
  dinein: [
    {
      title: "Bún Chả",
      note: "Served with fresh rice vermicelli, herbs, pickled papaya and our house dipping broth.",
      items: [
        { name: "Hanoi Bún Chả", vi: "Bún chả Hà Nội", desc: "Chargrilled pork patties & caramelised pork belly in warm nước chấm.", price: 21.9, tag: "signature" },
        { name: "Bún Chả + Spring Rolls", vi: "Bún chả nem rán", desc: "Our classic bún chả with two crispy pork & prawn spring rolls.", price: 25.9, tag: "signature" },
        { name: "Bún Chả Đặc Biệt", vi: "Bún chả đặc biệt", desc: "The works – extra pork, extra rolls, extra herbs. For the hungry.", price: 29.9 },
        { name: "Grilled Tofu Bún", vi: "Bún đậu nướng", desc: "Lemongrass tofu & mushrooms with vegan dipping sauce.", price: 20.9, tag: "v" },
      ],
    },
    {
      title: "Small Plates",
      items: [
        { name: "Crispy Spring Rolls (4)", vi: "Nem rán", desc: "Pork, prawn, wood-ear mushroom & glass noodle.", price: 12.9 },
        { name: "Fresh Rice Paper Rolls (2)", vi: "Gỏi cuốn", desc: "Prawn, pork, herbs, peanut hoisin dip.", price: 11.9 },
        { name: "Green Papaya Salad", vi: "Nộm đu đủ", desc: "Shredded papaya, beef jerky, peanuts, chilli lime.", price: 15.9, tag: "spicy" },
        { name: "Lemongrass Chicken Wings", vi: "Cánh gà sả", desc: "Fried crisp, tossed in garlic & lemongrass.", price: 14.9 },
      ],
    },
    {
      title: "Noodle Soups & Rice",
      items: [
        { name: "Beef Pho", vi: "Phở bò", desc: "12-hour bone broth, rare beef & brisket.", price: 19.9 },
        { name: "Spicy Hue Noodle Soup", vi: "Bún bò Huế", desc: "Lemongrass chilli broth, beef shank, pork.", price: 21.9, tag: "spicy" },
        { name: "Broken Rice with Pork Chop", vi: "Cơm tấm sườn", desc: "Grilled pork chop, fried egg, pickles, fish sauce.", price: 21.9 },
      ],
    },
    {
      title: "Drinks",
      items: [
        { name: "Vietnamese Iced Coffee", vi: "Cà phê sữa đá", desc: "Strong drip coffee with condensed milk.", price: 6.5 },
        { name: "Egg Coffee", vi: "Cà phê trứng", desc: "Hanoi's famous whipped egg-yolk coffee.", price: 7.5 },
        { name: "Fresh Lime Soda", vi: "Soda chanh", desc: "Salted or sweet.", price: 5.5 },
        { name: "Iced Jasmine Tea", vi: "Trà đá", desc: "Free refills with dine-in.", price: 3.0 },
      ],
    },
  ],
  takeaway: [
    {
      title: "Bún Chả Packs",
      note: "Packed separately – noodles, herbs, grilled meats and broth – so everything stays fresh. Gently warm the broth before serving.",
      items: [
        { name: "Hanoi Bún Chả", vi: "Bún chả Hà Nội", desc: "Grilled pork patties & pork belly, noodles, herbs, broth.", price: 19.9, tag: "signature" },
        { name: "Bún Chả + Spring Rolls", vi: "Bún chả nem rán", desc: "Classic pack plus two crispy spring rolls.", price: 23.9, tag: "signature" },
        { name: "Grilled Tofu Bún", vi: "Bún đậu nướng", desc: "Lemongrass tofu with vegan dipping sauce.", price: 18.9, tag: "v" },
        { name: "Family Pack (serves 4)", vi: "Phần gia đình", desc: "4 × bún chả, 8 spring rolls, extra herbs & broth.", price: 79.0 },
      ],
    },
    {
      title: "Sides",
      items: [
        { name: "Crispy Spring Rolls (4)", vi: "Nem rán", desc: "With dipping sauce.", price: 11.9 },
        { name: "Fresh Rice Paper Rolls (2)", vi: "Gỏi cuốn", desc: "Prawn & pork, peanut hoisin dip.", price: 10.9 },
        { name: "Extra Grilled Pork", vi: "Thêm thịt nướng", desc: "", price: 7.0 },
        { name: "Extra Broth & Herbs", vi: "Thêm nước chấm & rau", desc: "", price: 3.0 },
      ],
    },
    {
      title: "Drinks",
      items: [
        { name: "Vietnamese Iced Coffee", vi: "Cà phê sữa đá", desc: "", price: 6.0 },
        { name: "Fresh Lime Soda", vi: "Soda chanh", desc: "", price: 5.0 },
        { name: "Canned Soft Drinks", vi: "", desc: "Coke, Coke No Sugar, Sprite.", price: 3.5 },
      ],
    },
  ],
};
