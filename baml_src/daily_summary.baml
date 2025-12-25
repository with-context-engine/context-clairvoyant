// BAML functions for daily summary synthesis
// Used by packages/convex/dailySynthesis.ts

class SessionInput {
  index int @description("Session number (1-based)")
  summary string @description("Summary of the session")
}

class DailySummaryResult {
  summary string @description("1-2 casual sentences summarizing the user's day")
}

function SummarizeDailySessions(
  sessions: SessionInput[],
  userProfile: string?
) -> DailySummaryResult {
  client "CustomGPT4oMini"
  
  prompt #"
Summarize the user's day based on their glasses session notes. Write 1-2 casual sentences. Be concise and friendly. Focus on what's memorable. If you know the user's name, use it naturally. Personalize based on their profile if available.

{{ ctx.output_format }}

{% if userProfile %}
USER PROFILE:
{{ userProfile }}

{% endif %}
SESSIONS:
{% for session in sessions %}
Session {{ session.index }}: {{ session.summary }}
{% endfor %}

Instructions:
- Write 1-2 casual, friendly sentences
- Focus on what's memorable or interesting about their day
- Use the user's name naturally if known from the profile
- Don't start with "Today" or "You" - vary the opening
- Keep it conversational, like texting a friend
"#
}

test test_daily_summary_single_session {
  functions [SummarizeDailySessions]
  args {
    sessions [
      { index 1, summary "Worked on a presentation for a client meeting. Discussed AI integration strategies." }
    ]
    userProfile "Name: Ajay\nOccupation: Tech founder\nInterests: AI, startups"
  }
}

test test_daily_summary_multiple_sessions {
  functions [SummarizeDailySessions]
  args {
    sessions [
      { index 1, summary "Morning coffee at the local cafe while reviewing emails" },
      { index 2, summary "Video call with the team about product roadmap" },
      { index 3, summary "Picked up kids from school and helped with homework" }
    ]
    userProfile "Name: Sarah\nLocation: Toronto\nChildren: Two kids"
  }
}

test test_daily_summary_no_profile {
  functions [SummarizeDailySessions]
  args {
    sessions [
      { index 1, summary "Went for a run in the park" },
      { index 2, summary "Worked from home on a coding project" }
    ]
    userProfile null
  }
}
