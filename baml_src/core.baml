// Common classes shared across BAML functions

class MemoryContextLite {
  userName string? @description("User's name if known")
  userFacts string[] @description("Relevant biographical facts about the user")
  deductiveFacts string[] @description("Relevant deductive conclusions about the user's preferences and behaviors")
}
