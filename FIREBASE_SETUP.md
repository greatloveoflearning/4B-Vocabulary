# Setting up member login & the leaderboard

The site's login, activity tracking, and leaderboard ("Report" tab) are
powered by [Firebase](https://firebase.google.com) (Authentication +
Firestore). Firebase's free "Spark" plan is enough for this. You need to
create your own project — I can't create one on your behalf.

## 1. Create the project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
   and create a new project (any name).
2. In the left sidebar, go to **Build -> Authentication -> Get started**,
   then enable the **Email/Password** sign-in method.
3. Go to **Build -> Firestore Database -> Create database**. Start in
   production mode, pick any region.
4. In Firestore, open the **Rules** tab and paste the contents of
   `firestore.rules` from this repo, then **Publish**.
5. Go to **Project settings** (gear icon) -> scroll to **Your apps** ->
   click the `</>` (web) icon to register a new web app. Copy the
   `firebaseConfig` object it gives you.

## 2. Wire it into the site

Paste your config values into `assets/firebase-config.js`, replacing the
`REPLACE_WITH_YOUR_...` placeholders in the second (production) config
block. These values aren't secret — they just identify your project.

## 3. The activity index

The first time someone opens the **Report** tab, Firestore may show a
"query requires an index" error in the browser console with a link — click
it to auto-create the index (or run
`firebase deploy --only firestore:indexes` with the Firebase CLI using
`firestore.indexes.json` from this repo).

## How scoring works

- **+1 point** for each word ever mastered (💥 Eliminate), counted once
  per word even if you reset a lesson and re-master it later.
- **Match game points**: `pairs + speed bonus`, where the bonus is
  `pairs × 2` if you averaged 3 seconds/pair or faster, `pairs × 1` if
  6 seconds/pair or faster, otherwise no bonus. Every completed game adds
  to your running total (replaying is worth it).
- **Total score** = mastered words + match points. The leaderboard on the
  Report tab ranks all members by total score.

## Local development

`assets/firebase-config.js` automatically points at local Firebase
emulators when the site is served from `localhost`/`127.0.0.1`, so you can
develop without touching your real project:

```
npm install -g firebase-tools
firebase emulators:start --project demo-4b-vocab
```

Then serve the site with any static server (e.g. `python3 -m http.server`)
and open it at `http://localhost:<port>`.
