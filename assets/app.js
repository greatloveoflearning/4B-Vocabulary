(function () {
  "use strict";

  const STORAGE_KEY = "4b-vocab-eliminated-v1";

  let allCards = [];
  let deck = [];
  let activeIndex = 0;
  let flipped = false;
  let shuffleMode = false;
  let currentCard = null;
  let eliminated = loadEliminated();

  const els = {
    setSelect: document.getElementById("set-select"),
    modeTabs: Array.from(document.querySelectorAll(".mode-tab")),
    studyView: document.getElementById("study-view"),
    matchView: document.getElementById("match-view"),
    studyControls: document.getElementById("study-controls"),
    matchControls: document.getElementById("match-controls"),

    shuffleToggle: document.getElementById("shuffle-toggle"),
    masteryStat: document.getElementById("mastery-stat"),
    resetEliminatedBtn: document.getElementById("reset-eliminated-btn"),
    studyCompleteResetBtn: document.getElementById("study-complete-reset-btn"),

    progressWrap: document.getElementById("progress-wrap"),
    studyStage: document.getElementById("study-stage"),
    studyComplete: document.getElementById("study-complete"),
    studyCompleteMsg: document.getElementById("study-complete-msg"),
    studyBottomControls: document.getElementById("study-bottom-controls"),

    card: document.getElementById("card"),
    frontHanzi: document.getElementById("front-hanzi"),
    backPinyin: document.getElementById("back-pinyin"),
    backMeaning: document.getElementById("back-meaning"),
    backExampleCn: document.getElementById("back-example-cn"),
    backExampleEn: document.getElementById("back-example-en"),
    prevBtn: document.getElementById("prev-btn"),
    nextBtn: document.getElementById("next-btn"),
    flipBtn: document.getElementById("flip-btn"),
    eliminateBtn: document.getElementById("eliminate-btn"),
    speakFrontBtn: document.getElementById("speak-front-btn"),
    speakBackCnBtn: document.getElementById("speak-back-cn-btn"),
    speakBackEnBtn: document.getElementById("speak-back-en-btn"),
    progressFill: document.getElementById("progress-fill"),
    progressLabel: document.getElementById("progress-label"),
    cardIndexLabel: document.getElementById("card-index-label"),

    matchPairsSelect: document.getElementById("match-pairs-select"),
    newGameBtn: document.getElementById("new-game-btn"),
    matchTimer: document.getElementById("match-timer"),
    matchColCn: document.getElementById("match-col-cn"),
    matchColEn: document.getElementById("match-col-en"),
    matchComplete: document.getElementById("match-complete"),
    matchFinalTime: document.getElementById("match-final-time"),
    matchAgainBtn: document.getElementById("match-again-btn"),
  };

  // ---------- storage ----------

  function loadEliminated() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveEliminated() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(eliminated)));
    } catch (e) {
      /* ignore */
    }
  }

  // ---------- audio ----------

  let audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function playTone(freq, duration, type, startGain) {
    try {
      const ctx = getAudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(startGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch (e) {
      /* ignore */
    }
  }

  function playEliminateSound() {
    try {
      const ctx = getAudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(1100, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.22);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    } catch (e) {
      /* ignore */
    }
  }

  function playCorrectSound() {
    playTone(660, 0.12, "sine", 0.2);
    setTimeout(() => playTone(880, 0.15, "sine", 0.2), 90);
  }

  function playWrongSound() {
    playTone(160, 0.25, "square", 0.15);
  }

  function speak(text, lang) {
    if (!("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = lang.startsWith("zh") ? 0.9 : 1;
    window.speechSynthesis.speak(utter);
  }

  // ---------- helpers ----------

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function getLessonCards(value) {
    return value === "all" ? allCards.slice() : allCards.filter((c) => c.lesson === Number(value));
  }

  function getActiveCards() {
    return deck.filter((c) => !eliminated.has(c.id));
  }

  // ---------- study mode ----------

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

  function loadSet(value) {
    const base = getLessonCards(value);
    deck = shuffleMode ? shuffleArray(base) : base;
    activeIndex = 0;
    flipped = false;
    renderStudy();
  }

  function renderStudy() {
    const active = getActiveCards();
    const eliminatedCount = deck.length - active.length;
    els.masteryStat.textContent = `${eliminatedCount} eliminated · ${active.length} remaining`;

    if (active.length === 0) {
      els.studyStage.hidden = true;
      els.progressWrap.hidden = true;
      els.studyBottomControls.hidden = true;
      els.studyComplete.hidden = false;
      els.studyCompleteMsg.textContent =
        deck.length === 0
          ? "No words in this lesson."
          : "🎉 All words in this lesson are eliminated — great work!";
      currentCard = null;
      return;
    }

    els.studyStage.hidden = false;
    els.progressWrap.hidden = false;
    els.studyBottomControls.hidden = false;
    els.studyComplete.hidden = true;

    if (activeIndex >= active.length) activeIndex = 0;
    const c = active[activeIndex];
    currentCard = c;

    els.frontHanzi.textContent = c.hanzi;
    els.backPinyin.textContent = c.pinyin;
    els.backMeaning.textContent = c.meaning;
    els.backExampleCn.textContent = c.example_cn;
    els.backExampleEn.textContent = c.example_en;

    els.card.classList.toggle("flipped", flipped);

    const total = active.length;
    const pct = ((activeIndex + 1) / total) * 100;
    els.progressFill.style.width = `${pct}%`;
    els.progressLabel.textContent = `${activeIndex + 1} / ${total}`;
    els.cardIndexLabel.textContent = `Card ${activeIndex + 1} of ${total}`;
  }

  function flip() {
    flipped = !flipped;
    els.card.classList.toggle("flipped", flipped);
  }

  function next() {
    const active = getActiveCards();
    if (active.length === 0) return;
    activeIndex = (activeIndex + 1) % active.length;
    flipped = false;
    renderStudy();
  }

  function prev() {
    const active = getActiveCards();
    if (active.length === 0) return;
    activeIndex = (activeIndex - 1 + active.length) % active.length;
    flipped = false;
    renderStudy();
  }

  function eliminateCurrent() {
    if (!currentCard) return;
    eliminated.add(currentCard.id);
    saveEliminated();
    playEliminateSound();
    els.card.classList.add("eliminating");
    setTimeout(() => {
      els.card.classList.remove("eliminating");
      flipped = false;
      renderStudy();
    }, 250);
  }

  function resetEliminated() {
    deck.forEach((c) => eliminated.delete(c.id));
    saveEliminated();
    activeIndex = 0;
    renderStudy();
  }

  els.card.addEventListener("click", flip);
  els.flipBtn.addEventListener("click", flip);
  els.nextBtn.addEventListener("click", next);
  els.prevBtn.addEventListener("click", prev);
  els.eliminateBtn.addEventListener("click", eliminateCurrent);
  els.resetEliminatedBtn.addEventListener("click", resetEliminated);
  els.studyCompleteResetBtn.addEventListener("click", resetEliminated);

  els.setSelect.addEventListener("change", (e) => {
    loadSet(e.target.value);
    if (!els.matchView.hidden) startMatchGame();
  });

  els.shuffleToggle.addEventListener("change", (e) => {
    shuffleMode = e.target.checked;
    loadSet(els.setSelect.value);
  });

  els.speakFrontBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentCard) speak(currentCard.hanzi, "zh-CN");
  });

  els.speakBackCnBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentCard) speak(`${currentCard.hanzi}。${currentCard.example_cn || ""}`, "zh-CN");
  });

  els.speakBackEnBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentCard) speak(`${currentCard.meaning}. ${currentCard.example_en || ""}`, "en-US");
  });

  document.addEventListener("keydown", (e) => {
    if (els.studyView.hidden) return;
    if (e.target && ["SELECT", "INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
    if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
    else if (e.key === " ") {
      e.preventDefault();
      flip();
    } else if (e.key === "Delete" || e.key === "x" || e.key === "X") {
      eliminateCurrent();
    }
  });

  // ---------- match mode ----------

  let matchTiles = [];
  let selectedTile = null;
  let matchedCount = 0;
  let matchLocked = false;
  let matchTimerInterval = null;
  let matchStartTime = null;

  function stopMatchTimer() {
    if (matchTimerInterval) clearInterval(matchTimerInterval);
    matchTimerInterval = null;
  }

  function updateMatchTimer() {
    const secs = Math.floor((Date.now() - matchStartTime) / 1000);
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");
    els.matchTimer.textContent = `${mm}:${ss}`;
  }

  function startMatchGame() {
    stopMatchTimer();
    els.matchComplete.hidden = true;
    selectedTile = null;
    matchLocked = false;
    matchedCount = 0;

    const pool = getLessonCards(els.setSelect.value);
    const n = Math.min(Number(els.matchPairsSelect.value), pool.length);

    if (n < 2) {
      els.matchColCn.innerHTML = "";
      els.matchColEn.innerHTML = "";
      els.matchColCn.textContent = "Not enough words in this lesson for a match game.";
      return;
    }

    const sample = shuffleArray(pool.slice()).slice(0, n);
    const hanziTiles = sample.map((c) => ({ uid: `${c.id}-h`, pairId: c.id, kind: "hanzi", text: c.hanzi }));
    const meaningTiles = sample.map((c) => ({ uid: `${c.id}-m`, pairId: c.id, kind: "meaning", text: c.meaning }));
    shuffleArray(hanziTiles);
    shuffleArray(meaningTiles);
    matchTiles = hanziTiles.concat(meaningTiles);

    renderMatchColumn(els.matchColCn, hanziTiles);
    renderMatchColumn(els.matchColEn, meaningTiles);

    matchStartTime = Date.now();
    updateMatchTimer();
    matchTimerInterval = setInterval(updateMatchTimer, 250);
  }

  function renderMatchColumn(container, tiles) {
    container.innerHTML = "";
    tiles.forEach((tile) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "match-tile";
      btn.textContent = tile.text;
      btn.dataset.uid = tile.uid;
      btn.addEventListener("click", () => onTileClick(tile, btn));
      container.appendChild(btn);
    });
  }

  function findTileBtn(uid) {
    return document.querySelector(`.match-tile[data-uid="${uid}"]`);
  }

  function onTileClick(tile, btn) {
    if (matchLocked || btn.classList.contains("matched")) return;

    if (selectedTile && selectedTile.uid === tile.uid) {
      btn.classList.remove("selected");
      selectedTile = null;
      return;
    }

    if (!selectedTile) {
      selectedTile = tile;
      btn.classList.add("selected");
      return;
    }

    const firstBtn = findTileBtn(selectedTile.uid);

    if (selectedTile.pairId === tile.pairId && selectedTile.kind !== tile.kind) {
      btn.classList.remove("selected");
      firstBtn.classList.remove("selected");
      btn.classList.add("matched");
      firstBtn.classList.add("matched");
      selectedTile = null;
      matchedCount++;
      playCorrectSound();
      if (matchedCount === matchTiles.length / 2) finishMatchGame();
    } else {
      btn.classList.add("wrong");
      firstBtn.classList.add("wrong");
      playWrongSound();
      matchLocked = true;
      setTimeout(() => {
        btn.classList.remove("wrong", "selected");
        firstBtn.classList.remove("wrong", "selected");
        selectedTile = null;
        matchLocked = false;
      }, 500);
    }
  }

  function finishMatchGame() {
    stopMatchTimer();
    els.matchFinalTime.textContent = els.matchTimer.textContent;
    els.matchComplete.hidden = false;
  }

  els.newGameBtn.addEventListener("click", startMatchGame);
  els.matchAgainBtn.addEventListener("click", startMatchGame);
  els.matchPairsSelect.addEventListener("change", startMatchGame);

  // ---------- mode tabs ----------

  els.modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = tab.dataset.mode;
      els.modeTabs.forEach((t) => {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", String(t === tab));
      });

      if (mode === "study") {
        els.studyView.hidden = false;
        els.matchView.hidden = true;
        els.studyControls.hidden = false;
        els.matchControls.hidden = true;
        stopMatchTimer();
      } else {
        els.studyView.hidden = true;
        els.matchView.hidden = false;
        els.studyControls.hidden = true;
        els.matchControls.hidden = false;
        startMatchGame();
      }
    });
  });

  // ---------- init ----------

  allCards = (window.VOCAB_DATA || []).map((c, i) => Object.assign({ id: i }, c));
  buildSetOptions();
  loadSet("all");
})();
