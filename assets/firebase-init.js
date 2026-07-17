(function () {
  "use strict";
  const sdk = window.firebaseSdk;
  const app = sdk.initializeApp(window.FIREBASE_CONFIG);
  const auth = sdk.getAuth(app);
  const db = sdk.getFirestore(app);

  if (window.FIREBASE_USE_EMULATOR) {
    sdk.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    sdk.connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }

  window.vocabFirebase = { app, auth, db, sdk };
})();
