import whisper
import numpy as np
import os

# Load model once (English-optimized 'base.en' or multilingual 'base')
model = whisper.load_model("base")

ROBOT_NAV_PROMPT = (
    "Campus guide robot directions: HR office, H-R office, H.R. office, HOD office, H-O-D office, H.O.D. cabin, "
    "Head of Department, reception counter, reception desk, main entrance, exam cell, controller of examinations, "
    "canteen, cafeteria, food court, central library, CSE department, ECE, EEE, Mechanical, Civil, AI ML, "
    "Principal office, Director cabin, Dean office, Accounts section, fee counter, placement cell, auditorium, "
    "seminar hall, xerox shop, medical dispensary, restrooms, sports complex, hostels, main gate, stop, slow down."
)

def transcribe_audio(audio_path: str, model, prompt: str = ROBOT_NAV_PROMPT) -> str:
    """
    Transcribes an audio file with preprocessing and optimal settings for noisy/accented input:
    - Audio normalization (scaling quiet speech)
    - Forced English language (avoids wrong language detection)
    - Prompt conditioning (ensures acronym and domain keyword accuracy)
    - Zero temperature & no condition_on_previous_text (prevents hallucinations)
    """
    if not os.path.exists(audio_path):
        return f"[Error: File {audio_path} not found]"

    # 1. Load and peak-normalize audio to boost quiet recordings
    audio = whisper.load_audio(audio_path)
    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = (audio / peak) * 0.95

    # 2. Transcribe with robust decoding options
    result = model.transcribe(
        audio,
        language="en",
        temperature=0.0,
        initial_prompt=prompt,
        condition_on_previous_text=False,
        fp16=False
    )
    return result["text"].strip()

if __name__ == "__main__":
    audio_files = [
        "tests_jfk.wav",
        "wher_is_hr_office.wav",
        "where_is_hr_office.wav",
        "Where_is_the_exam_cell.wav",
        "take_me_to_reception.wav",
        "Can _you_show_me_the_cafeteria.wav",
        "Can_you_guide_me_to_reception.wav",
        "I_need_to_go_to_the_HOD_office.wav",
        "Where is_the_canteen.wav",
        "where_is_my_office.wav"
    ]

    print("=== Curbo Guide Robot Audio Transcription ===")
    for f in audio_files:
        if os.path.exists(f):
            text = transcribe_audio(f, model)
            print(f"{f:35s} -> {text}")