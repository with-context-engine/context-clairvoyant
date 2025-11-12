# Memory Injection Pattern for Tool Handlers

This document describes the pattern for adding proactive memory recall to tool handlers in Clairvoyant. This enables contextual, personalized responses based on user's stored memories.

## Overview

The pattern enables tools (like Weather, Maps, Web Search) to access user memory and weave relevant personal context into their responses naturally. It leverages both biographical facts (peerCard) and deductive conclusions (from peerRepresentation) to create personalized, context-aware responses.

**Example**: Weather response that knows your name and preferences:
- Without memory: "Today's vibe: 9/10, sunny with a breeze feels nice!"
- With memory (biographical): "Today's vibe: 9/10, Ajay - perfect for your morning run!"
- With memory (deductive): "Today's vibe: 9/10, Ajay - chilly but you like cold weather!"

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
let memoryContext: { userName?: string; userFacts: string[]; deductiveFacts: string[] } | null = null;
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
            peerRepresentation: string;
          };

          // Parse peerRepresentation JSON for explicit and deductive facts
          let peerRep: {
            explicit: Array<{ content: string }>;
            deductive: Array<{ conclusion: string; premises: string[] }>;
          };
          try {
            peerRep = JSON.parse(contextData.peerRepresentation);
          } catch (error) {
            session.logger.error(
              `[Clairvoyant] Error parsing peerRepresentation: ${error}`,
            );
            peerRep = { explicit: [], deductive: [] };
          }

          // Extract name and relevant facts from peerCard
          const userName = contextData.peerCard.find((fact: string) => fact.startsWith("Name:"))?.replace("Name:", "").trim();
          const relevantFacts = contextData.peerCard.slice(0, 3).filter((fact: string) => !fact.startsWith("Name:"));
          
          // Extract tool-relevant deductive conclusions
          // Customize filter keywords based on your tool (e.g., "weather", "location", "preference")
          const toolRelatedDeductions = peerRep.deductive
            .map((d) => d.conclusion)
            .filter((conclusion: string) => 
              conclusion.toLowerCase().includes("keyword1") ||  // Replace with tool-specific keywords
              conclusion.toLowerCase().includes("keyword2") ||
              conclusion.toLowerCase().includes("preference")
            )
            .slice(0, 2); // Limit to top 2 relevant deductions
          
          memoryContext = {
            userName,
            userFacts: relevantFacts,
            deductiveFacts: toolRelatedDeductions,
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
  deductiveFacts string[] @description("Relevant deductive conclusions about the user's preferences and behaviors")
}

function YourToolFormatter(
  input: YourDataType,
  memory: MemoryContextLite?  // Add this optional parameter
) -> YourOutputType {
  client "openai/gpt-4o-mini"
  
  prompt #"
  Your existing prompt...
  
  {% if memory and (memory.userName or memory.userFacts|length > 0 or memory.deductiveFacts|length > 0) %}
  User Context (weave naturally if relevant):
  {% if memory.userName %}Name: {{ memory.userName }}{% endif %}
  {% for fact in memory.userFacts %}
  - {{ fact }}
  {% endfor %}
  {% for fact in memory.deductiveFacts %}
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
2. **Rich Context**: Use both `peerCard` (biographical summary) and `peerRepresentation` (deductive conclusions) for deeper personalization
3. **Tool-Specific Filtering**: Filter deductive conclusions by relevance to your tool (e.g., weather preferences for weather tool)
4. **Subtle Integration**: Let the LLM weave memories naturally - don't force them into every response
5. **Privacy-First**: Only Pro users get memory features; check `isPro` status before fetching
6. **Error Handling**: Wrap memory fetching and JSON parsing in try-catch; log warnings but don't fail the tool

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

### peerRepresentation Format
The `peerRepresentation` is a JSON string containing explicit and deductive facts:
```typescript
{
  explicit: [
    { content: "User's name is Ajay Bhargava" },
    { content: "User stated they are from Canada" }
  ],
  deductive: [
    { 
      conclusion: "User likes cold weather because they are from Canada",
      premises: ["User stated they are from Canada", "Canadians like cold weather"]
    }
  ]
}
```

### Extracted Context
We extract and normalize to:
```typescript
{
  userName?: string,           // e.g., "Ajay Bhargava"
  userFacts: string[],        // e.g., ["Age: 37", "Location: San Francisco"]
  deductiveFacts: string[]    // e.g., ["User likes cold weather because they are from Canada"]
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

### Weather With Memory (Biographical)
```
Today's weather gets a 6/10 vibe rating, not great, right?
It's 18°C with light rain, so grab your raincoats.
Perfect day for indoor fun with your daughters, Sarah!
```

### Weather With Memory (Deductive Conclusions)
```
Weather's a 7/10, vibe's chilly with light snow vibes.
Currently 2°C but feels like -3°C, busy little snowflakes.
Perfect time for a warm drink, embrace your Canadian roots!
```
*Uses deductive fact: "User likes cold weather because they are from Canada"*

## Applying to Other Tools

### Maps Handler
- **Biographical facts**: Use location history, home address
- **Deductive conclusions**: "User prefers outdoor restaurants", "User avoids busy areas"
- **Example keywords**: `location`, `place`, `restaurant`, `prefer`, `avoid`

### Web Search Handler
- **Biographical facts**: Occupation, interests from peerCard
- **Deductive conclusions**: "User is interested in AI because they work in tech", "User prefers technical documentation"
- **Example keywords**: `interest`, `work`, `technology`, `prefer`, `like`

### Knowledge Handler
- **Biographical facts**: Education, background, expertise
- **Deductive conclusions**: "User has experience with Python", "User learns visually"
- **Example keywords**: `experience`, `knowledge`, `background`, `learn`, `understand`

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
