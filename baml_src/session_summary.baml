class SessionSummaryOutput {
  summary string @description("1-2 sentence summary of what was discussed")
  topics string[] @description("2-5 key topics or themes from the session")
}

function SummarizeSession(
  transcripts: string[]
) -> SessionSummaryOutput {
  client "GroqHeavy"
  
  prompt #"
You are summarizing a conversation session from smart glasses.

{{ ctx.output_format }}

CONVERSATION TRANSCRIPTS:
{% for transcript in transcripts %}
- {{ transcript }}
{% endfor %}

Instructions:
- Write a brief 1-2 sentence summary of what the user discussed or asked about
- Extract 2-5 key topics or themes (e.g., "weather", "navigation", "family", "work")
- Keep topics as single words or short phrases
- Focus on what's memorable or might be referenced later
- If transcripts are empty or trivial, return a minimal summary
"#
}

test test_summarize_session_weather {
  functions [SummarizeSession]
  args {
    transcripts [
      "What's the weather like today?",
      "Is it going to rain later?",
      "Should I bring an umbrella?"
    ]
  }
  @@assert({{ this.topics|length >= 1 }})
  @@assert({{ this.topics|length <= 5 }})
}

test test_summarize_session_mixed {
  functions [SummarizeSession]
  args {
    transcripts [
      "Navigate to the nearest coffee shop",
      "What time does Starbucks close?",
      "Remind me to call mom later",
      "What's on my calendar today?"
    ]
  }
  @@assert({{ this.topics|length >= 2 }})
  @@assert({{ this.topics|length <= 5 }})
}

test test_summarize_session_empty {
  functions [SummarizeSession]
  args {
    transcripts []
  }
  @@assert({{ this.summary|length > 0 }})
}
