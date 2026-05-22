#!/usr/bin/env python3
import array
import json
import os
import sys


def emit(obj):
    print(json.dumps(obj, ensure_ascii=False), flush=True)


def require_env(name):
    value = os.environ.get(name)
    if not value:
        raise ValueError(f"{name} is required")
    return value


def pcm16le_to_float32(data):
    even_length = len(data) - (len(data) % 2)
    samples_i16 = array.array("h")
    samples_i16.frombytes(data[:even_length])
    if sys.byteorder != "little":
        samples_i16.byteswap()
    return array.array("f", (max(-1.0, min(1.0, sample / 32768.0)) for sample in samples_i16))


def decode_ready(recognizer, stream):
    while recognizer.is_ready(stream):
        recognizer.decode_stream(stream)


def main():
    try:
        import sherpa_onnx
    except Exception as exc:
        emit({"type": "error", "message": "Install sherpa-onnx first: python -m pip install sherpa-onnx", "details": str(exc)})
        return 2

    try:
        sample_rate = int(float(os.environ.get("ASR_SAMPLE_RATE", "16000")))
        recognizer = sherpa_onnx.OnlineRecognizer.from_transducer(
            tokens=require_env("SHERPA_ONNX_TOKENS"),
            encoder=require_env("SHERPA_ONNX_ENCODER"),
            decoder=require_env("SHERPA_ONNX_DECODER"),
            joiner=require_env("SHERPA_ONNX_JOINER"),
            num_threads=int(os.environ.get("SHERPA_ONNX_NUM_THREADS", "1")),
            sample_rate=sample_rate,
            feature_dim=80,
            decoding_method=os.environ.get("SHERPA_ONNX_DECODING_METHOD", "greedy_search"),
            provider=os.environ.get("SHERPA_ONNX_PROVIDER", "cpu"),
            debug=os.environ.get("SHERPA_ONNX_DEBUG", "false").lower() == "true",
        )
    except Exception as exc:
        emit({"type": "error", "message": "Failed to create Sherpa-ONNX recognizer", "details": str(exc)})
        return 2

    stream = recognizer.create_stream()
    last_partial = ""

    while True:
        data = sys.stdin.buffer.read(3200)
        if not data:
            break

        samples = pcm16le_to_float32(data)
        if not samples:
            continue

        stream.accept_waveform(sample_rate, samples)
        decode_ready(recognizer, stream)

        text = str(recognizer.get_result(stream) or "").strip()
        if text and text != last_partial:
            last_partial = text
            emit({"type": "partial", "text": text})

    tail_padding = array.array("f", [0.0] * int(sample_rate * 0.66))
    stream.accept_waveform(sample_rate, tail_padding)
    stream.input_finished()
    decode_ready(recognizer, stream)

    text = str(recognizer.get_result(stream) or "").strip()
    if text:
        emit({"type": "final", "text": text})

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
