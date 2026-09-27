"""
Curbo Guide Robot - Core Speech & Intent Processing Module
----------------------------------------------------------
Provides:
- AudioPreprocessor: Peak gain normalization & audio loading
- TTSEngine: Offline text-to-speech via pyttsx3
- LiveMicRecorder: Microphone stream recording with energy-based VAD
- STTEngine: Whisper STT with domain prompt conditioning
- IntentParser: RapidFuzz intent & destination extraction
- CurboSpeechController: Unified pipeline controller
"""

import time
import numpy as np
import whisper
import sounddevice as sd
import pyttsx3
from rapidfuzz import fuzz
from dataclasses import dataclass
from typing import Optional, Dict, Any, List


# ---------------------------------------------------------------------------
# 1. Domain Knowledge Base & Waypoint Map
# ---------------------------------------------------------------------------
DESTINATIONS = {
    # 1. Administration & Governance
    "PRINCIPAL_OFFICE": {
        "canonical_name": "Principal's Office / Director Cabin",
        "aliases": ["principal office", "principal", "director office", "director cabin", "head of institution", "leadership office"],
        "waypoint_id": "WP_ADMIN_PRINCIPAL_01",
        "confirmation_msg": "Leading you to the Principal's Office. Please follow me."
    },
    "DEAN_ACADEMICS": {
        "canonical_name": "Dean Academics Office",
        "aliases": ["dean office", "dean academics", "academic dean", "dean student affairs", "dean"],
        "waypoint_id": "WP_ADMIN_DEAN_02",
        "confirmation_msg": "Guiding you to the Dean of Academics Office."
    },
    "ACCOUNTS_SECTION": {
        "canonical_name": "Accounts & Fee Counter",
        "aliases": ["accounts section", "accounts office", "fee counter", "fee payment", "challan counter", "finance department", "tuition fee desk", "cashier"],
        "waypoint_id": "WP_ADMIN_ACCOUNTS_03",
        "confirmation_msg": "Taking you to the Accounts Section and Fee Counter."
    },
    "EXAM_CELL": {
        "canonical_name": "Exam Cell / Controller of Examinations",
        "aliases": ["exam cell", "examination cell", "exam branch", "exam department", "controller of examinations", "coe", "hall ticket counter", "exam hall", "marksheet desk"],
        "waypoint_id": "WP_ADMIN_EXAM_04",
        "confirmation_msg": "Sure! Taking you to the Exam Cell. Follow me."
    },
    "HR_OFFICE": {
        "canonical_name": "HR & Administrative Block",
        "aliases": ["hr office", "human resources", "hr department", "admin office", "administration block", "registrar office", "hitchhane office", "hitan office", "hitan", "h r office", "h.r. office"],
        "waypoint_id": "WP_ADMIN_HR_05",
        "confirmation_msg": "Understood. Guiding you to the HR & Administration Office."
    },
    "RECEPTION": {
        "canonical_name": "Reception / Front Desk",
        "aliases": ["reception", "front desk", "main entrance", "inquiry desk", "information desk", "help desk", "visitor lobby", "section", "the section", "re-section", "reception counter"],
        "waypoint_id": "WP_ADMIN_RECEPTION_06",
        "confirmation_msg": "Leading you to the Reception now."
    },

    # 2. Academic Departments
    "CSE_DEPARTMENT": {
        "canonical_name": "Computer Science & Engineering (CSE)",
        "aliases": ["cse department", "computer science", "cse block", "it department", "information technology", "cse hod", "cse faculty"],
        "waypoint_id": "WP_DEPT_CSE_01",
        "confirmation_msg": "Alright! Guiding you to the Computer Science & Engineering Department."
    },
    "ECE_DEPARTMENT": {
        "canonical_name": "Electronics & Communication (ECE)",
        "aliases": ["ece department", "electronics department", "ece block", "communication department", "ece hod", "ece faculty"],
        "waypoint_id": "WP_DEPT_ECE_02",
        "confirmation_msg": "Heading towards the Electronics and Communication Department."
    },
    "EEE_DEPARTMENT": {
        "canonical_name": "Electrical & Electronics (EEE)",
        "aliases": ["eee department", "electrical department", "eee block", "electrical engineering", "eee hod"],
        "waypoint_id": "WP_DEPT_EEE_03",
        "confirmation_msg": "Leading you to the Electrical & Electronics Department."
    },
    "MECH_DEPARTMENT": {
        "canonical_name": "Mechanical Engineering",
        "aliases": ["mechanical department", "mech department", "mechanical block", "mech engineering", "mech hod"],
        "waypoint_id": "WP_DEPT_MECH_04",
        "confirmation_msg": "Taking you to the Mechanical Engineering Department."
    },
    "CIVIL_DEPARTMENT": {
        "canonical_name": "Civil Engineering",
        "aliases": ["civil department", "civil engineering", "civil block", "civil hod"],
        "waypoint_id": "WP_DEPT_CIVIL_05",
        "confirmation_msg": "Guiding you to the Civil Engineering Department."
    },
    "AIML_DEPARTMENT": {
        "canonical_name": "AI & Data Science (AIML/AIDS)",
        "aliases": ["ai department", "aiml department", "artificial intelligence", "data science department", "aids department", "aiml block"],
        "waypoint_id": "WP_DEPT_AIML_06",
        "confirmation_msg": "Leading you to the AI & Machine Learning Department."
    },
    "HOD_OFFICE": {
        "canonical_name": "HOD Cabin / Department Head",
        "aliases": ["hod office", "head of department", "hod cabin", "hod room", "hod", "h o d", "h.o.d", "h-o-d", "h.o.d."],
        "waypoint_id": "WP_DEPT_HOD_07",
        "confirmation_msg": "Taking you to the HOD Office."
    },
    "MY_OFFICE": {
        "canonical_name": "Faculty / Staff Room",
        "aliases": ["my office", "faculty room", "staff cabin", "teacher office", "prof office", "staff room", "faculty cabins"],
        "waypoint_id": "WP_DEPT_FACULTY_08",
        "confirmation_msg": "Guiding you to the Faculty and Staff Office."
    },

    # 3. Laboratories & Workshop
    "CENTRAL_COMPUTING_FACILITY": {
        "canonical_name": "Central Computing Facility (CCF)",
        "aliases": ["central computer facility", "ccf", "computer center", "programming lab", "central lab", "software lab", "computer lab 1"],
        "waypoint_id": "WP_LAB_CCF_01",
        "confirmation_msg": "Taking you to the Central Computing Facility."
    },
    "IOT_ROBOTICS_LAB": {
        "canonical_name": "IoT & Robotics Lab",
        "aliases": ["iot lab", "robotics lab", "embedded systems lab", "arduino lab", "microcontroller lab", "automation lab"],
        "waypoint_id": "WP_LAB_ROBOTICS_02",
        "confirmation_msg": "Heading towards the IoT and Robotics Laboratory."
    },
    "VLSI_HARDWARE_LAB": {
        "canonical_name": "VLSI & Digital Electronics Lab",
        "aliases": ["vlsi lab", "electronics lab", "digital electronics lab", "dsp lab", "hardware lab", "circuit lab"],
        "waypoint_id": "WP_LAB_VLSI_03",
        "confirmation_msg": "Guiding you to the VLSI and Hardware Lab."
    },
    "MECHANICAL_WORKSHOP": {
        "canonical_name": "Mechanical Workshop & CAD Lab",
        "aliases": ["mechanical workshop", "workshop", "cad lab", "cam lab", "lathe shop", "welding shop", "3d printing lab", "manufacturing lab"],
        "waypoint_id": "WP_LAB_WORKSHOP_04",
        "confirmation_msg": "Leading you to the Mechanical Engineering Workshop."
    },
    "PHYSICS_CHEMISTRY_LAB": {
        "canonical_name": "Physics & Chemistry Labs",
        "aliases": ["physics lab", "chemistry lab", "basic science lab", "first year lab"],
        "waypoint_id": "WP_LAB_SCI_05",
        "confirmation_msg": "Taking you to the Science and Basic Engineering Laboratories."
    },

    # 4. Student Support & Facilities
    "LIBRARY": {
        "canonical_name": "Central Library & Digital Reading Room",
        "aliases": ["library", "central library", "reading room", "digital library", "book bank", "reference section", "study hall"],
        "waypoint_id": "WP_FACILITY_LIB_01",
        "confirmation_msg": "Understood. Leading you to the Central Library."
    },
    "PLACEMENT_CELL": {
        "canonical_name": "Training & Placement (T&P) Cell",
        "aliases": ["placement cell", "training and placement", "tpo", "tpo office", "campus interview room", "placement officer", "internship desk"],
        "waypoint_id": "WP_FACILITY_TPO_02",
        "confirmation_msg": "Taking you to the Training and Placement Cell."
    },
    "AUDITORIUM": {
        "canonical_name": "Main Auditorium",
        "aliases": ["auditorium", "main auditorium", "cultural hall", "audi", "convention center", "amphitheater"],
        "waypoint_id": "WP_FACILITY_AUDI_03",
        "confirmation_msg": "Sure! Guiding you to the Main Auditorium."
    },
    "SEMINAR_HALL": {
        "canonical_name": "Seminar Hall / Conference Room",
        "aliases": ["seminar hall", "seminar hall a", "seminar hall b", "conference room", "presentation hall", "board room"],
        "waypoint_id": "WP_FACILITY_SEMINAR_04",
        "confirmation_msg": "Leading you to the Seminar Hall."
    },
    "STATIONERY_XEROX": {
        "canonical_name": "Stationery & Xerox / Photocopy Shop",
        "aliases": ["xerox shop", "photocopy center", "stationery", "printout shop", "xerox", "printing counter", "spiral binding"],
        "waypoint_id": "WP_FACILITY_XEROX_05",
        "confirmation_msg": "Taking you to the Stationery and Photocopy Center."
    },
    "INFIRMARY_MEDICAL": {
        "canonical_name": "First Aid & Medical Dispensary",
        "aliases": ["medical room", "dispensary", "first aid", "health center", "infirmary", "doctor room", "emergency care"],
        "waypoint_id": "WP_FACILITY_MED_06",
        "confirmation_msg": "Guiding you to the Medical and First Aid Room."
    },
    "RESTROOMS": {
        "canonical_name": "Restrooms / Washrooms",
        "aliases": ["restroom", "restrooms", "washroom", "washrooms", "toilet", "toilets", "ladies washroom", "gents washroom"],
        "waypoint_id": "WP_FACILITY_WASHROOM_07",
        "confirmation_msg": "Leading you to the nearest Restrooms."
    },

    # 5. Amenities & Campus Living
    "CAFETERIA": {
        "canonical_name": "Cafeteria / Canteen",
        "aliases": ["cafeteria", "canteen", "food court", "cafe", "mess", "refreshments", "snacks", "nescafe counter", "antenna", "the antenna"],
        "waypoint_id": "WP_AMENITY_CANTEEN_01",
        "confirmation_msg": "Alright! Let's head to the Cafeteria."
    },
    "SPORTS_COMPLEX": {
        "canonical_name": "Sports Complex & Gymnasium",
        "aliases": ["sports room", "gym", "gymnasium", "sports complex", "indoor stadium", "badminton court", "sports ground"],
        "waypoint_id": "WP_AMENITY_SPORTS_02",
        "confirmation_msg": "Guiding you to the Sports Complex and Gym."
    },
    "HOSTELS": {
        "canonical_name": "Campus Hostels",
        "aliases": ["hostel", "hostels", "boys hostel", "girls hostel", "warden office", "hostel mess"],
        "waypoint_id": "WP_AMENITY_HOSTEL_03",
        "confirmation_msg": "Taking you towards the Campus Hostels."
    },
    "SECURITY_MAIN_GATE": {
        "canonical_name": "Main Gate & Security Desk",
        "aliases": ["main gate", "security cabin", "security gate", "entrance gate", "visitor desk", "parking", "parking lot"],
        "waypoint_id": "WP_AMENITY_SECURITY_04",
        "confirmation_msg": "Leading you to the Main Gate and Security Desk."
    }
}

MOTION_COMMANDS = {
    "STOP": ["stop", "halt", "freeze", "stop here", "wait"],
    "SLOW_DOWN": ["slow down", "slower", "too fast", "walk slower", "wait for me"],
    "SPEED_UP": ["speed up", "faster", "go faster", "hurry"],
    "RESUME": ["continue", "keep going", "resume", "let's go"],
    "CANCEL": ["cancel", "nevermind", "abort", "go back"]
}


# ---------------------------------------------------------------------------
# 2. Audio Preprocessing
# ---------------------------------------------------------------------------
class AudioPreprocessor:
    """Preprocesses microphone / recorded audio to optimize for Whisper."""

    @staticmethod
    def normalize_waveform(audio: np.ndarray, target_peak: float = 0.95) -> np.ndarray:
        if audio is None or len(audio) == 0:
            return np.zeros(0, dtype=np.float32)
        peak = np.max(np.abs(audio))
        if peak > 0:
            return (audio / peak) * target_peak
        return audio

    @staticmethod
    def load_and_prepare(audio_path_or_array, target_sample_rate: int = 16000) -> np.ndarray:
        if isinstance(audio_path_or_array, str):
            audio = whisper.load_audio(audio_path_or_array)
        else:
            audio = np.array(audio_path_or_array, dtype=np.float32)
            if audio.ndim > 1:
                audio = audio.mean(axis=1)
        return AudioPreprocessor.normalize_waveform(audio)


# ---------------------------------------------------------------------------
# 3. Offline Text-to-Speech Engine
# ---------------------------------------------------------------------------
class TTSEngine:
    """
    Offline Text-to-Speech Engine using pyttsx3.
    Compatible with Windows SAPI5 and Raspberry Pi 5 (eSpeak-ng).
    """
    def __init__(self, rate: int = 165, volume: float = 1.0):
        self.rate = rate
        self.volume = volume
        self._engine = None
        self._init_engine()

    def _init_engine(self):
        try:
            self._engine = pyttsx3.init()
            self._engine.setProperty('rate', self.rate)
            self._engine.setProperty('volume', self.volume)
        except Exception as e:
            print(f"[TTSEngine Warning] Could not initialize sound driver: {e}")
            self._engine = None

    def speak(self, text: str, blocking: bool = True):
        print(f"\n[Curbo Speaks]: \"{text}\"")
        if not self._engine:
            return
        try:
            self._engine.say(text)
            if blocking:
                self._engine.runAndWait()
        except Exception as e:
            print(f"[TTSEngine Error] Speech output failed: {e}")
            self._init_engine()


# ---------------------------------------------------------------------------
# 4. Live Microphone Recorder with VAD
# ---------------------------------------------------------------------------
class LiveMicRecorder:
    """Captures live audio with Voice Activity Detection (VAD)."""
    def __init__(self, sample_rate: int = 16000):
        self.sample_rate = sample_rate

    @staticmethod
    def list_input_devices() -> List[Dict[str, Any]]:
        try:
            devices = sd.query_devices()
            input_devs = []
            for i, d in enumerate(devices):
                if d['max_input_channels'] > 0:
                    input_devs.append({
                        "index": i,
                        "name": d['name'],
                        "channels": d['max_input_channels'],
                        "default_sr": d['default_samplerate']
                    })
            return input_devs
        except Exception as e:
            print(f"[LiveMicRecorder Warning] Unable to query audio devices: {e}")
            return []

    def record_fixed(self, duration_sec: float = 4.0, device_index: Optional[int] = None) -> np.ndarray:
        print(f"[Curbo Mic] Recording for {duration_sec}s... (Speak now)")
        audio_data = sd.rec(
            int(duration_sec * self.sample_rate),
            samplerate=self.sample_rate,
            channels=1,
            dtype='float32',
            device=device_index
        )
        sd.wait()
        print("[Curbo Mic] Recording finished.")
        return audio_data.flatten()

    def record_with_vad(
        self,
        energy_threshold: float = 0.015,
        silence_timeout_sec: float = 1.3,
        max_duration_sec: float = 8.0,
        chunk_duration_sec: float = 0.1,
        device_index: Optional[int] = None
    ) -> np.ndarray:
        chunk_size = int(self.sample_rate * chunk_duration_sec)
        recorded_frames = []
        is_speech_started = False
        silence_start_time = None
        start_time = time.time()

        print("[Curbo Mic] Listening... (Start speaking your destination)")
        try:
            with sd.InputStream(
                samplerate=self.sample_rate,
                channels=1,
                dtype='float32',
                blocksize=chunk_size,
                device=device_index
            ) as stream:
                while True:
                    chunk, overflowed = stream.read(chunk_size)
                    audio_chunk = chunk.flatten()
                    recorded_frames.append(audio_chunk)
                    rms_energy = np.sqrt(np.mean(np.square(audio_chunk)))
                    current_time = time.time()
                    elapsed_total = current_time - start_time

                    if not is_speech_started:
                        if rms_energy > energy_threshold:
                            is_speech_started = True
                            print("[Curbo Mic] Speech detected! Recording...")
                        elif elapsed_total > max_duration_sec:
                            print("[Curbo Mic] No speech detected (Timeout).")
                            return np.zeros(0, dtype=np.float32)
                    else:
                        if rms_energy < energy_threshold:
                            if silence_start_time is None:
                                silence_start_time = current_time
                            elif (current_time - silence_start_time) >= silence_timeout_sec:
                                print("[Curbo Mic] Silence detected. Done listening.")
                                break
                        else:
                            silence_start_time = None

                        if elapsed_total > max_duration_sec:
                            print("[Curbo Mic] Max recording duration reached.")
                            break
        except Exception as e:
            print(f"[LiveMicRecorder Error] Audio capture failed: {e}")
            return np.zeros(0, dtype=np.float32)

        if recorded_frames:
            return np.concatenate(recorded_frames)
        return np.zeros(0, dtype=np.float32)


# ---------------------------------------------------------------------------
# 5. Speech-to-Text Engine
# ---------------------------------------------------------------------------
class STTEngine:
    """Speech Recognition Engine with domain priming and hallucination suppression."""
    def __init__(self, model_size: str = "base"):
        print(f"[STTEngine] Loading Whisper '{model_size}' model...")
        self.model = whisper.load_model(model_size)
        self.domain_prompt = (
            "Campus guide robot directions: HR office, H-R office, H.R. office, HOD office, H-O-D office, H.O.D. cabin, "
            "Head of Department, reception counter, reception desk, main entrance, exam cell, controller of examinations, "
            "canteen, cafeteria, food court, central library, CSE department, ECE, EEE, Mechanical, Civil, AI ML, "
            "Principal office, Director cabin, Dean office, Accounts section, fee counter, placement cell, auditorium, "
            "seminar hall, xerox shop, medical dispensary, restrooms, sports complex, hostels, main gate, stop, slow down."
        )

    def transcribe(self, audio: np.ndarray) -> str:
        if audio is None or len(audio) == 0:
            return ""
        result = self.model.transcribe(
            audio,
            language="en",
            temperature=0.0,
            initial_prompt=self.domain_prompt,
            condition_on_previous_text=False,
            fp16=False
        )
        return result["text"].strip()


COMMON_STOP_WORDS = {
    "and", "so", "my", "your", "can", "do", "for", "you", "not", "what", "is", "the",
    "in", "to", "of", "a", "an", "on", "at", "by", "with", "from", "as", "it", "this", "that"
}


# ---------------------------------------------------------------------------
# 6. Intent Parser & Data Structures
# ---------------------------------------------------------------------------
@dataclass
class CurboIntentResult:
    intent_type: str
    target: Optional[str]
    confidence: float
    raw_transcript: str
    robot_response: str
    waypoint_id: Optional[str] = None


NAV_TRIGGERS = {
    "where", "go", "take", "show", "find", "lead", "navigate", "location", "path",
    "direction", "reach", "way", "heading", "guide", "office", "dept", "department",
    "lab", "cell", "block", "room", "hall", "counter", "gate", "center", "centre"
}


class IntentParser:
    """Robust fuzzy intent & destination extractor."""
    @staticmethod
    def parse(transcript: str) -> CurboIntentResult:
        clean_text = transcript.lower().strip()
        # Remove common trailing punctuation
        clean_text = clean_text.rstrip('.!?')
        if not clean_text:
            return CurboIntentResult(
                intent_type="UNKNOWN",
                target=None,
                confidence=0.0,
                raw_transcript=transcript,
                robot_response="I didn't hear anything. How can I help you?"
            )

        # 1. Motion commands check (handles exact words, phrases, and fuzzy partial match)
        for cmd, triggers in MOTION_COMMANDS.items():
            for trig in triggers:
                if trig in clean_text or fuzz.partial_ratio(trig, clean_text) >= 90:
                    return CurboIntentResult(
                        intent_type="MOTION_CONTROL",
                        target=cmd,
                        confidence=0.95,
                        raw_transcript=transcript,
                        robot_response=f"Command acknowledged: {cmd.replace('_', ' ')}."
                    )

        # 2. Destination matching (exact alias match gets 100%, fallback to token set / weighted fuzzy)
        best_dest_key = None
        highest_score = 0.0
        is_exact_match = False

        text_words_content = [w for w in clean_text.replace('-', ' ').split() if len(w) > 1 and w not in COMMON_STOP_WORDS]

        for dest_key, dest_info in DESTINATIONS.items():
            for alias in dest_info["aliases"]:
                if alias in clean_text:
                    score = 100.0
                    is_exact_match = True
                else:
                    alias_words = [w for w in alias.replace('-', ' ').split() if len(w) > 1 and w not in COMMON_STOP_WORDS]

                    # Ensure at least one content word from alias matches a content word in clean_text
                    has_word_match = False
                    for aw in alias_words:
                        if any(aw == tw or (len(tw) >= 4 and tw in aw) or (len(aw) >= 4 and aw in tw) or fuzz.ratio(aw, tw) >= 80 for tw in text_words_content):
                            has_word_match = True
                            break

                    if not has_word_match:
                        score = 0.0
                    else:
                        ts_score = fuzz.token_set_ratio(alias, clean_text)
                        w_score = fuzz.WRatio(alias, clean_text)
                        p_score = fuzz.partial_ratio(alias, clean_text)

                        if len(alias) <= 3:
                            score = ts_score if (alias in clean_text.split()) else (p_score * 0.7)
                        else:
                            score = max(ts_score, w_score, p_score)

                if score > highest_score:
                    highest_score = score
                    best_dest_key = dest_key

        # Check for presence of navigation intent triggers in query
        has_nav_trigger = any(trig in clean_text for trig in NAV_TRIGGERS)

        # Accept match if exact alias match, or high confidence, or moderate score with clear nav trigger
        min_threshold = 75.0 if (has_nav_trigger or is_exact_match) else 88.0

        if best_dest_key and highest_score >= min_threshold:
            dest_data = DESTINATIONS[best_dest_key]
            return CurboIntentResult(
                intent_type="NAVIGATE",
                target=best_dest_key,
                confidence=round(min(1.0, highest_score / 100.0), 2),
                raw_transcript=transcript,
                robot_response=dest_data["confirmation_msg"],
                waypoint_id=dest_data["waypoint_id"]
            )

        return CurboIntentResult(
            intent_type="CONVERSATION",
            target=None,
            confidence=0.0,
            raw_transcript=transcript,
            robot_response="I heard your request, but I couldn't identify a valid campus destination. Where would you like to go?"
        )



# ---------------------------------------------------------------------------
# 7. Master Curbo Speech Controller
# ---------------------------------------------------------------------------
class CurboSpeechController:
    """Master controller connecting Mic, Preprocessor, Whisper, IntentParser, and TTS."""
    def __init__(self, model_size: str = "base"):
        self.preprocessor = AudioPreprocessor()
        self.stt = STTEngine(model_size=model_size)
        self.parser = IntentParser()
        self.tts = TTSEngine()
        self.mic = LiveMicRecorder()

    def process_audio_file(self, audio_path: str, speak: bool = False) -> CurboIntentResult:
        audio = self.preprocessor.load_and_prepare(audio_path)
        transcript = self.stt.transcribe(audio)
        intent_res = self.parser.parse(transcript)
        if speak and intent_res.robot_response:
            self.tts.speak(intent_res.robot_response)
        return intent_res

    def listen_and_guide(
        self,
        mode: str = "vad",
        duration_sec: float = 4.0,
        device_index: Optional[int] = None,
        speak: bool = True
    ) -> CurboIntentResult:
        if mode == "vad":
            raw_audio = self.mic.record_with_vad(device_index=device_index)
        else:
            raw_audio = self.mic.record_fixed(duration_sec=duration_sec, device_index=device_index)

        normalized_audio = self.preprocessor.normalize_waveform(raw_audio)
        transcript = self.stt.transcribe(normalized_audio)
        intent_res = self.parser.parse(transcript)
        print(f"\n[Transcript]  : \"{intent_res.raw_transcript}\"")
        print(f"[Intent]      : {intent_res.intent_type} -> {intent_res.target} ({intent_res.confidence})")
        print(f"[Waypoint ID] : {intent_res.waypoint_id or 'None'}")
        if speak and intent_res.robot_response:
            self.tts.speak(intent_res.robot_response)
        return intent_res
