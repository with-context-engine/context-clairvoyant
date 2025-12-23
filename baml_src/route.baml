enum Router {
    WEATHER @description("Current or upcoming weather questions for a specific place.")
    WEB_SEARCH @description("News, current events, facts that change over time such as political events, or topics not obviously location-based.")
    MAPS @description("Finding nearby businesses, restaurants, addresses, or directions.")
    KNOWLEDGE @description("General knowledge that does not fit into other categories.")
    MEMORY_CAPTURE @description("Commands to store new personal facts, preferences, or reminders for future recall.")
    MEMORY_RECALL @description("Questions about the user's memory and personal history, personal preferences, personal opinions, goals, information about the user, or anything that is not a fact.")
    PASSTHROUGH @description("Ambient speech, filler words, incomplete sentences, or unclear utterances that don't require action.")
}

class RoutingBehavior {
    origin string @description("Echo of the user's input text verbatim.")
    routing Router
}

function Route(text: string) -> RoutingBehavior {
    client "GroqHeavy"
    prompt #"
        Choose exactly one route for the user's utterance.
        
        Routes (in priority order when multiple could apply):
        1. WEATHER → questions about forecast or current weather for a place
        2. MAPS → requests to find locations, directions, or nearby businesses
        3. WEB_SEARCH → current events or information likely needing the internet
        4. KNOWLEDGE → general facts that are stable over time
        5. MEMORY_CAPTURE → commands to remember or store new information about the user
        6. MEMORY_RECALL → questions about the user's past, preferences, or personal information
        7. PASSTHROUGH → filler words, incomplete sentences, ambient noise, or unclear speech (e.g., "hmm", "okay", "uh", single words without context)
        
        Guidelines:
        - If the utterance mentions weather/forecast, choose WEATHER even if a location is mentioned
        - If the utterance is primarily about finding a place or directions, choose MAPS
        - If the utterance is a fragment, filler, or doesn't form a complete question/command, choose PASSTHROUGH
        - When in doubt between KNOWLEDGE and WEB_SEARCH, prefer WEB_SEARCH for anything that might change
        
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