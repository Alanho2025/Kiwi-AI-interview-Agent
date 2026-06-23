# Voice ASR fallback benchmark spike

This folder began as a benchmark-only spike. The Vosk, Sherpa-ONNX, Piper, fixture, and runner code remains benchmark-only. One exception now exists: production `backend/src/services/voice/elevenLabsRealtimeSpeechSessionService.js` reuses `adapters/elevenLabsRealtimeSttProvider.js` through the production STT provider router. Do not describe the entire folder as isolated from production.

## Real decision being tested

The goal is not to prove Azure works. Azure is the current primary STT path.

The goal is to decide whether a local open-source streaming ASR provider can be used as Plan B when Azure Speech is unavailable:

- Vosk streaming ASR
- Sherpa-ONNX streaming ASR

A local fallback must pass the real live-interview path, not only an isolated ASR timing test:

```text
PCM WebSocket-style chunks
-> local streaming ASR
-> final transcript after speech_end
-> existing realtime voice turn service
-> adaptive interview engine / RAG / DeepSeek
-> assistant response text
-> TTS audio readiness
```

## Decision rule

Do not add a local STT fallback for live interviews unless a streaming or near-streaming provider can pass all hard gates:

1. Interview answer length: 30, 60, and 90 seconds.
2. Partial transcript appears before the speaker finishes.
3. Final transcript is ready within 1 second after `speech_end`.
4. Technical keyword recall is at least 80 percent when keywords are provided.
5. WER is at most 30 percent when expected transcript is provided.
6. The existing RAG / adaptive interview / DeepSeek path produces an assistant response.
7. AI first audio is ready within 3 to 5 seconds after `speech_end`.
8. CPU and memory use are acceptable for the deployment target.
9. The provider can consume the existing 16 kHz mono PCM WebSocket chunks without changing the live voice product flow.

If a provider cannot pass these gates, do not wire it into live interviews. Keep Azure streaming STT as the primary path. Use faster-whisper only for optional post-interview transcript cleanup.

## Providers compared

- Vosk streaming ASR: local Plan B candidate. Requires a local Vosk model and native package support.
- Sherpa-ONNX streaming ASR: local Plan B candidate. Requires pinned model files and a pinned Node integration package or CLI wrapper.
- Azure streaming STT: optional baseline only. It is not Plan B.

Piper is intentionally not part of the STT benchmark. Use it only for a separate TTS fallback benchmark.

## Run simulation test first

Use this test before installing any ASR provider. It validates the benchmark gate logic with generated 30s, 60s, and 90s PCM audio and simulated providers.

From `backend/`:

```bash
node benchmarks/voice-asr-fallback/runVoiceAsrFallbackSimulationTest.js --fast
```

Expected behaviour:

- `mock-streaming-fast-pass` passes.
- `mock-streaming-borderline-pass` passes.
- `mock-streaming-slow-final-fail` fails because final transcript delay is over 1 second after `speech_end`.
- `mock-no-partial-fail` fails because no partial transcript appears before `speech_end`.
- `mock-low-recall-fail` fails because technical keyword recall is too low.

The simulation writes:

```text
backend/benchmarks/voice-asr-fallback/simulation.results.json
```

This simulation does not measure real ASR accuracy. It only confirms that the acceptance gates catch the correct failure modes.

## Generate local interview audio fixtures

On macOS, generate spoken 30s, 60s, and 90s style benchmark fixtures automatically:

```bash
node benchmarks/voice-asr-fallback/generateInterviewAudioFixtures.js
```

The script uses the built-in macOS `say` command, then converts the audio with `ffmpeg-static` into 16 kHz mono 16-bit PCM WAV files.

It writes:

```text
backend/benchmarks/voice-asr-fallback/fixtures/interview-answer-30s.wav
backend/benchmarks/voice-asr-fallback/fixtures/interview-answer-60s.wav
backend/benchmarks/voice-asr-fallback/fixtures/interview-answer-90s.wav
backend/benchmarks/voice-asr-fallback/fixtures.local.json
```

Optional voice settings:

```bash
ASR_FIXTURE_SAY_VOICE=Daniel ASR_FIXTURE_SAY_RATE=150 \
node benchmarks/voice-asr-fallback/generateInterviewAudioFixtures.js
```

Do not commit generated audio files. They are local benchmark fixtures.

## Fixture requirements for real provider benchmark

If you do not use the generator, create local fixtures manually under:

```text
backend/benchmarks/voice-asr-fallback/fixtures/
```

Use 16 kHz mono 16-bit PCM WAV files:

```text
interview-answer-30s.wav
interview-answer-60s.wav
interview-answer-90s.wav
```

Copy `fixtures.example.json` to `fixtures.local.json`, then fill in expected transcripts and technical keywords. Do not commit real interview recordings.

## Run local ASR-only benchmark

This checks whether Vosk or Sherpa-ONNX can consume the current PCM chunk format and produce usable transcripts. It does not call DeepSeek, RAG, or TTS.

From `backend/`:

```bash
node benchmarks/voice-asr-fallback/runVoiceAsrFallbackBenchmark.js \
  --manifest benchmarks/voice-asr-fallback/fixtures.local.json \
  --providers vosk,sherpa-onnx \
  --output benchmarks/voice-asr-fallback/results.local-fallback.json
```

Run one provider at a time if setup is incomplete:

```bash
node benchmarks/voice-asr-fallback/runVoiceAsrFallbackBenchmark.js \
  --manifest benchmarks/voice-asr-fallback/fixtures.local.json \
  --providers vosk \
  --output benchmarks/voice-asr-fallback/results.vosk.local.json
```

Azure baseline can still be run explicitly if needed:

```bash
node benchmarks/voice-asr-fallback/runVoiceAsrFallbackBenchmark.js \
  --manifest benchmarks/voice-asr-fallback/fixtures.local.json \
  --providers azure \
  --output benchmarks/voice-asr-fallback/results.azure.baseline.json
```

Fast mode skips real-time sleeps and is useful only for CPU and adapter smoke tests:

```bash
ASR_BENCHMARK_REALTIME=false node benchmarks/voice-asr-fallback/runVoiceAsrFallbackBenchmark.js \
  --manifest benchmarks/voice-asr-fallback/fixtures.local.json \
  --providers vosk
```

## Run real end-to-end fallback benchmark

This is the important benchmark for the product decision.

It runs:

```text
local ASR transcript
-> processRealtimeVoiceTurn()
-> runTask({ taskType: 'interview_next_turn' })
-> existing adaptive interview / RAG / DeepSeek path
-> Azure TTS full synthesis unless --text-only-ai is used
```

Because it uses the real realtime voice service, it writes transcript turns, saves interview answers, and advances the selected interview session. Use a disposable test session.

Required inputs:

- Local ASR provider setup, such as Vosk or Sherpa-ONNX.
- A valid existing interview session id.
- The user id that owns the test session, unless the session object already exposes it.
- DeepSeek and database environment variables required by the normal backend.
- Azure Speech env vars if you want full TTS audio synthesis.

Full E2E with TTS:

```bash
node benchmarks/voice-asr-fallback/runVoiceAsrFallbackE2eBenchmark.js \
  --manifest benchmarks/voice-asr-fallback/fixtures.local.json \
  --providers vosk,sherpa-onnx \
  --session-id <disposable-session-id> \
  --user-id <test-user-id> \
  --allow-session-mutation \
  --output benchmarks/voice-asr-fallback/results.e2e-local-fallback.json
```

Text-only E2E for isolating ASR + RAG + DeepSeek without waiting for TTS:

```bash
node benchmarks/voice-asr-fallback/runVoiceAsrFallbackE2eBenchmark.js \
  --manifest benchmarks/voice-asr-fallback/fixtures.local.json \
  --providers vosk \
  --session-id <disposable-session-id> \
  --user-id <test-user-id> \
  --allow-session-mutation \
  --text-only-ai \
  --output benchmarks/voice-asr-fallback/results.e2e-vosk-text-only.json
```

The script refuses to run the real pipeline unless `--allow-session-mutation` is provided. This prevents accidentally mutating a real demo or production session.

Local command TTS E2E for testing without Azure Speech:

```bash
ASR_BENCHMARK_TTS_PROVIDER=local-command \
ASR_BENCHMARK_LOCAL_TTS_COMMAND="./.venv-asr/bin/python benchmarks/voice-asr-fallback/adapters/piper_tts_worker.py" \
ASR_BENCHMARK_LOCAL_TTS_PROVIDER_NAME=local-piper-command \
ASR_BENCHMARK_LOCAL_TTS_CONTENT_TYPE=audio/wav \
ASR_BENCHMARK_LOCAL_TTS_OUTPUT_FORMAT=wav \
PIPER_TTS_MODEL=/absolute/path/en_US-lessac-medium.onnx \
PIPER_TTS_CONFIG=/absolute/path/en_US-lessac-medium.onnx.json \
node benchmarks/voice-asr-fallback/runVoiceAsrFallbackE2eBenchmark.js \
  --manifest benchmarks/voice-asr-fallback/fixtures.local.json \
  --providers vosk,sherpa-onnx \
  --session-id <disposable-session-id> \
  --user-id <test-user-id> \
  --allow-session-mutation \
  --tts-provider local-command \
  --local-tts-command "./.venv-asr/bin/python benchmarks/voice-asr-fallback/adapters/piper_tts_worker.py" \
  --local-tts-provider-name local-piper-command \
  --local-tts-content-type audio/wav \
  --local-tts-output-format wav \
  --output benchmarks/voice-asr-fallback/results.e2e-local-piper.json
```

High-quality third-party command TTS E2E using ElevenLabs:

```bash
ELEVENLABS_API_KEY=... \
ELEVENLABS_VOICE_ID=<voice-id-from-voice-library> \
ELEVENLABS_MODEL_ID=eleven_turbo_v2_5 \
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128 \
ELEVENLABS_STABILITY=0.55 \
ELEVENLABS_SIMILARITY_BOOST=0.8 \
ELEVENLABS_STYLE=0.25 \
ELEVENLABS_USE_SPEAKER_BOOST=true \
node benchmarks/voice-asr-fallback/runVoiceAsrFallbackE2eBenchmark.js \
  --manifest benchmarks/voice-asr-fallback/fixtures.local.json \
  --providers vosk,sherpa-onnx \
  --session-id <disposable-session-id> \
  --user-id <test-user-id> \
  --allow-session-mutation \
  --tts-provider local-command \
  --local-tts-command "./.venv-asr/bin/python benchmarks/voice-asr-fallback/adapters/elevenlabs_tts_worker.py" \
  --local-tts-provider-name elevenlabs-command \
  --local-tts-content-type audio/mpeg \
  --local-tts-output-format mp3_44100_128 \
  --output benchmarks/voice-asr-fallback/results.e2e-elevenlabs.json
```

## Provider setup

### Vosk

Install package and download a model locally:

```bash
npm i vosk
export VOSK_MODEL_PATH=/absolute/path/to/vosk-model-small-en-us-or-en
```

### Sherpa-ONNX

The runner intentionally uses environment variables because the exact Node package/API should be pinned before production use:

```bash
npm i <chosen-sherpa-onnx-node-package>
export SHERPA_ONNX_NODE_MODULE=<chosen-package-name>
export SHERPA_ONNX_STREAMING_FACTORY=createOnlineRecognizer
export SHERPA_ONNX_TOKENS=/absolute/path/tokens.txt
export SHERPA_ONNX_ENCODER=/absolute/path/encoder.onnx
export SHERPA_ONNX_DECODER=/absolute/path/decoder.onnx
export SHERPA_ONNX_JOINER=/absolute/path/joiner.onnx
```

If a selected Sherpa package uses a different API, adapt only the benchmark adapter first. Do not wire it into live voice until this benchmark passes.

### Azure baseline and TTS

Azure is not the local Plan B candidate. It is used only for baseline STT or full TTS synthesis in the E2E benchmark:

```bash
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=...
```

Run Azure as the baseline STT provider:

```bash
node benchmarks/voice-asr-fallback/runVoiceAsrFallbackE2eBenchmark.js \
  --manifest benchmarks/voice-asr-fallback/fixtures.local.json \
  --providers azure \
  --session-id <disposable-session-id> \
  --user-id <test-user-id> \
  --allow-session-mutation \
  --output benchmarks/voice-asr-fallback/results.e2e-azure.json
```

### ElevenLabs high-quality TTS

The `elevenlabs_tts_worker.py` adapter is benchmark-only. It reads text from stdin and writes MP3 bytes to stdout. Use it to compare a natural third-party voice against Azure Speech without changing production code.

For low-latency conversational use, start with:

```bash
ELEVENLABS_MODEL_ID=eleven_turbo_v2_5
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128
```

For the least robotic delivery, choose or create an ElevenLabs voice with a prompt such as:

```text
Warm professional New Zealand female interviewer, natural conversational pacing, clear but not overly formal, friendly coaching tone.
```

Use the resulting voice id as `ELEVENLABS_VOICE_ID`.

## Output fields

ASR-only benchmark rows report:

- `firstPartialMs`
- `speechEndMs`
- `finalTranscriptDelayAfterSpeechEndMs`
- `keywordRecall`
- `wer`
- `resourceUse`
- `integrationComplexity`
- `acceptance.pass`
- `acceptance.recommendation`

E2E benchmark rows report:

- `asr.finalTranscriptDelayAfterSpeechEndMs`
- `asr.finalTranscriptText`
- `asr.keywordRecall`
- `asr.wer`
- `e2e.mode`
- `e2e.pipelineDoneMs`
- `e2e.firstSentenceReadyMs`
- `e2e.assistantAudioReady`
- `e2e.assistantTextPreview`
- `e2e.latency`
- `acceptance.aiFirstAudioActualAfterSpeechEndMs`
- `acceptance.aiFirstAudioActualWithin5s`
- `acceptance.pass`

## Current hypothesis before real E2E results

Azure remains the safest primary STT option because it is already integrated with continuous recognition and current PCM chunks. Local fallback is only worth adding if Sherpa-ONNX or Vosk proves that it can produce final text within 1 second after `speech_end` and the existing RAG / DeepSeek / TTS pipeline can still produce first audio within 3 to 5 seconds. A turn-level faster-whisper fallback should not be added to live interviews because it starts too late and cannot provide partial transcript availability during the answer.
