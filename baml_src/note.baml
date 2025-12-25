class NoteContent {
    title string @description("Short, descriptive title for the note (5-10 words max)")
    summary string @description("2-3 sentence overview of the conversation")
    keyPoints string[] @description("3-5 bullet points of important/actionable items")
}

function AbridgeToNote(transcripts: string[]) -> NoteContent {
    client "Groq"
    prompt #"
        You are a helpful assistant that creates concise, actionable notes from conversation transcripts.
        
        Given the following conversation transcript (array of utterances), extract the most important information
        and create a structured note that would be useful to email to the user later.

        Focus on:
        - Key decisions or conclusions reached
        - Action items or tasks mentioned
        - Important facts, dates, or numbers discussed
        - Names and relationships mentioned
        - Any commitments or promises made

        Keep the note concise and scannable. The title should capture the main topic.
        The summary should give context. The key points should be actionable or memorable.

        {{ ctx.output_format }}

        {{ _.role("user") }}
        Transcript:
        {% for utterance in transcripts %}
        - {{ utterance }}
        {% endfor %}
    "#
}

test test_abridge_simple_conversation {
    functions [AbridgeToNote]
    args {
        transcripts [
            "What's the weather like today?",
            "It's sunny and 72 degrees in San Francisco.",
            "Great, I should go for a run this afternoon.",
            "That sounds like a good idea. The UV index is moderate so bring sunscreen.",
            "Oh right, I also need to call mom for her birthday tomorrow."
        ]
    }
    @@assert({{ this.title|length > 0 }})
    @@assert({{ this.summary|length > 0 }})
    @@assert({{ this.keyPoints|length >= 1 }})
    @@assert({{ this.keyPoints|length <= 5 }})
}

test test_abridge_meeting_notes {
    functions [AbridgeToNote]
    args {
        transcripts [
            "Let's discuss the project timeline.",
            "We need to finish the MVP by March 15th.",
            "John will handle the backend, Sarah takes frontend.",
            "Budget is $50,000 for the first phase.",
            "We should meet again next Tuesday at 2pm.",
            "Don't forget to send the specs to the client by Friday."
        ]
    }
    @@assert({{ this.title|length > 0 }})
    @@assert({{ this.keyPoints|length >= 3 }})
}
