(function () {
  "use strict";

  const { db, sdk } = window.vocabFirebase;

  const FREE_GAME_LIMIT = 15;

  const els = {
    overlay: document.getElementById("paywall-overlay"),
    limitText: document.getElementById("paywall-limit-text"),
    studentName: document.getElementById("paywall-student-name"),
    leadForm: document.getElementById("paywall-lead-form"),
    leadName: document.getElementById("paywall-lead-name"),
    leadContact: document.getElementById("paywall-lead-contact"),
    leadEmail: document.getElementById("paywall-lead-email"),
    leadSubmitBtn: document.getElementById("paywall-lead-submit-btn"),
    leadMsg: document.getElementById("paywall-lead-msg"),
    signoutBtn: document.getElementById("paywall-signout-btn"),
  };

  els.limitText.textContent = String(FREE_GAME_LIMIT);

  function isUnlocked(profile) {
    return !!(profile && (profile.isAdmin || profile.canHost || profile.unlocked));
  }

  function showOverlay() {
    const user = window.vocabAuth.getUser();
    els.studentName.textContent = user ? user.displayName || user.email : "";
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
    els.leadSubmitBtn.disabled = true;
    els.leadMsg.hidden = true;
    try {
      await sdk.addDoc(sdk.collection(db, "leads"), {
        uid: user.uid,
        loginEmail: user.email,
        name: els.leadName.value.trim(),
        contact: els.leadContact.value.trim(),
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

  els.signoutBtn.addEventListener("click", () => {
    window.vocabAuth.logOut();
  });

  window.vocabAuth.onProfileChange(() => checkGate());
  window.vocabAuth.onChange(() => checkGate());

  window.vocabPaywall = { recordGamePlayed, checkGate, isUnlocked, FREE_GAME_LIMIT };
})();
