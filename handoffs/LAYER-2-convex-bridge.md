# Layer 2: Convex Token Bridge

**Status:** DEPENDS on Layer 1 being merged
**Branch:** `feature/layer-2-convex-bridge`
**Dependencies:** Layer 1 merged, Convex prep branch merged

## Goal
Create backend endpoint that validates Mentra frontendToken and returns Convex session token. Frontend uses this token to authenticate with Convex.

## Context
Layer 1 is complete and merged - the webview can get MentraOS credentials (userId + frontendToken). Now we need to exchange the Mentra frontendToken for a Convex session token so the webview can access the Convex database.

## What to Build

### 1. Backend Auth Bridge (`src/api/session.ts`)
- POST `/api/session/mentra` endpoint
- Accept `{ frontendToken }` from request body
- Validate frontendToken using `@mentra/sdk` (AuthenticatedRequest middleware)
- Extract `mentraUserId` from request (req.authUserId)
- Call Convex mutation `api.users.getOrCreate({ mentraUserId })`
- Generate Convex session token (JWT with 15min expiry)
- Return `{ convexToken, expiresAt, user }`

### 2. Wire Endpoint into Express (`src/index.ts`)
- Import the session handler
- Register the POST route on the Express app

### 3. Frontend Updates (`src/frontend/App.tsx`)
- After getting `frontendToken` from `useMentraAuth()`
- Call `/api/session/mentra` with fetch to exchange for Convex token
- Initialize `ConvexReactClient` with the session token
- Wrap app with `<ConvexProvider client={convex}>`
- Use `useQuery()` to fetch current user from Convex and display in UI

### 4. Install Dependencies
- `convex` (React client for frontend)
- `convex` (Node.js client for backend)
- `jsonwebtoken` (for creating Convex session tokens in backend)

## Acceptance Criteria
- [ ] Console logs show full token exchange flow (Mentra → Backend → Convex)
- [ ] Convex dashboard shows user record with correct mentraUserId
- [ ] Frontend displays: "Authenticated as Convex user [id]"
- [ ] Refreshing page reuses existing Convex user (no duplicate records created)
- [ ] Opening from different MentraOS sessions creates only one user per mentraUserId

## Code Style
- Follow AGENTS.md: tabs, double quotes, strict TypeScript
- Use `import type` for type imports
- Error handling: catch and display via UI

## Test Plan
1. Start backend: `bun run dev`
2. Start frontend: `bun run dev:frontend`
3. Open webview from MentraOS app
4. Console should log:
   - [Mentra] Got userId and frontendToken
   - [Backend] Exchanging token...
   - [Convex] Session created
   - [Convex] User: { _id: "...", mentraUserId: "..." }
5. Check Convex dashboard - verify users table has exactly 1 record
6. Refresh webview multiple times - still only 1 user record
7. Close and reopen from glasses - still same user record

## Next Layer
Layer 3 will add Polar payment gating with a test "pro feature".

## Copy this prompt to start new Amp conversation:
```
I'm implementing Layer 2 - Convex Token Bridge for Clairvoyant. Please help me create the backend endpoint that exchanges MentraOS frontendToken for Convex session token. See handoffs/LAYER-2-convex-bridge.md for full requirements.
```
