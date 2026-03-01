// Sensitivity classification for cross-peer shared content

enum SensitivityCategory {
  SAFE @description("Content is safe to share across peers")
  SENSITIVE @description("Content contains sensitive personal information that should not be shared")
}

function CheckSensitivity(crossPeerContext: string) -> SensitivityCategory {
  client "Groq"

  prompt #"
Classify whether the following cross-peer context contains sensitive personal information that should NOT be shared between connected users.

SENSITIVE includes: medical/health details, financial information, passwords/credentials, private relationship issues, legal matters, or anything the user would reasonably expect to remain private.

SAFE includes: general interests, preferences, professional topics, hobbies, travel plans, food preferences, or other casual information.

Content to classify:
{{ crossPeerContext }}

{{ ctx.output_format }}
"#
}

test test_safe_content {
  functions [CheckSensitivity]
  args {
    crossPeerContext "User enjoys hiking and is interested in AI technology. Works as a software engineer."
  }
}

test test_sensitive_content {
  functions [CheckSensitivity]
  args {
    crossPeerContext "User mentioned they are dealing with a medical diagnosis and has been seeing a therapist."
  }
}
