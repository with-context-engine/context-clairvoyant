class WeatherConditionLite {
  id int
  main string
  description string
  icon string
}

class CurrentLite {
  temperature float
  feels_like float
  conditions WeatherConditionLite
  humidity int
  pressure int
  wind_speed float
  wind_direction int
  visibility int
  uv_index float
  clouds int
}

class TempBlock {
  day float
  min float
  max float
  night float
}

class DailyForecastItem {
  date string
  summary string
  temperature TempBlock
  conditions WeatherConditionLite
  precipitation_probability float
  rain float
}

class LocationLite {
  lat float
  lon float
  timezone string
}

class AlertLite {
  sender_name string
  event string
  start int
  end int
  description string
  tags string[]
}

class FormattedWeather {
  location LocationLite
  current CurrentLite
  daily_forecast DailyForecastItem[]
  alerts AlertLite[]
}

class WeatherLines {
  lines string[]
}

class MemoryContextLite {
  userName string? @description("User's name if known")
  userFacts string[] @description("Relevant biographical facts about the user")
}

function SummarizeWeatherFormatted(input: FormattedWeather, unit: string, memory: MemoryContextLite?) -> WeatherLines {
  client "openai/gpt-4o-mini"

  prompt #"
  You are a witty, conversational weather reporter that's super brief even if you have a lot of data to work with.
  Write exactly 10 words that sound like a friendly human texted them to a friend.
  Avoid bullet points, lists, or emoji. 
  Use the data to describe the weather on a scale of 1-10 out of 10 and include the "vibe rating" of the weather.
  {{ ctx.output_format }}

  {% if memory and (memory.userName or memory.userFacts|length > 0) %}
  User Context (weave naturally if relevant):
  {% if memory.userName %}Name: {{ memory.userName }}{% endif %}
  {% for fact in memory.userFacts %}
  - {{ fact }}
  {% endfor %}
  {% endif %}

  Style rules:
  - You are only allowed to print 3 lines in the list output. 
  - Each line can be a continuation of the previous line.
  - The first line should be the scale and the vibe rating.
  - The second line should be the current weather.
  - The third line should be the alert if there is one OR a personalized insight based on user context.

  Data (verbatim):
  Location:
    timezone="{{ input.location.timezone }}"
  Now:
    {% if unit == "C" %}
    temp_c={{ input.current.temperature }}
    feels_c={{ input.current.feels_like }}
    {% else %}
    temp_f={{ input.current.temperature }}
    feels_f={{ input.current.feels_like }}
    {% endif %}
    desc="{{ input.current.conditions.description }}"
    wind_ms={{ input.current.wind_speed }}
    wind_deg={{ input.current.wind_direction }}
    humidity={{ input.current.humidity }}
    uv_index={{ input.current.uv_index }}
    clouds={{ input.current.clouds }}
    visibility_m={{ input.current.visibility }}
  Today:
    date="{{ input.daily_forecast[0].date if input.daily_forecast|length > 0 else "" }}"
    {% if unit == "C" %}
    min_c={{ input.daily_forecast[0].temperature.min if input.daily_forecast|length > 0 else 0 }}
    max_c={{ input.daily_forecast[0].temperature.max if input.daily_forecast|length > 0 else 0 }}
    {% else %}
    min_f={{ input.daily_forecast[0].temperature.min if input.daily_forecast|length > 0 else 0 }}
    max_f={{ input.daily_forecast[0].temperature.max if input.daily_forecast|length > 0 else 0 }}
    {% endif %}
    pop={{ input.daily_forecast[0].precipitation_probability if input.daily_forecast|length > 0 else 0.0 }}
    rain_mm={{ input.daily_forecast[0].rain if input.daily_forecast|length > 0 else 0.0 }}
    desc="{{ input.daily_forecast[0].summary if input.daily_forecast|length > 0 else "" }}"
  Tomorrow:
    date="{{ input.daily_forecast[1].date if input.daily_forecast|length > 1 else "" }}"
    {% if unit == "C" %}
    min_c={{ input.daily_forecast[1].temperature.min if input.daily_forecast|length > 1 else 0 }}
    max_c={{ input.daily_forecast[1].temperature.max if input.daily_forecast|length > 1 else 0 }}
    {% else %}
    min_f={{ input.daily_forecast[1].temperature.min if input.daily_forecast|length > 1 else 0 }}
    max_f={{ input.daily_forecast[1].temperature.max if input.daily_forecast|length > 1 else 0 }}
    {% endif %}
    pop={{ input.daily_forecast[1].precipitation_probability if input.daily_forecast|length > 1 else 0.0 }}
    rain_mm={{ input.daily_forecast[1].rain if input.daily_forecast|length > 1 else 0.0 }}
    desc="{{ input.daily_forecast[1].summary if input.daily_forecast|length > 1 else "" }}"
  Alert:
    {% if input.alerts|length > 0 %}
    event="{{ input.alerts[0].event }}"
    end_unix={{ input.alerts[0].end }}
    sender="{{ input.alerts[0].sender_name }}"
    tags="{{ input.alerts[0].tags | join(", ") }}"
    {% endif %}
  "#
}

test test_weather_lines_fahrenheit {
  functions [SummarizeWeatherFormatted]
  args {
    input {
      location {
        lat 40.7128
        lon -74.006
        timezone "America/New_York"
      }
      current {
        temperature 75.0
        feels_like 75.0
        conditions {
          id 800
          main "Clear"
          description "clear sky"
          icon "01d"
        }
        humidity 50
        pressure 1013
        wind_speed 5.5
        wind_direction 180
        visibility 10000
        uv_index 6.5
        clouds 10
      }
      daily_forecast [
        {
          date "2025-08-12T17:00:00.000Z"
          summary "Expect a day of partly cloudy with clear spells"
          temperature {
            day 88.46600000000001
            min 65.984
            max 88.46600000000001
            night 76.15400000000005
          }
          conditions {
            id 801
            main "Clouds"
            description "few clouds"
            icon "02d"
          }
          precipitation_probability 0
          rain 0
        },
        {
          date "2025-08-13T17:00:00.000Z"
          summary "Expect a day of partly cloudy with rain"
          temperature {
            day 87.35
            min 71.00600000000003
            max 87.85400000000006
            night 80.40200000000007
          }
          conditions {
            id 501
            main "Rain"
            description "moderate rain"
            icon "10d"
          }
          precipitation_probability 1
          rain 4.89
        },
        {
          date "2025-08-14T17:00:00.000Z"
          summary "Expect a day of partly cloudy with rain"
          temperature {
            day 81.68000000000004
            min 76.424
            max 88.016
            night 80.79800000000003
          }
          conditions {
            id 501
            main "Rain"
            description "moderate rain"
            icon "10d"
          }
          precipitation_probability 1
          rain 2.85
        },
        {
          date "2025-08-15T17:00:00.000Z"
          summary "You can expect clear sky in the morning, with partly cloudy in the afternoon"
          temperature {
            day 84.90200000000007
            min 75.72200000000004
            max 85.53200000000001
            night 76.55
          }
          conditions {
            id 800
            main "Clear"
            description "clear sky"
            icon "01d"
          }
          precipitation_probability 0
          rain 0
        },
        {
          date "2025-08-16T17:00:00.000Z"
          summary "There will be partly cloudy today"
          temperature {
            day 81.57200000000003
            min 74.33600000000007
            max 81.57200000000003
            night 76.55
          }
          conditions {
            id 803
            main "Clouds"
            description "broken clouds"
            icon "04d"
          }
          precipitation_probability 0
          rain 0
        },
        {
          date "2025-08-17T17:00:00.000Z"
          summary "There will be partly cloudy today"
          temperature {
            day 90.64400000000008
            min 73.90400000000005
            max 90.64400000000008
            night 83.67800000000007
          }
          conditions {
            id 801
            main "Clouds"
            description "few clouds"
            icon "02d"
          }
          precipitation_probability 0.12
          rain 0
        },
        {
          date "2025-08-18T16:00:00.000Z"
          summary "There will be rain until morning, then partly cloudy"
          temperature {
            day 85.1
            min 75.99199999999999
            max 90.95
            night 80.25800000000001
          }
          conditions {
            id 500
            main "Rain"
            description "light rain"
            icon "10d"
          }
          precipitation_probability 1
          rain 2.4
        },
        {
          date "2025-08-19T16:00:00.000Z"
          summary "Expect a day of partly cloudy with rain"
          temperature {
            day 80.49199999999999
            min 76.13600000000007
            max 84.81200000000005
            night 76.13600000000007
          }
          conditions {
            id 501
            main "Rain"
            description "moderate rain"
            icon "10d"
          }
          precipitation_probability 1
          rain 11.61
        }
      ]
      alerts [
        {
          sender_name "NWS Upton NY"
          event "Air Quality Alert"
          start 1755004380
          end 1755054000
          description "The New York State Department of Environmental Conservation has\nissued an Air Quality Health Advisory for the following counties:\n\nNew York, Bronx, Kings, Queens, Richmond, Nassau, Suffolk,\nWestchester, Rockland, Orange, Putnam.\n\nuntil 11 PM EDT this evening.\n\nAir quality levels in outdoor air are predicted to be greater than\nan Air Quality Index value of 100 for the pollutant of Ground Level\nOzone. The Air Quality Index, or AQI, was created as an easy way to\ncorrelate levels of different pollutants to one scale. The higher\nthe AQI value, the greater the health concern.\n\nWhen pollution levels are elevated, the New York State Department of\nHealth recommends that individuals consider limiting strenuous\noutdoor physical activity to reduce the risk of adverse health\neffects. People who may be especially sensitive to the effects of\nelevated levels of pollutants include the very young, and those with\npreexisting respiratory problems such as asthma or heart disease.\nThose with symptoms should consider consulting their personal\nphysician.\n\nFor additional information, please visit the New York State\nDepartment of Environmental Conservation website at,\nhttps://on.ny.gov/nyaqi, or call the Air Quality Hotline at\n1 800 5 3 5, 1 3 4 5."
          tags [
            "Air quality"
          ]
        }
      ]
      }
       unit "F"
  }
}

test test_weather_lines_celsius {
  functions [SummarizeWeatherFormatted]
  args {
    input {
      location {
        lat 40.7128
        lon -74.006
        timezone "America/New_York"
      }
      current {
        temperature 23.9
        feels_like 23.9
        conditions {
          id 800
          main "Clear"
          description "clear sky"
          icon "01d"
        }
        humidity 50
        pressure 1013
        wind_speed 5.5
        wind_direction 180
        visibility 10000
        uv_index 6.5
        clouds 10
      }
      daily_forecast [
        {
          date "2025-08-12T17:00:00.000Z"
          summary "Expect a day of partly cloudy with clear spells"
          temperature {
            day 31.37
            min 18.88
            max 31.37
            night 24.53
          }
          conditions {
            id 801
            main "Clouds"
            description "few clouds"
            icon "02d"
          }
          precipitation_probability 0
          rain 0
        },
        {
          date "2025-08-13T17:00:00.000Z"
          summary "Expect a day of partly cloudy with rain"
          temperature {
            day 30.75
            min 21.67
            max 31.03
            night 26.89
          }
          conditions {
            id 501
            main "Rain"
            description "moderate rain"
            icon "10d"
          }
          precipitation_probability 1
          rain 4.89
        }
      ]
      alerts []
    }
    unit "C"
  }
}