# Clairvoyant Webview Integration - Layer Handoffs

This directory contains handoff documents for each layer of the webview integration project.

## Layer Architecture (Russian Doll Model)

```
┌─────────────────────────────────────────────┐
│ Layer 4: User Preferences (Weather Units)  │
│  ┌───────────────────────────────────────┐  │
│  │ Layer 3: Polar Payment Gate          │  │
│  │  ┌─────────────────────────────────┐  │  │
│  │  │ Layer 2: Convex Token Bridge   │  │  │
│  │  │  ┌───────────────────────────┐  │  │  │
│  │  │  │ Layer 1: Mentra Auth      │  │  │  │
│  │  │  │ Hello World (console.log) │  │  │  │
│  │  │  └───────────────────────────┘  │  │  │
│  │  └─────────────────────────────────┘  │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Execution Order

### Week 1
- **MAIN**: Layer 1 - MentraOS Auth Hello World
- **PARALLEL**: Layer 2-PREP - Convex Setup

### Week 2
- **MAIN**: Layer 2 - Convex Token Bridge
- **PARALLEL**: Layer 3-PREP - Polar Setup

### Week 3
- **MAIN**: Layer 3 - Polar Payment Gate
- **PARALLEL**: Layer 4-PREP - Preferences UI

### Week 4
- **MAIN**: Layer 4 - User Preferences Integration

## How to Use These Handoffs

Each `.md` file contains:
1. **Goal** - What this layer accomplishes
2. **Context** - Background and dependencies
3. **What to Build** - Detailed implementation steps
4. **Acceptance Criteria** - Checklist for completion
5. **Test Plan** - How to verify it works
6. **Copy this prompt** - Text to paste into new Amp conversation

### Starting a New Layer

1. Open the appropriate `.md` file
2. Read through the requirements
3. Copy the prompt at the bottom
4. Start a new Amp conversation
5. Paste the prompt to begin

### Example

To start Layer 1:
1. Open `LAYER-1-mentra-hello.md`
2. Copy the prompt at the bottom
3. Start new Amp conversation
4. Paste: "I'm implementing Layer 1 of the Clairvoyant webview integration..."

## Git Worktree Strategy

Each layer can be developed in a separate worktree:

```bash
# Layer 1
git worktree add ../clairvoyant-layer1 -b feature/layer-1-mentra-hello

# Layer 2 Prep (parallel)
git worktree add ../clairvoyant-convex-prep -b feature/convex-prep

# Layer 2
git worktree add ../clairvoyant-layer2 -b feature/layer-2-convex-bridge

# Layer 3 Prep (parallel)
git worktree add ../clairvoyant-polar-prep -b feature/polar-prep

# Layer 3
git worktree add ../clairvoyant-layer3 -b feature/layer-3-polar-gate

# Layer 4 Prep (parallel)
git worktree add ../clairvoyant-prefs-prep -b feature/prefs-prep

# Layer 4
git worktree add ../clairvoyant-layer4 -b feature/layer-4-preferences
```

## Files in This Directory

- `LAYER-1-mentra-hello.md` - Start here: MentraOS authentication
- `LAYER-2-PREP-convex.md` - Parallel prep: Convex setup
- `LAYER-2-convex-bridge.md` - MentraOS → Convex token exchange
- `LAYER-3-PREP-polar.md` - Parallel prep: Polar products
- `LAYER-3-polar-gate.md` - Payment gating with test feature
- `LAYER-4-PREP-preferences.md` - Parallel prep: Settings UI
- `LAYER-4-preferences-integration.md` - Final: Weather unit preferences

## Questions?

Refer back to the main thread where this architecture was designed, or consult AGENTS.md for code style and project structure.
