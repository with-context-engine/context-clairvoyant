class FollowupTopic {
    topic string @description("Short actionable title, 3-6 words max")
    summary string @description("1-2 sentence context about what to follow up on")
}

class FollowupConversationMessage {
    role string @description("'user' or 'assistant'")
    content string
    createdAt string
}

class FollowupChatContext {
    topic string @description("The follow-up topic title")
    summary string @description("Summary of what this follow-up is about")
    sourceMessages string[] @description("Original messages that led to this follow-up")
    conversationHistory FollowupConversationMessage[] @description("Previous chat messages about this follow-up")
    memory FollowupMemoryContext? @description("User memory context from Honcho")
    searchResults FollowupSearchResult[] @description("Web search results relevant to the topic")
}

class FollowupChatResponse {
    response string @description("Conversational reply about the follow-up topic (2-3 sentences max)")
    extractedFacts string[] @description("New facts about the user to store in memory")
}

class FollowupMemoryContext {
    userName string? @description("User's name if known")
    userFacts string[] @description("Known facts about the user")
    deductiveFacts string[] @description("Inferred facts about the user")
}

class FollowupSearchResult {
    title string
    content string
    url string
}

function ExtractFollowupTopic(userUtterance: string, recentMessages: string[]) -> FollowupTopic {
    client "Groq"
    prompt #"
        Extract the actionable topic the user wants to follow up on later.

        The user just said: {{ userUtterance }}

        Recent conversation context (most recent messages shown on display):
        {% for msg in recentMessages %}
        - {{ msg }}
        {% endfor %}

        Based on the recent messages, identify:
        1. The core topic or action item the user wants to revisit
        2. Enough context so they'll remember what this was about later

        Guidelines:
        - Topic should be a short, actionable title (3-6 words)
        - Summary should be 1-2 sentences capturing what to follow up on
        - Focus on what the user might want to act on or revisit
        - If the context is about a place, include the place name
        - If it's about a fact or information, capture the key detail

        {{ ctx.output_format }}
    "#
}

test test_extract_followup_restaurant {
    functions [ExtractFollowupTopic]
    args {
        userUtterance "bookmark this"
        recentMessages ["Looking for ramen near you...", "Top result: Mensho Tokyo, 4.5 stars, 0.3 miles away", "Known for their tori paitan ramen"]
    }
}

test test_extract_followup_weather {
    functions [ExtractFollowupTopic]
    args {
        userUtterance "I want to come back to this"
        recentMessages ["Weather in Paris next week", "Expect rain Tuesday through Thursday", "Pack an umbrella for your trip"]
    }
}

function InterpretFollowupChat(
    userMessage: string,
    context: FollowupChatContext
) -> FollowupChatResponse {
    client "GroqHeavy"
    
    prompt #"
You are Clairvoyant, a friendly AI assistant helping the user follow up on a saved topic.

The user bookmarked this topic to revisit later. Answer their questions using the source context.

{{ ctx.output_format }}

Style:
- Be helpful and conversational
- Reference the original context naturally
- Keep responses brief - 2-3 sentences max
- If you don't have enough information, say so honestly
- Use the user's name if known
- Reference web search results when relevant for current information

FOLLOW-UP TOPIC: {{ context.topic }}

SUMMARY: {{ context.summary }}

{% if context.memory %}
{% if context.memory.userName %}
USER NAME: {{ context.memory.userName }}
{% endif %}
{% if context.memory.userFacts | length > 0 %}
USER FACTS:
{% for fact in context.memory.userFacts %}
- {{ fact }}
{% endfor %}
{% endif %}
{% endif %}

{% if context.searchResults | length > 0 %}
RELEVANT WEB SEARCH:
{% for result in context.searchResults %}
- {{ result.title }}: {{ result.content }}
{% endfor %}
{% endif %}

{% if context.sourceMessages | length > 0 %}
ORIGINAL CONTEXT (messages when this was saved):
{% for msg in context.sourceMessages %}
- {{ msg }}
{% endfor %}

{% endif %}
{% if context.conversationHistory | length > 0 %}
CONVERSATION HISTORY:
{% for msg in context.conversationHistory %}
[{{ msg.role }}] {{ msg.content }}
---
{% endfor %}

{% endif %}
USER'S MESSAGE:
{{ userMessage }}

Provide a helpful response based on the saved context. Also extract any new facts about the user worth remembering (preferences, opinions, decisions, plans, etc.).
"#
}

test test_followup_chat_simple {
    functions [InterpretFollowupChat]
    args {
        userMessage "What were the details again?"
        context {
            topic "Try Mensho Tokyo ramen"
            summary "Found a highly-rated ramen place nearby, known for tori paitan"
            sourceMessages [
                "Looking for ramen near you...",
                "Top result: Mensho Tokyo, 4.5 stars, 0.3 miles away",
                "Known for their tori paitan ramen"
            ]
            conversationHistory []
            searchResults []
        }
    }
}

test test_followup_chat_with_history {
    functions [InterpretFollowupChat]
    args {
        userMessage "What should I order?"
        context {
            topic "Try Mensho Tokyo ramen"
            summary "Found a highly-rated ramen place nearby, known for tori paitan"
            sourceMessages [
                "Looking for ramen near you...",
                "Top result: Mensho Tokyo, 4.5 stars, 0.3 miles away",
                "Known for their tori paitan ramen"
            ]
            conversationHistory [
                {
                    role "user"
                    content "What were the details again?"
                    createdAt "2024-12-28T10:00:00Z"
                }
                {
                    role "assistant"
                    content "Mensho Tokyo is a ramen spot 0.3 miles away with 4.5 stars. They're known for their tori paitan ramen."
                    createdAt "2024-12-28T10:00:01Z"
                }
            ]
            searchResults []
        }
    }
}
