(function () {
  "use strict";

  let allCards = [];
  let currentSetCards = [];
  let index = 0;
  let flipped = false;
  let shuffleMode = false;

  const els = {
    setSelect: document.getElementById("set-select"),
    shuffleToggle: document.getElementById("shuffle-toggle"),
    card: document.getElementById("card"),
    frontHanzi: document.getElementById("front-hanzi"),
    backPinyin: document.getElementById("back-pinyin"),
    backMeaning: document.getElementById("back-meaning"),
    backExampleCn: document.getElementById("back-example-cn"),
    backExampleEn: document.getElementById("back-example-en"),
    prevBtn: document.getElementById("prev-btn"),
    nextBtn: document.getElementById("next-btn"),
    flipBtn: document.getElementById("flip-btn"),
    progressFill: document.getElementById("progress-fill"),
    progressLabel: document.getElementById("progress-label"),
    cardIndexLabel: document.getElementById("card-index-label"),
  };

  function buildSetOptions() {
    const lessons = Array.from(new Set(allCards.map((c) => c.lesson))).sort((a, b) => a - b);
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = `All lessons (${allCards.length} cards)`;
    els.setSelect.appendChild(allOption);

    lessons.forEach((lesson) => {
      const count = allCards.filter((c) => c.lesson === lesson).length;
      const opt = document.createElement("option");
      opt.value = String(lesson);
      opt.textContent = `Lesson ${lesson} (${count} cards)`;
      els.setSelect.appendChild(opt);
    });
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function loadSet(value) {
    const base =
      value === "all"
        ? allCards.slice()
        : allCards.filter((c) => c.lesson === Number(value));
    currentSetCards = shuffleMode ? shuffleArray(base) : base;
    index = 0;
    flipped = false;
    render();
  }

  function render() {
    if (currentSetCards.length === 0) return;
    const c = currentSetCards[index];
    els.frontHanzi.textContent = c.hanzi;
    els.backPinyin.textContent = c.pinyin;
    els.backMeaning.textContent = c.meaning;
    els.backExampleCn.textContent = c.example_cn;
    els.backExampleEn.textContent = c.example_en;

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

  els.card.addEventListener("click", flip);
  els.flipBtn.addEventListener("click", flip);
  els.nextBtn.addEventListener("click", next);
  els.prevBtn.addEventListener("click", prev);
  els.setSelect.addEventListener("change", (e) => loadSet(e.target.value));
  els.shuffleToggle.addEventListener("change", (e) => {
    shuffleMode = e.target.checked;
    loadSet(els.setSelect.value);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
    else if (e.key === " ") {
      e.preventDefault();
      flip();
    }
  });

  allCards = window.VOCAB_DATA || [];
  buildSetOptions();
  loadSet("all");
})();
