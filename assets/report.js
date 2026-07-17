(function () {
  "use strict";

  const { db, sdk } = window.vocabFirebase;

  const els = {
    signedOut: document.getElementById("report-signed-out"),
    signinBtn: document.getElementById("report-signin-btn"),
    content: document.getElementById("report-content"),
    stats: document.getElementById("report-stats"),
    lessonTableBody: document.querySelector("#report-lesson-table tbody"),
    activityTableBody: document.querySelector("#report-activity-table tbody"),
    leaderboardTableBody: document.querySelector("#report-leaderboard-table tbody"),
  };

  els.signinBtn.addEventListener("click", () => {
    document.getElementById("account-btn").click();
  });

  function formatWhen(ts) {
    if (!ts || !ts.toDate) return "just now";
    const d = ts.toDate();
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function activityLabel(event) {
    if (event.type === "eliminate") return `💥 Mastered ${event.hanzi || ""}`;
    if (event.type === "match_complete") return `🧩 Match: ${event.pairs} pairs in ${event.seconds}s (+${event.points} pts)`;
    return event.type;
  }

  function renderStats(score) {
    const tiles = [
      { label: "Mastered words", value: score.masteredCount || 0 },
      { label: "Match points", value: score.matchPoints || 0 },
      { label: "Total score", value: score.totalScore || 0 },
    ];
    els.stats.innerHTML = "";
    tiles.forEach((t) => {
      const div = document.createElement("div");
      div.className = "report-stat-tile";
      div.innerHTML = `<div class="value">${t.value}</div><div class="label">${t.label}</div>`;
      els.stats.appendChild(div);
    });
  }

  function renderLessonBreakdown(masteredIds) {
    const allCards = (window.VOCAB_DATA || []).map((c, i) => Object.assign({ id: i }, c));
    const lessons = Array.from(new Set(allCards.map((c) => c.lesson))).sort((a, b) => a - b);
    const masteredSet = new Set(masteredIds || []);

    els.lessonTableBody.innerHTML = "";
    lessons.forEach((lesson) => {
      const cards = allCards.filter((c) => c.lesson === lesson);
      const mastered = cards.filter((c) => masteredSet.has(c.id)).length;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>Lesson ${lesson}</td><td>${mastered}</td><td>${cards.length}</td>`;
      els.lessonTableBody.appendChild(tr);
    });
  }

  async function renderActivity(uid) {
    els.activityTableBody.innerHTML = `<tr><td colspan="3">Loading…</td></tr>`;
    try {
      const q = sdk.query(
        sdk.collection(db, "activity"),
        sdk.where("uid", "==", uid),
        sdk.orderBy("createdAt", "desc"),
        sdk.limit(20)
      );
      const snap = await sdk.getDocs(q);
      els.activityTableBody.innerHTML = "";
      if (snap.empty) {
        els.activityTableBody.innerHTML = `<tr><td colspan="3">No activity yet — start studying!</td></tr>`;
        return;
      }
      snap.forEach((docSnap) => {
        const e = docSnap.data();
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${formatWhen(e.createdAt)}</td><td>${activityLabel(e)}</td><td>${e.lesson}</td>`;
        els.activityTableBody.appendChild(tr);
      });
    } catch (err) {
      els.activityTableBody.innerHTML = `<tr><td colspan="3">Couldn't load activity (${err.code || err.message}).</td></tr>`;
    }
  }

  async function renderLeaderboard(uid) {
    els.leaderboardTableBody.innerHTML = `<tr><td colspan="5">Loading…</td></tr>`;
    try {
      const q = sdk.query(sdk.collection(db, "scores"), sdk.orderBy("totalScore", "desc"), sdk.limit(50));
      const snap = await sdk.getDocs(q);
      els.leaderboardTableBody.innerHTML = "";
      let rank = 0;
      snap.forEach((docSnap) => {
        rank++;
        const s = docSnap.data();
        const tr = document.createElement("tr");
        if (docSnap.id === uid) tr.classList.add("report-me");
        tr.innerHTML = `<td>#${rank}</td><td>${s.displayName || "Member"}</td><td>${s.masteredCount || 0}</td><td>${
          s.matchPoints || 0
        }</td><td>${s.totalScore || 0}</td>`;
        els.leaderboardTableBody.appendChild(tr);
      });
      if (rank === 0) {
        els.leaderboardTableBody.innerHTML = `<tr><td colspan="5">No scores yet.</td></tr>`;
      }
    } catch (err) {
      els.leaderboardTableBody.innerHTML = `<tr><td colspan="5">Couldn't load leaderboard (${err.code || err.message}).</td></tr>`;
    }
  }

  async function refresh() {
    const user = window.vocabAuth.getUser();
    if (!user) {
      els.signedOut.hidden = false;
      els.content.hidden = true;
      return;
    }
    els.signedOut.hidden = true;
    els.content.hidden = false;

    const scoreSnap = await sdk.getDoc(sdk.doc(db, "scores", user.uid));
    const score = scoreSnap.exists() ? scoreSnap.data() : { masteredCount: 0, matchPoints: 0, totalScore: 0, masteredIds: [] };

    renderStats(score);
    renderLessonBreakdown(score.masteredIds);
    renderActivity(user.uid);
    renderLeaderboard(user.uid);
  }

  window.vocabReport = { refresh };

  window.vocabAuth.onChange(() => {
    const reportView = document.getElementById("report-view");
    if (!reportView.hidden) refresh();
  });
})();
