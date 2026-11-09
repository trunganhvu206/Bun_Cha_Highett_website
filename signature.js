// Bún Chả Signature dishes on the home page: an auto-playing slideshow; tap a dish to read its story.
// Needs common.js.

const DISH_DATA = {
  goicuon: {
    title: "Gỏi Cuốn", sub: "Fresh rice paper rolls", img: "images/gallery-rice-paper-rolls.jpg",
    alt: "Three prawn rice paper rolls on a blue patterned plate with dipping sauce",
    html: `<p>Goi Cuon is one of the most popular appetizers in Vietnamese food culture. The traditional food is ranked at number 50 on the list of 50 most delicious foods in the world by CNN Go in 2011. This food consists of shrimp, pork, vegetables, herbs, rice vermicelli (Bún). All of them are wrapped in rice paper (Banh Trang).</p>
      <p>It is often served with a kind of special dipping sauce – fish sauce (nuoc nam) – and garlic, limes, chili, crushed roasted peanuts. The combination of herbs, pork, shrimp, and the salty, hot, and sour dipping sauce makes the Vietnamese fresh spring roll wonderfully unique.</p>
      <p>At Bun Cha Highett, Goi Cuon are made from fresh ingredients and retain the traditional flavor. Let’s come Bun Cha Highett to enjoy the rustic culture of South Vietnam through Goi Cuon.</p>`,
  },
  chaca: {
    title: "Chả Cá Lã Vọng", sub: "La Vong grilled fish", img: "images/gallery-cha-ca.jpg",
    alt: "Turmeric fish with dill and green onion on a sizzling plate, with vermicelli and dipping sauce",
    html: `<p>Chả Cá Lã Vọng is a must-not-miss in guidebooks for whoever visiting Hanoi not only for its mouthful flavor but also its representation of Hanoi culture.</p>
      <p>The dish and all of its accompaniment are complex in flavor and texture yet they come together harmoniously. La Vong grill fish is traditionally made with hemibagrus (<span lang="vi">cá lăng</span>), which is cut into pieces and marinated in a turmeric-based sauce, which often includes shrimp paste or fish sauce, ginger, and chili peppers. It is eaten with vermicelli rice noodles (bún) and peanuts.</p>
      <p>The Hanoians often eat this dish while sipping some alcohol in the cold weather. Eating La Vong grill fish is close to a ritual; it is a nice place for family and friends to get together and enjoy delicious dish after days of hard work.</p>`,
  },
  skewers: {
    title: "Grilled Chicken Skewers", sub: "To share · 2 pieces · $14", img: "images/gallery-skewers.jpg",
    alt: "Grilled chicken skewers in satay sauce topped with arugula slaw",
    html: `<p>Tender chicken, marinated and grilled over charcoal, then served with our satay sauce and a fresh arugula slaw.</p>
      <p class="muted">Contains nuts.</p>`,
  },
  vermicelli: {
    title: "Stir Fried Beef Vermicelli Bowl", sub: "Vermicelli bowl · $23", img: "images/gallery-vermicelli-beef.jpg",
    alt: "Vermicelli bowl with stir fried beef, cucumber, pickled carrot, lettuce and herbs, with fish sauce on the side",
    html: `<p>Wok stir fried beef on rice vermicelli with fresh salad, crispy shallot and peanuts, served with our fish sauce. Add a crispy spring roll for $2.</p>
      <p class="muted">Gluten free · contains nuts.</p>`,
  },
  bunchahanoi: {
    title: "Bún Chả Hà Nội", sub: "Our charcoal grilled signature", img: "images/bun-cha-hanoi.jpg",
    alt: "Bún chả Hanoi: grilled pork and pickled carrot in dipping sauce, with rice vermicelli and fresh herbs",
    html: `<p>The dish we are named after: pork patties and sliced pork belly grilled over charcoal, served in a light, sweet and sour fish sauce with pickled carrot and green papaya.</p>
      <p>Dip the cold rice vermicelli and fresh herbs into the bowl and enjoy the smoky, fragrant flavours of Hanoi.</p>`,
  },
  banhmi: {
    title: "Bánh Mì", sub: "Weekend special", img: "images/banh-mi.jpg",
    alt: "A crusty Vietnamese bánh mì roll filled with meat, pickles and herbs",
    html: `<p>A crisp, airy baguette filled with tasty meat, pickled carrot and daikon, cucumber, fresh herbs and chilli – the most famous Vietnamese street food.</p>
      <p class="muted">Bánh mì is served on weekends – see the full menu for today's fillings.</p>`,
  },
};
const DISHES = Object.keys(DISH_DATA);

// ---- Story pop-up (created here so both pages share it) ----
document.body.insertAdjacentHTML("beforeend", `
  <dialog class="dish-dialog" id="dish-dialog" aria-labelledby="dish-title">
    <button type="button" class="dish-close" id="dish-close" aria-label="Close">×</button>
    <img id="dish-img" src="" alt="" />
    <div class="dish-body">
      <h4 id="dish-title"></h4>
      <p class="dish-sub" id="dish-sub"></p>
      <div id="dish-text"></div>
      <div class="dish-actions">
        <a class="btn" target="_blank" rel="noopener" data-ubereats href="${esc(RESTAURANT.uberEats)}">Order now</a>
        <a class="btn btn-outline" href="menu.html">View full menu</a>
      </div>
    </div>
  </dialog>`);
const dishDialog = document.getElementById("dish-dialog");

function openDish(id) {
  const d = DISH_DATA[id];
  document.getElementById("dish-img").src = d.img;
  document.getElementById("dish-img").alt = d.alt;
  document.getElementById("dish-title").textContent = d.title;
  document.getElementById("dish-sub").textContent = d.sub;
  document.getElementById("dish-text").innerHTML = d.html;
  dishDialog.showModal();
  dishDialog.scrollTop = 0;
}
document.getElementById("dish-close").addEventListener("click", () => dishDialog.close());
dishDialog.addEventListener("click", (e) => { if (e.target === dishDialog) dishDialog.close(); }); // click the backdrop to close

const tileHtml = (id) => {
  const d = DISH_DATA[id];
  return `<img src="${esc(d.img)}" alt="" loading="lazy" />
    <span class="sig-caption"><span class="sig-name">${esc(d.title)}</span><span class="sig-more">${esc(d.sub)} · Read more</span></span>`;
};
document.addEventListener("click", (e) => {
  const tile = e.target.closest(".sig-tile");
  if (tile) openDish(tile.dataset.dish);
});

// ---- Home page: four tiles that fade to the next dishes by themselves ----
const sigTiles = [...document.querySelectorAll("#signature-grid .sig-tile")];
if (sigTiles.length) {
  const SIG_STEP = 2; // each slide moves on by two dishes, so every dish gets a turn in every tile position
  const SIG_PAGES = DISHES.length / SIG_STEP;
  let sigPage = 0;

  const swap = () => sigTiles.forEach((tile, i) => {
    const id = DISHES[(sigPage * SIG_STEP + i) % DISHES.length];
    tile.dataset.dish = id;
    tile.innerHTML = tileHtml(id);
  });
  swap();

  setInterval(() => {
    if (document.hidden || dishDialog.open) return;
    sigPage = (sigPage + 1) % SIG_PAGES;
    if (reducedMotion) return swap();
    sigTiles.forEach((tile) => tile.classList.add("is-fading"));
    setTimeout(() => { swap(); sigTiles.forEach((tile) => tile.classList.remove("is-fading")); }, 450);
  }, 5500);
}
