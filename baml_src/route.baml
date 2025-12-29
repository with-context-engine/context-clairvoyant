enum Router {
    WEATHER @description("Current or upcoming weather questions for a specific place.")
    WEB_SEARCH @description("News, current events, facts that change over time such as political events, or topics not obviously location-based.")
    MAPS @description("Finding nearby businesses, restaurants, addresses, or directions.")
    KNOWLEDGE @description("General knowledge that does not fit into other categories.")
    MEMORY_CAPTURE @description("Commands to store new personal facts, preferences, or reminders for future recall.")
    MEMORY_RECALL @description("Questions about the user's memory and personal history, personal preferences, personal opinions, goals, information about the user, or anything that is not a fact.")
    NOTE_THIS @description("User wants to save the current conversation as a note to email. Triggered by phrases like 'add this to a note', 'send this to my email', 'this would be great to remember', 'note this down'.")
    FOLLOW_UP @description("User wants to bookmark or revisit the current topic later. Triggered by: 'follow up on this', 'come back to this', 'revisit this later', 'bookmark this', 'I want to revisit this'.")
    PASSTHROUGH @description("Ambient speech, filler words, incomplete sentences, or unclear utterances that don't require action.")
}

class RoutingBehavior {
    origin string @description("Echo of the user's input text verbatim.")
    routing Router
}

function Route(text: string) -> RoutingBehavior {
    client "GroqHeavy"
    prompt #"
        You are routing a single short utterance to one of several intent categories.

        STEP 1 — MENTALLY CLEAN THE UTTERANCE:
        Before routing, internally strip filler and hesitation words like: "um", "uh", "hmm", "erm",
        "like", "you know", "uh yeah so", "okay so", "so yeah", repeated words, false starts,
        and mid-sentence corrections.
        - If, after removing these, there is NO clear question or command left, treat as PASSTHROUGH.
        - If there IS a clear question or command after cleaning, route based on the cleaned meaning.
        - Do NOT remove words that change the core intent (e.g., "okay" at the start of a command is fine to keep).

        STEP 2 — DETERMINE DIRECTEDNESS:
        Decide if this utterance is DIRECTED AT THE ASSISTANT vs AMBIENT/BACKGROUND speech.

        Signs of DIRECTED speech (route to a real category):
        - Question forms: "what", "who", "where", "when", "how", "why", "can you", "could you", "is it"
        - Commands/imperatives: "remind me", "remember that", "find me", "tell me", "look up", "show me"
        - Personal intentions with time references: "I need to... tomorrow", "I should... later"
        - Assistant wake word or second-person address

        Signs of AMBIENT/BACKGROUND speech (PASSTHROUGH):
        - Movie, TV, or audiobook dialogue (dramatic lines, exclamations, third-person narrative)
          e.g., "I'll never let you go Jack!", "You can't handle the truth!", "No Luke, I am your father"
        - Other people's conversations (named characters talking to each other, no request to assistant)
        - Narration or storytelling not involving a request
        - Pure reactions with no follow-up: "oh wow", "no way", "that's crazy", "ha ha"
        - Background announcements: "The next station is Times Square"

        EXCEPTION: If a movie/TV line is quoted AS PART OF a question (e.g., "What movie is 'I'll never
        let you go Jack' from?"), do NOT treat as PASSTHROUGH — route to WEB_SEARCH or KNOWLEDGE.

        STEP 3 — CHOOSE EXACTLY ONE ROUTE:
        Routes (in priority order when multiple could apply):
        1. WEATHER → questions about forecast or current weather for a place
        2. MAPS → requests to find locations, directions, or nearby businesses
        3. WEB_SEARCH → current events or information likely needing the internet
        4. KNOWLEDGE → general facts that are stable over time
        5. MEMORY_CAPTURE → commands or clear intentions to remember/store personal facts, preferences,
           or reminders — including indirect phrasing like "I need to call the dentist tomorrow"
        6. MEMORY_RECALL → questions about the user's past, preferences, or personal information
        7. NOTE_THIS → requests to save/note/email the current conversation, e.g., "add this to a note",
           "send this to my email", "this would be great to remember", "note this down", "save this"
        8. FOLLOW_UP → requests to bookmark or revisit the current topic later, e.g., "follow up on this",
           "come back to this", "revisit this later", "bookmark this", "I want to revisit this"
        9. PASSTHROUGH → pure filler, incomplete fragments with no clear request, ambient speech,
           or unclear utterances that don't require action

        Additional guidelines:
        - If the utterance mentions weather/forecast, choose WEATHER even if a location is mentioned
        - If the utterance is primarily about finding a place or directions, choose MAPS
        - When in doubt between KNOWLEDGE and WEB_SEARCH, prefer WEB_SEARCH for anything that might change
        - For vague self-talk without clear time/action ("maybe someday I should..."), prefer PASSTHROUGH
        - For clear near-term intentions ("I need to call mom tomorrow"), prefer MEMORY_CAPTURE

        {{ _.role("user") }} {{ text }}
        {{ ctx.output_format }}
    "#
}

test test_weather {
    functions [Route]
    args {
        text "What is the weather in San Francisco?"
    }
    @@assert( {{ this.routing == "WEATHER"}})
}

test test_web_search {
    functions [Route]
    args {
        text "Who is the current president of the United States?"
    }
    @@assert( {{ this.routing == "WEB_SEARCH"}})
}

test test_maps {
    functions [Route]
    args {
        text "Find me a ramen restaurant near Union Square."
    }
    @@assert( {{ this.routing == "MAPS"}})
}

test test_knowledge {
    functions [Route]
    args {
        text "What is the capital of France?"
    }
    @@assert( {{ this.routing == "KNOWLEDGE"}})
}

test test_knowledge_2 {
    functions [Route]
    args {
        text "What is the purpose of mitochondria?"
    }
    @@assert( {{ this.routing == "KNOWLEDGE"}})
}

test test_memory {
    functions [Route]
    args {
        text "What is my name?"
    }
    @@assert( {{ this.routing == "MEMORY_RECALL"}})
}

test test_memory_2 {
    functions [Route]
    args {
        text "Koyal, what did I eat yesterday?"
    }
    @@assert( {{ this.routing == "MEMORY_RECALL"}})
}

test test_memory_capture {
    functions [Route]
    args {
        text "Remember that my sister's birthday is May 3rd."
    }
    @@assert( {{ this.routing == "MEMORY_CAPTURE"}})
}

test test_memory_capture_task {
    functions [Route]
    args {
        text "Please remember I need to call the dentist tomorrow."
    }
    @@assert( {{ this.routing == "MEMORY_CAPTURE"}})
}

test test_memory_capture_task_2 {
    functions [Route]
    args {
        text "I need to call the dentist tomorrow."
    }
    @@assert( {{ this.routing == "MEMORY_CAPTURE"}})
}

test test_passthrough_filler {
    functions [Route]
    args {
        text "hmm"
    }
    @@assert( {{ this.routing == "PASSTHROUGH"}})
}

test test_passthrough_okay {
    functions [Route]
    args {
        text "okay"
    }
    @@assert( {{ this.routing == "PASSTHROUGH"}})
}

test test_passthrough_fragment {
    functions [Route]
    args {
        text "uh yeah so"
    }
    @@assert( {{ this.routing == "PASSTHROUGH"}})
}

test test_weather_with_location {
    functions [Route]
    args {
        text "What's the weather like for my trip to Paris?"
    }
    @@assert( {{ this.routing == "WEATHER"}})
}

// ===== FILLER WORD TESTS =====
// These test that fillers are stripped and the real intent is routed correctly

test test_weather_with_fillers {
    functions [Route]
    args {
        text "um what's the weather uh in SF"
    }
    @@assert( {{ this.routing == "WEATHER"}})
}

test test_maps_with_fillers {
    functions [Route]
    args {
        text "uh like find me a coffee shop you know nearby"
    }
    @@assert( {{ this.routing == "MAPS"}})
}

test test_knowledge_with_fillers {
    functions [Route]
    args {
        text "so like um what is the capital of Japan"
    }
    @@assert( {{ this.routing == "KNOWLEDGE"}})
}

test test_web_search_with_fillers {
    functions [Route]
    args {
        text "hmm uh who won the game last night"
    }
    @@assert( {{ this.routing == "WEB_SEARCH"}})
}

test test_memory_capture_with_fillers {
    functions [Route]
    args {
        text "um yeah so remind me to call mom tomorrow"
    }
    @@assert( {{ this.routing == "MEMORY_CAPTURE"}})
}

// ===== AMBIENT/MOVIE DIALOGUE TESTS =====
// These should be PASSTHROUGH as they are background speech, not directed at assistant

test test_passthrough_movie_titanic {
    functions [Route]
    args {
        text "I'll never let you go Jack!"
    }
    @@assert( {{ this.routing == "PASSTHROUGH"}})
}

test test_passthrough_movie_star_wars {
    functions [Route]
    args {
        text "No Luke, I am your father"
    }
    @@assert( {{ this.routing == "PASSTHROUGH"}})
}

test test_passthrough_movie_few_good_men {
    functions [Route]
    args {
        text "You can't handle the truth!"
    }
    @@assert( {{ this.routing == "PASSTHROUGH"}})
}

test test_passthrough_tv_dialogue {
    functions [Route]
    args {
        text "Ross, we were on a break!"
    }
    @@assert( {{ this.routing == "PASSTHROUGH"}})
}

test test_passthrough_background_announcement {
    functions [Route]
    args {
        text "The next station is Times Square"
    }
    @@assert( {{ this.routing == "PASSTHROUGH"}})
}

test test_passthrough_reaction {
    functions [Route]
    args {
        text "oh wow that's crazy"
    }
    @@assert( {{ this.routing == "PASSTHROUGH"}})
}

test test_passthrough_narration {
    functions [Route]
    args {
        text "He walked into the room and never looked back"
    }
    @@assert( {{ this.routing == "PASSTHROUGH"}})
}

// ===== EDGE CASES =====
// Movie quote AS PART OF a question should NOT be passthrough

test test_movie_quote_in_question {
    functions [Route]
    args {
        text "What movie is 'I'll never let you go Jack' from?"
    }
    @@assert( {{ this.routing != "PASSTHROUGH"}})
}

// Self-talk with clear near-term intention should be MEMORY_CAPTURE

test test_self_talk_clear_intent {
    functions [Route]
    args {
        text "I need to pick up groceries on the way home"
    }
    @@assert( {{ this.routing == "MEMORY_CAPTURE"}})
}

test test_self_talk_should_call {
    functions [Route]
    args {
        text "I should call the doctor tomorrow"
    }
    @@assert( {{ this.routing == "MEMORY_CAPTURE"}})
}

// Vague self-talk without clear action should be PASSTHROUGH

test test_self_talk_vague {
    functions [Route]
    args {
        text "maybe someday I should learn to play guitar"
    }
    @@assert( {{ this.routing == "PASSTHROUGH"}})
}

// ===== NOTE_THIS TESTS =====
// Requests to save/note/email the current conversation

test test_note_this_add_to_note {
    functions [Route]
    args {
        text "add this to a note"
    }
    @@assert( {{ this.routing == "NOTE_THIS"}})
}

test test_note_this_email_me {
    functions [Route]
    args {
        text "email me this conversation"
    }
    @@assert( {{ this.routing == "NOTE_THIS"}})
}

test test_note_this_remember {
    functions [Route]
    args {
        text "this would be great to remember"
    }
    @@assert( {{ this.routing == "NOTE_THIS"}})
}

test test_note_this_save {
    functions [Route]
    args {
        text "save this to my notes"
    }
    @@assert( {{ this.routing == "NOTE_THIS"}})
}

// ===== FOLLOW_UP TESTS =====
// Requests to bookmark or revisit the current topic later

test test_follow_up_later {
    functions [Route]
    args {
        text "follow up on this later"
    }
    @@assert( {{ this.routing == "FOLLOW_UP"}})
}

test test_follow_up_come_back {
    functions [Route]
    args {
        text "I want to come back to this"
    }
    @@assert( {{ this.routing == "FOLLOW_UP"}})
}

test test_follow_up_bookmark {
    functions [Route]
    args {
        text "bookmark this"
    }
    @@assert( {{ this.routing == "FOLLOW_UP"}})
}

test test_follow_up_revisit {
    functions [Route]
    args {
        text "revisit this later"
    }
    @@assert( {{ this.routing == "FOLLOW_UP"}})
}