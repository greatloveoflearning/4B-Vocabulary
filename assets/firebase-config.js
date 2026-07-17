// When running on localhost, the app talks to local Firebase emulators
// instead of a real project, so the site is safe to develop against without
// touching production data. Set to false to always use the real project.
window.FIREBASE_USE_EMULATOR =
  location.hostname === "localhost" || location.hostname === "127.0.0.1";

if (window.FIREBASE_USE_EMULATOR) {
  // Fake config used only against the local emulator suite (see README) —
  // the emulator does not validate these values against a real project.
  window.FIREBASE_CONFIG = {
    apiKey: "demo-key",
    authDomain: "demo-4b-vocab.firebaseapp.com",
    projectId: "demo-4b-vocab",
    storageBucket: "demo-4b-vocab.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000000000",
  };
} else {
  // kt-ai-learn Firebase project's web app config. Not a secret — this just
  // identifies which Firebase project the site talks to; access is enforced
  // by firestore.rules, not by hiding this value.
  window.FIREBASE_CONFIG = {
    apiKey: "AIzaSyAhQkgutTvMGsZ7zxRHOASmybVlOJUN1Vo",
    authDomain: "kt-ai-learn.firebaseapp.com",
    projectId: "kt-ai-learn",
    storageBucket: "kt-ai-learn.firebasestorage.app",
    messagingSenderId: "499347040375",
    appId: "1:499347040375:web:260dd15bcefbdff2ae3e72",
  };
}
