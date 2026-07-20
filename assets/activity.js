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

  function lessonKey(lesson) {
    return lesson === "all" ? "all" : Number(lesson);
  }

  async function updateLessonMatchBest(lesson, uid, displayName, pairs, seconds) {
    const key = lessonKey(lesson);
    const secondsPerPair = seconds / pairs;
    const ref = sdk.doc(db, "lessonMatchBest", `${key}_${uid}`);
    let completions = 1;
    try {
      await sdk.runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists() ? snap.data() : null;
        completions = (data && data.completions ? data.completions : 0) + 1;
        const isNewBest = !data || data.secondsPerPair > secondsPerPair;
        tx.set(
          ref,
          {
            uid,
            displayName,
            lesson: key,
            completions,
            ...(isNewBest ? { bestSeconds: seconds, bestPairs: pairs, secondsPerPair } : {}),
            updatedAt: sdk.serverTimestamp(),
          },
          { merge: true }
        );
      });
    } catch (e) {
      /* offline or permission issue */
    }
    return completions;
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
        const assessmentPoints = data.assessmentPoints || 0;
        tx.set(
          scoreRef,
          {
            displayName: user.displayName || user.email,
            masteredIds: Array.from(masteredIds),
            masteredCount,
            matchPoints,
            assessmentPoints,
            totalScore: masteredCount + matchPoints + assessmentPoints,
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

  async function getLessonMatchStanding(lesson, uid) {
    try {
      const q = sdk.query(
        sdk.collection(db, "lessonMatchBest"),
        sdk.where("lesson", "==", lessonKey(lesson)),
        sdk.orderBy("secondsPerPair", "asc")
      );
      const snap = await sdk.getDocs(q);
      const all = [];
      snap.forEach((docSnap) => all.push(docSnap.data()));
      const total = all.length;
      const rank = all.findIndex((d) => d.uid === uid) + 1;
      const others = all.filter((d) => d.uid !== uid);
      const mine = all.find((d) => d.uid === uid);
      const beaten = mine ? others.filter((d) => d.secondsPerPair > mine.secondsPerPair).length : 0;
      const percentile = others.length > 0 ? Math.round((beaten / others.length) * 100) : null;
      return { total, rank: rank || null, percentile, leaderboard: all.slice(0, 5) };
    } catch (e) {
      return null;
    }
  }

  async function recordMatchComplete(lesson, pairs, seconds) {
    const user = window.vocabAuth.getUser();
    if (!user) return null;

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
    const completions = await updateLessonMatchBest(lesson, user.uid, displayName, pairs, seconds);
    const standing = await getLessonMatchStanding(lesson, user.uid);

    const scoreRef = sdk.doc(db, "scores", user.uid);
    try {
      await sdk.runTransaction(db, async (tx) => {
        const snap = await tx.get(scoreRef);
        const data = snap.exists() ? snap.data() : {};
        const masteredCount = data.masteredCount || 0;
        const matchPoints = (data.matchPoints || 0) + points;
        const assessmentPoints = data.assessmentPoints || 0;
        tx.set(
          scoreRef,
          {
            displayName,
            masteredIds: data.masteredIds || [],
            masteredCount,
            matchPoints,
            assessmentPoints,
            totalScore: masteredCount + matchPoints + assessmentPoints,
            updatedAt: sdk.serverTimestamp(),
          },
          { merge: true }
        );
      });
    } catch (e) {
      /* offline or permission issue: activity is already logged, score sync can lag */
    }

    return { points, completions, standing };
  }

  async function recordAssessmentAnswer(lesson, card, correct) {
    const user = window.vocabAuth.getUser();
    if (!user) return;

    const points = correct ? 1 : 0;
    const displayName = user.displayName || user.email;

    sdk.addDoc(sdk.collection(db, "activity"), {
      uid: user.uid,
      type: "assessment_answer",
      lesson,
      hanzi: card.hanzi,
      cardId: card.id,
      correct,
      points,
      createdAt: sdk.serverTimestamp(),
    });

    touchLessonStats(lesson, user.uid);

    if (points === 0) return;

    const scoreRef = sdk.doc(db, "scores", user.uid);
    try {
      await sdk.runTransaction(db, async (tx) => {
        const snap = await tx.get(scoreRef);
        const data = snap.exists() ? snap.data() : {};
        const masteredCount = data.masteredCount || 0;
        const matchPoints = data.matchPoints || 0;
        const assessmentPoints = (data.assessmentPoints || 0) + points;
        tx.set(
          scoreRef,
          {
            displayName,
            masteredIds: data.masteredIds || [],
            masteredCount,
            matchPoints,
            assessmentPoints,
            totalScore: masteredCount + matchPoints + assessmentPoints,
            updatedAt: sdk.serverTimestamp(),
          },
          { merge: true }
        );
      });
    } catch (e) {
      /* offline or permission issue: activity is already logged, score sync can lag */
    }
  }

  async function recordPracticeComplete(lesson) {
    const user = window.vocabAuth.getUser();
    if (!user) return;

    const key = lessonKey(lesson);
    const ref = sdk.doc(db, "lessonPracticeCompletions", `${key}_${user.uid}`);
    try {
      await sdk.runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const completions = (snap.exists() ? snap.data().completions || 0 : 0) + 1;
        tx.set(ref, { uid: user.uid, lesson: key, completions, updatedAt: sdk.serverTimestamp() }, { merge: true });
      });
    } catch (e) {
      /* offline or permission issue */
    }
  }

  window.vocabActivity = {
    recordEliminate,
    recordMatchComplete,
    recordAssessmentAnswer,
    recordPracticeComplete,
    matchGamePoints,
  };
})();
