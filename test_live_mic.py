"""
Quick Live Microphone & TTS Test for Curbo
-------------------------------------------
Run this script to test your real microphone right now!
It records 4 seconds of your voice, transcribes it with Whisper,
extracts the navigation waypoint, and speaks back through your speakers.
"""

import time
import wave
import sounddevice as sd
import numpy as np
from curbo_speech import CurboSpeechController

def main():
    print("\n" + "="*60)
    print("       [CURBO LIVE MICROPHONE & TTS QUICK TEST]")
    print("="*60)
    
    # 1. Initialize Controller
    print("\n[1/4] Initializing Whisper STT & Text-to-Speech Engine...")
    controller = CurboSpeechController(model_size="base")
    
    # 2. Countdown
    print("\n[2/4] Get ready to speak a destination (e.g., 'Take me to the Exam Cell')...")
    for i in [3, 2, 1]:
        print(f"       >> Recording starts in {i}... <<")
        time.sleep(1)
    
    # 3. Record Audio
    duration_sec = 4.0
    sample_rate = 16000
    print(f"\n[3/4] [*] RECORDING NOW ({duration_sec}s)... Speak clearly into your mic!")
    
    audio_data = sd.rec(int(duration_sec * sample_rate), samplerate=sample_rate, channels=1, dtype='float32')
    sd.wait()
    print("      [+] Recording finished!")
    
    # Save a copy using standard wave module
    audio_flat = audio_data.flatten()
    int_audio = (np.clip(audio_flat, -1.0, 1.0) * 32767).astype(np.int16)
    with wave.open("my_live_recording.wav", "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(int_audio.tobytes())
    print("      [+] Saved live audio copy to 'my_live_recording.wav'")
    
    # 4. Transcribe & Parse Intent
    print("\n[4/4] Processing speech through Whisper & RapidFuzz Intent Matcher...")
    normalized = controller.preprocessor.normalize_waveform(audio_flat)
    transcript = controller.stt.transcribe(normalized)
    intent_res = controller.parser.parse(transcript)
    
    print("\n" + "="*60)
    print(f"[Transcript]   : \"{intent_res.raw_transcript}\"")
    print(f"[Intent]       : {intent_res.intent_type} -> {intent_res.target} (Confidence: {intent_res.confidence})")
    print(f"[Waypoint ID]  : {intent_res.waypoint_id or 'None'}")
    print(f"[Curbo Reply]  : \"{intent_res.robot_response}\"")
    print("="*60)
    
    # 5. Speak out the response
    controller.tts.speak(intent_res.robot_response)
    print("\n[+] Live test complete!\n")

if __name__ == "__main__":
    main()
