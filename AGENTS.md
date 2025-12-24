Clairvoyant Agent Integration Guide

Purpose: Help a code‑gen model add new “tools” (API calls + flows + BAML formatting/routing) to the glasses app with minimal changes and token‑efficient prompts.

Key Concepts
- Tool: A small module under `src/utils/tools` that calls an external API, validates/normalizes output, and returns a compact, typed object (often mirroring a BAML class).
- Handler (Flow): An orchestrator under `src/utils/handlers` that drives the UX on glasses: shows loading/done/error text, gathers context (e.g., location), calls the tool, and renders LLM‑formatted lines.
- BAML: Schema + prompts in `baml_src/*.baml` that (a) route transcripts to a flow and/or (b) transform tool data into short, readable lines. After edits, regenerate the client to expose `b.*` functions.
- Routing: `baml_src/route.baml` decides between flows via the `Router` enum consumed in `src/utils/transcriptionFlow.ts`.
- Text UI: `src/utils/core/textWall.ts` provides `showTextDuringOperation` to show loading/done/error messages cleanly.
- Env + Validation: `src/utils/core/env.ts` defines required API keys; `src/utils/types/schema.ts` holds Zod schemas for tool responses.

File Map (where things live)
- Tools: `src/utils/tools/*.ts` (e.g., `src/utils/tools/weatherCall.ts`, `src/utils/tools/webSearch.ts`, `src/utils/tools/mapsCall.ts`)
- Handlers: `src/utils/handlers/*.ts` (e.g., `src/utils/handlers/weather.ts`, `src/utils/handlers/search.ts`)
- Core helpers: `src/utils/core/env.ts`, `src/utils/core/rateLimiting.ts`, `src/utils/core/textWall.ts`
- BAML: `baml_src/*.baml` (e.g., `baml_src/route.baml`, `baml_src/weather.baml`, `baml_src/search.baml`, `baml_src/answer.baml`)
- Transcription entrypoint: `src/utils/transcriptionFlow.ts`

Integration Checklist (add a new tool/flow)
1) Define the response shape (keep it small)
   - If the tool needs LLM formatting, create matching BAML classes with only the fields you’ll actually use.
   - Add or reuse a Zod schema in `src/utils/types/schema.ts` for runtime validation if the tool returns untrusted JSON.

2) Implement the tool
   - Create `src/utils/tools/<toolName>.ts` that:
     - Reads secrets from `env` (see `src/utils/core/env.ts`).
     - Calls the external API.
     - Validates and normalizes to the compact shape from step 1.
   - Examples:
     - Weather: `src/utils/tools/weatherCall.ts` calls OpenWeather and formats to `FormattedWeather`.
     - Web search: `src/utils/tools/webSearch.ts` calls Tavily and returns `webSearchSchema` items.
     - Maps: `src/utils/tools/mapsCall.ts` calls Google Places and validates to `mapSearchSchema`.

3) Create or extend BAML for formatting/routing
   - Routing: add a new enum value in `baml_src/route.baml`’s `Router` if this tool should be directly routable (e.g., `MAPS`). Update the routing prompt to cover when to choose it. Add a test.
   - Formatting: add a function that converts your tool’s typed output to short lines (≤3 lines; ≤10 words per line when feasible). See:
     - Weather → `baml_src/weather.baml` (`SummarizeWeatherFormatted` → `WeatherLines`).
     - Web search → `baml_src/search.baml` (`AnswerSearch` → `AnswerLines`).
   - Keep prompts token‑efficient: supply only the minimal fields and avoid redundant prose.
   - After editing BAML, regenerate the client so TypeScript sees `b.*` changes:
     - Command: `npx baml-cli generate` (or your configured generator). The generated client sits under `src/utils/baml_client` and exposes functions like `b.Route`, `b.AnswerQuestion`, `b.SummarizeWeatherFormatted`, etc.

4) Add a handler (flow) under `src/utils/handlers`
   - Pattern:
     - Use a `WeakMap<AppSession, number>` to track a per‑session `runId` and ignore stale callbacks.
     - Use `showTextDuringOperation` to present loading/done/error messages while awaiting your async call.
     - If you need the user’s location, subscribe to `session.events.onLocation`, enforce a timeout, and clear text walls on cancellation (see `src/utils/handlers/weather.ts`).
     - Feed tool output into your BAML formatter and display lines via `session.layouts.showTextWall` with `ViewType.MAIN`.
   - Example pattern (skeleton):
     ```ts
     // src/utils/handlers/<toolName>.ts
     import type { AppSession } from "@mentra/sdk";
     import { ViewType } from "@mentra/sdk";
     import { b } from "../baml_client";
     import { showTextDuringOperation } from "../core/textWall";
     import { myToolCall } from "../tools/<toolName>";

     const runIds = new WeakMap<AppSession, number>();

     export async function start<MyTool>Flow(session: AppSession, query?: string) {
       const runId = Date.now();
       runIds.set(session, runId);

       try {
         const result = await showTextDuringOperation(
           session,
           "// Clairvoyant\nW: Working...",
           "// Clairvoyant\nW: Done!",
           "// Clairvoyant\nW: Something went wrong.",
           () => myToolCall(/* params: query, location, etc. */)
         );
         if (runIds.get(session) !== runId) return; // stale

         const lines = await b.<YourBamlFormatter>(/* result, query if needed */);
         const out = lines.results?.[0]?.lines ?? lines.lines;
         if (out?.length) {
           for (let i = 0; i < out.length; i++) {
             if (runIds.get(session) !== runId) return;
             session.layouts.showTextWall(`// Clairvoyant\nW: ${out[i]}`,
               { view: ViewType.MAIN, durationMs: 3000 });
             if (i < out.length - 1) await new Promise(r => setTimeout(r, 3000));
           }
         }
       } catch (err) {
         if (runIds.get(session) === runId) {
           session.layouts.showTextWall("// Clairvoyant\nW: Couldn’t complete that.",
             { view: ViewType.MAIN, durationMs: 3000 });
         }
       }
     }
     ```

5) Wire routing in `src/utils/transcriptionFlow.ts`
   - Import your new handler and extend the switch on `routing.routing` to call it. Example:
     ```ts
     // src/utils/transcriptionFlow.ts
     import { start<MyTool>Flow } from "./handlers/<toolName>";
     // ...inside handleTranscription switch...
     case Router.MAPS:
       session.logger.info(`[Clairvoyant] Maps route: starting async flow`);
       void start<MyTool>Flow(session, data.text);
       return;
     ```
   - The default path (no specific route) is the short‑answer LLM call via `b.AnswerQuestion`.

6) Ensure environment variables exist
   - Add required keys to `src/utils/core/env.ts` (already includes OpenAI, Groq, OpenWeatherMap, Tavily, Google Maps). Add new ones here if your tool needs them.
   - Provide values in `.env`.

7) Keep responses short and readable
   - Use BAML to strictly limit output length (lines and words/line) and avoid bullets/lists unless intended.
   - Do unit conversion/formatting in the tool module, not in prompts.
   - Only send the minimum data fields needed to the LLM.

Working Examples (what to mirror)
- Weather
  - Tool: `src/utils/tools/weatherCall.ts` → fetches, validates, and formats to `FormattedWeather`.
  - Handler: `src/utils/handlers/weather.ts` → location subscription + loading wall + BAML summarizer `b.SummarizeWeatherFormatted` → shows 3 lines.
  - BAML: `baml_src/weather.baml` defines compact classes and the summarizer with strict style rules.

- Web Search
  - Tool: `src/utils/tools/webSearch.ts` → Tavily, returns a list validated by `webSearchSchema`.
  - Handler: `src/utils/handlers/search.ts` → loading wall → `b.AnswerSearch(query, results)` → shows lines.
  - BAML: `baml_src/search.baml` formats short answers using only title/content.

- Regular Answers (default path)
  - BAML: `baml_src/answer.baml` → `b.AnswerQuestion` to detect and answer short questions.
  - Orchestrated by `src/utils/transcriptionFlow.ts` when routing is not WEATHER/WEB_SEARCH (or other specific routes you add).

Adding “Maps” Next (suggested shape)
1) Tool is ready: `src/utils/tools/mapsCall.ts` exposes `getPlaces(query, { latitude, longitude })` returning `mapSearchSchema` items.
2) BAML (new): create `baml_src/maps.baml` with:
   - A minimal class mirroring `mapSearchSchema` fields you’ll use.
   - A function like `SummarizePlaces(query: string, places: PlaceLite[]) -> AnswerLines` that produces ≤3 short lines (e.g., top matches near the user).
3) Route: add `MAPS` to `enum Router` in `baml_src/route.baml` and update instructions to pick MAPS for “near me”, “find a …”, “closest …”, addresses, etc. Add a test. Regenerate.
4) Handler: add `src/utils/handlers/maps.ts` that:
   - Waits for `session.events.onLocation` (with timeout).
   - Calls `getPlaces(data.text, { lat, lng })` inside `showTextDuringOperation` with user‑friendly loading messages.
   - Calls `b.SummarizePlaces(data.text, places)` and presents returned lines on the text wall.
5) Wire in `src/utils/transcriptionFlow.ts` for `Router.MAPS`.

Two-Phase Classification Pattern (Proactive Hints)

Use this pattern when you need to:
- Gate ambient/passive speech (movie dialogue, TV, announcements) vs user-directed speech
- Surface proactive information without being intrusive
- Minimize LLM costs by filtering early before expensive operations

Architecture:
1. Phase 1 (Fast Gate): Lightweight LLM call to classify eligibility
   - Use cheaper/faster model (e.g., `Groq` with 20b model)
   - Binary or simple enum classification
   - Returns early if not eligible → no further LLM calls
2. Phase 2 (Memory + Generation): Only if Phase 1 passes
   - Query memory/context for relevant knowledge
   - LLM decides if knowledge is worth surfacing
   - Generate the actual hint/response

Reference Implementation: `baml_src/hints.baml` + `src/utils/handlers/hints.ts`

BAML Pattern:
```baml
// Phase 1: Fast classification
enum HintCategory {
    HINTABLE @description("User self-talk, thinking aloud, discussing a topic.")
    AMBIENT @description("Movie/TV dialogue, announcements, reactions, background speech.")
}

class HintEligibility {
    category HintCategory
    topic string? @description("Core topic if HINTABLE, null if AMBIENT.")
}

function ClassifyForHint(text: string) -> HintEligibility {
    client "Groq"  // Fast, cheap model
    prompt #"..."#
}

// Phase 2: Generate hint (only called if Phase 1 returns HINTABLE)
class HintResult {
    should_show bool
    hint string?
}

function GenerateHint(topic: string, userSpeech: string, memory: MemoryCore?) -> HintResult {
    client "Groq"
    prompt #"..."#
}
```

Handler Pattern:
```ts
export async function tryPassthroughHint(text: string, session: AppSession, ...) {
  // Phase 1: Fast gate
  const eligibility = await b.ClassifyForHint(text);
  if (eligibility.category !== HintCategory.HINTABLE) return; // Early exit

  // Phase 2: Query memory (only for eligible utterances)
  const memoryContext = await fetchMemoryContext(...);
  if (!memoryContext.userFacts.length) return; // No knowledge to hint from

  // Phase 3: Generate and show hint
  const hint = await b.GenerateHint(eligibility.topic, text, memoryContext);
  if (hint.should_show) {
    session.layouts.showTextWall(`// Clairvoyant\n💡 ${hint.hint}`, ...);
  }
}
```

When to use this pattern:
- Proactive hints during passive speech (PASSTHROUGH route)
- Any feature where you want to "chime in" without being asked
- Filtering ambient noise (TV, podcasts, other people's conversations) from user intent
- Cost-sensitive flows where you want to minimize LLM calls

Key design principles:
- Phase 1 should be very fast and cheap (small model, simple output schema)
- Phase 1 prompt should clearly distinguish directed vs ambient speech
- Phase 2 only runs if Phase 1 passes AND relevant data exists
- Always give the LLM final say on whether to show (should_show bool)
- Keep hints brief and natural ("💡 Sarah likes pottery" not "I noticed you mentioned...")

UX and Robustness Tips
- Always guard against stale work with a runId `WeakMap<AppSession, number>` per handler.
- Use `showTextDuringOperation` to keep the UI responsive and auto‑clear messages.
- Time out location waits (see `src/utils/handlers/weather.ts`) and show a helpful fallback.
- Keep `durationMs` around ~3000 per line for readability.
- Respect the top‑level rate limiter in `src/index.ts` and avoid adding new global throttles unless necessary.

Regeneration/Build
- After modifying any `baml_src/*.baml`, regenerate the client so TypeScript sees `b.*`:
  - `npx baml-cli generate`
- No build changes are needed for new tools if you follow the structure above.

Done. This guide covers the minimal, repeatable steps for adding new tools and flows with token‑efficient prompts and predictable UX.
