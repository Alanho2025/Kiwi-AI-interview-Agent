#!/usr/bin/env python3
import json
import os
import sys

def emit(obj):
    print(json.dumps(obj, ensure_ascii=False), flush=True)

def main():
    model_path = os.environ.get("VOSK_MODEL_PATH")
    sample_rate = float(os.environ.get("ASR_SAMPLE_RATE", "16000"))

    if not model_path:
        emit({"type": "error", "message": "VOSK_MODEL_PATH is required"})
        return 2

    try:
        from vosk import Model, KaldiRecognizer, SetLogLevel
    except Exception as exc:
        emit({"type": "error", "message": "Install Python vosk first: python3 -m pip install vosk", "details": str(exc)})
        return 2

    SetLogLevel(-1)
    model = Model(model_path)
    rec = KaldiRecognizer(model, sample_rate)
    rec.SetWords(True)

    last_partial = ""
    while True:
        data = sys.stdin.buffer.read(3200)
        if not data:
            break

        if rec.AcceptWaveform(data):
            result = json.loads(rec.Result() or "{}")
            text = (result.get("text") or "").strip()
            if text:
                emit({"type": "final", "text": text})
        else:
            partial = json.loads(rec.PartialResult() or "{}")
            text = (partial.get("partial") or "").strip()
            if text and text != last_partial:
                last_partial = text
                emit({"type": "partial", "text": text})

    final = json.loads(rec.FinalResult() or "{}")
    text = (final.get("text") or "").strip()
    if text:
        emit({"type": "final", "text": text})

    return 0

if __name__ == "__main__":
    raise SystemExit(main())