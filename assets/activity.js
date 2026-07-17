(function () {
  "use strict";

  const { db, sdk } = window.vocabFirebase;

  function matchGamePoints(pairs, seconds) {
    const timePerPair = seconds / pairs;
    let speedBonus = 0;
    if (timePerPair <= 3) speedBonus = pairs * 2;
    else if (timePerPair <= 6) speedBonus = pairs;
    return pairs + speedBonus;
  }

  function touchLessonStats(lesson, uid) {
    if (lesson === "all" || lesson === undefined || lesson === null) return;
    sdk.setDoc(sdk.doc(db, "lessonStats", String(lesson)), { learners: sdk.arrayUnion(uid) }, { merge: true });
  }

  async function updateLessonMatchBest(lesson, uid, displayName, pairs, seconds) {
    if (lesson === "all") return;
    const secondsPerPair = seconds / pairs;
    const ref = sdk.doc(db, "lessonMatchBest", `${lesson}_${uid}`);
    try {
      await sdk.runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists() ? snap.data() : null;
        if (data && data.secondsPerPair <= secondsPerPair) return;
        tx.set(ref, {
          uid,
          displayName,
          lesson: Number(lesson),
          bestSeconds: seconds,
          bestPairs: pairs,
          secondsPerPair,
          updatedAt: sdk.serverTimestamp(),
        });
      });
    } catch (e) {
      /* offline or permission issue */
    }
  }

  async function recordEliminate(card) {
    const user = window.vocabAuth.getUser();
    if (!user) return;

    const scoreRef = sdk.doc(db, "scores", user.uid);
    let isNew = false;
    try {
      await sdk.runTransaction(db, async (tx) => {
        const snap = await tx.get(scoreRef);
        const data = snap.exists() ? snap.data() : {};
        const masteredIds = new Set(data.masteredIds || []);
        if (masteredIds.has(card.id)) return;
        isNew = true;
        masteredIds.add(card.id);
        const masteredCount = masteredIds.size;
        const matchPoints = data.matchPoints || 0;
        tx.set(
          scoreRef,
          {
            displayName: user.displayName || user.email,
            masteredIds: Array.from(masteredIds),
            masteredCount,
            matchPoints,
            totalScore: masteredCount + matchPoints,
            updatedAt: sdk.serverTimestamp(),
          },
          { merge: true }
        );
      });
    } catch (e) {
      /* offline or permission issue: activity is still logged below */
    }

    sdk.addDoc(sdk.collection(db, "activity"), {
      uid: user.uid,
      type: "eliminate",
      lesson: card.lesson,
      hanzi: card.hanzi,
      cardId: card.id,
      points: isNew ? 1 : 0,
      createdAt: sdk.serverTimestamp(),
    });

    touchLessonStats(card.lesson, user.uid);
  }

  async function recordMatchComplete(lesson, pairs, seconds) {
    const user = window.vocabAuth.getUser();
    if (!user) return;

    const points = matchGamePoints(pairs, seconds);
    const displayName = user.displayName || user.email;

    sdk.addDoc(sdk.collection(db, "activity"), {
      uid: user.uid,
      type: "match_complete",
      lesson: lesson,
      pairs,
      seconds,
      points,
      createdAt: sdk.serverTimestamp(),
    });

    touchLessonStats(lesson, user.uid);
    updateLessonMatchBest(lesson, user.uid, displayName, pairs, seconds);

    const scoreRef = sdk.doc(db, "scores", user.uid);
    try {
      await sdk.runTransaction(db, async (tx) => {
        const snap = await tx.get(scoreRef);
        const data = snap.exists() ? snap.data() : {};
        const masteredCount = data.masteredCount || 0;
        const matchPoints = (data.matchPoints || 0) + points;
        tx.set(
          scoreRef,
          {
            displayName,
            masteredIds: data.masteredIds || [],
            masteredCount,
            matchPoints,
            totalScore: masteredCount + matchPoints,
            updatedAt: sdk.serverTimestamp(),
          },
          { merge: true }
        );
      });
    } catch (e) {
      /* offline or permission issue: activity is already logged, score sync can lag */
    }
  }

  window.vocabActivity = { recordEliminate, recordMatchComplete, matchGamePoints };
})();
