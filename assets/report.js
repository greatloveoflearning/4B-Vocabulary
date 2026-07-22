(function () {
  "use strict";

  const { db, sdk } = window.vocabFirebase;

  const els = {
    signedOut: document.getElementById("report-signed-out"),
    signinBtn: document.getElementById("report-signin-btn"),
    content: document.getElementById("report-content"),
    stats: document.getElementById("report-stats"),
    adminBlockTop: document.getElementById("admin-block-top"),
    adminBlockBottom: document.getElementById("admin-block-bottom"),
    adminTypingBlock: document.getElementById("admin-typing-block"),
    adminMembersBody: document.querySelector("#admin-members-table tbody"),
    adminLeadsBody: document.querySelector("#admin-leads-table tbody"),
    adminLeadsAddBtn: document.getElementById("admin-leads-add-btn"),
    adminLeadsExportBtn: document.getElementById("admin-leads-export-btn"),
    adminClassInterestBody: document.querySelector("#admin-class-interest-table tbody"),
    adminClassInterestAddBtn: document.getElementById("admin-class-interest-add-btn"),
    adminClassInterestExportBtn: document.getElementById("admin-class-interest-export-btn"),
    adminActivitySelect: document.getElementById("admin-activity-select"),
    adminActivityStats: document.getElementById("admin-activity-stats"),
    adminActivityBody: document.querySelector("#admin-activity-table tbody"),
    adminTypingStatsBody: document.querySelector("#admin-typing-stats-table tbody"),
    adminProgressBody: document.querySelector("#admin-progress-table tbody"),
    lessonTableBody: document.querySelector("#report-lesson-table tbody"),
    matchLessonSelect: document.getElementById("report-match-lesson-select"),
    matchLeaderboardBody: document.querySelector("#report-match-leaderboard-table tbody"),
    activityTableBody: document.querySelector("#report-activity-table tbody"),
    leaderboardTableBody: document.querySelector("#report-leaderboard-table tbody"),
    footerStats: document.getElementById("footer-stats"),
  };

  els.signinBtn.addEventListener("click", (e) => {
    e.stopPropagation();
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
    if (event.type === "practice_complete") {
      const typeLabel = event.questionType === "mixed" ? "Mixed" : `Type ${event.questionType || ""}`;
      return `📝 Practice (${typeLabel}): ✅ ${event.correctCount || 0} · ❌ ${event.wrongCount || 0}`;
    }
    if (event.type === "typing_test_complete") {
      const cpm = Math.round(((event.correctCount || 0) / Math.max(1, event.elapsedSeconds || 1)) * 60);
      return `⌨️ Typing Test (${event.articleTitle || ""}): ✅ ${event.correctCount || 0} · ❌ ${
        event.wrongCount || 0
      } · ${cpm} CPM`;
    }
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
    const lessons = window.sortLessonIds(getLessons());
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
    window.getSortedLessonIds(getAllCards()).forEach((lesson) => {
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
        sdk.where("type", "in", ["match_complete", "practice_complete", "typing_test_complete"]),
        sdk.orderBy("createdAt", "desc"),
        sdk.limit(20)
      );
      const snap = await sdk.getDocs(q);
      els.activityTableBody.innerHTML = "";
      if (snap.empty) {
        els.activityTableBody.innerHTML = `<tr><td colspan="3">No Match, Practice, or Typing Test activity yet — start studying!</td></tr>`;
        return;
      }
      snap.forEach((docSnap) => {
        const e = docSnap.data();
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${formatWhen(e.createdAt)}</td><td>${activityLabel(e)}</td><td>${window.lessonLabel(e.lesson)}</td>`;
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
      els.adminBlockTop.hidden = true;
      els.adminBlockBottom.hidden = true;
      if (els.adminTypingBlock) els.adminTypingBlock.hidden = true;
      return;
    }
    els.adminBlockTop.hidden = false;
    els.adminBlockBottom.hidden = false;
    if (els.adminTypingBlock) els.adminTypingBlock.hidden = false;
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
        td.textContent = (u.banned ? "🚫 " : "") + (u.displayName || "Member");
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
        tdTrial.textContent = `${u.trialGamesPlayed || 0} / ${window.vocabPaywall ? window.vocabPaywall.FREE_GAME_LIMIT : 50}`;

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
        const banBtn = document.createElement("button");
        banBtn.type = "button";
        banBtn.className = "host-toggle-btn ghost-btn" + (u.banned ? " is-on" : "");
        banBtn.textContent = u.banned ? "Unban" : "Ban";
        banBtn.addEventListener("click", async () => {
          const next = !u.banned;
          if (next && !window.confirm(`Ban ${u.displayName || u.email || "this member"}? They will immediately lose all access, paid or not.`)) return;
          banBtn.disabled = true;
          try {
            await sdk.updateDoc(sdk.doc(db, "users", uid), { banned: next });
            u.banned = next;
            banBtn.classList.toggle("is-on", next);
            banBtn.textContent = next ? "Unban" : "Ban";
            td.textContent = (u.banned ? "🚫 " : "") + (u.displayName || "Member");
          } catch (e) {
            /* ignore */
          } finally {
            banBtn.disabled = false;
          }
        });
        tdSubActions.appendChild(renewBtn);
        tdSubActions.appendChild(clearBtn);
        tdSubActions.appendChild(banBtn);

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
      if (adminMembers.length) {
        renderMemberActivity(adminMembers[0].uid);
        renderMemberProgress(adminMembers[0].uid);
      }
    } catch (err) {
      els.adminMembersBody.innerHTML = `<tr><td colspan="6">Couldn't load members (${err.code || err.message}).</td></tr>`;
    }

    renderAdminLeads();
    renderAdminClassInterest();
    renderTypingTestStats();
  }

  function sourceLabel(l) {
    if (l.source === "public_page") return "🌐 Public page";
    if (l.source === "admin_manual") return "✍️ Manual";
    return "📱 App";
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function downloadCSV(filename, headers, rows) {
    const escapeCsv = (v) => {
      const s = String(v == null ? "" : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers.map(escapeCsv).join(",")];
    rows.forEach((row) => lines.push(row.map(escapeCsv).join(",")));
    const csv = "﻿" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const GRADE_OPTIONS = [
    ["g1-1", "一年级上册班 · Grade 1 (Semester 1)"],
    ["g1-2", "一年级下册班 · Grade 1 (Semester 2)"],
    ["g2-1", "二年级上册班 · Grade 2 (Semester 1)"],
    ["g2-2", "二年级下册班 · Grade 2 (Semester 2)"],
    ["g3-1", "三年级上册班 · Grade 3 (Semester 1)"],
    ["g3-2", "三年级下册班 · Grade 3 (Semester 2)"],
    ["g4-1", "四年级上册班 · Grade 4 (Semester 1)"],
    ["g4-2", "四年级下册班 · Grade 4 (Semester 2)"],
    ["g5-1", "五年级上册班 · Grade 5 (Semester 1)"],
    ["g5-2", "五年级下册班 · Grade 5 (Semester 2)"],
    ["g6-1", "六年级上册班 · Grade 6 (Semester 1)"],
    ["g6-2", "六年级下册班 · Grade 6 (Semester 2)"],
  ];

  function gradeSelectHtml(selected) {
    return (
      `<select class="edit-grade">` +
      GRADE_OPTIONS.map(
        ([v, label]) => `<option value="${v}"${v === selected ? " selected" : ""}>${escapeHtml(label)}</option>`
      ).join("") +
      `</select>`
    );
  }

  let leadsById = new Map();
  let classInterestById = new Map();

  function leadRowHtml(id, l) {
    return `<tr data-id="${id}">
      <td>${formatWhen(l.createdAt)}</td>
      <td>${escapeHtml(l.name)}</td>
      <td>${escapeHtml(l.phone)}</td>
      <td>${escapeHtml(l.wechat)}</td>
      <td>${escapeHtml(l.contactEmail || l.loginEmail)}</td>
      <td>${sourceLabel(l)}</td>
      <td class="cell-actions">
        <button type="button" class="ghost-btn row-edit-btn">Edit</button>
        <button type="button" class="danger-btn row-delete-btn">Delete</button>
      </td>
    </tr>`;
  }

  function leadEditRowHtml(id, l) {
    return `<tr data-id="${id}" data-editing="1">
      <td>${l.createdAt ? formatWhen(l.createdAt) : "—"}</td>
      <td><input type="text" class="edit-name" value="${escapeHtml(l.name)}" placeholder="Name"></td>
      <td><input type="text" class="edit-phone" value="${escapeHtml(l.phone)}" placeholder="Phone"></td>
      <td><input type="text" class="edit-wechat" value="${escapeHtml(l.wechat)}" placeholder="WeChat"></td>
      <td><input type="email" class="edit-email" value="${escapeHtml(l.contactEmail || l.loginEmail)}" placeholder="Email"></td>
      <td>${l.source ? sourceLabel(l) : "—"}</td>
      <td class="cell-actions">
        <button type="button" class="row-save-btn">Save</button>
        <button type="button" class="ghost-btn row-cancel-btn">Cancel</button>
      </td>
    </tr>`;
  }

  async function renderAdminLeads() {
    els.adminLeadsBody.innerHTML = `<tr><td colspan="7">Loading…</td></tr>`;
    try {
      const q = sdk.query(sdk.collection(db, "leads"), sdk.orderBy("createdAt", "desc"), sdk.limit(50));
      const snap = await sdk.getDocs(q);
      leadsById = new Map();
      els.adminLeadsBody.innerHTML = "";
      if (snap.empty) {
        els.adminLeadsBody.innerHTML = `<tr><td colspan="7">No leads yet.</td></tr>`;
        return;
      }
      snap.forEach((docSnap) => {
        leadsById.set(docSnap.id, docSnap.data());
      });
      leadsById.forEach((l, id) => {
        els.adminLeadsBody.insertAdjacentHTML("beforeend", leadRowHtml(id, l));
      });
    } catch (err) {
      els.adminLeadsBody.innerHTML = `<tr><td colspan="7">${formatQueryError(err)}</td></tr>`;
    }
  }

  function classRowHtml(id, l) {
    return `<tr data-id="${id}">
      <td>${formatWhen(l.createdAt)}</td>
      <td>${escapeHtml(l.name)}</td>
      <td>${escapeHtml(l.gradeLabel || l.grade)}</td>
      <td>${escapeHtml(l.phone)}</td>
      <td>${escapeHtml(l.wechat)}</td>
      <td>${escapeHtml(l.contactEmail || l.loginEmail)}</td>
      <td>${sourceLabel(l)}</td>
      <td class="cell-actions">
        <button type="button" class="ghost-btn row-edit-btn">Edit</button>
        <button type="button" class="danger-btn row-delete-btn">Delete</button>
      </td>
    </tr>`;
  }

  function classEditRowHtml(id, l) {
    return `<tr data-id="${id}" data-editing="1">
      <td>${l.createdAt ? formatWhen(l.createdAt) : "—"}</td>
      <td><input type="text" class="edit-name" value="${escapeHtml(l.name)}" placeholder="Name"></td>
      <td>${gradeSelectHtml(l.grade || "")}</td>
      <td><input type="text" class="edit-phone" value="${escapeHtml(l.phone)}" placeholder="Phone"></td>
      <td><input type="text" class="edit-wechat" value="${escapeHtml(l.wechat)}" placeholder="WeChat"></td>
      <td><input type="email" class="edit-email" value="${escapeHtml(l.contactEmail || l.loginEmail)}" placeholder="Email"></td>
      <td>${l.source ? sourceLabel(l) : "—"}</td>
      <td class="cell-actions">
        <button type="button" class="row-save-btn">Save</button>
        <button type="button" class="ghost-btn row-cancel-btn">Cancel</button>
      </td>
    </tr>`;
  }

  async function renderAdminClassInterest() {
    els.adminClassInterestBody.innerHTML = `<tr><td colspan="8">Loading…</td></tr>`;
    try {
      const q = sdk.query(sdk.collection(db, "classInterest"), sdk.orderBy("createdAt", "desc"), sdk.limit(50));
      const snap = await sdk.getDocs(q);
      classInterestById = new Map();
      els.adminClassInterestBody.innerHTML = "";
      if (snap.empty) {
        els.adminClassInterestBody.innerHTML = `<tr><td colspan="8">No submissions yet.</td></tr>`;
        return;
      }
      snap.forEach((docSnap) => {
        classInterestById.set(docSnap.id, docSnap.data());
      });
      classInterestById.forEach((l, id) => {
        els.adminClassInterestBody.insertAdjacentHTML("beforeend", classRowHtml(id, l));
      });
    } catch (err) {
      els.adminClassInterestBody.innerHTML = `<tr><td colspan="8">${formatQueryError(err)}</td></tr>`;
    }
  }

  async function renderTypingTestStats() {
    if (!els.adminTypingStatsBody) return;
    els.adminTypingStatsBody.innerHTML = `<tr><td colspan="3">Loading…</td></tr>`;
    try {
      const snap = await sdk.getDocs(sdk.collection(db, "typingTestStats"));
      els.adminTypingStatsBody.innerHTML = "";
      if (snap.empty) {
        els.adminTypingStatsBody.innerHTML = `<tr><td colspan="3">No Typing Test activity yet.</td></tr>`;
        return;
      }
      const rows = [];
      snap.forEach((docSnap) => rows.push(docSnap.data()));
      rows.sort((a, b) => (b.attempts || 0) - (a.attempts || 0));
      rows.forEach((s) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${escapeHtml(s.title || `#${s.articleId}`)}</td><td>${s.attempts || 0}</td><td>${
          (s.learners || []).length
        }</td>`;
        els.adminTypingStatsBody.appendChild(tr);
      });
    } catch (err) {
      els.adminTypingStatsBody.innerHTML = `<tr><td colspan="3">${formatQueryError(err)}</td></tr>`;
    }
  }

  els.adminLeadsBody.addEventListener("click", async (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    const id = tr.dataset.id;

    if (e.target.classList.contains("row-edit-btn")) {
      tr.outerHTML = leadEditRowHtml(id, leadsById.get(id));
      return;
    }
    if (e.target.classList.contains("row-cancel-btn")) {
      if (id === "__new__") {
        tr.remove();
        return;
      }
      tr.outerHTML = leadRowHtml(id, leadsById.get(id));
      return;
    }
    if (e.target.classList.contains("row-delete-btn")) {
      if (!confirm("Delete this lead? This cannot be undone.")) return;
      try {
        await sdk.deleteDoc(sdk.doc(db, "leads", id));
        renderAdminLeads();
      } catch (err) {
        alert("Delete failed: " + (err.message || err));
      }
      return;
    }
    if (e.target.classList.contains("row-save-btn")) {
      const name = tr.querySelector(".edit-name").value.trim();
      const phone = tr.querySelector(".edit-phone").value.trim();
      const wechat = tr.querySelector(".edit-wechat").value.trim();
      const contactEmail = tr.querySelector(".edit-email").value.trim();
      try {
        if (id === "__new__") {
          await sdk.addDoc(sdk.collection(db, "leads"), {
            uid: null,
            source: "admin_manual",
            name,
            phone,
            wechat,
            contactEmail,
            createdAt: sdk.serverTimestamp(),
          });
        } else {
          await sdk.updateDoc(sdk.doc(db, "leads", id), { name, phone, wechat, contactEmail });
        }
        renderAdminLeads();
      } catch (err) {
        alert("Save failed: " + (err.message || err));
      }
    }
  });

  els.adminLeadsAddBtn.addEventListener("click", () => {
    if (els.adminLeadsBody.querySelector('tr[data-id="__new__"]')) return;
    els.adminLeadsBody.insertAdjacentHTML("afterbegin", leadEditRowHtml("__new__", {}));
  });

  els.adminLeadsExportBtn.addEventListener("click", () => {
    const headers = ["When", "Name", "Phone", "WeChat", "Email", "Source"];
    const rows = Array.from(leadsById.values()).map((l) => [
      formatWhen(l.createdAt),
      l.name || "",
      l.phone || "",
      l.wechat || "",
      l.contactEmail || l.loginEmail || "",
      sourceLabel(l),
    ]);
    downloadCSV("leads.csv", headers, rows);
  });

  els.adminClassInterestBody.addEventListener("click", async (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    const id = tr.dataset.id;

    if (e.target.classList.contains("row-edit-btn")) {
      tr.outerHTML = classEditRowHtml(id, classInterestById.get(id));
      return;
    }
    if (e.target.classList.contains("row-cancel-btn")) {
      if (id === "__new__") {
        tr.remove();
        return;
      }
      tr.outerHTML = classRowHtml(id, classInterestById.get(id));
      return;
    }
    if (e.target.classList.contains("row-delete-btn")) {
      if (!confirm("Delete this submission? This cannot be undone.")) return;
      try {
        await sdk.deleteDoc(sdk.doc(db, "classInterest", id));
        renderAdminClassInterest();
      } catch (err) {
        alert("Delete failed: " + (err.message || err));
      }
      return;
    }
    if (e.target.classList.contains("row-save-btn")) {
      const name = tr.querySelector(".edit-name").value.trim();
      const phone = tr.querySelector(".edit-phone").value.trim();
      const wechat = tr.querySelector(".edit-wechat").value.trim();
      const contactEmail = tr.querySelector(".edit-email").value.trim();
      const gradeSel = tr.querySelector(".edit-grade");
      const grade = gradeSel.value;
      const gradeLabel = gradeSel.options[gradeSel.selectedIndex].textContent;
      try {
        if (id === "__new__") {
          await sdk.addDoc(sdk.collection(db, "classInterest"), {
            uid: null,
            source: "admin_manual",
            name,
            phone,
            wechat,
            contactEmail,
            grade,
            gradeLabel,
            createdAt: sdk.serverTimestamp(),
          });
        } else {
          await sdk.updateDoc(sdk.doc(db, "classInterest", id), { name, phone, wechat, contactEmail, grade, gradeLabel });
        }
        renderAdminClassInterest();
      } catch (err) {
        alert("Save failed: " + (err.message || err));
      }
    }
  });

  els.adminClassInterestAddBtn.addEventListener("click", () => {
    if (els.adminClassInterestBody.querySelector('tr[data-id="__new__"]')) return;
    els.adminClassInterestBody.insertAdjacentHTML("afterbegin", classEditRowHtml("__new__", {}));
  });

  els.adminClassInterestExportBtn.addEventListener("click", () => {
    const headers = ["When", "Name", "Grade", "Phone", "WeChat", "Email", "Source"];
    const rows = Array.from(classInterestById.values()).map((l) => [
      formatWhen(l.createdAt),
      l.name || "",
      l.gradeLabel || l.grade || "",
      l.phone || "",
      l.wechat || "",
      l.contactEmail || l.loginEmail || "",
      sourceLabel(l),
    ]);
    downloadCSV("class-enrollment-interest.csv", headers, rows);
  });

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
        sdk.where("type", "in", ["match_complete", "practice_complete", "typing_test_complete"]),
        sdk.orderBy("createdAt", "desc"),
        sdk.limit(150)
      );
      const snap = await sdk.getDocs(q);
      els.adminActivityBody.innerHTML = "";
      if (snap.empty) {
        els.adminActivityBody.innerHTML = `<tr><td colspan="3">${
          member ? member.displayName : "This member"
        } hasn't done any Match, Practice, or Typing Test activity yet.</td></tr>`;
        return;
      }
      snap.forEach((docSnap) => {
        const e = docSnap.data();
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${formatWhen(e.createdAt)}</td><td>${activityLabel(e)}</td><td>${window.lessonLabel(e.lesson)}</td>`;
        els.adminActivityBody.appendChild(tr);
      });
    } catch (err) {
      els.adminActivityBody.innerHTML = `<tr><td colspan="3">${formatQueryError(err)}</td></tr>`;
    }
  }

  async function renderMemberProgress(uid) {
    els.adminProgressBody.innerHTML = `<tr><td colspan="6">Loading…</td></tr>`;
    try {
      const [scoreSnap, matchSnap, practiceSnap] = await Promise.all([
        sdk.getDoc(sdk.doc(db, "scores", uid)),
        sdk.getDocs(sdk.query(sdk.collection(db, "lessonMatchBest"), sdk.where("uid", "==", uid))),
        sdk.getDocs(sdk.query(sdk.collection(db, "lessonPracticeCompletions"), sdk.where("uid", "==", uid))),
      ]);
      const masteredSet = new Set(scoreSnap.exists() ? scoreSnap.data().masteredIds || [] : []);

      const matchMap = {};
      matchSnap.forEach((docSnap) => {
        const d = docSnap.data();
        matchMap[d.lesson] = d.completions || 0;
      });
      const practiceType1Map = {};
      const practiceType2Map = {};
      practiceSnap.forEach((docSnap) => {
        const d = docSnap.data();
        practiceType1Map[d.lesson] = d.completionsType1 || 0;
        practiceType2Map[d.lesson] = d.completionsType2 || 0;
      });

      const allCards = getAllCards();
      const lessons = window.sortLessonIds(getLessons());
      els.adminProgressBody.innerHTML = "";
      lessons.forEach((lesson) => {
        const cards = allCards.filter((c) => c.lesson === lesson);
        const mastered = cards.filter((c) => masteredSet.has(c.id)).length;
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${window.lessonLabel(lesson)}</td><td>${mastered}</td><td>${cards.length}</td><td>${
          matchMap[lesson] || 0
        }</td><td>${practiceType1Map[lesson] || 0}</td><td>${practiceType2Map[lesson] || 0}</td>`;
        els.adminProgressBody.appendChild(tr);
      });
    } catch (err) {
      els.adminProgressBody.innerHTML = `<tr><td colspan="6">${formatQueryError(err)}</td></tr>`;
    }
  }

  els.adminActivitySelect.addEventListener("change", (e) => {
    renderMemberActivity(e.target.value);
    renderMemberProgress(e.target.value);
  });

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
