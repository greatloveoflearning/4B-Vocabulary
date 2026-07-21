(function () {
  "use strict";

  const { db, sdk } = window.vocabFirebase;

  const FREE_GAME_LIMIT = 50;

  const els = {
    overlay: document.getElementById("paywall-overlay"),
    limitText: document.getElementById("paywall-limit-text"),
    limitTextEn: document.getElementById("paywall-limit-text-en"),
    studentName: document.getElementById("paywall-student-name"),
    studentNameEn: document.getElementById("paywall-student-name-en"),
    leadForm: document.getElementById("paywall-lead-form"),
    leadName: document.getElementById("paywall-lead-name"),
    leadPhone: document.getElementById("paywall-lead-phone"),
    leadWechat: document.getElementById("paywall-lead-wechat"),
    leadEmail: document.getElementById("paywall-lead-email"),
    leadSubmitBtn: document.getElementById("paywall-lead-submit-btn"),
    leadMsg: document.getElementById("paywall-lead-msg"),
    classForm: document.getElementById("paywall-class-form"),
    className: document.getElementById("paywall-class-name"),
    classPhone: document.getElementById("paywall-class-phone"),
    classWechat: document.getElementById("paywall-class-wechat"),
    classEmail: document.getElementById("paywall-class-email"),
    classGrade: document.getElementById("paywall-class-grade"),
    classSubmitBtn: document.getElementById("paywall-class-submit-btn"),
    classMsg: document.getElementById("paywall-class-msg"),
    signoutBtn: document.getElementById("paywall-signout-btn"),
  };

  els.limitText.textContent = String(FREE_GAME_LIMIT);
  els.limitTextEn.textContent = String(FREE_GAME_LIMIT);

  function isUnlocked(profile) {
    if (!profile) return false;
    if (profile.isAdmin || profile.canHost) return true;
    return !!(profile.unlockedUntil && profile.unlockedUntil > Date.now());
  }

  function showOverlay() {
    const user = window.vocabAuth.getUser();
    const name = user ? user.displayName || user.email : "";
    els.studentName.textContent = name;
    els.studentNameEn.textContent = name;
    els.overlay.hidden = false;
  }

  function hideOverlay() {
    els.overlay.hidden = true;
  }

  function checkGate() {
    const user = window.vocabAuth.getUser();
    if (!user) {
      hideOverlay();
      return;
    }
    const profile = window.vocabAuth.getProfile();
    const played = (profile && profile.trialGamesPlayed) || 0;
    if (!isUnlocked(profile) && played >= FREE_GAME_LIMIT) {
      showOverlay();
    } else {
      hideOverlay();
    }
  }

  async function recordGamePlayed() {
    const user = window.vocabAuth.getUser();
    if (!user) return;
    const ref = sdk.doc(db, "users", user.uid);
    try {
      await sdk.runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists() ? snap.data() : {};
        const played = (data.trialGamesPlayed || 0) + 1;
        tx.set(ref, { trialGamesPlayed: played }, { merge: true });
      });
    } catch (e) {
      /* offline or permission issue */
    }
    await window.vocabAuth.refreshProfile();
    checkGate();
  }

  els.leadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = window.vocabAuth.getUser();
    if (!user) return;
    const phone = els.leadPhone.value.trim();
    const wechat = els.leadWechat.value.trim();
    if (!phone && !wechat) {
      els.leadMsg.textContent = "请至少填写电话或微信号其中一项。";
      els.leadMsg.className = "paywall-lead-msg error";
      els.leadMsg.hidden = false;
      return;
    }
    els.leadSubmitBtn.disabled = true;
    els.leadMsg.hidden = true;
    try {
      await sdk.addDoc(sdk.collection(db, "leads"), {
        uid: user.uid,
        loginEmail: user.email,
        name: els.leadName.value.trim(),
        phone,
        wechat,
        contactEmail: els.leadEmail.value.trim(),
        createdAt: sdk.serverTimestamp(),
      });
      els.leadMsg.textContent = "已收到，我们会在一天内与您电话或微信联系。";
      els.leadMsg.className = "paywall-lead-msg success";
      els.leadMsg.hidden = false;
      els.leadForm.reset();
    } catch (err) {
      els.leadMsg.textContent = "提交失败，请稍后重试。";
      els.leadMsg.className = "paywall-lead-msg error";
      els.leadMsg.hidden = false;
    } finally {
      els.leadSubmitBtn.disabled = false;
    }
  });

  els.classForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = window.vocabAuth.getUser();
    if (!user) return;
    els.classSubmitBtn.disabled = true;
    els.classMsg.hidden = true;
    try {
      await sdk.addDoc(sdk.collection(db, "classInterest"), {
        uid: user.uid,
        loginEmail: user.email,
        name: els.className.value.trim(),
        phone: els.classPhone.value.trim(),
        wechat: els.classWechat.value.trim(),
        contactEmail: els.classEmail.value.trim(),
        grade: els.classGrade.value,
        gradeLabel: els.classGrade.options[els.classGrade.selectedIndex].textContent,
        createdAt: sdk.serverTimestamp(),
      });
      els.classMsg.textContent = "已收到，我们会尽快与您联系。· Received — we'll be in touch soon.";
      els.classMsg.className = "paywall-lead-msg success";
      els.classMsg.hidden = false;
      els.classForm.reset();
    } catch (err) {
      els.classMsg.textContent = "提交失败，请稍后重试。· Submission failed, please try again.";
      els.classMsg.className = "paywall-lead-msg error";
      els.classMsg.hidden = false;
    } finally {
      els.classSubmitBtn.disabled = false;
    }
  });

  els.signoutBtn.addEventListener("click", () => {
    window.vocabAuth.logOut();
  });

  window.vocabAuth.onProfileChange(() => checkGate());
  window.vocabAuth.onChange(() => checkGate());

  window.vocabPaywall = { recordGamePlayed, checkGate, isUnlocked, FREE_GAME_LIMIT };
})();
