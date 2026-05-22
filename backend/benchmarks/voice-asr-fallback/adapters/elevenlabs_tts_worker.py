#!/usr/bin/env python3
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


def env_float(name, default):
    value = os.environ.get(name)
    if value in (None, ""):
        return default
    return float(value)


def env_bool(name, default):
    value = os.environ.get(name)
    if value in (None, ""):
        return default
    return str(value).lower() in ("1", "true", "yes", "on")


def fail(message, code=2):
    print(message, file=sys.stderr, flush=True)
    return code


def main():
    text = sys.stdin.read().strip()
    if not text:
        return fail("ElevenLabs TTS worker requires text on stdin.")

    api_key = os.environ.get("ELEVENLABS_API_KEY")
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID")
    if not api_key:
        return fail("ELEVENLABS_API_KEY is required.")
    if not voice_id:
        return fail("ELEVENLABS_VOICE_ID is required.")

    model_id = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_turbo_v2_5")
    output_format = os.environ.get("ELEVENLABS_OUTPUT_FORMAT", "mp3_44100_128")
    endpoint_mode = os.environ.get("ELEVENLABS_ENDPOINT_MODE", "stream")
    timeout_seconds = float(os.environ.get("ELEVENLABS_TTS_TIMEOUT_SECONDS", "30"))

    path = "stream" if endpoint_mode == "stream" else ""
    base_url = f"https://api.elevenlabs.io/v1/text-to-speech/{urllib.parse.quote(voice_id)}"
    if path:
        base_url = f"{base_url}/{path}"

    query = {"output_format": output_format}
    optimize_streaming_latency = os.environ.get("ELEVENLABS_OPTIMIZE_STREAMING_LATENCY")
    if optimize_streaming_latency not in (None, ""):
        query["optimize_streaming_latency"] = optimize_streaming_latency

    payload = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {
            "stability": env_float("ELEVENLABS_STABILITY", 0.55),
            "similarity_boost": env_float("ELEVENLABS_SIMILARITY_BOOST", 0.8),
            "style": env_float("ELEVENLABS_STYLE", 0.25),
            "use_speaker_boost": env_bool("ELEVENLABS_USE_SPEAKER_BOOST", True),
        },
    }

    request = urllib.request.Request(
        f"{base_url}?{urllib.parse.urlencode(query)}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "xi-api-key": api_key,
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            audio = response.read()
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        return fail(f"ElevenLabs TTS failed with HTTP {exc.code}: {details}", 1)
    except Exception as exc:
        return fail(f"ElevenLabs TTS failed: {exc}", 1)

    if not audio:
        return fail("ElevenLabs TTS produced empty audio.", 1)

    sys.stdout.buffer.write(audio)
    sys.stdout.buffer.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
