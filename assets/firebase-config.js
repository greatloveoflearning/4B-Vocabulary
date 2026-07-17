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
  // Replace these placeholder values with your own Firebase project's web
  // app config (Firebase console -> Project settings -> General -> Your apps
  // -> SDK setup and configuration). These values are safe to be public —
  // they are not secrets, they just identify which Firebase project to talk to.
  window.FIREBASE_CONFIG = {
    apiKey: "REPLACE_WITH_YOUR_API_KEY",
    authDomain: "REPLACE_WITH_YOUR_PROJECT.firebaseapp.com",
    projectId: "REPLACE_WITH_YOUR_PROJECT",
    storageBucket: "REPLACE_WITH_YOUR_PROJECT.appspot.com",
    messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
    appId: "REPLACE_WITH_YOUR_APP_ID",
  };
}
