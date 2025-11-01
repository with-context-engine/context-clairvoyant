# Layer 3: Polar Payment Gate

**Status:** DEPENDS on Layer 2 being merged
**Branch:** `feature/layer-3-polar-gate`
**Dependencies:** Layer 2 merged, Polar prep branch merged

## Goal
Block a demo feature for free users, redirect to Polar checkout for upgrade, unblock after successful payment via webhook.

## Context
Layer 2 is complete and merged - users can authenticate and access Convex. Now add payment gating with a test "pro feature" that's locked for free users and unlocks after payment.

## What to Build

### 1. Test Feature Component (`src/frontend/components/ProFeatureDemo.tsx`)
- Query user subscription: `useQuery(api.subscriptions.getSubscription, { userId })`
- Show button: "🔓 Show Secret Pro Data"
- If tier === "free": Render `<UpgradeGate />` overlay
- If tier === "pro": On click → `console.log("🎉 SECRET PRO DATA: Exclusive content unlocked!")`

### 2. Upgrade Gate Component (`src/frontend/components/UpgradeGate.tsx`)
- Display current tier badge ("Free Tier" or "Pro Tier")
- If free: Show "Upgrade to Pro" button
- Use `usePolar()` hook from `@convex-dev/polar` (or manual Polar checkout API)
- On click → redirect to Polar checkout URL
- Include return URL back to webview

### 3. Complete Webhook Handler (`src/api/webhooks.ts`)
- Verify Polar webhook signature using `POLAR_WEBHOOK_SECRET`
- Handle events:
  - `checkout.completed` → set tier to "pro", status to "active"
  - `subscription.updated` → update tier and status
  - `subscription.canceled` → set status to "canceled", maybe downgrade tier
- Call Convex mutation: `api.subscriptions.updateFromPolar(...)`
- Log events for debugging
- Return 200 OK to acknowledge webhook

### 4. Initialize Default Subscriptions
- Update `convex/users.ts` in the `getOrCreate` mutation
- When creating new user, also create default subscription record with tier="free"

## Acceptance Criteria
- [ ] New user sees "Free Tier" badge in UI
- [ ] Clicking test feature button shows "🔒 This is a Pro feature. Upgrade to unlock"
- [ ] Click "Upgrade to Pro" → Redirects to Polar checkout
- [ ] Complete test payment using Polar test card: `4242 4242 4242 4242`
- [ ] Webhook fires and backend logs: "Received Polar webhook: checkout.completed"
- [ ] Convex subscriptions table updated: tier="pro", status="active"
- [ ] Webview refreshes → Shows "Pro Tier" badge
- [ ] Test feature now works: clicking button logs secret data to console

## Test Plan
1. Open webview from MentraOS app
2. See "Free Tier" badge
3. Try test feature → See upgrade gate
4. Click "Upgrade to Pro"
5. Complete Polar checkout with test card
6. Monitor backend console for webhook event
7. Refresh webview
8. See "Pro Tier" badge
9. Try test feature → Should work and log to console

## Code Style
- Follow AGENTS.md conventions
- Proper error handling for webhook failures
- Secure webhook signature verification

## Polar Test Cards
- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002

## Next Layer
Layer 4 will add real user preferences (weather unit toggle) that persists and affects voice handlers.

## Copy this prompt to start new Amp conversation:
```
I'm implementing Layer 3 - Polar Payment Gate for Clairvoyant. Please help me create the payment gate that blocks a test feature for free users and unlocks it after Polar payment. See handoffs/LAYER-3-polar-gate.md for full requirements.
```
