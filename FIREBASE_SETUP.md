# Setting up member login, the leaderboard, and going live

The site's login, activity tracking, leaderboard ("Report" tab), and
online assessment game are powered by [Firebase](https://firebase.google.com)
(Authentication + Firestore). Firebase's free "Spark" plan is enough for
this — no credit card needed for a small family/classmates group.

This doc walks through the exact steps, including the current (2025+)
Firebase console layout, which groups products differently than older
guides ("构建/Build" was replaced with category groups like "安全/Security"
and "数据库和存储/Database and Storage").

## 1. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
   and create a new project (any name — e.g. this project is called
   "kt-ai-learn").
2. **Enable email/password login**: left sidebar → **安全 (Security)** →
   **Authentication** → **登录方法 (Sign-in method)** tab → click
   **电子邮件地址/密码 (Email/Password)** → enable → save.
3. **Create the database**: left sidebar → **数据库和存储 (Database and
   Storage)** → **Firestore Database** → Create database → **生产模式
   (Production mode)** → pick a region close to where members actually are
   (this can't be changed later) → Create.
4. **Publish the security rules**: in Firestore, click the **规则 (Rules)**
   tab → delete the default contents → paste in the entire contents of
   `firestore.rules` from this repo → **发布 (Publish)**.
5. **Register a web app** to get the config: left sidebar gear icon →
   **项目设置 (Project settings)** → scroll to "Your apps" / "您的应用" →
   click the `</>` (web) icon → give it any nickname → **don't** check
   "also set up Firebase Hosting" (this project uses GitHub Pages instead)
   → Register app. Copy the `firebaseConfig = {...}` object it shows you.

## 2. Wire the config into the site

Paste the config values into `assets/firebase-config.js`, in the second
(production) config block. These values aren't secret — Firebase's
security model protects data via `firestore.rules` and Authentication, not
by hiding this config, so it's fine for it to live in a public repo.

## 3. The activity index

The first time someone opens the **Report** tab, Firestore may show a
"query requires an index" error in the browser console with a link — click
it to auto-create the index (or run
`firebase deploy --only firestore:indexes` with the Firebase CLI using
`firestore.indexes.json` from this repo).

## 4. Deploying the site (GitHub Pages)

1. Push the code to the repo's `main` branch (this repo's `main` was
   created from the feature branch that built the site).
2. GitHub Pages' free tier only works on **public** repos. To make this
   one public: repo → **Settings** → **General** → scroll to the red
   **Danger Zone** → **Change repository visibility** → Public → confirm
   by typing the repo name.
   - Nothing sensitive lives in this repo (the Firebase config is meant to
     be public), so this is safe. If you'd rather keep it private, use
     Netlify or Vercel instead (their free tiers deploy from private
     repos) — see "Switching to a private host later" below.
3. Repo → **Settings** → **Pages** → Source: "Deploy from a branch" →
   Branch: **main**, folder **/ (root)** → Save. GitHub takes a few
   minutes to publish; the URL appears at the top of that page (something
   like `https://<username>.github.io/4B-Vocabulary/`).

## 5. Authorize the deployed domain

Firebase Authentication only allows sign-in from domains you've explicitly
allowed. Once you have the GitHub Pages URL: Firebase console → **安全
(Security)** → **Authentication** → **Settings** tab → **Authorized
domains** → **Add domain** → paste the domain (just the host, e.g.
`<username>.github.io`, no `https://` or path).

## 6. Make yourself admin

Only an admin can grant other members "host" permission for the online
assessment game, and `isAdmin` can't be set from the app itself (by
design — it can only be granted by hand in the Firebase console, so no
client can self-promote). After you sign up on the live site once:

1. Firebase console → **数据库和存储 (Database and Storage)** →
   **Firestore Database** → **数据 (Data)** tab.
2. Open the `users` collection → find your document (matches your
   account's UID — check Authentication → Users to match by email).
3. Add a field: name `isAdmin`, type `boolean`, value `true`. Save.
4. Reload the site and log back in — you should now see the "Host a new
   assessment" option and the admin member-management panel on the Report
   tab.

## How scoring works

- **+1 point** for each word ever mastered (💥 Eliminate), counted once
  per word even if you reset a lesson and re-master it later.
- **Match game points**: `pairs + speed bonus`, where the bonus is
  `pairs × 2` if you averaged 3 seconds/pair or faster, `pairs × 1` if
  6 seconds/pair or faster, otherwise no bonus. Every completed game adds
  to your running total (replaying is worth it).
- **Total score** = mastered words + match points. The leaderboard on the
  Report tab ranks all members by total score.
- **All-time percentile**: after a Match game or an assessment round, the
  site compares your result (speed for Match, score for assessment)
  against everyone else's personal best for that lesson and shows what
  percentage of them you beat.

## Local development

`assets/firebase-config.js` automatically points at local Firebase
emulators when the site is served from `localhost`/`127.0.0.1`, so you can
develop without touching the real project:

```
npm install -g firebase-tools
firebase emulators:start --project demo-4b-vocab
```

Then serve the site with any static server (e.g. `python3 -m http.server`)
and open it at `http://localhost:<port>`.

## Switching to a private host later

Nothing about the site's code or the Firebase backend is tied to GitHub
Pages — it's just wherever the static files happen to be served from. To
move to a private setup later:

1. Set the GitHub repo back to Private.
2. Connect it to **Netlify** or **Vercel** (both have free tiers that
   deploy straight from a private GitHub repo, no public visibility
   needed).
3. Add the new deployment's domain to Firebase's Authorized domains list
   (step 5 above); remove the old GitHub Pages domain if you like.

Login, Firestore data, scoring, and the assessment game don't change at
all — only where the HTML/CSS/JS files are served from.
