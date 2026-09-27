"""
Curbo Guide Robot - Live Interactive Voice Navigation Console
--------------------------------------------------------------
Launch this script to run Curbo's live microphone listener, speech recognizer,
intent extraction, waypoint dispatcher, and spoken voice response.

Hardware Target: Raspberry Pi 5 / Desktop PC
Execution:
    python curbo_live.py
"""

import sys
import os
import argparse
from curbo_speech import CurboSpeechController, LiveMicRecorder


def main():
    parser = argparse.ArgumentParser(description="Curbo Guide Robot - Live Voice Interface")
    parser.add_argument("--model", type=str, default="base", help="Whisper model size ('tiny', 'base', 'small')")
    parser.add_argument("--mode", type=str, default="vad", choices=["vad", "fixed"], help="Recording mode ('vad' or 'fixed')")
    parser.add_argument("--duration", type=float, default=4.0, help="Fixed recording duration in seconds (if mode=fixed)")
    parser.add_argument("--device", type=int, default=None, help="Input audio device index (optional)")
    parser.add_argument("--no-tts", action="store_true", help="Disable spoken audio response")
    args = parser.parse_args()

    print("\n" + "="*70)
    print("      [CURBO CAMPUS GUIDE ROBOT - LIVE SPEECH SUBSYSTEM]")
    print("="*70)

    # 1. Hardware Microphone Check
    devices = LiveMicRecorder.list_input_devices()
    print(f"\n[Hardware Probe] Found {len(devices)} input audio device(s):")
    for d in devices[:6]:
        marker = " (SELECTED)" if args.device == d['index'] else ""
        print(f"  * [Device #{d['index']}] {d['name']} ({d['channels']} ch, {int(d['default_sr'])}Hz){marker}")

    # 2. Initialize Controller
    print(f"\n[System] Loading Curbo Controller with Whisper '{args.model}' and TTS Engine...")
    controller = CurboSpeechController(model_size=args.model)
    enable_tts = not args.no_tts

    # 3. Startup Greeting
    welcome_msg = "Hello! I am Curbo, your campus guide. Where would you like to go?"
    print(f"\n[Curbo]: \"{welcome_msg}\"")
    if enable_tts:
        controller.tts.speak(welcome_msg)

    print("\n" + "-"*70)
    print("Ready for user commands!")
    print("Press [ENTER] to start speaking a destination (e.g., 'Where is the Exam Cell?')")
    print("Type 'q' or 'exit' and press [ENTER] to exit.")
    print("-"*70)

    while True:
        try:
            user_input = input("\n>> Press [ENTER] to speak (or 'q' to quit): ").strip().lower()
            if user_input in ['q', 'quit', 'exit']:
                farewell = "Shutting down speech navigation. Goodbye!"
                print(f"[Curbo]: \"{farewell}\"")
                if enable_tts:
                    controller.tts.speak(farewell)
                break

            result = controller.listen_and_guide(
                mode=args.mode,
                duration_sec=args.duration,
                device_index=args.device,
                speak=enable_tts
            )

            # Robot Action Dispatch Hook
            if result.intent_type == "NAVIGATE" and result.waypoint_id:
                print(f"[ROBOT ACTION] Dispatched Nav Goal -> {result.waypoint_id} ({result.target})")
            elif result.intent_type == "MOTION_CONTROL":
                print(f"[ROBOT ACTION] Dispatched Motion Command -> {result.target}")
            elif result.intent_type == "CONVERSATION":
                print(f"[ROBOT ACTION] Fallback Conversation Prompt")

        except KeyboardInterrupt:
            print("\nSession stopped by user.")
            break
        except Exception as err:
            print(f"[Error in Speech Loop]: {err}")


if __name__ == "__main__":
    main()
