(function () {
  "use strict";

  let allCards = [];
  let currentSetCards = [];
  let index = 0;
  let flipped = false;

  const els = {
    setSelect: document.getElementById("set-select"),
    shuffleBtn: document.getElementById("shuffle-btn"),
    card: document.getElementById("card"),
    frontHanzi: document.getElementById("front-hanzi"),
    frontPinyin: document.getElementById("front-pinyin"),
    backMeaning: document.getElementById("back-meaning"),
    backExample: document.getElementById("back-example"),
    prevBtn: document.getElementById("prev-btn"),
    nextBtn: document.getElementById("next-btn"),
    flipBtn: document.getElementById("flip-btn"),
    progressFill: document.getElementById("progress-fill"),
    progressLabel: document.getElementById("progress-label"),
    cardIndexLabel: document.getElementById("card-index-label"),
  };

  function buildSetOptions() {
    const pages = Array.from(new Set(allCards.map((c) => c.page))).sort((a, b) => a - b);
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = `All pages (${allCards.length} cards)`;
    els.setSelect.appendChild(allOption);

    pages.forEach((p) => {
      const count = allCards.filter((c) => c.page === p).length;
      const opt = document.createElement("option");
      opt.value = String(p);
      opt.textContent = `Page ${p} (${count} cards)`;
      els.setSelect.appendChild(opt);
    });
  }

  function loadSet(value) {
    if (value === "all") {
      currentSetCards = allCards.slice();
    } else {
      const page = Number(value);
      currentSetCards = allCards.filter((c) => c.page === page);
    }
    index = 0;
    flipped = false;
    render();
  }

  function render() {
    if (currentSetCards.length === 0) return;
    const c = currentSetCards[index];
    els.frontHanzi.textContent = c.hanzi;
    els.frontPinyin.textContent = c.pinyin;
    els.backMeaning.textContent = c.meaning;
    els.backExample.textContent = c.example_en;

    els.card.classList.toggle("flipped", flipped);

    const total = currentSetCards.length;
    const pct = ((index + 1) / total) * 100;
    els.progressFill.style.width = `${pct}%`;
    els.progressLabel.textContent = `${index + 1} / ${total}`;
    els.cardIndexLabel.textContent = `Card ${index + 1} of ${total}`;
  }

  function flip() {
    flipped = !flipped;
    els.card.classList.toggle("flipped", flipped);
  }

  function next() {
    if (currentSetCards.length === 0) return;
    index = (index + 1) % currentSetCards.length;
    flipped = false;
    render();
  }

  function prev() {
    if (currentSetCards.length === 0) return;
    index = (index - 1 + currentSetCards.length) % currentSetCards.length;
    flipped = false;
    render();
  }

  function shuffle() {
    for (let i = currentSetCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [currentSetCards[i], currentSetCards[j]] = [currentSetCards[j], currentSetCards[i]];
    }
    index = 0;
    flipped = false;
    render();
  }

  els.card.addEventListener("click", flip);
  els.flipBtn.addEventListener("click", flip);
  els.nextBtn.addEventListener("click", next);
  els.prevBtn.addEventListener("click", prev);
  els.shuffleBtn.addEventListener("click", shuffle);
  els.setSelect.addEventListener("change", (e) => loadSet(e.target.value));

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
    else if (e.key === " ") {
      e.preventDefault();
      flip();
    }
  });

  fetch("assets/vocab.json")
    .then((r) => r.json())
    .then((data) => {
      allCards = data;
      buildSetOptions();
      loadSet("all");
    })
    .catch((err) => {
      els.frontHanzi.textContent = "Failed to load data";
      console.error(err);
    });
})();
