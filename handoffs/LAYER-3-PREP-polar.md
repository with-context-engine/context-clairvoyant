# Layer 3-PREP: Polar Setup

**Status:** Can run in PARALLEL with Layer 2
**Branch:** `feature/polar-prep`
**Dependencies:** None

## Goal
Configure Polar products (Free/Pro tiers) and prepare Convex schema for subscriptions.

## Context
This is prep work for Layer 3 payment gating. Can run in PARALLEL while Layer 2 is being implemented. Setting up Polar account and products for subscription payments.

## What to Build

### 1. Polar Account Setup
- Create account at polar.sh
- Create two products:
  - Product 1: "Free Tier" (no charge, used as default tier marker)
  - Product 2: "Pro Monthly" ($5/month or test amount, unlimited queries)
- Configure webhook URL (will be `https://yourdomain.com/api/webhooks/polar`)
- Get `POLAR_ACCESS_TOKEN` from Polar dashboard settings

### 2. Install Convex Polar Component
```bash
npx convex components add polar
```
Or: `npm install @convex-dev/polar`

### 3. Create Subscriptions Schema (`convex/subscriptions.ts`)
```typescript
// Add to schema.ts:
subscriptions: defineTable({
  userId: v.id("users"),
  polarCustomerId: v.optional(v.string()),
  tier: v.string(), // "free" | "pro"
  status: v.string(), // "active" | "canceled" | "past_due"
  expiresAt: v.optional(v.number()),
}).index("by_user", ["userId"])
```

Create functions:
- Query: `getSubscription(userId)` - returns current subscription
- Mutation: `updateFromPolar({ userId, polarCustomerId, tier, status, expiresAt })` - called by webhook

### 4. Webhook Endpoint Structure (`src/api/webhooks.ts`)
- POST `/api/webhooks/polar` route
- Verify Polar webhook signature (placeholder for now)
- Parse webhook event
- Call Convex mutation to update subscription
- Return 200 OK
- (Don't implement full logic yet, just the structure)

### 5. Environment Setup
- Add `POLAR_ACCESS_TOKEN` to `.env`
- Add `POLAR_WEBHOOK_SECRET` to `.env` (get from Polar dashboard)
- Update `.env.example`

## Acceptance Criteria
- [ ] Polar account created with Free and Pro products
- [ ] Product IDs saved somewhere accessible
- [ ] `POLAR_ACCESS_TOKEN` in `.env`
- [ ] `@convex-dev/polar` component installed
- [ ] Subscriptions schema added to Convex (deploy with `npx convex deploy`)
- [ ] Webhook endpoint structure exists (even if not fully implemented)

## Files to Create
```
convex/subscriptions.ts
src/api/webhooks.ts
```

## Reference
Polar docs: https://www.convex.dev/components/polar

## Next Step
Merge into Layer 3 integration branch (feature/layer-3-polar-gate) when Layer 2 is complete.

## Copy this prompt to start new Amp conversation:
```
I'm preparing Polar payment integration for Clairvoyant (Layer 3 prep). Please help me set up Polar account, products, and Convex subscriptions schema. See handoffs/LAYER-3-PREP-polar.md for full requirements.
```
