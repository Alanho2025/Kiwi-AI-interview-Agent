# ElevenLabs realtime STT benchmark

This is a benchmark-only cloud STT fallback spike. It does not change the production live voice flow.

## Why this exists

The previous local ASR result showed that Vosk/Sherpa can be fast, but the technical keyword recall was too low for interview coaching. Since this project can rely on internet access, ElevenLabs realtime STT is a stronger next candidate than adding a low-quality local model to live interviews.

Use this benchmark to decide whether ElevenLabs realtime STT can act as an Azure Speech cloud fallback.

## Provider name

Use this provider name in the existing benchmark runners:

```text
elevenlabs-realtime
```

## Environment variables

Required:

```bash
ELEVENLABS_API_KEY=...
```

Optional:

```bash
ELEVENLABS_STT_MODEL_ID=scribe_v2_realtime
ELEVENLABS_STT_AUDIO_FORMAT=pcm_16000
ELEVENLABS_STT_COMMIT_STRATEGY=manual
ELEVENLABS_STT_INCLUDE_TIMESTAMPS=false
ELEVENLABS_STT_FINAL_TIMEOUT_MS=5000
ELEVENLABS_STT_KEYTERMS="React,Node,PostgreSQL,WebSocket,Azure,STAR,RAG,MongoDB,Redis,Kafka"
```

The adapter also uses each fixture's `keywords` as realtime STT keyterms. Extra keyterms from `ELEVENLABS_STT_KEYTERMS` are appended after fixture keywords. Keyterms are deduplicated, capped at 50 terms, and trimmed to 20 characters each.

## ASR-only benchmark

From `backend/`:

```bash
node benchmarks/voice-asr-fallback/runVoiceAsrFallbackBenchmark.js \
  --manifest benchmarks/voice-asr-fallback/fixtures.local.json \
  --providers elevenlabs-realtime \
  --output benchmarks/voice-asr-fallback/results.elevenlabs-realtime-stt.local.json
```

To compare against Azure baseline:

```bash
node benchmarks/voice-asr-fallback/runVoiceAsrFallbackBenchmark.js \
  --manifest benchmarks/voice-asr-fallback/fixtures.local.json \
  --providers azure,elevenlabs-realtime \
  --output benchmarks/voice-asr-fallback/results.azure-vs-elevenlabs-stt.local.json
```

## Real E2E benchmark

Use a disposable test session because the E2E runner mutates the session by saving transcript turns and advancing the interview.

```bash
node benchmarks/voice-asr-fallback/runVoiceAsrFallbackE2eBenchmark.js \
  --manifest benchmarks/voice-asr-fallback/fixtures.local.json \
  --providers elevenlabs-realtime \
  --session-id <disposable-session-id> \
  --user-id <test-user-id> \
  --allow-session-mutation \
  --output benchmarks/voice-asr-fallback/results.e2e-elevenlabs-realtime-stt.json
```

To test ElevenLabs realtime STT plus ElevenLabs TTS through the existing local-command TTS benchmark path:

```bash
node benchmarks/voice-asr-fallback/runVoiceAsrFallbackE2eBenchmark.js \
  --manifest benchmarks/voice-asr-fallback/fixtures.local.json \
  --providers elevenlabs-realtime \
  --session-id <disposable-session-id> \
  --user-id <test-user-id> \
  --allow-session-mutation \
  --tts-provider local-command \
  --local-tts-command "./.venv-asr/bin/python benchmarks/voice-asr-fallback/adapters/elevenlabs_tts_worker.py" \
  --local-tts-provider-name elevenlabs-command \
  --local-tts-content-type audio/mpeg \
  --local-tts-output-format mp3_44100_128 \
  --output benchmarks/voice-asr-fallback/results.e2e-elevenlabs-realtime-stt-and-tts.json
```

## Decision rule

Do not wire ElevenLabs realtime STT into production unless it passes all gates:

1. Partial transcript appears before speech end.
2. Final committed transcript is ready within 1 second after speech end.
3. Technical keyword recall is at least 80 percent.
4. WER is at most 30 percent.
5. Real E2E speech-end to first audio is within 5 seconds.
6. The existing adaptive interview / RAG / DeepSeek path produces a valid assistant response.

If it passes ASR-only but fails E2E latency, the next bottleneck is likely the AI/TTS path, not STT.

## Output fields added

Rows for `elevenlabs-realtime` include `benchmarkMetadata` with:

```json
{
  "modelId": "scribe_v2_realtime",
  "audioFormat": "pcm_16000",
  "commitStrategy": "manual",
  "keyterms": ["React", "Node"],
  "keytermCount": 2
}
```

Do not include API keys, tokens, audio recordings, or generated result files in commits.
