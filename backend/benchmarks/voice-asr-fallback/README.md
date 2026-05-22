# Voice ASR fallback benchmark spike

This is a benchmark-only spike. It must not be imported by production code.

## Decision rule

Do not add a local STT fallback for live interviews unless a streaming or near-streaming provider can pass all hard gates:

1. Interview answer length: 30, 60, and 90 seconds.
2. Final transcript is ready within 1 second after `speech_end`.
3. AI first audio remains possible within 3 to 5 seconds after `speech_end`.
4. Partial transcript appears before the speaker finishes.
5. Technical keyword recall is acceptable for interview terms.
6. CPU and memory use are acceptable for the deployment target.
7. The provider can consume the existing 16 kHz mono PCM WebSocket chunks without changing the live voice product flow.

If a provider cannot pass these gates, keep Azure streaming STT as the live path. Use faster-whisper only for optional post-interview transcript cleanup.

## Providers compared

- Azure streaming STT: current baseline. It already uses `createRealtimeSpeechSession()` and the existing PCM WebSocket chunk flow.
- Vosk streaming ASR: local candidate. Requires a local Vosk model and native package support.
- Sherpa-ONNX streaming ASR: local candidate. Requires pinned model files and a pinned Node integration package or CLI wrapper.

Piper is intentionally not part of the STT benchmark. Use it only for TTS fallback benchmarking.

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

## Run real provider benchmark

From `backend/`:

```bash
node benchmarks/voice-asr-fallback/runVoiceAsrFallbackBenchmark.js \
  --manifest benchmarks/voice-asr-fallback/fixtures.local.json \
  --providers azure,vosk,sherpa-onnx \
  --output benchmarks/voice-asr-fallback/results.local.json
```

For Azure baseline only:

```bash
node benchmarks/voice-asr-fallback/runVoiceAsrFallbackBenchmark.js \
  --manifest benchmarks/voice-asr-fallback/fixtures.local.json \
  --providers azure \
  --output benchmarks/voice-asr-fallback/results.azure.local.json
```

Fast mode skips real-time sleeps and is useful only for CPU and adapter smoke tests:

```bash
ASR_BENCHMARK_REALTIME=false node benchmarks/voice-asr-fallback/runVoiceAsrFallbackBenchmark.js \
  --manifest benchmarks/voice-asr-fallback/fixtures.local.json \
  --providers vosk
```

## Provider setup

### Azure

Requires the same backend env vars as the existing app:

```bash
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=...
```

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

## Output fields

Each provider-fixture row reports:

- `firstPartialMs`
- `finalTranscriptDelayAfterSpeechEndMs`
- `keywordRecall`
- `wer`
- `resourceUse`
- `integrationComplexity`
- `acceptance.finalReadyWithin1s`
- `acceptance.aiFirstAudioPossibleWithin3To5s`
- `acceptance.recommendation`

## Current hypothesis before real fixture results

Azure remains the safest live STT option because it is already integrated with continuous recognition and current PCM chunks. Local fallback is only worth adding if Sherpa-ONNX or Vosk proves that it can produce final text within 1 second after `speech_end` on 30 to 90 second answers. A turn-level faster-whisper fallback should not be added to live interviews because it starts too late and cannot provide partial transcript availability during the answer.
