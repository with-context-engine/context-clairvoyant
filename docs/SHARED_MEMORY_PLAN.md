# Shared Memory Between Users — Implementation Plan

## Status: Architecture Finalized / Ready for Phase 0

## Problem

Memory is currently strictly user-scoped. Each user's Honcho peers (`{userId}-diatribe`, `{userId}-synthesis`) are isolated — no user can access another's facts, context, or session history. This prevents use cases like:

- **Embodied perspective**: "What would Sarah think about this Kubernetes migration I'm following up on?"
- **Cross-user enrichment**: Follow-up conversations and email note threads that draw on connected users' knowledge and opinions
- **Collaborative recall**: A user's follow-up or email reply is enriched with relevant context from colleagues/family who are also Clairvoyant users

## Core Insight: Query-Scoped Cross-Peer Lookups

**This is NOT a data-sharing system.** We do not share raw transcripts, session summaries, or chat messages between users. Instead, at **query time** (during follow-ups and email replies), we make targeted cross-peer queries against connected users' existing Honcho diatribe peers using the v3 dialectic API.

The key mechanism: `peer.chat(query, { target })` — ask Honcho "What does Sarah's representation know about Kubernetes?" and get back a synthesized, abstracted answer. Honcho returns facts and deductions, not raw speech.

**Integration surfaces:**
- **Follow-up conversations** (`followupsChat.ts`) — when Ajay continues a follow-up, the system queries connected users' peers for relevant perspective
- **Email note replies** (`emailReply.ts`) — when Ajay replies to an email note, connected users' perspectives enrich the response

**NOT integration surfaces (unchanged):**
- Real-time glasses responses — no cross-peer queries during live transcription
- `MemoryRecall` handler — stays single-user for now
- `MemoryCapture` handler — no changes, all captures remain private

## Current Architecture (as-is)

```
User A                          User B
  │                               │
  ├── Peer: {userA}-diatribe      ├── Peer: {userB}-diatribe
  ├── Peer: {userA}-synthesis     ├── {userB}-synthesis
  │                               │
  └── Honcho Session (isolated)   └── Honcho Session (isolated)
```

- **Convex schema**: All tables keyed by single `userId: v.id("users")`. No user-to-user relationships exist.
- **Honcho peer IDs**: Hardcoded to `{userId}-{type}`. Peers are never shared across users.
- **Follow-ups**: `sendFollowupMessage` in `followupsChat.ts` fetches memory from user's own diatribe peer only.
- **Email replies**: `processEmailReply` in `emailReply.ts` fetches peerCard from user's own diatribe peer only.

## Honcho v3 SDK Capabilities

Our codebase uses **older SDK patterns**. The v3 SDK provides:

| Capability | Our current usage | v3 API |
|---|---|---|
| Peer context | `session.getContext({ peerTarget })` | `peer.chat(query)` (dialectic API) |
| Cross-peer queries | Not available | `peer.chat(query, { target })` |
| Messages | `session.addMessages([{ peer_id, content }])` | `peer.message(content)` |
| Observation config | Not used | `SessionPeerConfig` with `observe_me`/`observe_others` |
| Cross-peer representations | Not available | `session.working_rep(peerA, peerB)` |

**Critical dependency**: `peer.chat(query, { target })` is the core mechanism for cross-peer queries. Phase 0 must confirm this is available.

## Proposed Architecture (to-be)

```
User A (Ajay)                              User B (Sarah)
  │                                          │
  ├── {ajay}-diatribe (private peer)         ├── {sarah}-diatribe (private peer)
  ├── {ajay}-synthesis (private peer)        ├── {sarah}-synthesis (private peer)
  │                                          │
  └── Connection (bidirectional, consented) ──┘
        │
        ├── status: "active"
        ├── sharedMemoryEnabled: true (both opted in)
        ├── Labels: Ajay calls it "wife", Sarah calls it "husband"
        │
        └── At query time (follow-up / email reply):
            1. Ajay asks about "Kubernetes migration"
            2. System finds active connections with sharedMemoryEnabled
            3. Query: sarah-diatribe.chat(
                 "What relevant non-sensitive context does this person have about Kubernetes?",
                 { target: ajay-diatribe }
               )
            4. Sensitivity filter (BAML gate): is this safe to surface?
            5. Inject into follow-up/email response with attribution
```

### Layer 1: Convex — User Connections

Bidirectional, consent-based relationships between users.

```
connections table:
  - requesterId: v.id("users")          // who initiated
  - accepterId: v.id("users")           // who accepted
  - status: "pending" | "active" | "revoked"
  - sharedMemoryEnabled: v.boolean()     // both must opt in, both must be Pro
  
  indexes:
    by_requester: [requesterId]
    by_accepter: [accepterId]
    by_pair: [requesterId, accepterId]   // uniqueness check
```

Per-user labels (since "wife" vs "husband" differs by side):

```
connectionLabels table:
  - connectionId: v.id("connections")
  - userId: v.id("users")               // which side's label
  - label: v.string()                   // "wife", "Sarah", "my coworker Alex"
  
  indexes:
    by_connection: [connectionId]
    by_user: [userId]
```

**Connection setup is web-only.** Both users must already have Clairvoyant accounts. User A enters User B's email on the web dashboard, User B accepts on their dashboard.

### Layer 2: Query-Time Cross-Peer Lookup

No shared peer. No shared session. At query time, we query the connected user's existing private diatribe peer via the dialectic API.

**In `followupsChat.ts` (`sendFollowupMessage`):**

```typescript
// After fetching user's own memory context (existing code)...

// Fetch active connections with shared memory enabled
const connections = await ctx.runQuery(
  internal.connections.getActiveSharedMemoryConnections,
  { userId: user._id }
);

// For each connection, query the connected user's diatribe peer
const crossPeerContexts = await Promise.all(
  connections.map(async (conn) => {
    const connectedUserId = conn.requesterId === user._id 
      ? conn.accepterId 
      : conn.requesterId;
    const label = conn.label; // "wife — Sarah", "coworker — Alex"
    
    const connectedPeer = await honchoClient.peer(`${connectedUserId}-diatribe`);
    const perspective = await connectedPeer.chat(
      `What relevant context does this person have about: ${followup.topic}? ` +
      `Exclude any health/medical, financial, romantic, legal, or family-conflict information.`,
      { target: userPeer }
    );
    
    return { label, perspective };
  })
);

// Pass to BAML for sensitivity filtering + response generation
```

**In `emailReply.ts` (`processEmailReply`):**

Same pattern — query connected users' diatribe peers with the email note's topic/subject as the query.

### Layer 3: Sensitivity Filter

Two-layer protection:

**A) Query-scoped prompt** (in the `peer.chat()` query itself):
> "Exclude any health/medical, financial, romantic/sexual, legal, family-conflict, or credential/account information."

**B) BAML sensitivity gate** (post-filter, lightweight):

```baml
enum SensitivityCategory {
    SAFE @description("Professional, shared interests, general knowledge, plans")
    SENSITIVE @description("Health, finances, legal, romantic, family conflicts, credentials")
}

function CheckSensitivity(crossPeerContext: string) -> SensitivityCategory {
    client "Groq"  // Fast, cheap
    prompt #"
    Classify whether this cross-peer context contains sensitive personal information.
    
    SENSITIVE categories (return SENSITIVE if ANY are present):
    - Health or medical conditions
    - Financial details (salary, debt, investments)
    - Romantic or sexual content
    - Legal matters
    - Family conflicts or personal disputes
    - Passwords, credentials, or private account details
    
    Context to classify:
    {{ crossPeerContext }}
    
    {{ ctx.output_format }}
    "#
}
```

If the gate returns `SENSITIVE`, drop that cross-peer context entirely. No partial filtering — it's all-or-nothing per connection to keep it simple.

### Layer 4: Attribution in Responses

Cross-peer context is injected with attribution using the connection label:

```
CONNECTED USER PERSPECTIVES:
From "wife — Sarah":
- Sarah has been researching serverless alternatives to Kubernetes
- Sarah expressed concerns about operational complexity of container orchestration
```

The BAML response formatter (InterpretFollowupChat / InterpretEmailReply) weaves this naturally:
> "You bookmarked the Kubernetes migration topic. Worth noting — Sarah has been looking into serverless alternatives and has concerns about the operational complexity."

## Revocation Semantics

When a connection is revoked (either side):
- **Immediately stop** making cross-peer queries for that connection (`status !== "active"` check)
- **Leave past data** — responses already generated with cross-peer context remain in `followupChatMessages` and `emailThreadMessages`. The consent was valid when the data was surfaced.
- **No Honcho cleanup needed** — we never created shared peers or sessions, so there's nothing to tear down.

## Pro Gating

- **Both users must be Pro** to enable `sharedMemoryEnabled` on a connection
- The connection itself (Phase 1) can exist without Pro — it's just a social link
- If either user's Pro lapses, cross-peer queries silently stop (check at query time)
- Cost rationale: each cross-peer query adds 1-2 Honcho API calls + 1 BAML sensitivity gate call per connection

## Implementation Phases

### Phase 0: SDK Evaluation (prerequisite)

**Goal**: Confirm `peer.chat(query, { target })` is available and plan upgrade if needed.

1. Check current `@honcho-ai/sdk` version in `package.json` against latest v3.x
2. Test if `peer.chat(query, { target })` (dialectic API) works with our version
3. If upgrade needed, plan a separate PR for SDK migration
4. Verify backward compatibility with existing `getContext()` / `addMessages()` patterns
5. **Decision gate**: If dialectic API is unavailable, we need an alternative approach (manual context merging via `getContext()` on both peers)

### Phase 1: Connections (Convex only, no Honcho changes)

**Goal**: Let users connect with each other via the web dashboard.

1. Add `connections` + `connectionLabels` tables to Convex schema
2. Add Convex mutations: `createConnection` (by email lookup), `acceptConnection`, `revokeConnection`
3. Add Convex queries: `getConnectionsForUser`, `getActiveSharedMemoryConnections`
4. Web UI: connections management page
   - Search by email → send invite
   - Pending invites list → accept/reject
   - Active connections → set label, toggle sharedMemoryEnabled, revoke
5. **No memory changes yet** — purely relational infrastructure
6. Both users must be Pro to toggle `sharedMemoryEnabled`

### Phase 2: Cross-Peer Queries in Follow-ups

**Goal**: Follow-up conversations draw on connected users' perspectives.

1. Upgrade SDK if needed (Phase 0 outcome)
2. In `followupsChat.ts` `sendFollowupMessage`:
   - After existing `fetchMemoryContext()`, query active connections
   - For each connection, call `peer.chat(topic, { target })` against connected user's diatribe peer
   - Run BAML `CheckSensitivity` gate on each result
   - Pass safe cross-peer contexts to `InterpretFollowupChat` BAML function
3. Extend `FollowupChatContext` BAML class with `crossPeerContext` field
4. Update `InterpretFollowupChat` prompt to handle attributed cross-peer perspectives
5. Add `CheckSensitivity` BAML function in new `baml_src/sensitivity.baml`
6. Test: Ajay follows up on "Kubernetes migration", Sarah's perspective on containers is surfaced with attribution

### Phase 3: Cross-Peer Queries in Email Replies

**Goal**: Email note reply threads draw on connected users' perspectives.

1. In `emailReply.ts` `processEmailReply`:
   - After existing peerCard fetch, query active connections
   - Same cross-peer query + sensitivity filter pattern as Phase 2
   - Pass to `InterpretEmailReply` BAML function with cross-peer context
2. Extend email reply BAML context class with cross-peer perspectives
3. Update `InterpretEmailReply` prompt for attributed cross-peer weaving
4. Test: Ajay replies to an email note about a topic Sarah has discussed, her perspective enriches the reply

### Phase 4: Advanced Cross-Peer Features (future)

**Goal**: Deeper cross-peer reasoning and additional surfaces.

1. Use `session.working_rep(peerA, peerB)` for pre-computed cross-peer representations (faster than per-query `peer.chat`)
2. Extend to real-time glasses responses (MemoryRecall handler) for "What does Sarah think about X?" queries
3. Add cross-peer context to web chat (`chat.ts` `sendMessage`) for daily recap conversations
4. Group connections (3+ users, e.g., a team sharing context)

### Phase 5: Passive Sharing & Smart Detection (future)

**Goal**: Automatically detect when cross-peer context would be relevant.

1. Topic-overlap detection: when a follow-up topic matches known topics in a connected user's peer representation, proactively surface their perspective
2. "We" detection in queries: "What do we think about X?" triggers cross-peer lookup
3. Connection-label matching: "What did Sarah say about X?" detects "Sarah" as a connection label and routes to cross-peer query

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | **Query-scoped cross-peer lookups** | No shared peers, no shared sessions. Query connected users' existing diatribe peers at query time via dialectic API. Simplest, most privacy-respecting approach. |
| Integration surfaces | **Follow-ups + email replies only** | These are reflective, async surfaces where cross-peer enrichment adds value. Real-time glasses responses stay single-user. |
| Sensitivity filter | **Prompt-scoped + BAML gate** | Two layers: exclude sensitive categories in the dialectic query prompt, then post-filter with a cheap BAML binary classifier. Fixed category list, no user customization. |
| Sensitive categories | **Health, finances, romantic, legal, family conflicts, credentials** | Fixed list, sufficient for Phase 1. No per-user customization needed. |
| Connection setup | **Web dashboard only, existing users only** | Users search by email, send invite, accept on web. No QR codes, no invite-to-join for non-users. Glasses experience is passive. |
| Connection model | **Bidirectional with explicit accept** | Prevents unwanted data exposure. Both sides must consent. |
| Pro gating | **Both users must be Pro** | Shared memory doubles Honcho API calls per query. Connection can exist without Pro, but `sharedMemoryEnabled` requires both. |
| Label storage | **Per-side labels** | "wife" from Ajay's side, "husband" from Sarah's side. Same connection, different labels. |
| Revocation | **Stop future queries, leave past data** | Revocation immediately stops cross-peer queries. Responses already generated remain — consent was valid when surfaced. No Honcho cleanup needed. |
| Data shared | **Honcho abstractions only, never raw data** | Cross-peer queries return Honcho's synthesized facts/deductions, not raw transcripts, session summaries, or chat messages. |

## Resolved Questions

1. **Connection discovery**: Web dashboard, email-based lookup. Both users must already have accounts.
2. **Honcho shared peer lifecycle**: Not needed — we use query-time dialectic API against existing private peers.
3. **Revocation semantics**: Stop querying, leave past data. No shared constructs to tear down.
4. **Pro gating**: Both users must be Pro for `sharedMemoryEnabled`.
5. **What data is shared**: Honcho peer abstractions only (facts, deductions, peerCard). Never raw Convex data (summaries, chats, transcripts).
6. **Sensitivity**: Fixed category filter (health, finances, romantic, legal, family conflicts, credentials). Two-layer: prompt + BAML gate.

## Open Questions

1. **SDK upgrade scope**: Can we upgrade `@honcho-ai/sdk` without breaking existing `getContext()` / `addMessages()` patterns? Is v3 backward-compatible?
2. **Rate limiting / latency budget**: Each cross-peer query adds ~200-500ms (Honcho) + ~100ms (BAML gate). With N connections, this multiplies. Cap at 3 connections per user? Parallelize queries?
3. **Dialectic API cost**: `peer.chat()` pricing per query. Need to evaluate cost per follow-up/email interaction with cross-peer queries.
4. **Attribution UX**: Should the follow-up/email response explicitly name the connected user ("Sarah thinks...") or be more ambient ("Your team has discussed...")? Current plan: explicit attribution with connection label.

## Files to Modify (by phase)

### Phase 0
- `package.json` / `bun.lock` — evaluate and potentially upgrade `@honcho-ai/sdk`
- Test script to verify `peer.chat(query, { target })` works

### Phase 1
- `packages/convex/schema.ts` — add `connections`, `connectionLabels` tables
- `packages/convex/connections.ts` — new file: mutations + queries
- `apps/web/` — connection management UI (search, invite, accept, label, toggle, revoke)

### Phase 2
- `packages/convex/followupsChat.ts` — add cross-peer query logic in `sendFollowupMessage`
- `baml_src/followup.baml` — extend `FollowupChatContext` with `crossPeerContext`, update prompt
- `baml_src/sensitivity.baml` — new file: `CheckSensitivity` function
- `packages/convex/connections.ts` — add `getActiveSharedMemoryConnections` query

### Phase 3
- `packages/convex/emailReply.ts` — add cross-peer query logic in `processEmailReply`
- `baml_src/emailReply.baml` — extend context class with cross-peer perspectives, update prompt

### Phase 4
- `packages/convex/followupsChat.ts` — optimize with `working_rep()` caching
- `apps/application/src/handlers/memory.ts` — extend `MemoryRecall` with cross-peer support
- `packages/convex/chat.ts` — extend `sendMessage` with cross-peer context

### Phase 5
- `baml_src/sensitivity.baml` — topic-overlap detection
- `packages/convex/followupsChat.ts` — proactive cross-peer surfacing
- `baml_src/route.baml` — connection-label detection in routing
