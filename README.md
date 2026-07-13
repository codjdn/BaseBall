# ⚾ Finger Baseball Arcade

A polished, browser-based arcade baseball game where **your index finger is the bat**.
Point your webcam at your hand, and MediaPipe hand tracking turns your finger into a
glowing baseball bat. Swing through the pitch, smash targets in the outfield, chase
combos, and rack up the highest score before three strikeouts.

Runs 100% client-side — no backend, no accounts, deployable straight to GitHub Pages.

## ✨ Features

- **Finger bat** — MediaPipe Hand Landmarker tracks your index finger with One-Euro
  smoothing for low-latency, jitter-free control. The bat rotates with your finger,
  leaves a glowing trail, stretches on fast swings, and sparks on contact.
- **Six pitch types** — fastball, curveball, slider, changeup, knuckleball, sinker,
  each with unique speed, movement, and timing, thrown by an animated pitcher with a
  full windup.
- **Pseudo-3D arcade physics** — gravity, drag, bounce, roll, wall/fence collisions,
  and home runs, simulated in real-world units and projected into a stylized
  behind-home-plate perspective.
- **Arcade target scoring** — neon rings, floating signs, and landing zones worth
  50–1000 points, plus BONUS and JACKPOT targets. Combos, perfect-hit bonuses,
  home run and distance bonuses.
- **Defensive fielders** — eight cartoon fielders idle, chase fly balls, catch,
  throw back, and celebrate. A catch costs you the points (but never an out).
- **Simplified baseball rules** — balls, strikes, fouls, walks, strikeouts.
  Three outs end the game. No base runners, no innings — pure arcade scoring.
- **Juice** — hit stop, slow-motion on perfect contact, camera zoom on home runs,
  screen shake, screen flash, dust, sparks, confetti, animated crowd and scoreboard,
  moving clouds, day/night themes.
- **Accessibility** — adjustable sensitivity, left/right-handed modes, camera preview
  toggle, reduced motion mode, colorblind-friendly indicators, volume controls, and a
  full mouse/touch fallback so the game is playable with no webcam at all.
- **Local persistence** — high score, statistics, unlockable bat skins, and settings
  are stored in `localStorage`.

## 🕹️ How to play

1. Allow camera access (or press **Play without camera** for mouse/touch control).
2. Hold your hand up so the camera can see it — your index finger becomes the bat.
3. When the pitcher throws, swing your finger *through* the ball.
4. Aim for the glowing targets in the outfield. Consecutive hits build your combo
   multiplier. Perfect timing gives big bonuses and slow-mo.
5. Fouls and misses are strikes. Three strikes is an out. Three outs ends the game.

## 🚀 Development

```bash
npm install
npm run dev        # start the dev server
npm run build      # typecheck + production build to dist/
npm run preview    # preview the production build
```

Requires Node 20+.

> **Note:** camera access requires a secure context. `localhost` works out of the
> box; for LAN testing use HTTPS or a tunneling tool.

## 📦 Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the game and
deploys it to GitHub Pages automatically. One-time setup: in the repository settings,
set **Settings → Pages → Source** to **GitHub Actions**. The Vite config uses a
relative base path, so the build works from any sub-path.

MediaPipe's WASM runtime and the hand landmark model are loaded from Google's CDN at
runtime (still fully client-side). To self-host them, drop the files in
`public/assets/` and change the two URLs in `src/handtracking/HandTracker.ts`.

## 🗂️ Project structure

```
src/
  main.ts            entry point, Phaser boot
  game/              scenes, game state, rules, difficulty, scoring
  handtracking/      MediaPipe wrapper, camera manager, smoothing, bat input
  physics/           3D ball flight, projection, bat-ball contact model
  entities/          ball, bat, pitcher, fielders, targets
  ui/                HUD, popups, buttons, indicators
  stadium/           field, crowd, scoreboard, sky and clouds
  pitching/          pitch type definitions and sequencing
  effects/           particles, screen shake, hit stop, flashes
  audio/             WebAudio synth SFX/music (drop-in replaceable)
  utils/             math helpers, localStorage wrapper
public/assets/       images/, sounds/, fonts/ (placeholder dirs for real assets)
```

All graphics are drawn procedurally and all sounds are synthesized at runtime, so the
repository ships zero copyrighted assets. To replace a sound with a real recording,
register a file URL for its key in `src/audio/AudioManager.ts`.

## 📄 License

MIT — see [LICENSE](LICENSE).
