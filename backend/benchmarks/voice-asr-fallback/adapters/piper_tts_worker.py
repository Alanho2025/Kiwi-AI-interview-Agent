#!/usr/bin/env python3
import os
import subprocess
import sys
import tempfile


def require_env(name):
    value = os.environ.get(name)
    if not value:
        raise ValueError(f"{name} is required")
    return value


def main():
    text = sys.stdin.read().strip()
    if not text:
        print("Piper TTS worker requires text on stdin.", file=sys.stderr, flush=True)
        return 2

    try:
        piper_command = os.environ.get("PIPER_TTS_COMMAND", "./.venv-asr/bin/piper")
        model_path = require_env("PIPER_TTS_MODEL")
        config_path = require_env("PIPER_TTS_CONFIG")
    except Exception as exc:
        print(str(exc), file=sys.stderr, flush=True)
        return 2

    output_path = None
    try:
        with tempfile.NamedTemporaryFile(prefix="kiwi-piper-", suffix=".wav", delete=False) as output_file:
            output_path = output_file.name

        result = subprocess.run(
            [piper_command, "-m", model_path, "-c", config_path, "-f", output_path],
            input=f"{text}\n",
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        if result.returncode != 0:
            if result.stderr:
                print(result.stderr[-2000:], file=sys.stderr, flush=True)
            return result.returncode

        with open(output_path, "rb") as audio_file:
            sys.stdout.buffer.write(audio_file.read())
            sys.stdout.buffer.flush()

        return 0
    finally:
        if output_path:
            try:
                os.unlink(output_path)
            except OSError:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
