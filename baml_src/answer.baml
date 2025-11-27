class QuestionAnalysisResponse {
    original_text string @description("Echo of the user's input text verbatim")
    has_question bool @description("Whether the text contains a question")
    question string? @description("Concise summary of the user's question in 10 words or fewer")
    answer string[] @description("Direct answer in 20 words or fewer")
}

function AnswerQuestion(text: string, memory: MemoryCore?) -> QuestionAnalysisResponse {
    client "GroqHeavy"
    prompt #"
        {{ _.role("system") }}
        You analyze a user's message to detect and answer questions.
        
        Note: The 'text' parameter may be an enhanced version of the original query with additional context woven in.
        
        Instructions:
        - Set original_text to the user's input text verbatim.
        - Set has_question to true only if a question is present; otherwise false.
        - If has_question is true:
          - question: concise (≤10 words) summary without prefixed phrases like 'You asked'.
          - answer: direct answer in ≤50 words as an array of lines. Each item in the array cannot be more than 10 words.
        - If no question is present, set question and answer to null.
        - If the user is describing someone else's conversation, set has_question to false.

        {% if memory %}
        {% set hasUserName = memory.userName is defined and memory.userName %}
        {% set hasUserFacts = memory.userFacts|length > 0 %}
        {% set hasDeductiveFacts = memory.deductiveFacts|length > 0 %}
        {% if hasUserName or hasUserFacts or hasDeductiveFacts %}
        User Context (use to personalize answers and acknowledge past questions):
        {% if memory.userName %}Name: {{ memory.userName }}{% endif %}
        {% for fact in memory.userFacts %}
        - {{ fact }}
        {% endfor %}
        {% for fact in memory.deductiveFacts %}
        - {{ fact }}
        {% endfor %}
        
        If the user has asked similar questions before or shown interest in related topics, naturally acknowledge this in your answer (e.g., "You've asked about X before..." or "Building on your interest in Y..."). Keep it conversational and familiar.
        {% endif %}
        {% endif %}

        {{ ctx.output_format }}

        {{ _.role("user") }} {{ text }}
    "#
}

test test_answer_question {
    functions [AnswerQuestion]
    args {
        text "What is the capital of France?"
        memory null
    }
}

test test_answer_question_with_memory_repeat_topic {
    functions [AnswerQuestion]
    args {
        text "Tell me more about quantum computing"
        memory {
            userName "Ajay"
            userFacts [
                "Occupation: Founder of a technology company",
                "Age: 37"
            ]
            deductiveFacts [
                "User has asked about quantum computing before",
                "User is interested in technology because they work in tech"
            ]
        }
    }
}

test test_answer_question_with_memory_related_interest {
    functions [AnswerQuestion]
    args {
        text "How does machine learning work?"
        memory {
            userName "Sarah"
            userFacts [
                "Education: Computer Science degree",
                "Occupation: Data scientist"
            ]
            deductiveFacts [
                "User has experience with Python programming",
                "User has asked about artificial intelligence topics before"
            ]
        }
    }
}

test test_answer_question_with_no_memory_related_interest {
    functions [AnswerQuestion]
    args {
        text "Tell me more about quantum computing"
        memory null
    }
}