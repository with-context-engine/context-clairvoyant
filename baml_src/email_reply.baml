// BAML functions for email reply interpretation
// Used by packages/convex/emailReply.ts

class EmailInterpretation {
  response string @description("Conversational reply to send back (2-3 sentences max)")
  extractedFacts string[] @description("New facts about the user to store in memory")
  newTopics string[] @description("New topics to add to session (1-2 word tags)")
  shouldUpdateSummary bool @description("Whether the session summary should be enriched")
  summaryAddition string? @description("Text to append to session summary if shouldUpdateSummary is true")
}

class ConversationMessage {
  direction string @description("'outbound' or 'inbound'")
  content string
}

class EmailContext {
  originalSubject string
  sessionSummary string? @description("Summary of the linked session, if any")
  sessionTopics string[] @description("Topics from the linked session")
  peerCard string[] @description("User profile facts from Honcho")
  conversationHistory ConversationMessage[] @description("Previous messages in this email thread")
  crossPeerPerspectives CrossPeerPerspective[] @description("Perspectives from connected users with shared memory enabled")
}

function InterpretEmailReply(
  userMessage: string,
  context: EmailContext
) -> EmailInterpretation {
  client "CustomGPT4oMini"
  
  prompt #"
You are Clairvoyant, a friendly AI assistant that helps users reflect on their day through email conversations.

The user is replying to a session note email. Analyze their reply and provide:
1. A warm, conversational response (2-3 sentences max)
2. Any new facts about the user worth remembering
3. New topics to tag this session with
4. Whether to update the session summary, and if so, what to add

Style:
- Be warm and casual, like a friend
- Use their name if known
- Reference session context naturally
- Keep responses brief - this is email, not an essay
- Don't be overly enthusiastic or use excessive exclamation marks

{{ ctx.output_format }}

EMAIL SUBJECT: {{ context.originalSubject }}

{% if context.sessionSummary %}
SESSION CONTEXT:
{{ context.sessionSummary }}
Topics: {{ context.sessionTopics | join(", ") }}

{% endif %}
{% if context.peerCard | length > 0 %}
USER PROFILE:
{% for fact in context.peerCard %}
{{ fact }}
{% endfor %}

{% endif %}
{% if context.conversationHistory | length > 1 %}
CONVERSATION HISTORY:
{% for msg in context.conversationHistory %}
[{{ msg.direction }}] {{ msg.content }}
---
{% endfor %}

{% endif %}
{% if context.crossPeerPerspectives | length > 0 %}
CONNECTED USER PERSPECTIVES:
{% for p in context.crossPeerPerspectives %}
From "{{ p.label }}":
{{ p.perspective }}
{% endfor %}

{% endif %}
USER'S NEW REPLY:
{{ userMessage }}

Interpret this reply and generate a response.
"#
}

test test_email_reply_simple {
  functions [InterpretEmailReply]
  args {
    userMessage "That was a great session! I really enjoyed the discussion about AI."
    context {
      originalSubject "Your session notes from Dec 21"
      sessionSummary "Discussed AI integration strategies for the new product"
      sessionTopics ["AI", "product", "strategy"]
      peerCard ["Name: Ajay", "Occupation: Tech founder"]
      conversationHistory [
        { direction "outbound", content "Here are your session notes from today..." }
      ]
      crossPeerPerspectives []
    }
  }
}

test test_email_reply_with_new_info {
  functions [InterpretEmailReply]
  args {
    userMessage "Thanks for the notes! By the way, I forgot to mention that my team is based in Toronto and we're planning to expand to NYC next year."
    context {
      originalSubject "Your session notes from Dec 21"
      sessionSummary "Team meeting about expansion plans"
      sessionTopics ["team", "planning"]
      peerCard ["Name: Sarah"]
      conversationHistory [
        { direction "outbound", content "Here are your session notes from today..." }
      ]
      crossPeerPerspectives []
    }
  }
}

test test_email_reply_no_session {
  functions [InterpretEmailReply]
  args {
    userMessage "Hi! Just wanted to say the glasses are working great."
    context {
      originalSubject "Welcome to Clairvoyant"
      sessionSummary null
      sessionTopics []
      peerCard []
      conversationHistory []
      crossPeerPerspectives []
    }
  }
}
