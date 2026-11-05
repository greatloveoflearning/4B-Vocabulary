(function () {
  "use strict";

  const { db, sdk } = window.vocabFirebase;

  // Anonymous, signed-out visitors get a small preview (assets/vocab.js).
  // Once signed in, lessons are fetched one at a time from Firestore as
  // they're actually needed (window.vocabLoader.ensureLesson/ensureAllLessons)
  // rather than all at once on sign-in — so opening the site and signing in
  // doesn't by itself dump the entire vocabulary set over the network.
  window.VOCAB_DATA = window.VOCAB_PREVIEW || [];

  const lessonCache = new Map(); // lesson number -> words array (ids already embedded)
  const pending = new Map(); // lesson number -> in-flight fetch promise
  let currentUser = null;

  const listeners = [];
  window.onVocabDataChange = function (cb) {
    listeners.push(cb);
  };
  function notify() {
    listeners.forEach((cb) => cb());
  }

  function rebuildVocabData() {
    const arr = [];
    Array.from(lessonCache.keys())
      .sort((a, b) => a - b)
      .forEach((lesson) => arr.push(...lessonCache.get(lesson)));
    window.VOCAB_DATA = arr;
  }

  async function ensureLesson(lesson) {
    const num = Number(lesson);
    if (!currentUser) return;
    if (lessonCache.has(num)) return;
    if (pending.has(num)) return pending.get(num);

    const fetchPromise = (async () => {
      try {
        const snap = await sdk.getDoc(sdk.doc(db, "vocabData", String(num)));
        lessonCache.set(num, snap.exists() ? snap.data().words || [] : []);
      } catch (e) {
        lessonCache.set(num, []);
      }
      rebuildVocabData();
      notify();
    })();

    pending.set(num, fetchPromise);
    try {
      await fetchPromise;
    } finally {
      pending.delete(num);
    }
  }

  async function ensureAllLessons() {
    if (!currentUser) return;
    const ids = window.getAllLessonIds ? window.getAllLessonIds() : Object.keys(window.LESSON_META || {}).map(Number);
    // Aggregate pseudo-lessons (9001/9002/9003) never have their own
    // Firestore document — only real lesson numbers do.
    const realIds = ids.filter((n) => !(window.LESSON_META[n] && window.LESSON_META[n].allCategory));
    await Promise.all(realIds.map((n) => ensureLesson(n)));
  }

  window.vocabLoader = { ensureLesson, ensureAllLessons };

  window.vocabAuth.onChange((user) => {
    currentUser = user;
    lessonCache.clear();
    pending.clear();
    window.VOCAB_DATA = user ? [] : window.VOCAB_PREVIEW || [];
    notify();
  });
})();
