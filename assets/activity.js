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

  async function recordEliminate(card) {
    const user = window.vocabAuth.getUser();
    if (!user) return;

    sdk.addDoc(sdk.collection(db, "activity"), {
      uid: user.uid,
      type: "eliminate",
      lesson: card.lesson,
      hanzi: card.hanzi,
      cardId: card.id,
      createdAt: sdk.serverTimestamp(),
    });

    const scoreRef = sdk.doc(db, "scores", user.uid);
    try {
      await sdk.runTransaction(db, async (tx) => {
        const snap = await tx.get(scoreRef);
        const data = snap.exists() ? snap.data() : {};
        const masteredIds = new Set(data.masteredIds || []);
        if (masteredIds.has(card.id)) return;
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
      /* offline or permission issue: activity is already logged, score sync can lag */
    }
  }

  async function recordMatchComplete(lesson, pairs, seconds) {
    const user = window.vocabAuth.getUser();
    if (!user) return;

    const points = matchGamePoints(pairs, seconds);

    sdk.addDoc(sdk.collection(db, "activity"), {
      uid: user.uid,
      type: "match_complete",
      lesson: lesson,
      pairs,
      seconds,
      points,
      createdAt: sdk.serverTimestamp(),
    });

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
            displayName: user.displayName || user.email,
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
