// Proactive hint system for passthrough utterances
// Surfaces helpful knowledge when the user is talking/thinking aloud about something they have relevant memory for

enum HintCategory {
    HINTABLE @description("User self-talk, thinking aloud, discussing a topic where stored knowledge could help.")
    AMBIENT @description("Truly ambient: movie/TV dialogue, announcements, reactions, background speech from others.")
}

class HintEligibility {
    category HintCategory
    topic string? @description("If HINTABLE, the core topic or subject the user is discussing (2-5 words). Null if AMBIENT.")
}

function ClassifyForHint(text: string) -> HintEligibility {
    client "Groq"
    prompt #"
        Classify this utterance for proactive hint eligibility.

        HINTABLE (should check memory for helpful hints):
        - User thinking aloud: "I was trying to remember when that meeting is..."
        - User self-talk about tasks: "need to figure out what to get Sarah for her birthday"
        - User discussing topics: "that reminds me of the project we were working on"
        - User musing: "I wonder if I should take that route today"
        - Partial planning: "so if I leave at 3..."

        AMBIENT (no hint needed):
        - Movie/TV quotes: "I'll never let you go Jack!"
        - Other people's conversations: "Ross, we were on a break!"
        - Background announcements: "The next station is Times Square"
        - Pure reactions: "oh wow", "no way", "that's crazy"
        - Filler only: "um", "uh", "hmm"
        - Narration: "He walked into the room"

        {{ _.role("user") }} {{ text }}
        {{ ctx.output_format }}
    "#
}

class HintResult {
    should_show bool @description("True if there's relevant, non-obvious knowledge worth surfacing.")
    hint string? @description("The helpful hint in ≤10 words. Null if should_show is false.")
}

function GenerateHint(
    topic: string,
    userSpeech: string,
    memory: MemoryCore?
) -> HintResult {
    client "Groq"
    prompt #"
        You are a proactive assistant. The user said something passively (not asking you directly).
        Decide if you have relevant stored knowledge that would genuinely help them.

        USER SAID: "{{ userSpeech }}"
        TOPIC: {{ topic }}

        {% if memory %}
        {% set hasUserName = memory.userName is defined and memory.userName %}
        {% set hasUserFacts = memory.userFacts|length > 0 %}
        {% set hasDeductiveFacts = memory.deductiveFacts|length > 0 %}
        {% if hasUserName or hasUserFacts or hasDeductiveFacts %}
        STORED KNOWLEDGE:
        {% if memory.userName %}Name: {{ memory.userName }}{% endif %}
        {% for fact in memory.userFacts %}
        - {{ fact }}
        {% endfor %}
        {% for fact in memory.deductiveFacts %}
        - {{ fact }}
        {% endfor %}
        {% endif %}
        {% endif %}

        RULES:
        - Only show a hint if the stored knowledge is DIRECTLY relevant to what the user just said
        - The hint must add real value — don't just echo what they said
        - If no stored knowledge relates to this topic, set should_show to false
        - Keep hints brief and natural, like a helpful friend chiming in
        - Use conversational phrasing like "By the way..." or "Remember..." or just state the fact
        - If the user is clearly talking to someone else, set should_show to false

        Examples of good hints:
        - User: "need to figure out what to get Sarah" → Hint: "Sarah mentioned she likes pottery"
        - User: "I wonder if the dry cleaner is open" → Hint: "Last time you went on Tuesday"
        - User: "trying to remember that restaurant name" → Hint: "You liked Osteria Mozza"

        Examples of when NOT to hint:
        - No relevant stored knowledge
        - User is talking TO someone else (not about something)
        - The hint would just repeat what they said
        - The topic is too vague to be helpful

        {{ ctx.output_format }}
    "#
}

// Tests for hint eligibility classification

test test_hintable_self_talk {
    functions [ClassifyForHint]
    args {
        text "I was trying to remember when that meeting is"
    }
    @@assert({{ this.category == "HINTABLE" }})
}

test test_hintable_musing {
    functions [ClassifyForHint]
    args {
        text "need to figure out what to get Sarah for her birthday"
    }
    @@assert({{ this.category == "HINTABLE" }})
}

test test_hintable_thinking {
    functions [ClassifyForHint]
    args {
        text "I wonder if I should take the highway today"
    }
    @@assert({{ this.category == "HINTABLE" }})
}

test test_hintable_planning {
    functions [ClassifyForHint]
    args {
        text "so if I leave at 3 I could probably make it"
    }
    @@assert({{ this.category == "HINTABLE" }})
}

test test_ambient_movie_titanic {
    functions [ClassifyForHint]
    args {
        text "I'll never let you go Jack!"
    }
    @@assert({{ this.category == "AMBIENT" }})
}

test test_ambient_movie_star_wars {
    functions [ClassifyForHint]
    args {
        text "No Luke, I am your father"
    }
    @@assert({{ this.category == "AMBIENT" }})
}

test test_ambient_tv_friends {
    functions [ClassifyForHint]
    args {
        text "Ross, we were on a break!"
    }
    @@assert({{ this.category == "AMBIENT" }})
}

test test_ambient_announcement {
    functions [ClassifyForHint]
    args {
        text "The next station is Times Square"
    }
    @@assert({{ this.category == "AMBIENT" }})
}

test test_ambient_reaction {
    functions [ClassifyForHint]
    args {
        text "oh wow that's crazy"
    }
    @@assert({{ this.category == "AMBIENT" }})
}

test test_ambient_filler {
    functions [ClassifyForHint]
    args {
        text "hmm"
    }
    @@assert({{ this.category == "AMBIENT" }})
}

test test_ambient_narration {
    functions [ClassifyForHint]
    args {
        text "He walked into the room and never looked back"
    }
    @@assert({{ this.category == "AMBIENT" }})
}

// Tests for hint generation

test test_generate_hint_relevant {
    functions [GenerateHint]
    args {
        topic "Sarah's birthday gift"
        userSpeech "need to figure out what to get Sarah for her birthday"
        memory {
            userName "Ajay"
            userFacts [
                "Sarah is Ajay's sister",
                "Sarah mentioned she likes pottery classes"
            ]
            deductiveFacts []
        }
    }
    @@assert({{ this.should_show == true }})
}

test test_generate_hint_no_relevant_memory {
    functions [GenerateHint]
    args {
        topic "dry cleaner hours"
        userSpeech "I wonder if the dry cleaner is open"
        memory {
            userName "Ajay"
            userFacts [
                "Ajay works at a tech company"
            ]
            deductiveFacts []
        }
    }
    @@assert({{ this.should_show == false }})
}

test test_generate_hint_null_memory {
    functions [GenerateHint]
    args {
        topic "restaurant name"
        userSpeech "trying to remember that restaurant name"
        memory null
    }
    @@assert({{ this.should_show == false }})
}
