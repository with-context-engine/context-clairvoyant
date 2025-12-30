# python-tools

Python tooling library for Clairvoyant.

## Setup

```bash
# Install uv if not already installed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create virtual environment and install dependencies
uv sync
```

## Feature Illustration Generator

Generate IKEA-style instruction manual illustrations for Clairvoyant features using Gemini 3 Pro Image.

### Prerequisites

1. **Google AI API Key**: Get one from [Google AI Studio](https://aistudio.google.com/apikey)
2. **Modal Account**: Sign up at [modal.com](https://modal.com)
3. **Reference Image**: An example IKEA-style illustration to guide the style

### Setup

```bash
# 1. Create Modal secret with your Google API key
modal secret create --env main google-ai GOOGLE_API_KEY=your_api_key_here

# 2. Upload your reference image to the Modal volume
modal volume put --env main clairvoyant-reference-images ./path/to/reference.png /
```

### Usage

```bash
# Generate all 9 feature illustrations
modal run --env main src/python_tools/image_generation.py

# Generate a single feature (useful for testing)
modal run --env main src/python_tools/image_generation.py --single "Weather"

# Use a different reference image name
modal run --env main src/python_tools/image_generation.py --reference-image my_reference.png

# Generate without using a reference image
modal run --env main src/python_tools/image_generation.py --no-reference

# Use an existing output image as reference, skip regenerating it
modal run --env main src/python_tools/image_generation.py \
    --reference-image weather.png --use-output-reference --skip "Weather"
```

### Download Generated Images

```bash
# Download all generated images to local ./output directory
modal volume get --env main clairvoyant-generated-images / ./output
```

### Features Generated

| Use Case | Output Filename |
|----------|-----------------|
| Weather | `weather.png` |
| Web Search | `web_search.png` |
| Maps / Nearby Places | `maps___nearby_places.png` |
| Knowledge / Q&A | `knowledge___q_and_a.png` |
| Memory Recall | `memory_recall.png` |
| Note This / Email Session | `note_this___email_session.png` |
| Follow Up / Bookmark | `follow_up___bookmark.png` |
| Proactive Hints | `proactive_hints.png` |
| Interactive Chat | `interactive_chat.png` |

### Customizing Prompts

The prompts are defined in `docs/FEATURE_ILLUSTRATIONS.json`. To use custom prompts, modify that file and the script will read from it.

## Development

```bash
# Run tests
uv run pytest

# Lint and format
uv run ruff check .
uv run ruff format .

# Type check
uv run ty check
```
