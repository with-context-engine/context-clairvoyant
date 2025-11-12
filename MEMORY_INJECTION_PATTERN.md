# Memory Injection Pattern for Tool Handlers

This document describes the pattern for adding proactive memory recall to tool handlers in Clairvoyant. This enables contextual, personalized responses based on user's stored memories.

## Overview

The pattern enables tools (like Weather, Maps, Web Search) to access user memory and weave relevant personal context into their responses naturally.

**Example**: Weather response that knows your name and preferences:
- Without memory: "Today's vibe: 9/10, sunny with a breeze feels nice!"
- With memory: "Today's vibe: 9/10, Ajay - perfect for your morning run!"

## Implementation Reference: Weather Handler

The Weather handler (`src/application/handlers/weather.ts`) was the first to implement this pattern. Use it as a reference for other tools.

## Step-by-Step Pattern

### 1. Update Handler Function Signature

Add optional `memorySession` and `peers` parameters to your handler:

```typescript
import type { Peer, Session } from "@honcho-ai/sdk";

export async function startYourToolFlow(
  session: AppSession,
  memorySession?: Session,  // Add this
  peers?: Peer[],           // Add this
) {
  // ... handler implementation
}
```

### 2. Add Memory Context Fetching

After your main data fetch (e.g., after weather API call), add memory context retrieval:

```typescript
import { checkUserIsPro, convexClient } from "../core/convex";
import { api } from "../../../convex/_generated/api";

// Fetch memory context if available
let memoryContext: { userName?: string; userFacts: string[] } | null = null;
if (memorySession && peers) {
  try {
    const isPro = await checkUserIsPro(mentraUserId);
    if (isPro) {
      const user = await convexClient.query(
        api.polar.getCurrentUserWithSubscription,
        { mentraUserId },
      );
      if (user) {
        const userId = user._id;
        const diatribePeer = peers.find((peer) => peer.id === `${userId}-diatribe`);
        
        if (diatribePeer) {
          session.logger.info("[Clairvoyant] Fetching memory context for personalization");
          const contextData = await memorySession.getContext({
            peerTarget: diatribePeer.id,
            lastUserMessage: "your-tool-name", // e.g., "weather", "maps", "search"
          }) as {
            peerCard: string[];
          };

          // Extract name and relevant facts from peerCard
          const userName = contextData.peerCard.find((fact: string) => fact.startsWith("Name:"))?.replace("Name:", "").trim();
          const relevantFacts = contextData.peerCard.slice(0, 3).filter((fact: string) => !fact.startsWith("Name:"));
          
          memoryContext = {
            userName,
            userFacts: relevantFacts,
          };
          session.logger.info(`[Clairvoyant] Memory context: ${JSON.stringify(memoryContext)}`);
        }
      }
    }
  } catch (error) {
    session.logger.warn(`[Clairvoyant] Failed to fetch memory context: ${String(error)}`);
  }
}
```

### 3. Update BAML Function

Add a `MemoryContextLite` class and optional memory parameter to your BAML function:

```baml
class MemoryContextLite {
  userName string? @description("User's name if known")
  userFacts string[] @description("Relevant biographical facts about the user")
}

function YourToolFormatter(
  input: YourDataType,
  memory: MemoryContextLite?  // Add this optional parameter
) -> YourOutputType {
  client "openai/gpt-4o-mini"
  
  prompt #"
  Your existing prompt...
  
  {% if memory and (memory.userName or memory.userFacts|length > 0) %}
  User Context (weave naturally if relevant):
  {% if memory.userName %}Name: {{ memory.userName }}{% endif %}
  {% for fact in memory.userFacts %}
  - {{ fact }}
  {% endfor %}
  {% endif %}
  
  Style rules:
  - ... your existing rules ...
  - The third line should be ... OR a personalized insight based on user context.
  "#
}
```

### 4. Pass Memory to BAML Call

Update your BAML function call to include the memory context:

```typescript
const result = await b.YourToolFormatter(yourData, memoryContext);
```

### 5. Update Routing in transcriptionFlow.ts

Pass memory session and peers to your handler:

```typescript
case Router.YOUR_TOOL:
  session.logger.info(`[Clairvoyant] Your Tool route: starting async flow`);
  void recordToolInvocation(mentraUserId, Router.YOUR_TOOL);
  void startYourToolFlow(session, memorySession, peers);  // Add memorySession and peers
  return;
```

### 6. Regenerate BAML Client

After modifying BAML files, regenerate the client:

```bash
npx baml-cli generate
```

### 7. Test Your Changes

Run BAML tests to verify your changes work:

```bash
bunx baml-cli test -i "YourToolFormatter::"
```

## Key Design Principles

1. **Graceful Degradation**: Memory injection is optional - if no memory exists or fetching fails, the tool still works normally
2. **Lightweight Context**: Use `peerCard` only (biographical summary) rather than full context retrieval to minimize latency
3. **Subtle Integration**: Let the LLM weave memories naturally - don't force them into every response
4. **Privacy-First**: Only Pro users get memory features; check `isPro` status before fetching
5. **Error Handling**: Wrap memory fetching in try-catch; log warnings but don't fail the tool

## Memory Context Structure

### peerCard Format
The `peerCard` is an array of biographical facts:
```typescript
[
  "Name: Ajay Bhargava",
  "Date of birth: December 19, 1987",
  "Age: 37",
  "Children: Two daughters (Koyal and Kavya)",
  "Location: San Francisco",
  // ... more facts
]
```

### Extracted Context
We extract and normalize to:
```typescript
{
  userName?: string,        // e.g., "Ajay Bhargava"
  userFacts: string[]      // e.g., ["Age: 37", "Location: San Francisco"]
}
```

## Performance Considerations

- **Honcho API latency**: `getContext()` adds ~200-500ms
- **When to fetch**: After primary data (weather, maps, etc.) to parallelize work
- **Timeout handling**: Use stale request detection (`runId` pattern) to prevent late responses

## Example Outputs

### Weather Without Memory
```
Today's vibe: 9/10, sunny with a breeze feels nice!
Current temp is 23.9°C, clear skies with low humidity.
Tomorrow brings rain, so enjoy today while you can!
```

### Weather With Memory
```
Today's vibe: 9/10, Ajay - perfect for your morning run!
Current temp is 23.9°C, clear skies with low humidity.
Remember you mentioned liking this kind of weather!
```

## Applying to Other Tools

### Maps Handler
- Personalize location suggestions based on past preferences
- Reference previously saved favorite places

### Web Search Handler
- Tailor results based on user's interests from memory
- Reference related topics the user has mentioned

### Knowledge Handler
- Connect new knowledge to user's existing context
- Personalize explanations based on user's background

## Testing Strategy

1. **BAML Tests**: Verify formatter works with and without memory
2. **Manual Testing**: Test with Pro and non-Pro accounts
3. **Edge Cases**: Test with empty peerCard, missing name, API failures
4. **Performance**: Monitor latency impact of memory fetching

## Future Enhancements

- Cache peerCard data for the session to reduce Honcho API calls
- Intelligent fact selection based on tool context (e.g., prioritize location facts for maps)
- Memory usage analytics to understand which facts are most useful
- User controls for memory personalization preferences
