class NewsItem {
    title string
    content string
}

class AnswerLines {
    lines string[]
}

class QueryResult {
    query string
    results AnswerLines[]
}

function AnswerSearch(query: string, searchResults: NewsItem[], memory: MemoryContextLite?) -> QueryResult {
    client "Groq"
    prompt #"
        {{ _.role("system")}}
        You are a helpful Web Search Summarizer who summarizes the results of a web search. 
        You need give an answer to the following question: {{ query }} given the results of the web search below collected by the user. 
        The output should be lines of text that sound like a human would say them to a friend and no more than 10 words per line as per the output format and no more than 3 lines as per the output format: 
        
        {% if memory and (memory.userName or memory.userFacts|length > 0 or memory.deductiveFacts|length > 0) %}
        User Context (use to personalize response and acknowledge past searches):
        {% if memory.userName %}Name: {{ memory.userName }}{% endif %}
        {% for fact in memory.userFacts %}
        - {{ fact }}
        {% endfor %}
        {% for fact in memory.deductiveFacts %}
        - {{ fact }}
        {% endfor %}
        
        If the user has searched for related topics before, naturally acknowledge this (e.g., "You searched for X yesterday..." or "Following up on your interest in Y..."). Keep it conversational.
        {% endif %}
        
        {{ ctx.output_format }}
        {{ _.role("user") }}
        {% for result in searchResults %}
            Title:
            {{ result.title }}
            {{- "\n" -}}
            Content:
            {{ result.content }}
            {{- "\n" -}}
        {% endfor %}
    "#
}

test test_answer_search {
    functions [AnswerSearch]
    args {
        query "Did Charlie Kirk die?"
        memory null
        searchResults [
            {
                title "California state Sen. Scott Wiener labels Charlie Kirk 'a vile bigot who' normalized 'dehumanization' - Fox News"
                content "### Recommended Videos Charlie Kirk # California state Sen. Scott Wiener labels Charlie Kirk 'a vile bigot who' normalized 'dehumanization' 2 min \"Charlie Kirk did not deserve to die. Also Charlie Kirk was a vile bigot who did immeasurable harm to so many people by normalizing dehumanization. **CHARLIE KIRK VIGILS HELD AT UNIVERSITIES ACROSS AMERICA FOLLOWING ASSASSINATION OF CONSERVATIVE ACTIVIST** \"Multiple things can be true: Political violence is toxic & Kirk's assassination must be condemned. Charlie Kirk poses at The Cambridge Union on May 19, 2025 in Cambridge, Cambridgeshire. (Nordin Catic/Getty Images for The Cambridge Union) Video \"Charlie Kirk's murder is horrific. 21 mins ago #### California state Sen. Scott Wiener labels Charlie Kirk 'a vile bigot who' normalized 'dehumanization' 1 hour ago 3 hours ago"
            },
            {
                title "Erika Kirk delivers moving tribute to husband, Charlie: 'I will never let your legacy die' - Fox News"
                content "# Erika Kirk delivers moving tribute to husband, Charlie: 'I will never let your legacy die' #### Charlie Kirk's widow makes first public comments since his assassination: 'The movement my husband built will not die' Erika Kirk, the widow of Charlie Kirk, made her first public remarks since her husband's death. Erika Kirk, the widow of the late Charlie Kirk, gave an emotional tribute to her husband and declared that his mission will not end at Turning Point USA's headquarters Friday. Erika Kirk spoke for the first time since the assassination of her husband, Charlie Kirk, at Turning Point USA Sept. #### Erika Kirk delivers moving tribute to husband, Charlie: 'I will never let your legacy die'"
            },
            {
                title "Opinion | Charlie Kirk and the Future of Political Violence - The New York Times"
                content "Opinion | Charlie Kirk and the Future of Political Violence - The New York Times Opinion|If We Keep This Up, Charlie Kirk Will Not Be the Last to Die https://www.nytimes.com/2025/09/11/opinion/charlie-kirk-assassination-debate.html If We Keep This Up, Charlie Kirk Will Not Be the Last to Die An assassin's bullet cut down Charlie Kirk, one of the nation's most prominent conservative activists and commentators, at a public event on the campus of Utah Valley University. When an assassin shot Kirk, that person killed a man countless students felt like they knew, and the assassin killed him _on a college campus_. Subscribe to The Times to read as many articles as you like. *   Your Privacy Choices"
            },
            {
                title "Life, Liberty & Levin - Saturday, September 13 - Fox News"
                content "Watch the live stream of Fox News and full episodes. Charlie Kirk, Tribute, Legacy Fox News Channel Charlie Kirk: An American Original FOX News Radio Live Channel Coverage Fox News Channel Live ### Bill Maher calls for people to stop comparing Trump to Hitler following Charlie Kirk's assassination ### Charlie Kirk's widow makes first public comments since his assassination: 'The movement my husband built will not die' ### Charlie Kirk assassin was 'much closer to mainstream Democrat than any of us wanted to believe': Tim Pool ### Lara Trump says media played role in Charlie Kirk assassination ### Illegal immigrant suspect dead after dragging agent with car, DHS reports ### Friend of Charlie Kirk speaks to his legacy"
            },
            {
                title "Kilmeade apologizes for remarks on homelessness, mental illness - Fox News"
                content "Watch the live stream of Fox News and full episodes. Fox News Channel FOX News Radio Live Channel Coverage Fox News Channel Live ### Bill Maher calls for people to stop comparing Trump to Hitler following Charlie Kirk's assassination ### Charlie Kirk's widow makes first public comments since his assassination: 'The movement my husband built will not die' ### Mark Levin says he knew right away how special Charlie Kirk was ### Lara Trump says media played role in Charlie Kirk assassination ### Questions remain on how suspect in Charlie Kirk murder got access to roof ### Dean Phillips: Part of our core American principles were assassinated with Charlie Kirk ### Alleged assassin of Charlie Kirk held in Utah jail without bail"
            },
            {
                title "'His voice will remain,' Charlie Kirk's widow vows after suspect arrested - BBC"
                content "* \"I will never let his legacy die,\" Charlie Kirk's wife says in her first public comments since he was fatally shot at a Utah university campus on Wednesday * Erika vowed to never let Charlie's legacy die, adding that his message will carry on being shared through his campus tour of US universities and his podcast - she did not specify how they would continue 2. ### 'My husband's voice will remain,' Charlie Kirk's widow says as suspected killer in custodypublished at 08:15 BST 08:15 BST published at 03:15 03:15 His widow, Erika Kirk, vows to never let his legacy die, saying in her first public statement on Friday: \"The movement my husband built will not die.\""
            },
            {
                title "Country singer warns that Charlie Kirk's death has 'awoken' millions - New York Post"
                content "For all the people or the hateful people out there, the groups that thought that would quiet Charlie Kirk, you've just awoken millions of other people that are not scared to die, Adcock said Monday on 'The Ingraham Angle.' 'If you live in the life of the Lord and believe in Jesus, you shouldn't be scared to leave this world, and Charlie Kirk was a great example of that.' Adcock had never met Kirk but said he often watched videos of his debates on social media. \"For all the people or the hateful people out there, the groups that thought that would quiet Charlie Kirk, you've just awoken millions of other people that are not scared to die,\" country artist Gavin Adcock said. Adcock had never met Kirk but said he watched videos of him."
            },
            {
                title "Black Pastor Blasts Efforts To Whitewash Charlie Kirk's Legacy In The Wake Of His Killing - HuffPost"
                content "The Rev. Howard-John Wesley on Sunday spoke out against efforts to whitewash the legacy of right-wing political activist Charlie Kirk in the wake of his assassination on a Utah college campus last week, declaring that how you die does not redeem how you live. (Watch video below). The Trump administration has taken steps to honor Kirk following his death. Maggie Haberman Says Trump Is 'Struggling' With Messaging Around Charlie Kirk's Death Charlie Kirk Shooting Suspect Captured, Trump And Utah Authorities Announce GOP Lawmaker Calls Out Trump's 'Over The Top' Rhetoric After Charlie Kirk Killing Wall Street Journal Warns Trump Of 'Dangerous Moment' After Charlie Kirk Assassination"
            },
            {
                title "Country singer Gavin Adcock warns those who tried to silence Charlie Kirk have 'awoken' millions more - Fox News"
                content "# Country singer Gavin Adcock warns those who tried to silence Charlie Kirk have 'awoken' millions more ## Fans chanted 'Charlie Kirk' as Adcock waved an American flag on stage over the weekend Country singer Gavin Adcock explains why he paid tribute to Charlie Kirk in a series of shows on 'The Ingraham Angle.' Country artist Gavin Adcock warned those who thought they could silence Charlie Kirk that his death has only awakened millions more. \"For all the people or the hateful people out there, the groups that thought that would quiet Charlie Kirk, you've just awoken millions of other people that are not scared to die,\" Adcock said Monday on \"The Ingraham Angle.\""
            },
            {
                title "Caroline Sunshine: The solution to America's void isn't banning guns or silencing speech - Fox News"
                content "Watch the live stream of Fox News and full episodes. The 'Fox News @ Night' panel discusses reactions to the assassination of Turning Point USA founder Charlie Kirk. Fox News Channel FOX News Radio Live Channel Coverage Fox News Channel Live ### Charlie Kirk's widow makes first public comments since his assassination: 'The movement my husband built will not die' ### Charlie Kirk assassin was 'much closer to mainstream Democrat than any of us wanted to believe': Tim Pool ### Donald Trump Jr on Charlie Kirk's assassination: The violence is 'not going both ways' ### 'We have him': Trump says suspected Charlie Kirk assassin is in custody ### Phoenix air traffic control honors Charlie Kirk: 'May God bless your family'"
            }
        ]
    }
    @@assert({{ this.results[0].lines|length == 3 }})
}
