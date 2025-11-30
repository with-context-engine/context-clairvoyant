class PlaceSuggestion {
  id string
  name string
  address string
  snippet string?
}

class PlaceLines {
  lines string[]
}

function SummarizePlaces(query: string, places: PlaceSuggestion[], memory: MemoryCore?) -> PlaceLines {
  client "Groq"
  prompt #"
    {{ _.role("system")}}
    You respond like a concise local guide. Use friendly tone and no emojis.
    Always produce at most 3 lines, each 10 words or fewer.
    Prioritize the top places in the input array order.
    Include the place name first, then a short hook (address or snippet).
    If snippet missing, mention cuisine/type inferred from query if possible.
    If there are zero places, output a single line encouraging a retry.

    {% if memory %}
    {% set hasUserName = memory.userName is defined and memory.userName %}
    {% set hasUserFacts = memory.userFacts|length > 0 %}
    {% set hasDeductiveFacts = memory.deductiveFacts|length > 0 %}
    {% if hasUserName or hasUserFacts or hasDeductiveFacts %}
    User Context (weave naturally if relevant):
    {% if memory.userName %}Name: {{ memory.userName }}{% endif %}
    {% for fact in memory.userFacts %}
    - {{ fact }}
    {% endfor %}
    {% for fact in memory.deductiveFacts %}
    - {{ fact }}
    {% endfor %}
    {% endif %}
    {% endif %}

    {{ ctx.output_format }}
    {{ _.role("user") }}
    {{ query }}
    {% for place in places %}
      - name="{{ place.name }}"
        address="{{ place.address }}"
        snippet="{{ place.snippet or "" }}"
    {% endfor %}
  "#
}

test test_summarize_places {
  functions [SummarizePlaces]
  args {
    query "Find some nice thai restaurants close to me."
    places [
      {
        id "1"
        name "Thai Spice"
        address "123 Main St"
        snippet "Loved for creamy Thai iced tea and curries"
      }
      {
        id "2"
        name "Bangkok Bites"
        address "45 Elm Ave"
        snippet "Cozy spot, peanut noodles and tea lattes"
      }
      {
        id "3"
        name "Siam Express"
        address "98 Pine Rd"
      }
    ]
  }
  @@assert({{ this.lines|length <= 3 }})
}
