# Memory Injection Pattern for Tool Handlers

This document describes the pattern for adding proactive memory recall to tool handlers in Clairvoyant. This enables contextual, personalized responses based on user's stored memories.

## Overview

The pattern enables tools (like Weather, Maps, Web Search) to access user memory and weave relevant personal context into their responses naturally. It leverages both biographical facts (peerCard) and deductive conclusions (from peerRepresentation) to create personalized, context-aware responses.

**Two Implementation Layers:**
1. **Single-Layer (Post-Fetch)**: Memory enhances response formatting only (Weather, Knowledge)
2. **Dual-Layer (Pre + Post-Fetch)**: Memory enhances both query generation AND response formatting (Web Search)

**Example**: Weather response that knows your name and preferences:
- Without memory: "Today's vibe: 9/10, sunny with a breeze feels nice!"
- With memory (biographical): "Today's vibe: 9/10, Ajay - perfect for your morning run!"
- With memory (deductive): "Today's vibe: 9/10, Ajay - chilly but you like cold weather!"

## Implementation References

- **Single-Layer Pattern**: Weather handler (`src/application/handlers/weather.ts`) and Knowledge handler (`src/application/handlers/knowledge.ts`)
- **Dual-Layer Pattern**: Web Search handler (`src/application/handlers/search.ts`)

## Step-by-Step Pattern (Single-Layer)

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
import { getTimeAgo } from "../core/utils";
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
            messages: Array<{ content: string; metadata?: { timestamp?: string } }>;
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

          // Extract recent tool-related queries with timestamps (TEMPORAL CONTEXT)
          const recentMessages = contextData.messages || [];
          const toolPattern = /keyword1|keyword2|tool-specific-pattern/i; // Customize pattern
          const recentQueries = recentMessages
            .filter(msg => toolPattern.test(msg.content))
            .slice(-5) // Get last 5 tool-related messages
            .map(msg => {
              if (msg.metadata?.timestamp) {
                const timeAgo = getTimeAgo(msg.metadata.timestamp);
                return `Asked about [tool] "${msg.content.slice(0, 40)}${msg.content.length > 40 ? '...' : ''}" ${timeAgo}`;
              }
              return null;
            })
            .filter(Boolean) as string[];

          // Combine deductions with temporal information
          const deductionsWithTiming = toolRelatedDeductions.concat(
            recentQueries.slice(0, 1) // Add up to 1-2 recent query timestamps
          );
          
          memoryContext = {
            userName,
            userFacts: relevantFacts,
            deductiveFacts: deductionsWithTiming,
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

## Dual-Layer Pattern (Query Enhancement + Response Personalization)

For tools that call external APIs (Web Search, potentially Maps), enhance the query BEFORE fetching data to get better, more personalized results.

### When to Use Dual-Layer

- External search APIs (Tavily, Google, etc.) benefit from richer queries
- User context improves result relevance (e.g., occupation for topic filtering)
- Past queries indicate evolving interests

### Implementation Steps

**Step 1**: Fetch memory context EARLY (before API call):

```typescript
// Fetch memory at the START of the handler
let memoryContext = null;
// ... same memory fetching logic as single-layer pattern
```

**Step 2**: Enhance query with `EnhanceQuery` (in `baml_src/core.baml`):

```typescript
import { b } from "../baml_client";

let searchQuery = query;
if (memoryContext) {
  try {
    const enhancedQuery = await b.EnhanceQuery(query, memoryContext);
    searchQuery = enhancedQuery.enhanced;
    session.logger.info(`[Tool] Enhanced query: "${searchQuery}"`);
  } catch (error) {
    session.logger.warn(`[Tool] Query enhancement failed, using original`);
  }
}
```

**Step 3**: Use enhanced query for API call:

```typescript
const results = await externalAPI(searchQuery); // Uses enhanced query
```

**Step 4**: Pass memory to formatter for personalized response:

```typescript
const formatted = await b.YourFormatter(query, results, memoryContext);
```

### EnhanceQuery BAML Function

The `EnhanceQuery` function lives in `baml_src/core.baml` and is reusable across tools:

```baml
function EnhanceQuery(query: string, memory: MemoryContextLite?) -> EnhancedQuery {
  client "openai/gpt-4o-mini"
  
  prompt #"
  You enhance search and knowledge queries by weaving in relevant user context.
  
  Original query: {{ query }}
  
  {% if memory ... %}
  User Context (use to enhance query):
  - Occupation, interests, past queries
  {% endif %}
  
  Instructions:
  - Keep enhanced query concise (≤100 words)
  - Only add RELEVANT context
  - Make it natural, not robotic
  "#
}
```

### Example: Web Search Enhancement

**Original query**: "Find AI news"

**Memory context**:
- Occupation: Tech founder
- Deductive: "Interested in AI", "Asked about quantum computing before"

**Enhanced query**: "Find the latest AI news relevant to technology and quantum computing, as I'm a founder of a tech company"

**Result**: Tavily returns better, more relevant articles about AI intersecting with quantum computing

## Key Design Principles

1. **Graceful Degradation**: Memory injection is optional - if no memory exists or fetching fails, the tool still works normally
2. **Rich Context**: Use both `peerCard` (biographical summary) and `peerRepresentation` (deductive conclusions) for deeper personalization
3. **Temporal Awareness**: Include recent query timestamps using `getTimeAgo()` utility to provide WHAT and WHEN context
4. **Tool-Specific Filtering**: Filter deductive conclusions and messages by relevance to your tool (e.g., weather preferences for weather tool)
5. **Subtle Integration**: Let the LLM weave memories naturally - don't force them into every response
6. **Privacy-First**: Only Pro users get memory features; check `isPro` status before fetching
7. **Error Handling**: Wrap memory fetching and JSON parsing in try-catch; log warnings but don't fail the tool

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
  deductiveFacts: string[]    // e.g., [
                              //   "User likes cold weather because they are from Canada",
                              //   'Asked about weather "What\'s the temperature?" 3 hours ago'
                              // ]
}
```

**Note**: `deductiveFacts` now includes both:
- Deductive conclusions from peerRepresentation
- Temporal context (recent queries with timestamps)

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

### Weather With Memory (Temporal Context)
```
Today's a solid 8/10, Ajay - still loving the cold weather!
Currently -2°C with snow, just like you asked about earlier.
You checked weather 3 hours ago, conditions haven't changed much.
```
*Uses temporal fact: 'Asked about weather "What's the temperature in Toronto?" 3 hours ago'*

## Applying to Other Tools

### Maps Handler
- **Biographical facts**: Use location history, home address
- **Deductive conclusions**: "User prefers outdoor restaurants", "User avoids busy areas"
- **Temporal keywords**: `location|place|restaurant|directions|address|nearby`
- **Example temporal**: 'Asked about maps "Find coffee shop near me" 1 hour ago'

### Web Search Handler (✅ Implemented - Dual Layer)
- **Biographical facts**: Occupation, interests from peerCard
- **Deductive conclusions**: "User is interested in AI because they work in tech", "User prefers technical documentation"
- **Temporal keywords**: `search|find|look up|information|news|latest`
- **Example temporal**: 'Searched "Latest AI news" yesterday'
- **Layer 1**: Query enhancement via `EnhanceQuery` BAML function
- **Layer 2**: Response personalization via `AnswerSearch` with memory
- **Example enhancement**: 
  - Original: "Find AI news"
  - Enhanced: "Find the latest AI news relevant to technology and quantum computing, as I'm a founder of a tech company"

### Knowledge Handler (✅ Implemented)
- **Biographical facts**: Education, background, expertise
- **Deductive conclusions**: "User has experience with Python", "User learns visually"
- **Temporal keywords**: `question|ask|interest|knowledge|learn|understand`
- **Example temporal**: 'Asked "What is quantum computing?" 2 days ago'

### Weather Handler (✅ Implemented)
- **Biographical facts**: Location, age, family
- **Deductive conclusions**: "User likes cold weather because they are from Canada"
- **Temporal keywords**: `weather|temperature|forecast|rain|snow|sun|cold|hot`
- **Example temporal**: 'Asked about weather "What's the temperature?" 3 hours ago'

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
