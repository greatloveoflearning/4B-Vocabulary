(function () {
  "use strict";

  const { db, sdk } = window.vocabFirebase;
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

  const els = {
    signedOut: document.getElementById("assessment-signed-out"),
    signinBtn: document.getElementById("assessment-signin-btn"),
    home: document.getElementById("assessment-home"),
    hostEntryCard: document.getElementById("host-entry-card"),
    joinForm: document.getElementById("join-form"),
    joinCodeInput: document.getElementById("join-code-input"),
    joinError: document.getElementById("join-error"),
    hostNewBtn: document.getElementById("host-new-btn"),

    hostSetup: document.getElementById("assessment-host-setup"),
    hostSetupForm: document.getElementById("host-setup-form"),
    hostLessonSelect: document.getElementById("host-lesson-select"),
    hostQuestionTypeSelect: document.getElementById("host-question-type-select"),
    hostDurationSelect: document.getElementById("host-duration-select"),
    hostPlayCheckbox: document.getElementById("host-play-checkbox"),
    hostSetupCancelBtn: document.getElementById("host-setup-cancel-btn"),

    lobby: document.getElementById("assessment-lobby"),
    lobbyCode: document.getElementById("lobby-code"),
    lobbyInfo: document.getElementById("lobby-info"),
    lobbyPlayersBody: document.getElementById("lobby-players-body"),
    lobbyStartBtn: document.getElementById("lobby-start-btn"),
    lobbyLeaveBtn: document.getElementById("lobby-leave-btn"),

    running: document.getElementById("assessment-running"),
    runningTimer: document.getElementById("running-timer"),
    runningScore: document.getElementById("running-score"),
    questionSpeakRow: document.getElementById("question-speak-row"),
    questionSpeakCnBtn: document.getElementById("question-speak-cn-btn"),
    questionSpeakEnBtn: document.getElementById("question-speak-en-btn"),
    questionPrompt: document.getElementById("question-prompt"),
    answerForm: document.getElementById("answer-form"),
    answerInput: document.getElementById("answer-input"),
    answerFeedback: document.getElementById("answer-feedback"),
    questionCard: document.getElementById("assessment-question"),
    spectating: document.getElementById("assessment-spectating"),
    runningLeaderboardBody: document.querySelector("#running-leaderboard-table tbody"),

    results: document.getElementById("assessment-results"),
    podium: document.getElementById("podium"),
    assessmentPercentile: document.getElementById("assessment-percentile"),
    resultsBody: document.querySelector("#results-table tbody"),
    hostAgainBtn: document.getElementById("host-again-btn"),
    resultsLeaveBtn: document.getElementById("results-leave-btn"),

    studentOverviewList: document.getElementById("student-overview-list"),
  };

  const views = [els.signedOut, els.home, els.hostSetup, els.lobby, els.running, els.results];
  function showView(view) {
    views.forEach((v) => (v.hidden = v !== view));
  }

  // ---------- session state ----------

  let sessionId = null;
  let sessionData = null;
  let isHost = false;
  let isPlaying = true;
  let unsubSession = null;
  let unsubPlayers = null;
  let latestPlayers = [];

  let currentQuestion = null;
  let lastCardId = null;
  let timerInterval = null;
  let hasEnded = false;

  function getAllCards() {
    return (window.VOCAB_DATA || []).map((c, i) => Object.assign({ id: i }, c));
  }

  function generateCode() {
    let code = "";
    for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return code;
  }

  function cleanupListeners() {
    if (unsubSession) unsubSession();
    if (unsubPlayers) unsubPlayers();
    unsubSession = null;
    unsubPlayers = null;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }

  function resetToHome() {
    cleanupListeners();
    sessionId = null;
    sessionData = null;
    isHost = false;
    isPlaying = true;
    hasEnded = false;
    els.joinCodeInput.value = "";
    els.joinError.hidden = true;
    renderHome();
  }

  function renderHome() {
    const profile = window.vocabAuth.getProfile();
    els.hostEntryCard.hidden = !(profile && (profile.isAdmin || profile.canHost));
    showView(els.home);
  }

  // ---------- host setup ----------

  function ensureHostLessonOptions() {
    if (els.hostLessonSelect.options.length) return;
    window.getSortedLessonIds(getAllCards()).forEach((lesson) => {
      const opt = document.createElement("option");
      opt.value = String(lesson);
      opt.textContent = window.lessonLabel(lesson);
      els.hostLessonSelect.appendChild(opt);
    });
  }

  function syncHostQuestionTypeAvailability() {
    const value = els.hostLessonSelect.value;
    const restricted = window.TYPE1_ONLY_LESSONS && window.TYPE1_ONLY_LESSONS.has(Number(value));
    Array.from(els.hostQuestionTypeSelect.options).forEach((opt) => {
      opt.disabled = restricted && opt.value !== "1";
    });
    if (restricted) els.hostQuestionTypeSelect.value = "1";
  }

  els.hostLessonSelect.addEventListener("change", syncHostQuestionTypeAvailability);

  els.hostNewBtn.addEventListener("click", () => {
    ensureHostLessonOptions();
    syncHostQuestionTypeAvailability();
    showView(els.hostSetup);
  });

  els.hostSetupCancelBtn.addEventListener("click", renderHome);

  els.hostSetupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = window.vocabAuth.getUser();
    if (!user) return;

    const lesson = Number(els.hostLessonSelect.value);
    const questionType =
      window.TYPE1_ONLY_LESSONS && window.TYPE1_ONLY_LESSONS.has(lesson) ? "1" : els.hostQuestionTypeSelect.value;
    const durationSeconds = Number(els.hostDurationSelect.value);
    const code = generateCode();

    await sdk.setDoc(sdk.doc(db, "sessions", code), {
      hostUid: user.uid,
      hostName: user.displayName || user.email,
      lesson,
      questionType,
      durationSeconds,
      status: "lobby",
      createdAt: sdk.serverTimestamp(),
    });

    await joinSession(code, true, els.hostPlayCheckbox.checked);
  });

  // ---------- join ----------

  els.joinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = els.joinCodeInput.value.trim().toUpperCase();
    if (!code) return;
    els.joinError.hidden = true;
    try {
      const snap = await sdk.getDoc(sdk.doc(db, "sessions", code));
      if (!snap.exists()) {
        els.joinError.textContent = "Room not found — check the code.";
        els.joinError.hidden = false;
        return;
      }
      if (snap.data().status !== "lobby") {
        els.joinError.textContent = "This game has already started or finished.";
        els.joinError.hidden = false;
        return;
      }
      await joinSession(code, false);
    } catch (err) {
      els.joinError.textContent = "Couldn't join that room. Please try again.";
      els.joinError.hidden = false;
    }
  });

  async function joinSession(code, asHost, asPlayer) {
    const user = window.vocabAuth.getUser();
    if (!user) return;

    sessionId = code;
    isHost = asHost;
    isPlaying = asPlayer !== false;
    hasEnded = false;

    if (isPlaying) {
      const playerRef = sdk.doc(db, "sessions", code, "players", user.uid);
      const existing = await sdk.getDoc(playerRef);
      if (!existing.exists()) {
        await sdk.setDoc(playerRef, {
          displayName: user.displayName || user.email,
          score: 0,
          answered: 0,
          joinedAt: sdk.serverTimestamp(),
        });
      }
    }

    subscribeSession();
    subscribePlayers();
  }

  function subscribeSession() {
    if (unsubSession) unsubSession();
    unsubSession = sdk.onSnapshot(sdk.doc(db, "sessions", sessionId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const prevStatus = sessionData && sessionData.status;
      sessionData = data;

      if (data.status === "lobby") {
        renderLobby();
      } else if (data.status === "running" && prevStatus !== "running") {
        enterRunning();
      } else if (data.status === "finished" && !hasEnded) {
        enterResults();
      }
    });
  }

  function subscribePlayers() {
    if (unsubPlayers) unsubPlayers();
    const q = sdk.query(sdk.collection(db, "sessions", sessionId, "players"));
    unsubPlayers = sdk.onSnapshot(q, (snap) => {
      latestPlayers = [];
      snap.forEach((docSnap) => latestPlayers.push(Object.assign({ uid: docSnap.id }, docSnap.data())));
      latestPlayers.sort((a, b) => (b.score || 0) - (a.score || 0));
      if (sessionData && sessionData.status === "lobby") renderLobbyPlayers();
      if (sessionData && sessionData.status === "running") renderRunningLeaderboard();
    });
  }

  // ---------- lobby ----------

  function renderLobby() {
    showView(els.lobby);
    els.lobbyCode.textContent = sessionId;
    els.lobbyInfo.textContent = `${window.lessonLabel(sessionData.lesson)} · ${questionTypeLabel(
      sessionData.questionType
    )} · ${sessionData.durationSeconds}s`;
    els.lobbyStartBtn.hidden = !isHost;
    renderLobbyPlayers();
  }

  function renderLobbyPlayers() {
    els.lobbyPlayersBody.innerHTML = "";
    if (latestPlayers.length === 0) {
      els.lobbyPlayersBody.innerHTML = `<tr><td>Waiting for players…</td></tr>`;
      return;
    }
    latestPlayers.forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${p.displayName}${p.uid === sessionData.hostUid ? " (host)" : ""}</td>`;
      els.lobbyPlayersBody.appendChild(tr);
    });
  }

  function questionTypeLabel(type) {
    if (type === "1") return "Type 1";
    if (type === "2") return "Type 2";
    return "Mixed";
  }

  els.lobbyStartBtn.addEventListener("click", async () => {
    const now = Date.now();
    await sdk.updateDoc(sdk.doc(db, "sessions", sessionId), {
      status: "running",
      startedAt: new Date(now),
      endsAt: new Date(now + sessionData.durationSeconds * 1000),
    });
  });

  els.lobbyLeaveBtn.addEventListener("click", async () => {
    await leaveSession();
  });

  async function leaveSession() {
    const user = window.vocabAuth.getUser();
    if (user && sessionId) {
      try {
        await sdk.deleteDoc(sdk.doc(db, "sessions", sessionId, "players", user.uid));
      } catch (e) {
        /* ignore */
      }
    }
    resetToHome();
  }

  els.resultsLeaveBtn.addEventListener("click", leaveSession);

  // ---------- running ----------

  function pickQuestionType() {
    if (window.TYPE1_ONLY_LESSONS && window.TYPE1_ONLY_LESSONS.has(sessionData.lesson)) return "1";
    if (sessionData.questionType === "mixed") return Math.random() < 0.5 ? "1" : "2";
    return sessionData.questionType;
  }

  function nextQuestion() {
    const pool = window.getCardsForLessonValue(getAllCards(), sessionData.lesson);
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
    return { card, type: pickQuestionType() };
  }

  function renderQuestion() {
    currentQuestion = nextQuestion();
    els.answerInput.value = "";
    els.answerFeedback.hidden = true;
    if (!currentQuestion) {
      els.questionPrompt.textContent = "No words available for this lesson.";
      return;
    }
    const { card, type } = currentQuestion;
    if (type === "1") {
      els.questionSpeakRow.hidden = true;
      els.questionPrompt.innerHTML = `<span class="hanzi no-copy">${card.hanzi}</span>`;
    } else {
      const blanked = card.example_cn && card.example_cn.includes(card.hanzi)
        ? card.example_cn.replace(card.hanzi, '<span class="blank">（　）</span>')
        : `<span class="blank">（　）</span>${card.example_cn || ""}`;
      els.questionSpeakRow.hidden = false;
      els.questionSpeakCnBtn.hidden = false;
      els.questionSpeakEnBtn.hidden = false;
      els.questionPrompt.innerHTML = `<span class="meaning no-copy">${card.meaning}</span>${blanked}<span class="en-sentence no-copy">${
        card.example_en || ""
      }</span>`;
    }
    els.answerInput.focus();
  }

  ["copy", "cut", "contextmenu", "selectstart", "dragstart"].forEach((evt) => {
    els.questionPrompt.addEventListener(evt, (e) => e.preventDefault());
  });

  els.questionSpeakCnBtn.addEventListener("click", () => {
    if (!currentQuestion || currentQuestion.type === "1") return;
    const { card } = currentQuestion;
    window.vocabAudio.speak(`${card.example_cn || ""}`, "zh-CN");
  });

  els.questionSpeakEnBtn.addEventListener("click", () => {
    if (!currentQuestion) return;
    const { card } = currentQuestion;
    window.vocabAudio.speak(`${card.meaning}. ${card.example_en || ""}`, "en-US");
  });

  els.answerInput.addEventListener("paste", (e) => {
    if (currentQuestion && currentQuestion.type === "1") e.preventDefault();
  });

  els.answerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isPlaying || !currentQuestion || hasEnded) return;
    const guess = els.answerInput.value.trim();
    const { card, type } = currentQuestion;
    const correct = guess === card.hanzi;

    if (correct) {
      window.vocabAudio.playCorrectSound();
      els.answerFeedback.textContent = "✅ Correct!";
      els.answerFeedback.className = "answer-feedback correct";
    } else {
      window.vocabAudio.playWrongSound();
      els.answerFeedback.textContent = `❌ Answer: ${card.hanzi}`;
      els.answerFeedback.className = "answer-feedback wrong";
    }
    els.answerFeedback.hidden = false;
    if (window.vocabActivity) window.vocabActivity.recordAssessmentAnswer(sessionData.lesson, card, correct);
    recordAnswer(correct ? 1 : 0, {
      cardId: card.id,
      hanzi: card.hanzi,
      meaning: card.meaning,
      exampleCn: card.example_cn || "",
      exampleEn: card.example_en || "",
      type,
      guess,
      correct,
    });
    setTimeout(() => {
      if (!hasEnded) renderQuestion();
    }, 500);
  });

  let localScore = 0;
  function recordAnswer(delta, entry) {
    localScore += delta;
    els.runningScore.textContent = `Score: ${localScore}`;
    const user = window.vocabAuth.getUser();
    if (!user) return;
    sdk
      .updateDoc(sdk.doc(db, "sessions", sessionId, "players", user.uid), {
        score: sdk.increment(delta),
        answered: sdk.increment(1),
        lastAnswerAt: sdk.serverTimestamp(),
        answerLog: sdk.arrayUnion(entry),
      })
      .catch(() => {});
  }

  function renderRunningLeaderboard() {
    els.runningLeaderboardBody.innerHTML = "";
    const user = window.vocabAuth.getUser();
    latestPlayers.slice(0, 20).forEach((p, i) => {
      const tr = document.createElement("tr");
      if (user && p.uid === user.uid) tr.classList.add("report-me");
      tr.innerHTML = `<td>#${i + 1}</td><td>${p.displayName}</td><td>${p.score || 0}</td>`;
      els.runningLeaderboardBody.appendChild(tr);
    });
  }

  let timerFinishAttempted = false;

  function enterRunning() {
    hasEnded = false;
    timerFinishAttempted = false;
    localScore = 0;
    lastCardId = null;
    els.runningScore.textContent = "Score: 0";
    els.runningScore.hidden = !isPlaying;
    els.questionCard.hidden = !isPlaying;
    els.spectating.hidden = isPlaying;
    showView(els.running);
    if (isPlaying) renderQuestion();
    renderRunningLeaderboard();
    startTimer();
  }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    const endsAt = sessionData.endsAt && sessionData.endsAt.toDate ? sessionData.endsAt.toDate() : new Date(sessionData.endsAt);

    function tick() {
      const remainingMs = endsAt.getTime() - Date.now();
      const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
      const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
      const ss = String(remaining % 60).padStart(2, "0");
      els.runningTimer.textContent = `${mm}:${ss}`;
      if (remainingMs <= 0 && !timerFinishAttempted) {
        timerFinishAttempted = true;
        clearInterval(timerInterval);
        sdk
          .updateDoc(sdk.doc(db, "sessions", sessionId), { status: "finished" })
          .catch(() => {});
      }
    }
    tick();
    timerInterval = setInterval(tick, 250);
  }

  // ---------- results ----------

  async function updateAssessmentBestAndGetPercentile(lesson, uid, displayName, score) {
    const ref = sdk.doc(db, "assessmentBest", `${lesson}_${uid}`);
    try {
      await sdk.runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const existing = snap.exists() ? snap.data().bestScore : -1;
        if (score > existing) {
          tx.set(ref, { uid, displayName, lesson: Number(lesson), bestScore: score, updatedAt: sdk.serverTimestamp() });
        }
      });
    } catch (e) {
      /* ignore */
    }

    try {
      const q = sdk.query(sdk.collection(db, "assessmentBest"), sdk.where("lesson", "==", Number(lesson)));
      const snap = await sdk.getDocs(q);
      let total = 0;
      let beaten = 0;
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.uid === uid) return;
        total++;
        if (d.bestScore < score) beaten++;
      });
      if (total === 0) return null;
      return Math.round((beaten / total) * 100);
    } catch (e) {
      return null;
    }
  }

  async function enterResults() {
    hasEnded = true;
    if (timerInterval) clearInterval(timerInterval);
    if (isPlaying && window.vocabPaywall) window.vocabPaywall.recordGamePlayed();
    showView(els.results);
    els.hostAgainBtn.hidden = !isHost;
    els.assessmentPercentile.textContent = "";

    let players = latestPlayers;
    try {
      const q = sdk.query(sdk.collection(db, "sessions", sessionId, "players"), sdk.orderBy("score", "desc"), sdk.limit(200));
      const snap = await sdk.getDocs(q);
      players = [];
      snap.forEach((docSnap) => players.push(Object.assign({ uid: docSnap.id }, docSnap.data())));
    } catch (e) {
      players = latestPlayers.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    renderPodium(players);
    renderResultsTable(players);
    renderAnswerReportOptions(players);

    const user = window.vocabAuth.getUser();
    const me = user && players.find((p) => p.uid === user.uid);
    if (user && me && sessionData) {
      const percentile = await updateAssessmentBestAndGetPercentile(
        sessionData.lesson,
        user.uid,
        me.displayName,
        me.score || 0
      );
      if (percentile != null) {
        els.assessmentPercentile.textContent = `🎉 You beat ${percentile}% of everyone who's played this lesson!`;
      } else {
        els.assessmentPercentile.textContent = "🎉 You're the first to play this lesson!";
      }
    }
  }

  function renderPodium(players) {
    els.podium.innerHTML = "";
    const order = [
      { place: players[1], cls: "silver", medal: "🥈" },
      { place: players[0], cls: "gold", medal: "🥇" },
      { place: players[2], cls: "bronze", medal: "🥉" },
    ];
    order.forEach((entry) => {
      const div = document.createElement("div");
      div.className = `podium-place ${entry.cls}`;
      if (entry.place) {
        div.innerHTML = `<div class="podium-name">${entry.place.displayName}</div><div class="podium-score">${
          entry.place.score || 0
        } pts</div><div class="podium-bar">${entry.medal}</div>`;
      } else {
        div.innerHTML = `<div class="podium-name">–</div><div class="podium-score"></div><div class="podium-bar">${entry.medal}</div>`;
      }
      els.podium.appendChild(div);
    });
  }

  function renderResultsTable(players) {
    els.resultsBody.innerHTML = "";
    const user = window.vocabAuth.getUser();
    players.forEach((p, i) => {
      const tr = document.createElement("tr");
      if (user && p.uid === user.uid) tr.classList.add("report-me");
      tr.innerHTML = `<td>#${i + 1}</td><td>${p.displayName}</td><td>${p.score || 0}</td>`;
      els.resultsBody.appendChild(tr);
    });
    if (players.length === 0) {
      els.resultsBody.innerHTML = `<tr><td colspan="3">No players.</td></tr>`;
    }
  }

  function renderAnswerReportOptions(players) {
    renderStudentOverview(players);
  }

  function questionLabel(entry) {
    if (entry.type === "1") return entry.hanzi;
    const blanked =
      entry.exampleCn && entry.exampleCn.includes(entry.hanzi)
        ? entry.exampleCn.replace(entry.hanzi, "（　）")
        : `（　）${entry.exampleCn || ""}`;
    return `${entry.meaning} — ${blanked}`;
  }

  function renderStudentOverview(players) {
    const container = els.studentOverviewList;
    container.innerHTML = "";
    if (players.length === 0) {
      container.innerHTML = `<p class="report-block-note">No players.</p>`;
      return;
    }

    const user = window.vocabAuth.getUser();
    players.forEach((p) => {
      const log = p.answerLog || [];
      const correctCount = log.filter((a) => a.correct).length;
      const wrongEntries = log.filter((a) => !a.correct);
      const accuracy = log.length ? Math.round((correctCount / log.length) * 100) : 0;

      const row = document.createElement("div");
      row.className = "student-row";
      if (user && p.uid === user.uid) row.classList.add("report-me");

      const main = document.createElement("div");
      main.className = "student-row-main";
      main.innerHTML = `
        <div class="student-name">${p.displayName}</div>
        <div class="student-stats">
          <div class="stat-tile stat-correct" title="Correct">${correctCount}</div>
          <button type="button" class="stat-tile stat-wrong" title="Wrong — click to see which"${
            wrongEntries.length ? "" : " disabled"
          }>${wrongEntries.length}</button>
          <div class="stat-tile stat-accuracy" title="Accuracy">${accuracy}%</div>
        </div>`;
      row.appendChild(main);

      const panel = document.createElement("div");
      panel.className = "student-wrong-panel";
      panel.hidden = true;
      if (wrongEntries.length) {
        const wrap = document.createElement("div");
        wrap.className = "report-table-wrap";
        const table = document.createElement("table");
        table.className = "report-table";
        table.innerHTML = `<thead><tr><th>Question</th><th>Their answer</th><th>Correct answer</th></tr></thead><tbody></tbody>`;
        const tbody = table.querySelector("tbody");
        wrongEntries.forEach((entry) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td>${questionLabel(entry)}</td><td>${entry.guess || "(blank)"}</td><td>${entry.hanzi}</td>`;
          tbody.appendChild(tr);
        });
        wrap.appendChild(table);
        panel.appendChild(wrap);
      }
      row.appendChild(panel);

      const wrongBtn = main.querySelector(".stat-wrong");
      wrongBtn.addEventListener("click", () => {
        panel.hidden = !panel.hidden;
      });

      container.appendChild(row);
    });
  }

  els.hostAgainBtn.addEventListener("click", async () => {
    await leaveSession();
    ensureHostLessonOptions();
    showView(els.hostSetup);
  });

  // ---------- entry point ----------

  els.signinBtn.addEventListener("click", () => {
    document.getElementById("account-btn").click();
  });

  function onTabShown() {
    const user = window.vocabAuth.getUser();
    if (!user) {
      showView(els.signedOut);
      return;
    }
    if (sessionId && sessionData) {
      if (sessionData.status === "lobby") renderLobby();
      else if (sessionData.status === "running") showView(els.running);
      else if (sessionData.status === "finished") showView(els.results);
      else renderHome();
    } else {
      renderHome();
    }
  }

  window.vocabAssessment = { onTabShown };

  window.vocabAuth.onChange((user) => {
    if (!user) resetToHome();
  });
})();
