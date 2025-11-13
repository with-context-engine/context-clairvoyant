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
  - If occupation/expertise is relevant, include it
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
