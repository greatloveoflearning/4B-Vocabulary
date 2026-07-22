(function () {
  "use strict";

  const els = {
    signedOut: document.getElementById("typing-signed-out"),
    signinBtn: document.getElementById("typing-signin-btn"),
    main: document.getElementById("typing-main"),
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

  function getArticles() {
    return window.TYPING_ARTICLES || [];
  }

  function ensureArticleOptions() {
    if (els.articleSelect.options.length) return;
    getArticles().forEach((article) => {
      const opt = document.createElement("option");
      opt.value = String(article.id);
      opt.textContent = `${article.id}${article.title}`;
      els.articleSelect.appendChild(opt);
    });
  }

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

  function loadArticle(articleId) {
    const article = getArticles().find((a) => a.id === articleId);
    if (!article) return;
    currentArticle = article;
    stopTest();
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
  });

  els.startBtn.addEventListener("click", startTest);
  els.restartBtn.addEventListener("click", startTest);

  els.newTextBtn.addEventListener("click", () => {
    ensureArticleOptions();
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

  function onTabShown() {
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
      ensureArticleOptions();
      const articles = getArticles();
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
