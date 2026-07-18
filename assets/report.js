(function () {
  "use strict";

  const { db, sdk } = window.vocabFirebase;

  const els = {
    signedOut: document.getElementById("report-signed-out"),
    signinBtn: document.getElementById("report-signin-btn"),
    content: document.getElementById("report-content"),
    stats: document.getElementById("report-stats"),
    adminBlock: document.getElementById("admin-block"),
    adminMembersBody: document.querySelector("#admin-members-table tbody"),
    adminLeadsBody: document.querySelector("#admin-leads-table tbody"),
    adminActivitySelect: document.getElementById("admin-activity-select"),
    adminActivityStats: document.getElementById("admin-activity-stats"),
    adminActivityBody: document.querySelector("#admin-activity-table tbody"),
    lessonTableBody: document.querySelector("#report-lesson-table tbody"),
    matchLessonSelect: document.getElementById("report-match-lesson-select"),
    matchLeaderboardBody: document.querySelector("#report-match-leaderboard-table tbody"),
    activityTableBody: document.querySelector("#report-activity-table tbody"),
    leaderboardTableBody: document.querySelector("#report-leaderboard-table tbody"),
    footerStats: document.getElementById("footer-stats"),
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

  function formatSeconds(secs) {
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(Math.round(secs % 60)).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function formatQueryError(err) {
    const msg = (err && err.message) || "";
    const urlMatch = msg.match(/https:\/\/console\.firebase\.google\.com\S*/);
    if (urlMatch) {
      return `Firestore needs an index for this — <a href="${urlMatch[0]}" target="_blank" rel="noopener">click here to create it</a>, then reload.`;
    }
    return `Couldn't load (${(err && err.code) || msg}).`;
  }

  function activityLabel(event) {
    if (event.type === "eliminate") return `💥 Mastered ${event.hanzi || ""}`;
    if (event.type === "match_complete") return `🧩 Match: ${event.pairs} pairs in ${event.seconds}s (+${event.points} pts)`;
    if (event.type === "assessment_answer")
      return event.correct ? `🏆 Assessment: correct (${event.hanzi || ""})` : `🏆 Assessment: wrong (${event.hanzi || ""})`;
    return event.type;
  }

  async function loadGlobalStats() {
    try {
      const snap = await sdk.getDoc(sdk.doc(db, "stats", "global"));
      const total = snap.exists() ? snap.data().totalMembers || 0 : 0;
      els.footerStats.textContent = `🎓 ${total} member${total === 1 ? "" : "s"} ${total === 1 ? "has" : "have"} used this site`;
    } catch (e) {
      els.footerStats.textContent = "";
    }
  }

  async function scoreGainSince(uid, since) {
    try {
      const q = sdk.query(
        sdk.collection(db, "activity"),
        sdk.where("uid", "==", uid),
        sdk.where("createdAt", ">=", since)
      );
      const snap = await sdk.getDocs(q);
      let sum = 0;
      snap.forEach((docSnap) => {
        sum += docSnap.data().points || 0;
      });
      return sum;
    } catch (e) {
      return null;
    }
  }

  function renderStats(score, gain7, gain30) {
    const tiles = [
      { label: "Mastered words", value: score.masteredCount || 0 },
      { label: "Match points", value: score.matchPoints || 0 },
      { label: "Assessment points", value: score.assessmentPoints || 0 },
      { label: "Total score", value: score.totalScore || 0 },
      { label: "Score / 7 days", value: gain7 == null ? "–" : `+${gain7}` },
      { label: "Score / 30 days", value: gain30 == null ? "–" : `+${gain30}` },
    ];
    els.stats.innerHTML = "";
    tiles.forEach((t) => {
      const div = document.createElement("div");
      div.className = "report-stat-tile";
      div.innerHTML = `<div class="value">${t.value}</div><div class="label">${t.label}</div>`;
      els.stats.appendChild(div);
    });
  }

  function getAllCards() {
    return (window.VOCAB_DATA || []).map((c, i) => Object.assign({ id: i }, c));
  }

  function getLessons() {
    return Array.from(new Set(getAllCards().map((c) => c.lesson))).sort((a, b) => a - b);
  }

  async function renderLessonBreakdown(masteredIds) {
    const allCards = getAllCards();
    const lessons = getLessons();
    const masteredSet = new Set(masteredIds || []);

    els.lessonTableBody.innerHTML = "";
    for (const lesson of lessons) {
      const cards = allCards.filter((c) => c.lesson === lesson);
      const mastered = cards.filter((c) => masteredSet.has(c.id)).length;
      let learners = "–";
      try {
        const snap = await sdk.getDoc(sdk.doc(db, "lessonStats", String(lesson)));
        learners = snap.exists() ? (snap.data().learners || []).length : 0;
      } catch (e) {
        /* leave as – */
      }
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${window.lessonLabel(lesson)}</td><td>${mastered}</td><td>${cards.length}</td><td>${learners}</td>`;
      els.lessonTableBody.appendChild(tr);
    }
  }

  function ensureMatchLessonOptions() {
    if (els.matchLessonSelect.options.length) return;
    getLessons().forEach((lesson) => {
      const opt = document.createElement("option");
      opt.value = String(lesson);
      opt.textContent = window.lessonLabel(lesson);
      els.matchLessonSelect.appendChild(opt);
    });
  }

  async function renderMatchLeaderboard(uid) {
    ensureMatchLessonOptions();
    const lesson = els.matchLessonSelect.value;
    if (!lesson) {
      els.matchLeaderboardBody.innerHTML = `<tr><td colspan="4">No lessons available.</td></tr>`;
      return;
    }
    els.matchLeaderboardBody.innerHTML = `<tr><td colspan="4">Loading…</td></tr>`;
    try {
      const q = sdk.query(
        sdk.collection(db, "lessonMatchBest"),
        sdk.where("lesson", "==", Number(lesson)),
        sdk.orderBy("secondsPerPair", "asc"),
        sdk.limit(20)
      );
      const snap = await sdk.getDocs(q);
      els.matchLeaderboardBody.innerHTML = "";
      let rank = 0;
      snap.forEach((docSnap) => {
        rank++;
        const s = docSnap.data();
        const tr = document.createElement("tr");
        if (s.uid === uid) tr.classList.add("report-me");
        tr.innerHTML = `<td>#${rank}</td><td>${s.displayName || "Member"}</td><td>${formatSeconds(
          s.bestSeconds
        )}</td><td>${s.bestPairs}</td>`;
        els.matchLeaderboardBody.appendChild(tr);
      });
      if (rank === 0) {
        els.matchLeaderboardBody.innerHTML = `<tr><td colspan="4">No match games played for this lesson yet.</td></tr>`;
      }
    } catch (err) {
      els.matchLeaderboardBody.innerHTML = `<tr><td colspan="4">${formatQueryError(err)}</td></tr>`;
    }
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
      els.activityTableBody.innerHTML = `<tr><td colspan="3">${formatQueryError(err)}</td></tr>`;
    }
  }

  async function renderLeaderboard(uid) {
    els.leaderboardTableBody.innerHTML = `<tr><td colspan="6">Loading…</td></tr>`;
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
        }</td><td>${s.assessmentPoints || 0}</td><td>${s.totalScore || 0}</td>`;
        els.leaderboardTableBody.appendChild(tr);
      });
      if (rank === 0) {
        els.leaderboardTableBody.innerHTML = `<tr><td colspan="6">No scores yet.</td></tr>`;
      }
    } catch (err) {
      els.leaderboardTableBody.innerHTML = `<tr><td colspan="6">Couldn't load leaderboard (${err.code || err.message}).</td></tr>`;
    }
  }

  let adminMembers = [];

  async function renderAdminPanel(profile) {
    if (!profile || !profile.isAdmin) {
      els.adminBlock.hidden = true;
      return;
    }
    els.adminBlock.hidden = false;
    els.adminMembersBody.innerHTML = `<tr><td colspan="6">Loading…</td></tr>`;
    try {
      const snap = await sdk.getDocs(sdk.collection(db, "users"));
      els.adminMembersBody.innerHTML = "";
      adminMembers = [];
      snap.forEach((docSnap) => {
        const u = docSnap.data();
        const uid = docSnap.id;
        adminMembers.push({ uid, displayName: u.displayName || "Member" });

        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.textContent = u.displayName || "Member";
        const tdEmail = document.createElement("td");
        tdEmail.textContent = u.email || "";
        const tdHost = document.createElement("td");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "host-toggle-btn ghost-btn" + (u.canHost ? " is-on" : "");
        btn.textContent = u.canHost ? "Host: on" : "Host: off";
        btn.addEventListener("click", async () => {
          const next = !u.canHost;
          btn.disabled = true;
          try {
            await sdk.updateDoc(sdk.doc(db, "users", uid), { canHost: next });
            u.canHost = next;
            btn.classList.toggle("is-on", next);
            btn.textContent = next ? "Host: on" : "Host: off";
          } catch (e) {
            /* ignore */
          } finally {
            btn.disabled = false;
          }
        });
        tdHost.appendChild(btn);

        const tdTrial = document.createElement("td");
        tdTrial.textContent = `${u.trialGamesPlayed || 0} / ${window.vocabPaywall ? window.vocabPaywall.FREE_GAME_LIMIT : 15}`;

        const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
        function subStatusText(member) {
          if (!member.unlockedUntil) return "Not subscribed";
          const until = new Date(member.unlockedUntil).toLocaleDateString();
          return member.unlockedUntil > Date.now() ? `Active until ${until}` : `Expired ${until}`;
        }

        const tdSub = document.createElement("td");
        tdSub.textContent = subStatusText(u);

        const tdSubActions = document.createElement("td");
        const renewBtn = document.createElement("button");
        renewBtn.type = "button";
        renewBtn.className = "host-toggle-btn ghost-btn";
        renewBtn.textContent = "+1 Year";
        renewBtn.addEventListener("click", async () => {
          renewBtn.disabled = true;
          try {
            const base = u.unlockedUntil && u.unlockedUntil > Date.now() ? u.unlockedUntil : Date.now();
            const next = base + YEAR_MS;
            await sdk.updateDoc(sdk.doc(db, "users", uid), { unlockedUntil: next });
            u.unlockedUntil = next;
            tdSub.textContent = subStatusText(u);
          } catch (e) {
            /* ignore */
          } finally {
            renewBtn.disabled = false;
          }
        });
        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.className = "host-toggle-btn ghost-btn";
        clearBtn.textContent = "Clear";
        clearBtn.addEventListener("click", async () => {
          clearBtn.disabled = true;
          try {
            await sdk.updateDoc(sdk.doc(db, "users", uid), { unlockedUntil: null });
            u.unlockedUntil = null;
            tdSub.textContent = subStatusText(u);
          } catch (e) {
            /* ignore */
          } finally {
            clearBtn.disabled = false;
          }
        });
        tdSubActions.appendChild(renewBtn);
        tdSubActions.appendChild(clearBtn);

        tr.appendChild(td);
        tr.appendChild(tdEmail);
        tr.appendChild(tdHost);
        tr.appendChild(tdTrial);
        tr.appendChild(tdSub);
        tr.appendChild(tdSubActions);
        els.adminMembersBody.appendChild(tr);
      });

      els.adminActivitySelect.innerHTML = "";
      adminMembers.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.uid;
        opt.textContent = m.displayName;
        els.adminActivitySelect.appendChild(opt);
      });
      if (adminMembers.length) renderMemberActivity(adminMembers[0].uid);
    } catch (err) {
      els.adminMembersBody.innerHTML = `<tr><td colspan="6">Couldn't load members (${err.code || err.message}).</td></tr>`;
    }

    renderAdminLeads();
  }

  async function renderAdminLeads() {
    els.adminLeadsBody.innerHTML = `<tr><td colspan="5">Loading…</td></tr>`;
    try {
      const q = sdk.query(sdk.collection(db, "leads"), sdk.orderBy("createdAt", "desc"), sdk.limit(50));
      const snap = await sdk.getDocs(q);
      els.adminLeadsBody.innerHTML = "";
      if (snap.empty) {
        els.adminLeadsBody.innerHTML = `<tr><td colspan="5">No leads yet.</td></tr>`;
        return;
      }
      snap.forEach((docSnap) => {
        const l = docSnap.data();
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${formatWhen(l.createdAt)}</td><td>${l.name || ""}</td><td>${l.phone || ""}</td><td>${
          l.wechat || ""
        }</td><td>${l.contactEmail || l.loginEmail || ""}</td>`;
        els.adminLeadsBody.appendChild(tr);
      });
    } catch (err) {
      els.adminLeadsBody.innerHTML = `<tr><td colspan="5">${formatQueryError(err)}</td></tr>`;
    }
  }

  async function renderMemberActivity(uid) {
    const member = adminMembers.find((m) => m.uid === uid);
    els.adminActivityStats.innerHTML = "";
    els.adminActivityBody.innerHTML = `<tr><td colspan="3">Loading…</td></tr>`;

    try {
      const scoreSnap = await sdk.getDoc(sdk.doc(db, "scores", uid));
      const score = scoreSnap.exists()
        ? scoreSnap.data()
        : { masteredCount: 0, matchPoints: 0, totalScore: 0 };
      const tiles = [
        { label: "Mastered words", value: score.masteredCount || 0 },
        { label: "Match points", value: score.matchPoints || 0 },
        { label: "Total score", value: score.totalScore || 0 },
      ];
      tiles.forEach((t) => {
        const div = document.createElement("div");
        div.className = "report-stat-tile";
        div.innerHTML = `<div class="value">${t.value}</div><div class="label">${t.label}</div>`;
        els.adminActivityStats.appendChild(div);
      });
    } catch (e) {
      /* leave stats empty */
    }

    try {
      const q = sdk.query(
        sdk.collection(db, "activity"),
        sdk.where("uid", "==", uid),
        sdk.orderBy("createdAt", "desc"),
        sdk.limit(30)
      );
      const snap = await sdk.getDocs(q);
      els.adminActivityBody.innerHTML = "";
      if (snap.empty) {
        els.adminActivityBody.innerHTML = `<tr><td colspan="3">${
          member ? member.displayName : "This member"
        } hasn't done any activity yet.</td></tr>`;
        return;
      }
      snap.forEach((docSnap) => {
        const e = docSnap.data();
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${formatWhen(e.createdAt)}</td><td>${activityLabel(e)}</td><td>${e.lesson}</td>`;
        els.adminActivityBody.appendChild(tr);
      });
    } catch (err) {
      els.adminActivityBody.innerHTML = `<tr><td colspan="3">${formatQueryError(err)}</td></tr>`;
    }
  }

  els.adminActivitySelect.addEventListener("change", (e) => renderMemberActivity(e.target.value));

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

    const now = Date.now();
    const since7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const [gain7, gain30] = await Promise.all([scoreGainSince(user.uid, since7), scoreGainSince(user.uid, since30)]);

    renderStats(score, gain7, gain30);
    renderAdminPanel(window.vocabAuth.getProfile());
    renderLessonBreakdown(score.masteredIds);
    renderMatchLeaderboard(user.uid);
    renderActivity(user.uid);
    renderLeaderboard(user.uid);
  }

  els.matchLessonSelect.addEventListener("change", () => {
    const user = window.vocabAuth.getUser();
    if (user) renderMatchLeaderboard(user.uid);
  });

  window.vocabReport = { refresh };

  window.vocabAuth.onChange(() => {
    const reportView = document.getElementById("report-view");
    if (!reportView.hidden) refresh();
  });

  loadGlobalStats();
})();
