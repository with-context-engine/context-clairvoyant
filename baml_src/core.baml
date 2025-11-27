// Common classes shared across BAML functions

class MemoryCore {
  userName string? @description("User's name if known")
  userFacts string[] @description("Relevant biographical facts about the user")
  deductiveFacts string[] @description("Relevant deductive conclusions about the user's preferences and behaviors")
}

class EnhancedQuery {
  original string @description("Original user query")
  enhanced string @description("Enhanced query with user context woven in")
}

function EnhanceQuery(query: string, memory: MemoryCore?) -> EnhancedQuery {
  client "Groq"
  
  prompt #"
  You enhance search and knowledge queries by weaving in relevant user context to get better, more personalized results.
  
  For search queries: Add context to improve external API results (e.g., Tavily, Google).
  For knowledge queries: Clarify ambiguous questions and add context that helps answer more accurately.
  
  Original query: {{ query }}
  
  {% if memory %}
  {% set hasUserName = memory.userName is defined and memory.userName %}
  {% set hasUserFacts = memory.userFacts|length > 0 %}
  {% set hasDeductiveFacts = memory.deductiveFacts|length > 0 %}
  {% if hasUserName or hasUserFacts or hasDeductiveFacts %}
  User Context (use to enhance query):
  {% if memory.userName %}Name: {{ memory.userName }}{% endif %}
  {% for fact in memory.userFacts %}
  - {{ fact }}
  {% endfor %}
  {% for fact in memory.deductiveFacts %}
  - {{ fact }}
  {% endfor %}
  {% endif %}
  {% endif %}
  
  Instructions:
  - Keep the enhanced query concise (≤100 words)
  - Only add context that's RELEVANT to the query topic
  - For questions: Clarify ambiguity using user background (e.g., "what's the weather" → "what's the weather in Toronto where I live")
  - For searches: Add occupation/expertise to filter results (e.g., "AI news" → "AI news for tech founders")
  - If past interests/questions are related, reference them
  - If no memory context is relevant, return the original query as enhanced
  - Make it sound natural, not robotic
  
  {{ ctx.output_format }}
  "#
}

test test_enhance_query_with_tech_background {
  functions [EnhanceQuery]
  args {
    query "What's happening in the world of AI?"
    memory {
      userName "Ajay"
      userFacts [
        "Occupation: Founder of a technology company",
        "Age: 37"
      ]
      deductiveFacts [
        "User is interested in AI because they work in tech",
        "User has asked about quantum computing before"
      ]
    }
  }
}

test test_enhance_query_no_memory {
  functions [EnhanceQuery]
  args {
    query "Latest news on climate change"
    memory null
  }
}

test test_enhance_query_knowledge_ambiguous {
  functions [EnhanceQuery]
  args {
    query "What's the weather like?"
    memory {
      userName "Sarah"
      userFacts [
        "Location: Toronto, Canada",
        "Age: 32"
      ]
      deductiveFacts [
        "User checks weather frequently in the morning"
      ]
    }
  }
}

test test_enhance_query_knowledge_context {
  functions [EnhanceQuery]
  args {
    query "How does that work?"
    memory {
      userName "Alex"
      userFacts [
        "Occupation: Software engineer"
      ]
      deductiveFacts [
        "Asked about quantum computing 1 hour ago"
      ]
    }
  }
}
