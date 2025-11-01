# Layer 4-PREP: Preferences UI

**Status:** Can run in PARALLEL with Layer 3
**Branch:** `feature/prefs-prep`
**Dependencies:** None

## Goal
Create settings page UI with weather unit toggle (Celsius/Fahrenheit) and navigation, without backend integration yet.

## Context
This is prep work for Layer 4. Build UI components for settings page with weather unit toggle. Can run in PARALLEL while Layer 3 is being implemented.

## What to Build

### 1. Preferences Schema (`convex/preferences.ts`)
```typescript
// Add to schema.ts:
preferences: defineTable({
  userId: v.id("users"),
  weatherUnit: v.string(), // "C" | "F"
  defaultLocation: v.optional(v.string()),
}).index("by_user", ["userId"])
```

Create functions:
- Query: `getPreferences(userId)` - returns user preferences
- Mutation: `updatePreferences({ userId, weatherUnit })` - saves changes

### 2. Settings Page (`src/frontend/components/SettingsPage.tsx`)
- Title: "Settings"
- Section: "Weather Preferences"
- Toggle switch component for Celsius ↔ Fahrenheit
- Shows current selection
- Save button (disabled/non-functional for now, just UI)
- Clean, simple styling

### 3. Weather Unit Toggle (`src/frontend/components/WeatherUnitToggle.tsx`)
- Reusable toggle component
- Props: `value: "C" | "F"`, `onChange: (unit) => void`
- Visual indicator showing C/F with active state
- Accessible (keyboard navigation, aria labels)

### 4. Navigation Component (`src/frontend/components/NavBar.tsx`)
- Links: Home | Settings | Billing
- Active route highlighting
- Use React Router or simple state-based routing
- Responsive layout

### 5. Routing Setup (`src/frontend/App.tsx` update)
- Install `react-router-dom` if not already
- Set up routes: `/` (home), `/settings`, `/billing`
- NavBar appears on all pages

## Acceptance Criteria
- [ ] Settings page renders with weather unit toggle
- [ ] Toggle switches between C/F (local state only, no persistence)
- [ ] NavBar links work and show active state
- [ ] UI is clean and functional
- [ ] No console errors
- [ ] Mobile-friendly layout

## Files to Create
```
convex/preferences.ts
src/frontend/components/
├── SettingsPage.tsx
├── NavBar.tsx
├── WeatherUnitToggle.tsx
└── BillingPage.tsx (placeholder)
```

## Code Style
- Follow AGENTS.md: tabs, double quotes
- Use TypeScript for all components
- Functional components with hooks

## UI/UX Notes
- Keep it simple and clean
- Clear labels: "Weather Unit: Celsius" or "Weather Unit: Fahrenheit"
- Visual feedback on toggle interaction
- Consider using a switch/toggle library or build custom

## Next Step
Merge into Layer 4 integration branch (feature/layer-4-preferences) when Layer 3 is complete.

## Copy this prompt to start new Amp conversation:
```
I'm preparing preferences UI for Clairvoyant (Layer 4 prep). Please help me create the settings page with weather unit toggle component. See handoffs/LAYER-4-PREP-preferences.md for full requirements.
```
