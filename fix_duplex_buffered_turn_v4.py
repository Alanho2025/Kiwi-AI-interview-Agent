#!/usr/bin/env python3
"""
Fix duplex buffered-turn tests after voice product behavior patch.

Run from repo root:

    python fix_duplex_buffered_turn_v4.py --dry-run
    python fix_duplex_buffered_turn_v4.py
    python fix_duplex_buffered_turn_v4.py --run-tests

Root cause:
- tests send { type: 'speech_start' } without clientTurnId
- duplexVoiceAgentService currently ignores speech_start with no clientTurnId
- therefore realtime STT session is never created, so realtimeState.config/session stays null

Fix:
- generate a safe fallback clientTurnId when the frontend/test does not provide one
- keep strict duplicate/mismatch handling after a turn id exists
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

ROOT = Path.cwd()
BACKUP_DIR = ROOT / ".voice_product_behavior_patch_backup" / datetime.now().strftime("v4_%Y%m%d_%H%M%S")


@dataclass
class Result:
    path: str
    changed: bool
    message: str


results: list[Result] = []
errors: list[str] = []


def read(path: str) -> str:
    p = ROOT / path
    if not p.exists():
        raise FileNotFoundError(f"Missing expected file: {path}")
    return p.read_text(encoding="utf-8")


def backup(path: str) -> None:
    source = ROOT / path
    target = BACKUP_DIR / path
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def write(path: str, content: str, dry_run: bool) -> None:
    if dry_run:
        return
    backup(path)
    (ROOT / path).write_text(content, encoding="utf-8")


def patch_duplex_voice_agent_service(dry_run: bool) -> None:
    path = "backend/src/services/voice/duplexVoiceAgentService.js"
    text = read(path)
    original = text

    old = """      if (payload.type === 'speech_start') {
        const incomingClientTurnId = String(payload.clientTurnId || '').trim();
        if (!incomingClientTurnId) {
          logger?.warn?.('Ignoring speech_start without clientTurnId', {
            sessionId: activeSession?.id || session?.id,
          });
          return;
        }
"""
    new = """      if (payload.type === 'speech_start') {
        const providedClientTurnId = String(payload.clientTurnId || '').trim();
        const incomingClientTurnId = providedClientTurnId || `voice-turn-${Date.now()}-${speechCaptureSequence + 1}`;
        if (!providedClientTurnId) {
          logger?.warn?.('speech_start did not include clientTurnId; generated fallback turn id', {
            sessionId: activeSession?.id || session?.id,
            generatedClientTurnId: incomingClientTurnId,
          });
        }
"""

    if old not in text:
        if "speech_start did not include clientTurnId; generated fallback turn id" in text:
            results.append(Result(path, False, "fallback clientTurnId already present"))
            return
        raise ValueError("Could not find strict speech_start clientTurnId block")

    text = text.replace(old, new, 1)

    if text != original:
        write(path, text, dry_run)
        results.append(Result(path, True, "allow speech_start without clientTurnId by generating fallback id"))
    else:
        results.append(Result(path, False, "already up to date"))


def run_tests() -> int:
    commands = [
        ["npm", "test", "--", "tests/robustness/voice/duplexVoiceBufferedTurn.test.js"],
        ["npm", "test", "--", "tests/robustness/voice/speechConfidenceGate.productBehavior.test.js"],
        ["npm", "test", "--", "tests/robustness/interview/questionRanker.productBehavior.test.js"],
        ["npm", "run", "lint"],
    ]
    for command in commands:
        print(f"\n[run] cd backend && {' '.join(command)}")
        completed = subprocess.run(command, cwd=ROOT / "backend")
        if completed.returncode != 0:
            return completed.returncode
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--run-tests", action="store_true")
    args = parser.parse_args()

    if not (ROOT / "backend").exists():
        print("ERROR: run from repo root", file=sys.stderr)
        return 2

    try:
      patch_duplex_voice_agent_service(args.dry_run)
    except Exception as exc:
      errors.append(f"patch_duplex_voice_agent_service: {exc}")

    print("\n=== v4 fix summary ===")
    for item in results:
        print(f"{'CHANGED' if item.changed else 'SKIPPED':8} {item.path} - {item.message}")

    if errors:
        print("\n=== Errors ===", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    if args.dry_run:
        print("\nDry run passed. No files were written.")
        return 0

    print(f"\nBackups saved under: {BACKUP_DIR}")
    print("\nNext checks:")
    print("  git diff backend/src/services/voice/duplexVoiceAgentService.js")
    print("  cd backend && npm test -- tests/robustness/voice/duplexVoiceBufferedTurn.test.js")
    print("  cd backend && npm run lint")

    if args.run_tests:
        return run_tests()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
