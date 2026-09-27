"""
Curbo Guide Robot - Transcription & Intent Evaluation Harness
=============================================================
Evaluates the full STT → Intent pipeline across all WAV test files.

Metrics computed:
  - WER  (Word Error Rate)
  - CER  (Character Error Rate)
  - Keyword Hit Rate  (domain-specific vocabulary)
  - Intent Accuracy   (NAVIGATE / MOTION_CONTROL / CONVERSATION)
  - Destination Accuracy  (correct target key)
  - Waypoint ID Match Rate
  - Average Confidence Score
  - Transcription Latency (ms)
  - Hallucination Rate    (non-empty output on known-silent clips)

Usage:
    python evaluate_transcription.py
    python evaluate_transcription.py --report        # saves report to eval_report.txt
    python evaluate_transcription.py --verbose       # prints full per-sample details
"""

import os
import sys
import time
import argparse
import json
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Tuple

import numpy as np
import whisper

from curbo_speech import (
    AudioPreprocessor,
    STTEngine,
    IntentParser,
    CurboIntentResult,
)


# ---------------------------------------------------------------------------
# Ground-Truth Test Suite
# ---------------------------------------------------------------------------
# Each entry: (wav_file, reference_transcript, expected_intent, expected_target)
#
# reference_transcript : what a perfect STT should produce (lowercase, clean)
# expected_intent      : "NAVIGATE" | "MOTION_CONTROL" | "CONVERSATION"
# expected_target      : destination key or motion command key (None if CONVERSATION)
# ---------------------------------------------------------------------------
TEST_CASES = [
    {
        "wav": "wher_is_hr_office.wav",
        "reference": "where is hr office",
        "intent": "NAVIGATE",
        "target": "HR_OFFICE",
        "waypoint_id": "WP_ADMIN_HR_05",
        "domain_keywords": ["hr", "office"],
        "notes": "Misspelled filename – tests robustness to garbled/accented speech",
    },
    {
        "wav": "where_is_hr_office.wav",
        "reference": "where is the hr office",
        "intent": "NAVIGATE",
        "target": "HR_OFFICE",
        "waypoint_id": "WP_ADMIN_HR_05",
        "domain_keywords": ["hr", "office"],
        "notes": "Clean pronunciation of HR Office query",
    },
    {
        "wav": "Where_is_the_exam_cell.wav",
        "reference": "where is the exam cell",
        "intent": "NAVIGATE",
        "target": "EXAM_CELL",
        "waypoint_id": "WP_ADMIN_EXAM_04",
        "domain_keywords": ["exam", "cell"],
        "notes": "Standard navigation query",
    },
    {
        "wav": "take_me_to_reception.wav",
        "reference": "take me to the reception",
        "intent": "NAVIGATE",
        "target": "RECEPTION",
        "waypoint_id": "WP_ADMIN_RECEPTION_06",
        "domain_keywords": ["reception"],
        "notes": "Imperative phrasing",
    },
    {
        "wav": "Can _you_show_me_the_cafeteria.wav",
        "reference": "can you show me the cafeteria",
        "intent": "NAVIGATE",
        "target": "CAFETERIA",
        "waypoint_id": "WP_AMENITY_CANTEEN_01",
        "domain_keywords": ["cafeteria"],
        "notes": "Polite phrasing; space in filename (edge case)",
    },
    {
        "wav": "Can_you_guide_me_to_reception.wav",
        "reference": "can you guide me to the reception",
        "intent": "NAVIGATE",
        "target": "RECEPTION",
        "waypoint_id": "WP_ADMIN_RECEPTION_06",
        "domain_keywords": ["reception"],
        "notes": "Alternative polite phrasing",
    },
    {
        "wav": "I_need_to_go_to_the_HOD_office.wav",
        "reference": "i need to go to the hod office",
        "intent": "NAVIGATE",
        "target": "HOD_OFFICE",
        "waypoint_id": "WP_DEPT_HOD_07",
        "domain_keywords": ["hod", "office"],
        "notes": "Acronym 'HOD' – tests prompt-conditioning effectiveness",
    },
    {
        "wav": "Where is_the_canteen.wav",
        "reference": "where is the canteen",
        "intent": "NAVIGATE",
        "target": "CAFETERIA",   # Canteen -> maps to CAFETERIA alias
        "waypoint_id": "WP_AMENITY_CANTEEN_01",
        "domain_keywords": ["canteen"],
        "notes": "Alias test: 'canteen' should resolve to CAFETERIA destination",
    },
    {
        "wav": "where_is_my_office.wav",
        "reference": "where is my office",
        "intent": "NAVIGATE",
        "target": "MY_OFFICE",
        "waypoint_id": "WP_DEPT_FACULTY_08",
        "domain_keywords": ["office"],
        "notes": "Ambiguous phrasing – tests fallback to MY_OFFICE / CONVERSATION",
    },
    # JFK reference audio (long-form, non-navigation – sanity check)
    {
        "wav": "tests_jfk.wav",
        "reference": (
            "and so my fellow americans ask not what your country "
            "can do for you ask what you can do for your country"
        ),
        "intent": "CONVERSATION",
        "target": None,
        "waypoint_id": None,
        "domain_keywords": ["americans", "country"],
        "notes": "JFK speech – non-navigation input, expect CONVERSATION fallback",
    },
]


# ---------------------------------------------------------------------------
# WER / CER Helpers
# ---------------------------------------------------------------------------
def _edit_distance(a: List[str], b: List[str]) -> int:
    """Levenshtein distance between two token lists."""
    m, n = len(a), len(b)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev, dp[0] = dp[0], i
        for j in range(1, n + 1):
            temp = dp[j]
            if a[i - 1] == b[j - 1]:
                dp[j] = prev
            else:
                dp[j] = 1 + min(prev, dp[j], dp[j - 1])
            prev = temp
    return dp[n]


def compute_wer(reference: str, hypothesis: str) -> float:
    """Word Error Rate (0.0 = perfect, 1.0 = completely wrong)."""
    ref_tokens = reference.lower().split()
    hyp_tokens = hypothesis.lower().split()
    if not ref_tokens:
        return 0.0 if not hyp_tokens else 1.0
    dist = _edit_distance(ref_tokens, hyp_tokens)
    return round(dist / len(ref_tokens), 4)


def compute_cer(reference: str, hypothesis: str) -> float:
    """Character Error Rate."""
    ref_chars = list(reference.lower().replace(" ", ""))
    hyp_chars = list(hypothesis.lower().replace(" ", ""))
    if not ref_chars:
        return 0.0 if not hyp_chars else 1.0
    dist = _edit_distance(ref_chars, hyp_chars)
    return round(dist / len(ref_chars), 4)


def keyword_hit_rate(transcript: str, keywords: List[str]) -> Tuple[float, List[str], List[str]]:
    """
    Returns (hit_rate, hits, misses) for a list of expected keywords.
    Checks for substring presence in the lowercased transcript.
    """
    t = transcript.lower()
    hits = [k for k in keywords if k in t]
    misses = [k for k in keywords if k not in t]
    rate = len(hits) / len(keywords) if keywords else 1.0
    return round(rate, 4), hits, misses


# ---------------------------------------------------------------------------
# Per-Sample Result
# ---------------------------------------------------------------------------
@dataclass
class EvalSample:
    wav: str
    notes: str
    found: bool                      # WAV file exists on disk
    reference: str = ""
    hypothesis: str = ""             # raw Whisper output
    wer: float = 0.0
    cer: float = 0.0
    keyword_hit_rate: float = 0.0
    keyword_hits: List[str] = field(default_factory=list)
    keyword_misses: List[str] = field(default_factory=list)
    expected_intent: str = ""
    actual_intent: str = ""
    intent_correct: bool = False
    expected_target: Optional[str] = None
    actual_target: Optional[str] = None
    target_correct: bool = False
    expected_waypoint: Optional[str] = None
    actual_waypoint: Optional[str] = None
    waypoint_correct: bool = False
    confidence: float = 0.0
    latency_ms: float = 0.0
    is_hallucination: bool = False   # empty audio but non-empty transcript


# ---------------------------------------------------------------------------
# Evaluation Runner
# ---------------------------------------------------------------------------
def run_evaluation(
    test_cases: List[Dict],
    model_size: str = "base",
    wav_dir: str = ".",
    verbose: bool = False,
) -> List[EvalSample]:
    print(f"\n{'='*65}")
    print(f"  Curbo Transcription Evaluator  |  Whisper: {model_size}")
    print(f"{'='*65}")

    print(f"\n[+] Loading Whisper '{model_size}' model...")
    preprocessor = AudioPreprocessor()
    stt = STTEngine(model_size=model_size)
    parser = IntentParser()
    print("[+] Model ready.\n")

    samples: List[EvalSample] = []

    for i, tc in enumerate(test_cases, start=1):
        wav_path = os.path.join(wav_dir, tc["wav"])
        sample = EvalSample(
            wav=tc["wav"],
            notes=tc.get("notes", ""),
            found=os.path.exists(wav_path),
            reference=tc["reference"],
            expected_intent=tc["intent"],
            expected_target=tc["target"],
            expected_waypoint=tc.get("waypoint_id"),
        )

        print(f"[{i:02d}/{len(test_cases)}] {tc['wav']}")

        if not sample.found:
            print(f"       WARNING: File not found - skipping.\n")
            samples.append(sample)
            continue

        # --- Transcribe ---
        audio = preprocessor.load_and_prepare(wav_path)
        t0 = time.perf_counter()
        hypothesis = stt.transcribe(audio)
        sample.latency_ms = round((time.perf_counter() - t0) * 1000, 1)
        sample.hypothesis = hypothesis

        # --- Hallucination check (very short / silent audio) ---
        audio_duration_sec = len(audio) / 16000
        if audio_duration_sec < 0.5 and hypothesis.strip():
            sample.is_hallucination = True

        # --- Text metrics ---
        sample.wer = compute_wer(sample.reference, hypothesis)
        sample.cer = compute_cer(sample.reference, hypothesis)
        kw_rate, kw_hits, kw_misses = keyword_hit_rate(
            hypothesis, tc.get("domain_keywords", [])
        )
        sample.keyword_hit_rate = kw_rate
        sample.keyword_hits = kw_hits
        sample.keyword_misses = kw_misses

        # --- Intent parsing ---
        intent_res: CurboIntentResult = parser.parse(hypothesis)
        sample.actual_intent = intent_res.intent_type
        sample.actual_target = intent_res.target
        sample.actual_waypoint = intent_res.waypoint_id
        sample.confidence = intent_res.confidence

        sample.intent_correct = (sample.actual_intent == sample.expected_intent)
        sample.target_correct = (sample.actual_target == sample.expected_target)
        sample.waypoint_correct = (sample.actual_waypoint == sample.expected_waypoint)

        # --- Per-sample summary ---
        ok_i = "[OK]" if sample.intent_correct else "[FAIL]"
        ok_d = "[OK]" if sample.target_correct  else "[FAIL]"
        ok_w = "[OK]" if sample.waypoint_correct else "[FAIL]"
        print(f"       Transcript : \"{hypothesis}\"")
        print(f"       WER={sample.wer:.3f}  CER={sample.cer:.3f}  "
              f"KW={sample.keyword_hit_rate:.0%}  Latency={sample.latency_ms}ms")
        print(f"       Intent {ok_i} ({sample.actual_intent})  "
              f"Target {ok_d} ({sample.actual_target})  "
              f"WP {ok_w}  Conf={sample.confidence:.2f}")
        if verbose:
            print(f"       Reference  : \"{sample.reference}\"")
            print(f"       KW hits    : {sample.keyword_hits}")
            print(f"       KW misses  : {sample.keyword_misses}")
            print(f"       Notes      : {sample.notes}")
        print()

        samples.append(sample)

    return samples


# ---------------------------------------------------------------------------
# Aggregate Report
# ---------------------------------------------------------------------------
def build_report(samples: List[EvalSample]) -> str:
    found = [s for s in samples if s.found]
    missing = [s for s in samples if not s.found]
    n = len(found)

    if n == 0:
        return "No WAV files were found. Nothing to evaluate."

    avg_wer        = np.mean([s.wer for s in found])
    avg_cer        = np.mean([s.cer for s in found])
    avg_kw         = np.mean([s.keyword_hit_rate for s in found])
    avg_lat        = np.mean([s.latency_ms for s in found])
    intent_acc     = np.mean([s.intent_correct for s in found])
    dest_acc       = np.mean([s.target_correct for s in found])
    wp_acc         = np.mean([s.waypoint_correct for s in found])
    avg_conf       = np.mean([s.confidence for s in found])
    hallucinations = sum(s.is_hallucination for s in found)

    # Per-intent breakdown
    navigate_samples = [s for s in found if s.expected_intent == "NAVIGATE"]
    nav_intent_acc = np.mean([s.intent_correct for s in navigate_samples]) if navigate_samples else 0.0
    nav_dest_acc   = np.mean([s.target_correct for s in navigate_samples]) if navigate_samples else 0.0

    lines = [
        "",
        "=" * 65,
        "  CURBO TRANSCRIPTION EVALUATION REPORT",
        "=" * 65,
        f"  Samples evaluated : {n}  |  Missing files: {len(missing)}",
        "-" * 65,
        "",
        "  [1] TRANSCRIPTION ACCURACY",
        f"      Average WER          : {avg_wer:.3f}  ({avg_wer*100:.1f}% word error)",
        f"      Average CER          : {avg_cer:.3f}  ({avg_cer*100:.1f}% char error)",
        f"      Domain KW Hit Rate   : {avg_kw:.1%}",
        f"      Avg Latency          : {avg_lat:.0f} ms",
        f"      Hallucinations       : {hallucinations} / {n}",
        "",
        "  [2] INTENT PARSING ACCURACY",
        f"      Overall Intent Acc   : {intent_acc:.1%}  ({sum(s.intent_correct for s in found)}/{n})",
        f"      NAVIGATE Intent Acc  : {nav_intent_acc:.1%}  ({sum(s.intent_correct for s in navigate_samples)}/{len(navigate_samples)})",
        f"      Destination Acc      : {dest_acc:.1%}  ({sum(s.target_correct for s in found)}/{n})",
        f"      Nav Dest Acc         : {nav_dest_acc:.1%}  ({sum(s.target_correct for s in navigate_samples)}/{len(navigate_samples)})",
        f"      Waypoint ID Acc      : {wp_acc:.1%}  ({sum(s.waypoint_correct for s in found)}/{n})",
        f"      Avg Confidence Score : {avg_conf:.2f}",
        "",
        "  [3] PER-SAMPLE BREAKDOWN",
        f"  {'File':<45} {'WER':>6} {'Intent':>7} {'Dest':>7} {'Lat(ms)':>8}",
        "  " + "-" * 63,
    ]

    for s in found:
        ok_i = "OK" if s.intent_correct else "FAIL"
        ok_d = "OK" if s.target_correct  else "FAIL"
        lines.append(
            f"  {s.wav:<45} {s.wer:>6.3f} {ok_i:>7} {ok_d:>7} {s.latency_ms:>8.0f}"
        )

    if missing:
        lines += ["", "  [4] MISSING FILES (skipped)"]
        for s in missing:
            lines.append(f"      MISSING: {s.wav}")

    lines += [
        "",
        "  [5] FAILURE ANALYSIS",
    ]
    failures = [s for s in found if not s.intent_correct or not s.target_correct]
    if not failures:
        lines.append("      All samples passed intent + destination checks!")
    else:
        for s in failures:
            lines.append(f"\n      FAIL: {s.wav}")
            lines.append(f"         Transcript : \"{s.hypothesis}\"")
            lines.append(f"         Reference  : \"{s.reference}\"")
            if not s.intent_correct:
                lines.append(f"         Intent     : expected={s.expected_intent}  got={s.actual_intent}")
            if not s.target_correct:
                lines.append(f"         Target     : expected={s.expected_target}  got={s.actual_target}")
            if s.keyword_misses:
                lines.append(f"         KW missed  : {s.keyword_misses}")

    lines += ["", "=" * 65, ""]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# JSON export
# ---------------------------------------------------------------------------
def to_json(samples: List[EvalSample]) -> str:
    out = []
    for s in samples:
        out.append({
            "wav": s.wav,
            "found": s.found,
            "reference": s.reference,
            "hypothesis": s.hypothesis,
            "wer": s.wer,
            "cer": s.cer,
            "keyword_hit_rate": s.keyword_hit_rate,
            "keyword_hits": s.keyword_hits,
            "keyword_misses": s.keyword_misses,
            "expected_intent": s.expected_intent,
            "actual_intent": s.actual_intent,
            "intent_correct": s.intent_correct,
            "expected_target": s.expected_target,
            "actual_target": s.actual_target,
            "target_correct": s.target_correct,
            "expected_waypoint": s.expected_waypoint,
            "actual_waypoint": s.actual_waypoint,
            "waypoint_correct": s.waypoint_correct,
            "confidence": s.confidence,
            "latency_ms": s.latency_ms,
            "is_hallucination": s.is_hallucination,
            "notes": s.notes,
        })
    return json.dumps(out, indent=2)


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------
def main():
    arg_parser = argparse.ArgumentParser(
        description="Curbo STT + Intent Evaluation Harness"
    )
    arg_parser.add_argument(
        "--model", default="base",
        choices=["tiny", "tiny.en", "base", "base.en", "small", "small.en", "medium"],
        help="Whisper model size to evaluate (default: base)"
    )
    default_wav_dir = "audio_files" if os.path.exists("audio_files") else "."
    arg_parser.add_argument(
        "--wav-dir", default=default_wav_dir,
        help=f"Directory containing WAV test files (default: {default_wav_dir})"
    )
    arg_parser.add_argument(
        "--report", action="store_true",
        help="Save evaluation report to eval_report.txt"
    )
    arg_parser.add_argument(
        "--json", action="store_true",
        help="Save per-sample results to eval_results.json"
    )
    arg_parser.add_argument(
        "--verbose", action="store_true",
        help="Print full per-sample detail including reference and keyword breakdown"
    )
    args = arg_parser.parse_args()

    samples = run_evaluation(
        TEST_CASES,
        model_size=args.model,
        wav_dir=args.wav_dir,
        verbose=args.verbose,
    )

    report = build_report(samples)
    print(report)

    if args.report:
        with open("eval_report.txt", "w", encoding="utf-8") as f:
            f.write(report)
        print("[+] Report saved -> eval_report.txt")

    if args.json:
        with open("eval_results.json", "w", encoding="utf-8") as f:
            f.write(to_json(samples))
        print("[+] JSON saved   -> eval_results.json")


if __name__ == "__main__":
    main()
