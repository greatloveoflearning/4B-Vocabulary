(function () {
  "use strict";

  const els = {
    signedOut: document.getElementById("typing-signed-out"),
    signinBtn: document.getElementById("typing-signin-btn"),
    main: document.getElementById("typing-main"),
    modeArticleBtn: document.getElementById("typing-mode-article-btn"),
    modeHskBtn: document.getElementById("typing-mode-hsk-btn"),
    modeSupplementBtn: document.getElementById("typing-mode-supplement-btn"),
    articleControls: document.getElementById("typing-article-controls"),
    hskControls: document.getElementById("typing-hsk-controls"),
    hskLevelSelect: document.getElementById("typing-hsk-level-select"),
    hskCountSelect: document.getElementById("typing-hsk-count-select"),
    hskStartBtn: document.getElementById("typing-hsk-start-btn"),
    hskRestartBtn: document.getElementById("typing-hsk-restart-btn"),
    hskProgress: document.getElementById("typing-hsk-progress"),
    hskMeaning: document.getElementById("typing-hsk-meaning"),
    supplementControls: document.getElementById("typing-supplement-controls"),
    supplementUnitSelect: document.getElementById("typing-supplement-unit-select"),
    supplementStartBtn: document.getElementById("typing-supplement-start-btn"),
    supplementRestartBtn: document.getElementById("typing-supplement-restart-btn"),
    supplementProgress: document.getElementById("typing-supplement-progress"),
    durationSelect: document.getElementById("typing-duration-select"),
    startBtn: document.getElementById("typing-start-btn"),
    restartBtn: document.getElementById("typing-restart-btn"),
    newTextBtn: document.getElementById("typing-newtext-btn"),
    togglePinyinBtn: document.getElementById("typing-toggle-pinyin-btn"),
    correctCountEl: document.getElementById("typing-correct-count"),
    timerEl: document.getElementById("typing-timer"),
    articlePicker: document.getElementById("typing-article-picker"),
    articleSelect: document.getElementById("typing-article-select"),
    articleConfirmBtn: document.getElementById("typing-article-confirm-btn"),
    articleCancelBtn: document.getElementById("typing-article-cancel-btn"),
    passage: document.getElementById("typing-passage"),
    input: document.getElementById("typing-input"),
    results: document.getElementById("typing-results"),
    resultsLine: document.getElementById("typing-results-line"),
    mistakesBody: document.querySelector("#typing-mistakes-table tbody"),
  };

  const { db, sdk } = window.vocabFirebase;

  let currentMode = "article";
  let currentArticle = null;
  let tokenEls = [];
  let currentIndex = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let mistakes = [];
  let running = false;
  let pinyinHidden = false;
  let durationSeconds = 60;
  let remainingMs = 0;
  let startedAt = 0;
  let timerInterval = null;

  let articlesMeta = [];
  const contentCache = new Map();

  async function fetchArticlesMeta() {
    if (articlesMeta.length) return articlesMeta;
    const snap = await sdk.getDoc(sdk.doc(db, "typingArticlesMeta", "list"));
    articlesMeta = snap.exists() ? snap.data().articles || [] : [];
    return articlesMeta;
  }

  async function fetchArticleContent(articleId) {
    if (contentCache.has(articleId)) return contentCache.get(articleId);
    const snap = await sdk.getDoc(sdk.doc(db, "typingArticleContent", String(articleId)));
    if (!snap.exists()) return null;
    const data = snap.data();
    contentCache.set(articleId, data);
    return data;
  }

  async function ensureArticleOptions() {
    if (els.articleSelect.options.length) return;
    const articles = await fetchArticlesMeta();
    articles.forEach((article) => {
      const opt = document.createElement("option");
      opt.value = String(article.id);
      opt.textContent = `${article.id}${article.title}`;
      els.articleSelect.appendChild(opt);
    });
  }

  // ---------- HSK vocabulary typing round ----------

  const hskCache = new Map();

  async function fetchHskLevel(level) {
    if (hskCache.has(level)) return hskCache.get(level);
    const snap = await sdk.getDoc(sdk.doc(db, "hskVocabContent", String(level)));
    const words = snap.exists() ? snap.data().words || [] : [];
    hskCache.set(level, words);
    return words;
  }

  function shuffleSample(arr, n) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.min(n, copy.length));
  }

  function buildHskRoundArticle(level, words) {
    const tokens = [];
    words.forEach((w, wi) => {
      const chars = Array.from(w.hanzi);
      const pinyins = (w.pinyin || "").split(" ");
      chars.forEach((ch, ci) => {
        tokens.push({ hanzi: ch, pinyin: pinyins[ci] || null, word: w });
      });
      if (wi < words.length - 1) {
        tokens.push({ hanzi: "　", pinyin: null });
      }
    });
    return { id: `hsk-${level}`, title: `HSK ${level} 词汇练习`, tokens };
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function updateHskMeaning() {
    if (!els.hskMeaning) return;
    if (currentMode !== "hsk" && currentMode !== "supplement") {
      els.hskMeaning.hidden = true;
      return;
    }
    const token = currentArticle && currentArticle.tokens[currentIndex];
    const word = token && token.word;
    if (!word) {
      els.hskMeaning.hidden = true;
      return;
    }
    let html = `<div><span class="hsk-meaning-word">${escapeHtml(word.hanzi)}</span><span class="hsk-meaning-english">${escapeHtml(
      word.english || ""
    )}</span></div>`;
    if (word.example_cn) {
      const sentence = escapeHtml(word.example_cn).split(word.hanzi).join(`<b>${escapeHtml(word.hanzi)}</b>`);
      html += `<div class="hsk-meaning-sentence">${sentence}</div>`;
    }
    if (word.example_en) {
      html += `<div class="hsk-meaning-sentence-en">${escapeHtml(word.example_en)}</div>`;
    }
    els.hskMeaning.innerHTML = html;
    els.hskMeaning.hidden = false;
  }

  async function startHskRound() {
    const level = els.hskLevelSelect.value;
    const count = Number(els.hskCountSelect.value);
    els.hskStartBtn.disabled = true;
    els.passage.innerHTML = "";
    els.passage.textContent = "Loading…";
    const words = await fetchHskLevel(level);
    if (!words.length) {
      els.passage.textContent = "Couldn't load this HSK level. Please try again.";
      els.hskStartBtn.disabled = false;
      return;
    }
    const sample = shuffleSample(words, count);
    currentArticle = buildHskRoundArticle(level, sample);
    renderPassage(currentArticle);
    resetStats();
    els.results.hidden = true;
    els.input.value = "";
    els.hskStartBtn.disabled = false;
    els.hskRestartBtn.disabled = false;
    els.hskProgress.textContent = `0 / ${sample.length}`;
    els.durationSelect.value = "0";
    startTest();
    updateHskMeaning();
  }

  function updateHskProgress() {
    if (!currentArticle) return;
    const tokens = currentArticle.tokens;
    const wordLastIndex = new Map();
    tokens.forEach((t, i) => {
      if (t.word) wordLastIndex.set(t.word, i);
    });
    let completed = 0;
    wordLastIndex.forEach((lastIdx) => {
      if (lastIdx < currentIndex) completed++;
    });
    const text = `${completed} / ${wordLastIndex.size}`;
    if (currentMode === "hsk" && els.hskProgress) els.hskProgress.textContent = text;
    if (currentMode === "supplement" && els.supplementProgress) els.supplementProgress.textContent = text;
  }

  // ---------- Supplementary vocabulary typing round (by unit/source) ----------

  let supplementMetaLoaded = false;
  const supplementCache = new Map();

  async function fetchSupplementMeta() {
    if (supplementMetaLoaded) return;
    const snap = await sdk.getDoc(sdk.doc(db, "supplementVocabMeta", "list"));
    const units = snap.exists() ? snap.data().units || [] : [];
    els.supplementUnitSelect.innerHTML = "";
    units.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.title;
      els.supplementUnitSelect.appendChild(opt);
    });
    supplementMetaLoaded = true;
  }

  async function fetchSupplementUnit(unitId) {
    if (supplementCache.has(unitId)) return supplementCache.get(unitId);
    const snap = await sdk.getDoc(sdk.doc(db, "supplementVocabContent", unitId));
    const data = snap.exists() ? snap.data() : null;
    supplementCache.set(unitId, data);
    return data;
  }

  function buildSupplementRoundArticle(unit) {
    const tokens = [];
    unit.words.forEach((w, wi) => {
      const chars = Array.from(w.hanzi);
      const pinyins = (w.pinyin || "").split(" ");
      chars.forEach((ch, ci) => {
        tokens.push({ hanzi: ch, pinyin: pinyins[ci] || null, word: w });
      });
      if (wi < unit.words.length - 1) {
        tokens.push({ hanzi: "　", pinyin: null });
      }
    });
    return { id: `supplement-${unit.id}`, title: unit.title, tokens };
  }

  async function startSupplementRound() {
    const unitId = els.supplementUnitSelect.value;
    if (!unitId) return;
    els.supplementStartBtn.disabled = true;
    els.passage.innerHTML = "";
    els.passage.textContent = "Loading…";
    const unit = await fetchSupplementUnit(unitId);
    if (!unit || !unit.words || !unit.words.length) {
      els.passage.textContent = "Couldn't load this unit. Please try again.";
      els.supplementStartBtn.disabled = false;
      return;
    }
    currentArticle = buildSupplementRoundArticle(unit);
    renderPassage(currentArticle);
    resetStats();
    els.results.hidden = true;
    els.input.value = "";
    els.supplementStartBtn.disabled = false;
    els.supplementRestartBtn.disabled = false;
    els.supplementProgress.textContent = `0 / ${unit.words.length}`;
    els.durationSelect.value = "0";
    startTest();
    updateHskMeaning();
  }

  function setMode(mode) {
    if (currentMode === mode) return;
    stopTest();
    currentMode = mode;
    els.modeArticleBtn.classList.toggle("is-active", mode === "article");
    els.modeHskBtn.classList.toggle("is-active", mode === "hsk");
    els.modeSupplementBtn.classList.toggle("is-active", mode === "supplement");
    els.articleControls.hidden = mode !== "article";
    els.hskControls.hidden = mode !== "hsk";
    els.supplementControls.hidden = mode !== "supplement";
    els.articlePicker.hidden = true;
    els.results.hidden = true;
    els.passage.innerHTML = "";
    els.input.value = "";
    els.input.disabled = true;
    els.startBtn.disabled = mode !== "article";
    els.restartBtn.disabled = true;
    els.hskRestartBtn.disabled = true;
    els.supplementRestartBtn.disabled = true;
    currentArticle = null;
    if (mode === "hsk") els.hskProgress.textContent = `0 / ${els.hskCountSelect.value}`;
    if (mode === "supplement") {
      els.supplementProgress.textContent = "0 / 0";
      fetchSupplementMeta();
    }
    updateHskMeaning();
  }

  els.modeArticleBtn.addEventListener("click", () => setMode("article"));
  els.modeHskBtn.addEventListener("click", () => setMode("hsk"));
  els.modeSupplementBtn.addEventListener("click", () => setMode("supplement"));
  els.hskStartBtn.addEventListener("click", startHskRound);
  els.hskRestartBtn.addEventListener("click", startHskRound);
  els.supplementStartBtn.addEventListener("click", startSupplementRound);
  els.supplementRestartBtn.addEventListener("click", startSupplementRound);

  function renderPassage(article) {
    els.passage.innerHTML = "";
    tokenEls = article.tokens.map((token, i) => {
      const isPunct = token.pinyin == null;
      const span = document.createElement("span");
      span.className = isPunct ? "typing-token typing-token-punct" : "typing-token";
      span.dataset.idx = String(i);
      const hanziEl = document.createElement("span");
      hanziEl.className = "typing-token-hanzi";
      hanziEl.textContent = token.hanzi;
      span.appendChild(hanziEl);
      if (!isPunct) {
        const pinyinEl = document.createElement("span");
        pinyinEl.className = "typing-token-pinyin";
        pinyinEl.textContent = token.pinyin;
        span.appendChild(pinyinEl);
      }
      els.passage.appendChild(span);
      return span;
    });
    els.passage.classList.toggle("hide-pinyin", pinyinHidden);
  }

  function firstTestableIndex(fromIndex) {
    const tokens = currentArticle ? currentArticle.tokens : [];
    let i = fromIndex;
    while (i < tokens.length && tokens[i].pinyin == null) i++;
    return i;
  }

  async function loadArticle(articleId) {
    stopTest();
    els.startBtn.disabled = true;
    els.passage.innerHTML = "";
    els.passage.textContent = "Loading…";
    const article = await fetchArticleContent(articleId);
    if (!article) {
      els.passage.textContent = "Couldn't load this article. Please try again.";
      return;
    }
    currentArticle = article;
    renderPassage(article);
    resetStats();
    els.startBtn.disabled = false;
    els.restartBtn.disabled = true;
    els.input.disabled = true;
    els.input.value = "";
    els.results.hidden = true;
  }

  function scrollCurrentIntoView() {
    const el = tokenEls[currentIndex];
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function resetStats() {
    currentIndex = firstTestableIndex(0);
    correctCount = 0;
    wrongCount = 0;
    mistakes = [];
    els.correctCountEl.textContent = "0";
    tokenEls.forEach((el) => el.classList.remove("correct", "wrong", "current"));
    if (tokenEls[currentIndex]) tokenEls[currentIndex].classList.add("current");
    els.passage.scrollTop = 0;
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    if (durationSeconds === 0) {
      const elapsed = running ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      els.timerEl.textContent = `${elapsed}s`;
    } else {
      const remaining = running ? Math.max(0, Math.ceil(remainingMs / 1000)) : durationSeconds;
      els.timerEl.textContent = `${remaining}s`;
    }
  }

  function startTest() {
    if (!currentArticle || !currentArticle.tokens.length) return;
    resetStats();
    els.results.hidden = true;
    running = true;
    startedAt = Date.now();
    durationSeconds = Number(els.durationSelect.value);
    remainingMs = durationSeconds * 1000;
    els.input.disabled = false;
    els.input.value = "";
    els.input.focus();
    els.startBtn.disabled = true;
    els.restartBtn.disabled = false;
    els.durationSelect.disabled = true;

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (durationSeconds > 0) {
        remainingMs = startedAt + durationSeconds * 1000 - Date.now();
        if (remainingMs <= 0) {
          updateTimerDisplay();
          finishTest();
          return;
        }
      }
      updateTimerDisplay();
    }, 200);
    updateTimerDisplay();
  }

  function stopTest() {
    running = false;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    els.input.disabled = true;
    els.durationSelect.disabled = false;
  }

  function finishTest() {
    stopTest();
    els.startBtn.disabled = false;
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const cpm = Math.round((correctCount / elapsedSeconds) * 60);
    const total = correctCount + wrongCount;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    els.resultsLine.textContent = `✅ ${correctCount} correct · ❌ ${wrongCount} wrong · ${cpm} CPM · ${accuracy}% accuracy`;
    els.mistakesBody.innerHTML = "";
    if (mistakes.length === 0) {
      els.mistakesBody.innerHTML = `<tr><td colspan="3">Perfect run — no mistakes! 🎉</td></tr>`;
    } else {
      mistakes.forEach((m) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${m.hanzi}</td><td>${m.typed || "(blank)"}</td><td>${m.pinyin}</td>`;
        els.mistakesBody.appendChild(tr);
      });
    }
    els.results.hidden = false;

    if (window.vocabActivity && currentArticle) {
      window.vocabActivity.recordTypingTestComplete(
        currentArticle.id,
        currentArticle.title,
        correctCount,
        wrongCount,
        elapsedSeconds
      );
    }
  }

  function advance() {
    tokenEls[currentIndex].classList.remove("current");
    currentIndex = firstTestableIndex(currentIndex + 1);
    els.input.value = "";
    if (currentIndex >= tokenEls.length) {
      finishTest();
      return;
    }
    tokenEls[currentIndex].classList.add("current");
    scrollCurrentIntoView();
    updateHskMeaning();
  }

  els.input.addEventListener("input", () => {
    if (!running || !currentArticle) return;
    const token = currentArticle.tokens[currentIndex];
    if (!token || token.pinyin == null) return;
    const typed = els.input.value.trim().toLowerCase();
    const target = token.pinyin.toLowerCase();
    if (typed === target) {
      tokenEls[currentIndex].classList.add("correct");
      correctCount++;
      els.correctCountEl.textContent = String(correctCount);
      window.vocabAudio && window.vocabAudio.speak(token.hanzi, "zh-CN");
      advance();
    } else if (typed.length >= target.length) {
      tokenEls[currentIndex].classList.add("wrong");
      wrongCount++;
      mistakes.push({ hanzi: token.hanzi, typed: els.input.value.trim(), pinyin: token.pinyin });
      advance();
    }
    updateHskProgress();
  });

  els.startBtn.addEventListener("click", startTest);
  els.restartBtn.addEventListener("click", startTest);

  els.newTextBtn.addEventListener("click", async () => {
    await ensureArticleOptions();
    if (currentArticle) els.articleSelect.value = String(currentArticle.id);
    els.articlePicker.hidden = false;
  });

  els.articleCancelBtn.addEventListener("click", () => {
    els.articlePicker.hidden = true;
  });

  els.articleConfirmBtn.addEventListener("click", () => {
    const id = Number(els.articleSelect.value);
    els.articlePicker.hidden = true;
    loadArticle(id);
  });

  els.togglePinyinBtn.addEventListener("click", () => {
    pinyinHidden = !pinyinHidden;
    els.passage.classList.toggle("hide-pinyin", pinyinHidden);
    els.togglePinyinBtn.textContent = pinyinHidden ? "Show all Pinyin" : "Hide all Pinyin";
  });

  els.signinBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("account-btn").click();
  });

  let initialized = false;

  async function onTabShown() {
    const user = window.vocabAuth.getUser();
    if (!user) {
      els.signedOut.hidden = false;
      els.main.hidden = true;
      return;
    }
    els.signedOut.hidden = true;
    els.main.hidden = false;
    if (!initialized) {
      initialized = true;
      const articles = await fetchArticlesMeta();
      await ensureArticleOptions();
      if (articles.length) loadArticle(articles[0].id);
    }
  }

  function onTabHidden() {
    if (running) stopTest();
  }

  window.vocabTyping = { onTabShown, onTabHidden };

  window.vocabAuth.onChange((user) => {
    if (!user) {
      stopTest();
      initialized = false;
    }
  });
})();
