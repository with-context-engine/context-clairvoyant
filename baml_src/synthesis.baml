class MemoryContext {
  explicitFacts string[]
  deductiveFacts string[]
  peerCard string[]
  recentMessages string[]
  sessionSummaries string[] @description("Summaries of past sessions, e.g. 'Dec 20: discussed weather and navigation'")
}

class MemorySynthesisLines {
  lines string[] @description("1-3 concise lines answering the query")
}

function SynthesizeMemory(
  query: string,
  context: MemoryContext
) -> MemorySynthesisLines {
  client "GroqHeavy"
  
  prompt #"
You are a memory synthesis agent. Answer the user's query using their stored memories.

{{ ctx.output_format }}

USER'S BIOGRAPHICAL INFO:
{% for fact in context.peerCard %}
{{ fact }}
{% endfor %}

EXPLICIT FACTS (directly stated by user):
{% for fact in context.explicitFacts %}
- {{ fact }}
{% endfor %}

DEDUCTIVE CONCLUSIONS:
{% for fact in context.deductiveFacts %}
- {{ fact }}
{% endfor %}

RECENT CONVERSATION:
{% for msg in context.recentMessages %}
{{ msg }}
{% endfor %}

PAST SESSION SUMMARIES:
{% for summary in context.sessionSummaries %}
- {{ summary }}
{% endfor %}

QUERY: {{ query }}

Instructions:
- Provide 1-3 short lines (≤10 words each) that directly answer the query
- Use a natural, conversational tone like texting a friend
- If the user's name is known from peerCard, use it naturally
- You can use contractions and casual language
- If you don't have enough information to answer, say so briefly
- Focus on what's most relevant to the query
- Ignore any alphanumeric IDs or hashes in the facts (e.g., "j979r44m..." prefixes) — extract only the meaningful content
"#
}

test test_memory_synthesis_name {
  functions [SynthesizeMemory]
  args {
    query "What is my name?"
    context {
      explicitFacts [
        "j979r44mshwqcstwyjps48mrw57v4vat-diatribe's name is Ajay Bhargava."
      ]
      deductiveFacts []
      peerCard [
        "Name: Ajay Bhargava",
        "Date of birth: December 19, 1987",
        "Age: 37"
      ]
      recentMessages [
        "My name is Ajay Bhargava, that's spelled A-J-A-Y, last name B-H-A-R-G-A-V-A.",
        "What is my name?"
      ]
      sessionSummaries []
    }
  }
  @@assert({{ this.lines|length <= 3 }})
  @@assert({{ this.lines|length >= 1 }})
}

test test_memory_synthesis_children {
  functions [SynthesizeMemory]
  args {
    query "Tell me about my daughters"
    context {
      explicitFacts [
        "j979r44mshwqcstwyjps48mrw57v4vat-diatribe has two daughters.",
        "j979r44mshwqcstwyjps48mrw57v4vat-diatribe's daughters' names are Koyal and Kavya.",
        "j979r44mshwqcstwyjps48mrw57v4vat-diatribe's daughters are five and two years old."
      ]
      deductiveFacts [
        "j979r44mshwqcstwyjps48mrw57v4vat-diatribe has children of different ages."
      ]
      peerCard [
        "Name: Ajay Bhargava",
        "Children: Two daughters (Koyal and Kavya)",
        "Daughters' ages: 5 and 2 years old"
      ]
      recentMessages [
        "I have two girls, five and two. Their names are Koyal and Kavya.",
        "Tell me about my daughters"
      ]
      sessionSummaries []
    }
  }
  @@assert({{ this.lines|length <= 3 }})
  @@assert({{ this.lines|length >= 1 }})
}

test test_memory_synthesis_no_info {
  functions [SynthesizeMemory]
  args {
    query "What car do I drive?"
    context {
      explicitFacts [
        "j979r44mshwqcstwyjps48mrw57v4vat-diatribe's name is Ajay Bhargava."
      ]
      deductiveFacts []
      peerCard [
        "Name: Ajay Bhargava",
        "Date of birth: December 19, 1987"
      ]
      recentMessages [
        "What car do I drive?"
      ]
      sessionSummaries []
    }
  }
  @@assert({{ this.lines|length <= 3 }})
  @@assert({{ this.lines|length >= 1 }})
}

test test_memory_synthesis_age {
  functions [SynthesizeMemory]
  args {
    query "How old am I?"
    context {
      explicitFacts [
        "j979r44mshwqcstwyjps48mrw57v4vat-diatribe's date of birth is December 19, 1987."
      ]
      deductiveFacts [
        "j979r44mshwqcstwyjps48mrw57v4vat-diatribe is 37 years old."
      ]
      peerCard [
        "Name: Ajay Bhargava",
        "Date of birth: December 19, 1987",
        "Age: 37"
      ]
      recentMessages [
        "How old am I?"
      ]
      sessionSummaries []
    }
  }
  @@assert({{ this.lines|length <= 3 }})
  @@assert({{ this.lines|length >= 1 }})
}
