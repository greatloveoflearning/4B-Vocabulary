(function () {
  "use strict";

  const { auth, db, sdk } = window.vocabFirebase;
  const listeners = [];
  let currentUser = null;

  function onChange(cb) {
    listeners.push(cb);
    cb(currentUser);
  }

  function notify() {
    listeners.forEach((cb) => cb(currentUser));
  }

  sdk.onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateWidget(user);
    notify();
  });

  async function signUp(displayName, email, password) {
    const cred = await sdk.createUserWithEmailAndPassword(auth, email, password);
    await sdk.updateProfile(cred.user, { displayName });
    currentUser = cred.user;
    updateWidget(currentUser);
    notify();
    await sdk.setDoc(sdk.doc(db, "users", cred.user.uid), {
      displayName,
      email,
      createdAt: sdk.serverTimestamp(),
    });
    await sdk.setDoc(
      sdk.doc(db, "scores", cred.user.uid),
      {
        displayName,
        masteredCount: 0,
        matchPoints: 0,
        totalScore: 0,
        updatedAt: sdk.serverTimestamp(),
      },
      { merge: true }
    );
  }

  function logIn(email, password) {
    return sdk.signInWithEmailAndPassword(auth, email, password);
  }

  function logOut() {
    return sdk.signOut(auth);
  }

  window.vocabAuth = { onChange, signUp, logIn, logOut, getUser: () => currentUser };

  // ---------- widget wiring ----------

  const els = {
    accountBtn: document.getElementById("account-btn"),
    accountPanel: document.getElementById("account-panel"),
    accountTabs: document.getElementById("account-tabs"),
    authForm: document.getElementById("auth-form"),
    authName: document.getElementById("auth-name"),
    authEmail: document.getElementById("auth-email"),
    authPassword: document.getElementById("auth-password"),
    authSubmit: document.getElementById("auth-submit"),
    accountProfile: document.getElementById("account-profile"),
    accountProfileName: document.getElementById("account-profile-name"),
    logoutBtn: document.getElementById("logout-btn"),
    accountError: document.getElementById("account-error"),
  };

  let authMode = "login";

  function setAuthMode(mode) {
    authMode = mode;
    Array.from(els.accountTabs.children).forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.authMode === mode);
    });
    els.authName.hidden = mode !== "signup";
    els.authName.required = mode === "signup";
    els.authSubmit.textContent = mode === "signup" ? "Sign up" : "Log in";
  }

  els.accountTabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".account-tab");
    if (btn) setAuthMode(btn.dataset.authMode);
  });

  els.accountBtn.addEventListener("click", () => {
    els.accountPanel.hidden = !els.accountPanel.hidden;
  });

  document.addEventListener("click", (e) => {
    if (!els.accountPanel.hidden && !e.composedPath().includes(els.accountPanel) && e.target !== els.accountBtn) {
      els.accountPanel.hidden = true;
    }
  });

  els.authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.accountError.hidden = true;
    els.authSubmit.disabled = true;
    try {
      if (authMode === "signup") {
        await signUp(els.authName.value.trim(), els.authEmail.value.trim(), els.authPassword.value);
      } else {
        await logIn(els.authEmail.value.trim(), els.authPassword.value);
      }
      els.authForm.reset();
      els.accountPanel.hidden = true;
    } catch (err) {
      els.accountError.textContent = friendlyError(err);
      els.accountError.hidden = false;
    } finally {
      els.authSubmit.disabled = false;
    }
  });

  els.logoutBtn.addEventListener("click", () => {
    logOut();
    els.accountPanel.hidden = true;
  });

  function friendlyError(err) {
    const code = err && err.code ? err.code : "";
    if (code.includes("email-already-in-use")) return "That email is already registered — try logging in instead.";
    if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found"))
      return "Incorrect email or password.";
    if (code.includes("weak-password")) return "Password should be at least 6 characters.";
    if (code.includes("invalid-email")) return "Please enter a valid email address.";
    return "Something went wrong. Please try again.";
  }

  function updateWidget(user) {
    if (user) {
      els.accountBtn.textContent = `👤 ${user.displayName || user.email}`;
      els.authForm.hidden = true;
      els.accountTabs.hidden = true;
      els.accountProfile.hidden = false;
      els.accountProfileName.textContent = `Signed in as ${user.displayName || user.email}`;
    } else {
      els.accountBtn.textContent = "Sign in";
      els.authForm.hidden = false;
      els.accountTabs.hidden = false;
      els.accountProfile.hidden = true;
      setAuthMode("login");
    }
  }

  setAuthMode("login");
})();
