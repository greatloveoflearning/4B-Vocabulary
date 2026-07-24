(function () {
  "use strict";

  const { db, sdk } = window.vocabFirebase;

  // Anonymous, signed-out visitors get a small preview (assets/vocab.js);
  // once we know a visitor is actually signed in, we swap in the full
  // 707-word set from Firestore (protected by firestore.rules).
  window.VOCAB_DATA = window.VOCAB_PREVIEW || [];

  const listeners = [];
  window.onVocabDataChange = function (cb) {
    listeners.push(cb);
  };
  function notify() {
    listeners.forEach((cb) => cb());
  }

  async function loadForUser(user) {
    if (!user) {
      window.VOCAB_DATA = window.VOCAB_PREVIEW || [];
      notify();
      return;
    }
    try {
      const snap = await sdk.getDoc(sdk.doc(db, "vocabData", "list"));
      window.VOCAB_DATA = snap.exists() ? snap.data().words || [] : [];
    } catch (e) {
      window.VOCAB_DATA = window.VOCAB_PREVIEW || [];
    }
    notify();
  }

  window.vocabAuth.onChange((user) => {
    loadForUser(user);
  });
})();
