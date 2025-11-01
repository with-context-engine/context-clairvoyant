# Layer 4: User Preferences Integration

**Status:** DEPENDS on Layer 3 being merged
**Branch:** `feature/layer-4-preferences`
**Dependencies:** Layer 3 merged, Prefs prep branch merged

## Goal
Authenticated users can toggle weather units (C ↔ F) in settings, preference persists in Convex, and voice weather queries use the user's preferred unit.

## Context
Layer 3 is complete and merged - payment gating works with Polar. Now add real functionality: users can change their weather unit preference (Celsius/Fahrenheit) in the webview, it persists in Convex, and the voice weather handler respects this preference.

## What to Build

### 1. Wire Up Settings Page (`src/frontend/components/SettingsPage.tsx`)
- Use `useQuery(api.preferences.getPreferences, { userId })` to load current setting
- Use `useMutation(api.preferences.updatePreferences)` when user clicks save
- Show loading spinner while fetching
- Show success message after save
- Handle case where preferences don't exist yet (default to Celsius)

### 2. Initialize Preferences on User Creation
- Update `convex/users.ts` in the `getOrCreate` mutation
- When creating new user, also create default preferences record with `weatherUnit: "C"`

### 3. Update Weather Handler (`src/utils/handlers/weather.ts`)
- At start of flow, query user's preference from Convex
- Pass `preferredUnit` parameter to weather tool
- Format final response using user's unit

### 4. Update Weather Tool (`src/utils/tools/weatherCall.ts`)
- Accept optional `preferredUnit: "C" | "F"` parameter (default "C")
- If unit is "F", convert Celsius temperatures to Fahrenheit
- Return temperature with correct unit symbol (°C or °F)
- Formula: F = (C × 9/5) + 32

### 5. Backend Convex Client Setup
- Install Convex Node.js client if not already: `npm install convex`
- Create `src/utils/core/convex.ts` to initialize Convex client for backend
- Use in weather handler to query preferences

## Acceptance Criteria
- [ ] Open webview → Navigate to Settings
- [ ] See current preference (default: Celsius for new users)
- [ ] Switch to Fahrenheit → Click Save
- [ ] See success message
- [ ] Console logs: "Preference saved: weatherUnit=F"
- [ ] Refresh page → Still shows Fahrenheit
- [ ] Put on glasses, ask "What's the weather in San Francisco?"
- [ ] Response uses Fahrenheit (e.g., "It's 65°F and partly cloudy")
- [ ] Change back to Celsius in webview
- [ ] Ask weather question again via voice
- [ ] Response now uses Celsius (e.g., "It's 18°C and partly cloudy")

## Test Plan
1. Open webview from MentraOS app
2. Navigate to Settings page
3. See "Weather Unit: Celsius" (default)
4. Click toggle to switch to Fahrenheit
5. Click "Save Preferences"
6. See success toast/message
7. Check Convex dashboard - preferences table has record with weatherUnit="F"
8. Refresh webview - still shows Fahrenheit
9. Put on glasses
10. Say "What's the weather in New York?"
11. Listen to response - should include "°F"
12. Open webview, switch back to Celsius, save
13. Ask weather question again
14. Listen to response - should include "°C"

## Code Style
- Follow AGENTS.md conventions
- Handle errors gracefully (Convex query failures, etc.)
- Add loading states in UI

## Edge Cases to Handle
- User has no preferences yet (first time)
- Convex query fails (show error in UI)
- User changes preference while voice query in progress (use latest)

## Next Step
All layers complete! Ready for production deployment and documentation.

## Copy this prompt to start new Amp conversation:
```
I'm implementing Layer 4 - User Preferences Integration for Clairvoyant. Please help me wire up the settings page to Convex and make the voice weather handler respect user preferences. See handoffs/LAYER-4-preferences-integration.md for full requirements.
```
