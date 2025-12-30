"""
Modal script for generating IKEA-style feature illustrations using Gemini 3 Pro Image.

Usage:
    # 1. Create API secret
    modal secret create --env main google-ai GOOGLE_API_KEY=your_key

    # 2. Upload reference image to volume
    modal volume put --env main clairvoyant-reference-images ./reference.png /

    # 3. Run generation (all images)
    modal run --env main src/python_tools/image_generation.py

    # 4. Run without reference image
    modal run --env main src/python_tools/image_generation.py --no-reference

    # 5. Use existing output as reference, skip that image
    modal run --env main src/python_tools/image_generation.py \\
        --reference-image weather.png --use-output-reference --skip "Weather"

    # 6. Download generated images
    modal volume get --env main clairvoyant-generated-images / ./output
"""

import modal

app = modal.App(name="clairvoyant-image-generation")

image = modal.Image.debian_slim(python_version="3.12").uv_pip_install(
    "google-genai>=1.0.0",
    "rich>=13.0.0",
)

with image.imports():
    import json
    from pathlib import Path

    from google import genai
    from google.genai import types
    from rich.console import Console

reference_volume = modal.Volume.from_name("clairvoyant-reference-images", create_if_missing=True)
output_volume = modal.Volume.from_name("clairvoyant-generated-images", create_if_missing=True)

FEATURE_PROMPTS = {
    "meta": {
        "tool": "Nano Banana Image Gen",
        "purpose": "App Instruction Manual",
        "visual_identity": "IKEA Assembly Guide Aesthetic",
    },
    "negative_prompt": "text, words, color, greyscale, shading, photorealistic, gradients, complex details, faces with eyes",
    "example_generations": [
        {
            "use_case": "Weather",
            "prompt_construction": "A minimalist black line art, vector style illustration in the style of an IKEA assembly schematic diagram on a solid white background with no shading and thick consistent line weights. A two-panel instruction diagram. Panel 1 (left): A simplified humanoid figure wearing simple rounded rectangular smart glasses speaks with a speech bubble containing a sun outline icon and question mark. An arrow connects to Panel 2. Panel 2 (right): Weather outline icons (sun, cloud, thermometer) float near the glasses. The figure gives a satisfied nod.",
        },
        {
            "use_case": "Web Search",
            "prompt_construction": "A minimalist black line art, vector style illustration in the style of an IKEA assembly schematic diagram on a solid white background with no shading and thick consistent line weights. A two-panel instruction diagram. Panel 1 (left): A simplified humanoid figure wearing simple rounded rectangular smart glasses speaks with a speech bubble containing a magnifying glass outline icon. An arrow connects to Panel 2. Panel 2 (right): Three horizontal lines (representing search results) float near the glasses with a small checkmark outline icon. The figure gives a slight nod.",
        },
        {
            "use_case": "Maps / Nearby Places",
            "prompt_construction": "A minimalist black line art, vector style illustration in the style of an IKEA assembly schematic diagram on a solid white background with no shading and thick consistent line weights. A two-panel instruction diagram. Panel 1 (left): A simplified humanoid figure wearing simple rounded rectangular smart glasses speaks with a speech bubble containing a building outline icon. An arrow connects to Panel 2. Panel 2 (right): A location pin outline icon and dotted path line appear near the glasses. The figure points forward confidently.",
        },
        {
            "use_case": "Knowledge / Q&A",
            "prompt_construction": "A minimalist black line art, vector style illustration in the style of an IKEA assembly schematic diagram on a solid white background with no shading and thick consistent line weights. A two-panel instruction diagram. Panel 1 (left): A simplified humanoid figure wearing simple rounded rectangular smart glasses speaks with a speech bubble containing a question mark. An arrow connects to Panel 2. Panel 2 (right): A lightbulb outline icon appears near the glasses. The figure nods with understanding.",
        },
        {
            "use_case": "Memory Recall",
            "prompt_construction": "A minimalist black line art, vector style illustration in the style of an IKEA assembly schematic diagram on a solid white background with no shading and thick consistent line weights. A two-panel instruction diagram. Panel 1 (left): A simplified humanoid figure wearing simple rounded rectangular smart glasses speaks with a speech bubble containing a person outline icon and question mark. An arrow connects to Panel 2. Panel 2 (right): A drawer outline icon opens with small shapes (heart, star) floating outward toward the figure. The figure points to themselves.",
        },
        {
            "use_case": "Note This / Email Session",
            "prompt_construction": "A minimalist black line art, vector style illustration in the style of an IKEA assembly schematic diagram on a solid white background with no shading and thick consistent line weights. A two-panel instruction diagram. Panel 1 (left): A simplified humanoid figure wearing simple rounded rectangular smart glasses speaks with a speech bubble containing an envelope outline icon. An arrow connects to Panel 2. Panel 2 (right): The figure watches as three horizontal lines (representing conversation text) flow with a curved arrow into an envelope outline icon, which then shows a checkmark. The figure gives a thumbs up.",
        },
        {
            "use_case": "Follow Up / Bookmark",
            "prompt_construction": "A minimalist black line art, vector style illustration in the style of an IKEA assembly schematic diagram on a solid white background with no shading and thick consistent line weights. A two-panel instruction diagram. Panel 1 (left): A simplified humanoid figure wearing simple rounded rectangular smart glasses speaks with a speech bubble containing a bookmark ribbon outline icon. An arrow connects to Panel 2. Panel 2 (right): A bookmark ribbon attaches to a floating card shape, with a clock outline icon nearby. The figure nods approvingly.",
        },
        {
            "use_case": "Proactive Hints",
            "prompt_construction": "A minimalist black line art, vector style illustration in the style of an IKEA assembly schematic diagram on a solid white background with no shading and thick consistent line weights. A single-panel illustration. A simplified humanoid figure wearing simple rounded rectangular smart glasses stands relaxed with hands at sides. A small lightbulb outline icon with a sparkle appears near the glasses unprompted. A dotted line connects from a tiny box outline icon to the lightbulb. The figure looks pleasantly surprised with a slight head tilt.",
        },
        {
            "use_case": "Interactive Chat",
            "prompt_construction": "A minimalist black line art, vector style illustration in the style of an IKEA assembly schematic diagram on a solid white background with no shading and thick consistent line weights. A three-panel instruction diagram. Panel 1 (left): A simplified humanoid figure wearing simple rounded rectangular smart glasses speaks with a speech bubble on the right. An arrow connects to Panel 2. Panel 2 (middle): A response speech bubble appears on the left near the glasses. An arrow connects to Panel 3. Panel 3 (right): The figure speaks again with a speech bubble, and a small brain outline icon above shows bidirectional arrows connecting to the conversation.",
        },
    ],
}


def slugify(text: str) -> str:
    """Convert text to a filename-safe slug."""
    return text.lower().replace(" ", "_").replace("/", "_").replace("&", "and")


@app.function(
    image=image,
    volumes={"/reference": reference_volume, "/output": output_volume},
    secrets=[modal.Secret.from_name("google-ai")],
    timeout=600,
)
def generate_single_image(
    prompt: str,
    use_case: str,
    negative_prompt: str,
    reference_image_path: str | None = "/reference/images.png",
    use_output_as_reference: bool = False,
) -> dict:
    """Generate a single image using Gemini 3 Pro Image."""
    import os

    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])

    if reference_image_path:
        if use_output_as_reference:
            ref_path = Path("/output") / reference_image_path
        else:
            ref_path = Path(reference_image_path)
        if not ref_path.exists():
            raise FileNotFoundError(f"Reference image not found: {ref_path}")

        with open(ref_path, "rb") as f:
            reference_bytes = f.read()

        ref_mime = "image/png" if ref_path.suffix.lower() == ".png" else "image/jpeg"

        full_prompt = f"""Using the provided reference image as a style guide for the character design and line art style, generate:

{prompt}

Style requirements:
- Match the exact line weight and minimalist aesthetic of the reference
- Use the same simplified humanoid figure design
- Maintain pure black lines on white background
- No shading, no color, no gradients

Negative prompt (avoid these): {negative_prompt}"""

        contents = [
            types.Part.from_bytes(data=reference_bytes, mime_type=ref_mime),
            full_prompt,
        ]
    else:
        full_prompt = f"""{prompt}

Negative prompt (avoid these): {negative_prompt}"""

        contents = [full_prompt]

    response = client.models.generate_content(
        model="gemini-3-pro-image-preview",
        contents=contents,
        config={
            "response_modalities": ["IMAGE"],
            "image_config": {
                "aspect_ratio": "16:9",
            },
        },
    )

    output_filename = f"{slugify(use_case)}.png"
    output_path = Path("/output") / output_filename

    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            image_data = part.inline_data.data
            with open(output_path, "wb") as f:
                f.write(image_data)
            output_volume.commit()
            return {
                "success": True,
                "use_case": use_case,
                "output_path": str(output_path),
                "filename": output_filename,
            }

    return {
        "success": False,
        "use_case": use_case,
        "error": "No image generated in response",
    }


@app.function(
    image=image,
    volumes={"/reference": reference_volume, "/output": output_volume},
    secrets=[modal.Secret.from_name("google-ai")],
    timeout=3600,
)
def generate_all_images(
    reference_image_name: str | None = "images.png",
    prompts_json_path: str | None = None,
    use_output_as_reference: bool = False,
    skip_use_cases: list[str] | None = None,
) -> list[dict]:
    """Generate all feature illustrations."""
    console = Console()
    prompts = FEATURE_PROMPTS

    if prompts_json_path:
        json_path = Path(prompts_json_path)
        if json_path.exists():
            with open(json_path) as f:
                prompts = json.load(f)

    reference_path = None
    if reference_image_name:
        if use_output_as_reference:
            reference_path = reference_image_name
            full_path = Path("/output") / reference_image_name
        else:
            reference_path = f"/reference/{reference_image_name}"
            full_path = Path(reference_path)
        if not full_path.exists():
            available = list(Path("/output" if use_output_as_reference else "/reference").glob("*"))
            raise FileNotFoundError(
                f"Reference image not found: {full_path}. Available: {available}"
            )

    skip_set = set(skip_use_cases or [])

    negative_prompt = prompts.get(
        "negative_prompt",
        "text, words, color, greyscale, shading, photorealistic, gradients, complex details, faces with eyes",
    )

    results = []
    examples = prompts.get("example_generations", [])

    console.print(f"[bold green]Generating {len(examples)} images...[/bold green]")

    for i, example in enumerate(examples):
        use_case = example["use_case"]
        prompt = example["prompt_construction"]

        if use_case in skip_set:
            console.print(f"[{i + 1}/{len(examples)}] Skipping: {use_case}")
            results.append({"success": True, "use_case": use_case, "skipped": True})
            continue

        console.print(f"[{i + 1}/{len(examples)}] Generating: {use_case}")

        try:
            result = generate_single_image.local(
                prompt=prompt,
                use_case=use_case,
                negative_prompt=negative_prompt,
                reference_image_path=reference_path,
                use_output_as_reference=use_output_as_reference,
            )
            results.append(result)

            if result["success"]:
                console.print(f"  [green]✓[/green] Saved: {result['filename']}")
            else:
                console.print(f"  [red]✗[/red] Failed: {result.get('error')}")

        except Exception as e:
            console.print(f"  [red]✗[/red] Error: {e}")
            results.append({
                "success": False,
                "use_case": use_case,
                "error": str(e),
            })

    successful = sum(1 for r in results if r.get("success"))
    console.print(f"\n[bold]Complete: {successful}/{len(examples)} images generated[/bold]")

    return results


@app.local_entrypoint()
def main(
    reference_image: str = "images.png",
    single: str | None = None,
    no_reference: bool = False,
    use_output_reference: bool = False,
    skip: str | None = None,
):
    """
    Generate IKEA-style feature illustrations.

    Args:
        reference_image: Name of reference image in the volume (default: images.png)
        single: Generate only a single use case by name (e.g., "Weather")
        no_reference: Skip using a reference image for style guidance
        use_output_reference: Use reference image from output volume instead of reference volume
        skip: Comma-separated list of use cases to skip (e.g., "Weather,Web Search")
    """
    from rich.console import Console

    console = Console()
    console.print("[bold]Clairvoyant Feature Illustration Generator[/bold]")

    skip_list = [s.strip() for s in skip.split(",")] if skip else []
    if skip_list:
        console.print(f"Skipping: {skip_list}")

    if no_reference:
        ref_path = None
        console.print("Reference image: [yellow]disabled[/yellow]")
    elif use_output_reference:
        ref_path = reference_image
        console.print(f"Reference image: {reference_image} [cyan](from output volume)[/cyan]")
    else:
        ref_path = f"/reference/{reference_image}"
        console.print(f"Reference image: {reference_image}")

    if single:
        example = next(
            (e for e in FEATURE_PROMPTS["example_generations"] if e["use_case"] == single),
            None,
        )
        if not example:
            console.print(f"[red]Use case not found: {single}[/red]")
            console.print("Available:", [e["use_case"] for e in FEATURE_PROMPTS["example_generations"]])
            return

        result = generate_single_image.remote(
            prompt=example["prompt_construction"],
            use_case=example["use_case"],
            negative_prompt=FEATURE_PROMPTS["negative_prompt"],
            reference_image_path=ref_path if not no_reference else None,
            use_output_as_reference=use_output_reference,
        )
        console.print(result)
    else:
        results = generate_all_images.remote(
            reference_image_name=None if no_reference else reference_image,
            use_output_as_reference=use_output_reference,
            skip_use_cases=skip_list if skip_list else None,
        )
        console.print("\n[bold]Results:[/bold]")
        for r in results:
            status = "[green]✓[/green]" if r.get("success") else "[red]✗[/red]"
            console.print(f"  {status} {r['use_case']}")
