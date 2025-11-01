# Layer 1: MentraOS Auth Hello World

**Status:** START HERE - Foundation layer
**Branch:** `feature/layer-1-mentra-hello`
**Dependencies:** None

## Goal
Create a minimal React webview that authenticates with MentraOS and logs userId + frontendToken to browser console.

## Context
You're working on Clairvoyant, a MentraOS glasses app (voice-activated assistant). Currently it only has voice handlers in `src/utils/handlers/`. This is Layer 1 of adding a React webview for user settings.

## What to Build

### 1. Frontend Scaffold (`src/frontend/`)
- Install dependencies: `@mentra/react`, `react`, `react-dom`, `vite`
- Create `main.tsx`: Wrap app with `<MentraAuthProvider>`
- Create `App.tsx`: Use `useMentraAuth()` hook, console.log userId + frontendToken
- Create `vite.config.ts`: Dev server on port 5173, proxy `/api` to `http://localhost:3000`
- Create `index.html`: Entry point with root div

### 2. Backend Changes (`src/index.ts`)
- Expose Express app by adding public method to access `this.getExpressApp()`
- Add basic `/api/health` route to test connectivity

### 3. Package.json Scripts
- Add `"dev:frontend": "vite"`
- Add `"build:frontend": "vite build --outDir dist/frontend"`

## Acceptance Criteria
- [ ] Browser console logs: `userId: "mentra_user_..."` when opened from MentraOS app
- [ ] Browser console logs: `frontendToken: "eyJ..."` 
- [ ] Shows "Not authenticated. Please open from MentraOS app" when opened in regular browser
- [ ] Two terminals running: backend (bun run dev on :3000) + frontend (bun run dev:frontend on :5173)

## Code Style (from AGENTS.md)
- Use Biome formatting (tabs, double quotes)
- Strict TypeScript with `import type` for types
- Follow existing project structure

## Test Plan
1. `bun install` (installs new React deps)
2. Start backend: `bun run dev` (port 3000)
3. Start frontend: `bun run dev:frontend` (port 5173)
4. Open http://localhost:5173 in browser → Should show "Not authenticated"
5. Configure webview URL in MentraOS Developer Console to http://localhost:5173
6. Open from MentraOS app → Console should log credentials

## Reference
The user provided MentraOS React webview documentation showing how to use `@mentra/react` with `MentraAuthProvider` and `useMentraAuth()` hook.

## Next Layer
After this works and is merged, Layer 2 will exchange the frontendToken for a Convex session token.

## Copy this prompt to start new Amp conversation:
```
I'm implementing Layer 1 of the Clairvoyant webview integration. Please help me create a React webview with MentraOS authentication that logs userId and frontendToken to the console. See handoffs/LAYER-1-mentra-hello.md for full requirements.
```
