(function () {
  "use strict";

  const LESSON_STORAGE_KEY = "4b-vocab-last-lesson";

  function loadLastLesson() {
    try {
      return localStorage.getItem(LESSON_STORAGE_KEY) || "all";
    } catch (e) {
      return "all";
    }
  }

  function saveLastLesson(value) {
    try {
      localStorage.setItem(LESSON_STORAGE_KEY, value);
    } catch (e) {
      /* ignore */
    }
  }

  const els = {
    signedOut: document.getElementById("practice-signed-out"),
    signinBtn: document.getElementById("practice-signin-btn"),

    setup: document.getElementById("practice-setup"),
    setupForm: document.getElementById("practice-setup-form"),
    lessonSelect: document.getElementById("practice-lesson-select"),
    questionTypeSelect: document.getElementById("practice-question-type-select"),
    countSelect: document.getElementById("practice-count-select"),

    running: document.getElementById("practice-running"),
    progress: document.getElementById("practice-progress"),
    tally: document.getElementById("practice-tally"),
    speakCnBtn: document.getElementById("practice-speak-cn-btn"),
    speakEnBtn: document.getElementById("practice-speak-en-btn"),
    prompt: document.getElementById("practice-prompt"),
    answerForm: document.getElementById("practice-answer-form"),
    answerInput: document.getElementById("practice-answer-input"),
    feedback: document.getElementById("practice-feedback"),
    endBtn: document.getElementById("practice-end-btn"),

    summary: document.getElementById("practice-summary"),
    summaryLine: document.getElementById("practice-summary-line"),
    summaryBody: document.querySelector("#practice-summary-table tbody"),
    againBtn: document.getElementById("practice-again-btn"),
    changeBtn: document.getElementById("practice-change-btn"),
  };

  const views = [els.signedOut, els.setup, els.running, els.summary];
  function showView(view) {
    views.forEach((v) => (v.hidden = v !== view));
    currentView = view;
  }
  let currentView = els.signedOut;

  function getAllCards() {
    return (window.VOCAB_DATA || []).map((c, i) => Object.assign({ id: i }, c));
  }

  function getLessons() {
    return Array.from(new Set(getAllCards().map((c) => c.lesson))).sort((a, b) => a - b);
  }

  function ensureLessonOptions() {
    if (els.lessonSelect.options.length) return;
    const allOpt = document.createElement("option");
    allOpt.value = "all";
    allOpt.textContent = "All lessons";
    els.lessonSelect.appendChild(allOpt);
    getLessons().forEach((lesson) => {
      const opt = document.createElement("option");
      opt.value = String(lesson);
      opt.textContent = window.lessonLabel(lesson);
      els.lessonSelect.appendChild(opt);
    });
  }

  function syncLessonSelectFromStorage() {
    const saved = loadLastLesson();
    const values = Array.from(els.lessonSelect.options).map((o) => o.value);
    els.lessonSelect.value = values.includes(saved) ? saved : "all";
  }

  function syncQuestionTypeAvailability() {
    const value = els.lessonSelect.value;
    const restricted = value !== "all" && window.TYPE1_ONLY_LESSONS && window.TYPE1_ONLY_LESSONS.has(Number(value));
    Array.from(els.questionTypeSelect.options).forEach((opt) => {
      opt.disabled = restricted && opt.value !== "1";
    });
    if (restricted) els.questionTypeSelect.value = "1";
  }

  els.lessonSelect.addEventListener("change", (e) => {
    saveLastLesson(e.target.value);
    syncQuestionTypeAvailability();
  });

  // ---------- state ----------

  let lesson = "all";
  let questionType = "1";
  let targetCount = 20;
  let correctCount = 0;
  let wrongCount = 0;
  let answerLog = [];
  let currentQuestion = null;
  let lastCardId = null;

  function getPool() {
    const all = getAllCards();
    return lesson === "all" ? all : all.filter((c) => c.lesson === Number(lesson));
  }

  function pickQuestionType(card) {
    if (window.TYPE1_ONLY_LESSONS && window.TYPE1_ONLY_LESSONS.has(card.lesson)) return "1";
    if (questionType === "mixed") return Math.random() < 0.5 ? "1" : "2";
    return questionType;
  }

  function nextQuestion() {
    const pool = getPool();
    if (pool.length === 0) return null;
    let card = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1) {
      let tries = 0;
      while (card.id === lastCardId && tries < 10) {
        card = pool[Math.floor(Math.random() * pool.length)];
        tries++;
      }
    }
    lastCardId = card.id;
    return { card, type: pickQuestionType(card) };
  }

  function updateTally() {
    els.tally.textContent = `✅ ${correctCount} · ❌ ${wrongCount}`;
    const answered = correctCount + wrongCount;
    els.progress.textContent = `Question ${Math.min(answered + 1, targetCount)} of ${targetCount}`;
  }

  function renderQuestion() {
    currentQuestion = nextQuestion();
    els.answerInput.value = "";
    els.feedback.hidden = true;
    if (!currentQuestion) {
      els.prompt.textContent = "No words available for this lesson.";
      return;
    }
    const { card, type } = currentQuestion;
    if (type === "1") {
      els.speakEnBtn.hidden = true;
      els.prompt.innerHTML = `<span class="hanzi no-copy">${card.hanzi}</span>`;
    } else {
      const blanked =
        card.example_cn && card.example_cn.includes(card.hanzi)
          ? card.example_cn.replace(card.hanzi, '<span class="blank">（　）</span>')
          : `<span class="blank">（　）</span>${card.example_cn || ""}`;
      els.speakEnBtn.hidden = false;
      els.prompt.innerHTML = `<span class="meaning no-copy">${card.meaning}</span>${blanked}<span class="en-sentence no-copy">${
        card.example_en || ""
      }</span>`;
    }
    els.answerInput.focus();
  }

  ["copy", "cut", "contextmenu", "selectstart", "dragstart"].forEach((evt) => {
    els.prompt.addEventListener(evt, (e) => e.preventDefault());
  });

  els.answerInput.addEventListener("paste", (e) => {
    if (currentQuestion && currentQuestion.type === "1") e.preventDefault();
  });

  els.speakCnBtn.addEventListener("click", () => {
    if (!currentQuestion) return;
    const { card, type } = currentQuestion;
    const text = type === "1" ? card.hanzi : card.example_cn || "";
    window.vocabAudio.speak(text, "zh-CN");
  });

  els.speakEnBtn.addEventListener("click", () => {
    if (!currentQuestion) return;
    const { card } = currentQuestion;
    window.vocabAudio.speak(`${card.meaning}. ${card.example_en || ""}`, "en-US");
  });

  els.answerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentQuestion) return;
    const guess = els.answerInput.value.trim();
    const { card, type } = currentQuestion;
    const correct = guess === card.hanzi;

    if (correct) {
      window.vocabAudio.playCorrectSound();
      els.feedback.textContent = "✅ Correct!";
      els.feedback.className = "answer-feedback correct";
      correctCount++;
    } else {
      window.vocabAudio.playWrongSound();
      els.feedback.textContent = `❌ Answer: ${card.hanzi}`;
      els.feedback.className = "answer-feedback wrong";
      wrongCount++;
    }
    els.feedback.hidden = false;
    window.vocabAudio.speak(card.hanzi, "zh-CN");
    answerLog.push({
      hanzi: card.hanzi,
      meaning: card.meaning,
      exampleCn: card.example_cn || "",
      type,
      guess,
      correct,
    });
    updateTally();

    const done = correctCount + wrongCount >= targetCount;
    setTimeout(() => {
      if (currentView !== els.running) return;
      if (done) endPractice();
      else renderQuestion();
    }, 500);
  });

  function questionLabel(entry) {
    if (entry.type === "1") return entry.hanzi;
    const blanked =
      entry.exampleCn && entry.exampleCn.includes(entry.hanzi)
        ? entry.exampleCn.replace(entry.hanzi, "（　）")
        : `（　）${entry.exampleCn || ""}`;
    return `${entry.meaning} — ${blanked}`;
  }

  function startPractice() {
    lesson = els.lessonSelect.value;
    questionType = els.questionTypeSelect.value;
    targetCount = els.countSelect.value === "all" ? getPool().length : Number(els.countSelect.value);
    correctCount = 0;
    wrongCount = 0;
    answerLog = [];
    lastCardId = null;
    updateTally();
    showView(els.running);
    renderQuestion();
  }

  function endPractice() {
    showView(els.summary);
    const answered = correctCount + wrongCount;
    els.summaryLine.textContent = `${answered} question${answered === 1 ? "" : "s"}: ✅ ${correctCount} correct · ❌ ${wrongCount} wrong`;
    const wrongEntries = answerLog.filter((a) => !a.correct);
    els.summaryBody.innerHTML = "";
    if (wrongEntries.length === 0) {
      els.summaryBody.innerHTML = answerLog.length
        ? `<tr><td colspan="3">Perfect round — no mistakes! 🎉</td></tr>`
        : `<tr><td colspan="3">No questions answered.</td></tr>`;
      return;
    }
    wrongEntries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${questionLabel(entry)}</td><td>${entry.guess || "(blank)"}</td><td>${entry.hanzi}</td>`;
      els.summaryBody.appendChild(tr);
    });
  }

  els.setupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    startPractice();
  });

  els.endBtn.addEventListener("click", endPractice);
  els.againBtn.addEventListener("click", startPractice);
  els.changeBtn.addEventListener("click", () => showView(els.setup));
  els.signinBtn.addEventListener("click", () => {
    document.getElementById("account-btn").click();
  });

  function onTabShown() {
    const user = window.vocabAuth.getUser();
    if (!user) {
      showView(els.signedOut);
      return;
    }
    ensureLessonOptions();
    syncLessonSelectFromStorage();
    syncQuestionTypeAvailability();
    if (currentView === els.signedOut) showView(els.setup);
    else showView(currentView);
  }

  window.vocabPractice = { onTabShown };
})();
