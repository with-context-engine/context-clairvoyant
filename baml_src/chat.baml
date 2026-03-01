// BAML functions for web chat interpretation
// Used by packages/convex/chat.ts

class ChatInterpretation {
  response string @description("Conversational reply to send back (2-3 sentences max)")
  extractedFacts string[] @description("New facts about the user to store in memory")
  newTopics string[] @description("New topics to add to session (1-2 word tags)")
  shouldUpdateSummary bool @description("Whether the session summary should be enriched")
  summaryAddition string? @description("Text to append to session summary if shouldUpdateSummary is true")
}

class ChatSessionSummary {
  summary string
  topics string[]
  startedAt string
  endedAt string
}

class ChatConversationMessage {
  role string @description("'user' or 'assistant'")
  content string
  createdAt string
}

class ChatContext {
  date string @description("Date of the conversation (YYYY-MM-DD)")
  sessionSummaries ChatSessionSummary[] @description("Session summaries for this date")
  userName string? @description("User's name if known")
  userFacts string[] @description("Known facts about the user")
  deductiveFacts string[] @description("Inferred facts about the user")
  conversationHistory ChatConversationMessage[] @description("Previous messages in this chat")
  crossPeerPerspectives CrossPeerPerspective[] @description("Perspectives from connected users with shared memory enabled")
}

function InterpretChatMessage(
  userMessage: string,
  context: ChatContext
) -> ChatInterpretation {
  client "GroqHeavy"
  
  prompt #"
You are Clairvoyant, a friendly AI assistant that helps users reflect on their day through chat conversations.

The user is chatting with you about their day. Analyze their message and provide a structured response.

{{ ctx.output_format }}

Style:
- Be warm and casual, like a friend
- Use their name if known
- Reference session context naturally
- Keep responses brief - this is chat, not an essay
- Don't be overly enthusiastic or use excessive exclamation marks
- If connected user perspectives are available, weave them naturally with attribution (e.g. "Your wife mentioned...", "Alex has been looking into...")

DATE: {{ context.date }}

{% if context.sessionSummaries | length > 0 %}
SESSIONS FROM {{ context.date }}:
{% for session in context.sessionSummaries %}
- {{ session.summary }}
  Topics: {{ session.topics | join(", ") }}
  Time: {{ session.startedAt }} to {{ session.endedAt }}
{% endfor %}

{% else %}
No sessions recorded for {{ context.date }} yet.

{% endif %}
{% if context.userName or context.userFacts | length > 0 or context.deductiveFacts | length > 0 %}
USER PROFILE:
{% if context.userName %}Name: {{ context.userName }}{% endif %}
{% for fact in context.userFacts %}
- {{ fact }}
{% endfor %}
{% for fact in context.deductiveFacts %}
- {{ fact }}
{% endfor %}

{% endif %}
{% if context.crossPeerPerspectives | length > 0 %}
CONNECTED USER PERSPECTIVES:
{% for p in context.crossPeerPerspectives %}
From "{{ p.label }}":
{{ p.perspective }}
{% endfor %}

{% endif %}
{% if context.conversationHistory | length > 0 %}
CONVERSATION HISTORY:
{% for msg in context.conversationHistory %}
[{{ msg.role }}] {{ msg.content }}
---
{% endfor %}

{% endif %}
USER'S NEW MESSAGE:
{{ userMessage }}

Interpret this message and generate a response. Extract any new facts worth remembering, suggest topic tags for the session, and indicate if the session summary should be updated.
"#
}

test test_chat_simple_greeting {
  functions [InterpretChatMessage]
  args {
    userMessage "Hey, how was my day?"
    context {
      date "2024-12-24"
      sessionSummaries [
        {
          summary "Worked on a presentation for a client meeting about AI integration"
          topics ["work", "AI", "presentation"]
          startedAt "2024-12-24T09:00:00Z"
          endedAt "2024-12-24T10:30:00Z"
        }
      ]
      userName "Ajay"
      userFacts [
        "Occupation: Tech founder",
        "Location: Toronto"
      ]
      deductiveFacts [
        "User is interested in AI technologies"
      ]
      conversationHistory []
      crossPeerPerspectives []
    }
  }
}

test test_chat_with_history {
  functions [InterpretChatMessage]
  args {
    userMessage "Actually, the meeting went really well. We landed the deal!"
    context {
      date "2024-12-24"
      sessionSummaries [
        {
          summary "Client meeting about AI integration"
          topics ["work", "AI", "client"]
          startedAt "2024-12-24T14:00:00Z"
          endedAt "2024-12-24T15:00:00Z"
        }
      ]
      userName "Sarah"
      userFacts []
      deductiveFacts []
      conversationHistory [
        {
          role "assistant"
          content "How did your client meeting go today?"
          createdAt "2024-12-24T16:00:00Z"
        }
      ]
      crossPeerPerspectives []
    }
  }
}

test test_chat_no_sessions {
  functions [InterpretChatMessage]
  args {
    userMessage "Just checking in, nothing much happened today"
    context {
      date "2024-12-24"
      sessionSummaries []
      userName null
      userFacts []
      deductiveFacts []
      conversationHistory []
      crossPeerPerspectives []
    }
  }
}
