# 🤖 CURBO: Autonomous Campus Guide & Navigation Kiosk Robot

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0%2B-green.svg)](https://flask.palletsprojects.com/)
[![Whisper](https://img.shields.io/badge/STT-OpenAI%20Whisper-orange.svg)](https://github.com/openai/whisper)
[![Fuzzy Matching](https://img.shields.io/badge/NLP-RapidFuzz-purple.svg)](https://github.com/maxbachmann/RapidFuzz)
[![ROS 2 Ready](https://img.shields.io/badge/Hardware-ROS%202%20%2F%20Nav2-red.svg)](https://docs.ros.org/)
[![Status](https://img.shields.io/badge/Intent%20Accuracy-100%25-brightgreen.svg)](#-evaluation--benchmarking)

> **Curbo** is an intelligent, voice-interactive, autonomous Campus Guide and Navigation Kiosk Robot designed for university campuses, administrative blocks, and institutional facilities. 
> 
> It seamlessly combines **hands-free speech-to-text (Whisper)**, **domain-primed fuzzy intent classification (RapidFuzz)**, **offline voice synthesis (pyttsx3)**, and an **interactive glassmorphic kiosk web console** with dynamic SVG venue mapping.

---

## 📋 Table of Contents
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Complete Software Details & Specifications](#-complete-software-details--specifications)
- [Complete Hardware Architecture & Specifications](#-complete-hardware-architecture--specifications)
- [Project Structure](#-project-structure)
- [Installation & Setup](#-installation--setup)
- [Usage Guide](#-usage-guide)
  - [1. Launching Web Kiosk Server](#1-launching-web-kiosk-server)
  - [2. Running Live Microphone Navigation](#2-running-live-microphone-navigation)
  - [3. Running Accuracy & Performance Benchmarks](#3-running-accuracy--performance-benchmarks)
- [REST API Reference](#-rest-api-reference)
- [Evaluation & Benchmarking](#-evaluation--benchmarking)
- [Campus Destination Knowledge Base](#-campus-destination-knowledge-base)
- [Future Enhancements & Roadmap](#-future-enhancements--roadmap)

---

## ✨ Key Features

- **🎙️ Offline Speech-to-Text (STT):** Powered by OpenAI Whisper (`base` model) with domain-prompt conditioning to accurately capture technical jargon, department acronyms (e.g., *HOD, CSE, VLSI, Exam Cell, Accounts*), and noisy inputs without hallucinations.
- **⚡ Voice Activity Detection (VAD) & Audio Normalization:** RMS energy thresholding and dynamic silence detection automatically start and stop mic recording. Includes peak-gain waveform normalization for quiet/distance microphones.
- **🧠 3-Tier Fuzzy Intent Engine:** 
  - **Tier 1 (Motion Commands):** Instantly handles emergency motion triggers (`STOP`, `SLOW DOWN`, `SPEED UP`, `RESUME`, `CANCEL`).
  - **Tier 2 (Destination Mapping):** Maps natural language queries to 25+ campus destinations, extracting canonical names and hardware `Waypoint IDs` with alias fallbacks.
  - **Tier 3 (Conversational Fallback):** Gracefully prompts users to rephrase unrecognized inputs.
- **🔊 Spoken Voice Feedback (TTS):** Dual text-to-speech feedback via `pyttsx3` (offline desktop/Pi engine compatible with SAPI5 and `eSpeak-ng`) and browser Web Speech API.
- **🗺️ Interactive Web Kiosk & Live Map:** Dynamic HTML5/JS web console featuring:
  - Touch-optimized card layout filtered by *Administration*, *Academic Departments*, and *Facilities & Amenities*.
  - Live SVG Campus Node Map with real-time animated robot position updates.
  - Search bar with instant query matching.
- **📊 Benchmark Evaluation Suite:** Built-in benchmarking script (`evaluate_transcription.py`) evaluating Word Error Rate (WER), Character Error Rate (CER), Keyword Hit Rate, Intent Accuracy, Waypoint Accuracy, and Latency against reference audio datasets.

---

## 🏗️ System Architecture

```
                 +-----------------------------------+
                 |           USER INPUT              |
                 |   (Microphone Array / Kiosk Touch) |
                 +-----------------+-----------------+
                                   |
                                   v
                 +-----------------------------------+
                 |        AUDIO PREPROCESSING        |
                 |  Gain Normalization & RMS VAD     |
                 +-----------------+-----------------+
                                   | (Audio Buffer / Text Query)
                                   v
                 +-----------------------------------+
                 |      OPENAI WHISPER STT ENGINE    |
                 | (Domain-Prompt conditioned text)  |
                 +-----------------+-----------------+
                                   |
                                   v
                 +-----------------------------------+
                 |      RAPIDFUZZ INTENT PARSER      |
                 | (Motion Tier -> Destination Tier) |
                 +-----------------+-----------------+
                                   |
              +--------------------+--------------------+
              |                                         |
              v                                         v
   +-----------------------+                +-----------------------+
   |  WAYPOINT DISPATCH    |                |    VOICE SYNTHESIS    |
   | (ROS 2 / Nav2 Goal)   |                |  (pyttsx3 / Web TTS)  |
   +-----------+-----------+                +-----------+-----------+
               |                                        |
               +--------------------+-------------------+
                                    |
                                    v
                 +-----------------------------------+
                 |       FLASK KIOSK WEB SERVER      |
                 |  Interactive Map & Telemetry UI   |
                 +-----------------------------------+
```

---

## 💻 Complete Software Details & Specifications

### 1. Languages, Runtimes & Frameworks
- **Python `3.10+`**: Primary backend language for speech recognition, audio processing, VAD, NLP parsing, and web server operations.
- **JavaScript (ES6+)**: Frontend application logic for the kiosk console, asynchronous REST API polling, interactive SVG node movement, and audio feedback.
- **HTML5 & Vanilla CSS3**: Glassmorphic dark/light UI design system, animated canvas particle backdrop, and responsive CSS grid.
- **Flask `3.0+` & `flask-cors`**: Lightweight WSGI web framework serving the REST API endpoints, static assets, and cross-origin kiosk communication.

### 2. Speech-to-Text Subsystem (STT)
- **Engine**: OpenAI Whisper (`base` model, ~74M parameters) running locally for 100% offline transcription.
- **Domain Prompt Conditioning**: Supplies a structured domain prompt containing all campus acronyms, department names, and venue jargon to bias the decoder transformer.
- **Decoder Configuration**:
  - `temperature = 0.0` (zero-temperature greedy decoding to eliminate hallucinations).
  - `condition_on_previous_text = False` (prevents repeating phrase loops across consecutive spoken queries).

### 3. Audio Preprocessing & Voice Activity Detection (VAD)
- **Audio Loading & Resampling**: `sounddevice` and `numpy` recording raw mono PCM audio at **16,000 Hz** sample rate.
- **Peak Gain Normalization**: `AudioPreprocessor.normalize_waveform` rescales the peak amplitude of input audio buffers to **0.95**, ensuring high transcription accuracy even with quiet or distant voices.
- **Energy-based RMS VAD**:
  - `chunk_duration` = `0.1s` (1600 samples per chunk).
  - `energy_threshold` = `0.015` RMS.
  - `silence_timeout` = `1.3s` (automatically stops recording after speech ends).
  - `max_recording_duration` = `8.0s` (upper limit cut-off).

### 4. Natural Language Processing (NLP) & Intent Engine
- **Fuzzy Matching Library**: `RapidFuzz` (`fuzz.partial_ratio` algorithm) for robust string matching against noisy transcriptions.
- **Multi-Tiered Classification Strategy**:
  - **Tier 1 (Motion Commands)**: Matches incoming text against motion triggers (`STOP`, `SLOW_DOWN`, `SPEED_UP`, `RESUME`, `CANCEL`) with exact matching or fuzzy ratio $\ge 90\%$.
  - **Tier 2 (Destination Mapping)**: Searches 25+ structured venue definitions across Administration, Academic Departments, Labs, Facilities, and Amenities.
    - *Exact Alias Match*: $100\%$ confidence.
    - *Fuzzy Match*: Selects highest scoring venue with score $\ge 80\%$.
  - **Tier 3 (Conversational Fallback)**: Catches unrecognized queries and returns polite prompts requesting the user to rephrase.

### 5. Voice Synthesis (TTS) Engine
- **Primary Engine (`pyttsx3`)**: Offline text-to-speech engine compatible with Windows SAPI5 and Linux/Raspberry Pi `eSpeak-ng`. Configured with `rate = 160 WPM` and `volume = 1.0`.
- **Web UI Fallback (`Web Speech API`)**: Browser-native `window.speechSynthesis` for audio feedback when using the web console touch interface.

### 6. Evaluation & Benchmarking Suite
- **Script**: `evaluate_transcription.py`
- **Metrics Calculated**:
  - **WER (Word Error Rate)**: $\text{WER} = \frac{S + D + I}{N}$ using Levenshtein distance on word tokens.
  - **CER (Character Error Rate)**: Character-level Levenshtein distance metric.
  - **Domain Keyword Hit Rate**: Percentage of target campus acronyms correctly present in transcription.
  - **Intent & Waypoint ID Accuracy**: Exact match verification against expected ROS 2 hardware target IDs.

---

## 🛠️ Complete Hardware Architecture & Specifications

### 1. Main Compute Unit
- **Primary Target**: **Raspberry Pi 5** (Broadcom BCM2712 Quad-core ARM Cortex-A76 @ 2.4GHz, 4GB / 8GB LPDDR4X RAM).
- **Secondary Target**: Standard Industrial SBC or x86_64 Laptop / Desktop PC.
- **Storage**: Minimum 32 GB Class 10 High-Speed MicroSD / PCIe NVMe M.2 SSD via Raspberry Pi M.2 HAT for fast model loading and logging.

### 2. Audio Capture & Processing Hardware
- **Microphone Array**: USB or I2S Far-Field Dual/Quad Microphone Array with omnidirectional pick-up pattern and onboard hardware noise suppression / acoustic echo cancellation (AEC).
- **Audio Output**: 3.5mm AUX jack or USB Audio DAC output connected to a **5W-10W PAM8403 / TPA3116 Class-D Audio Amplifier** driving dual 4-ohm magnetic speakers for clear public address.

### 3. Kiosk Display & Touch Console
- **Display Module**: 7-inch to 10.1-inch Capacitive Touchscreen LCD (1024x600 or 1920x1080 resolution) connected via HDMI / DSI.
- **User Interface**: Displays full-screen browser kiosk mode (`Chromium --kiosk http://localhost:5000`) for direct touch interaction.

### 4. Robot Mobility & Navigation Interface (ROS 2 / Nav2 Stack)
- **Mobility Base**: Differential drive or Omnidirectional (Mecanum) wheel robot chassis.
- **Low-Level Motor Control**: Microcontroller (ESP32 / STM32) handling PID motor speed control and quadrature wheel encoder odometry over UART / ROS 2 Serial bridge.
- **Spatial Perception & Mapping Sensors**:
  - 2D LiDAR (360° scanning, 8–12m range) for SLAM mapping (`Cartographer` / `slam_toolbox`) and real-time obstacle avoidance.
  - 3D Depth Camera (Intel RealSense D435 or OAK-D) for 3D obstacle filtering and floor surface detection.
- **ROS 2 Integration Bridge**: When an intent maps to a target `Waypoint ID` (e.g., `WP_ADMIN_EXAM_04`), Curbo dispatches the 2D Pose Goal to ROS 2 Nav2 stack (`/navigate_to_pose` action or `/goal_pose` topic).

---

## 📁 Project Structure

```
curbo/
├── curbo_live.py             # CLI application for live mic capture & interactive voice navigation
├── curbo_speech.py           # Core speech subsystem (VAD, Whisper STT, RapidFuzz NLP, pyttsx3 TTS)
├── server.py                 # Flask REST API server serving web kiosk console & status endpoints
├── evaluate_transcription.py # Benchmark evaluation harness for WER/CER/Intent accuracy
├── test_live_mic.py          # Quick hardware test script for microphone input & VAD
├── curbo_speech.ipynb        # Jupyter Notebook for interactive prototyping & testing
├── semantic_nlp.ipynb        # Prototyping notebook for NLP intent parsing experiments
├── project_details.txt       # System architecture documentation & technical specification
├── requirements.txt          # Python dependencies
├── eval_report.txt           # Generated benchmarking performance report
├── eval_results.json         # Structured benchmark output JSON
├── audio_files/              # Evaluation test suite WAV audio files
└── web/                      # Kiosk Web UI Frontend
    ├── index.html            # Responsive Glassmorphic Kiosk Web Console
    ├── styles.css            # Custom CSS3 theme, glassmorphism, and canvas animations
    └── app.js                # Frontend state management, REST polling, and SVG map renderer
```

---

## ⚙️ Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/curbo.git
cd curbo
```

### 2. Set Up Virtual Environment (Recommended)
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux / Raspberry Pi OS
python3 -m venv venv
source venv/bin/activate
```

### 3. Install System Audio Dependencies
- **Linux / Raspberry Pi OS:**
  ```bash
  sudo apt-get update
  sudo apt-get install -y portaudio19-dev espeak-ng ffmpeg
  ```
- **Windows:** Ensure `ffmpeg` is installed and added to PATH (required by OpenAI Whisper).

### 4. Install Python Packages
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 🚀 Usage Guide

### 1. Launching Web Kiosk Server
Run the Flask REST server to launch the interactive kiosk interface:
```bash
python server.py
```
Open your browser and navigate to:
- **Local:** `http://localhost:5000`
- **Network Kiosk Display:** `http://<your-pi-ip>:5000`

### 2. Running Live Microphone Navigation
To launch Curbo's voice interface in terminal/hardware mode with live microphone listening:
```bash
python curbo_live.py --model base --mode vad
```
* **Options:**
  - `--model`: Whisper model size (`tiny`, `base`, `small`). Default: `base`.
  - `--mode`: Recording trigger (`vad` for voice-activity detection or `fixed` for fixed length).
  - `--no-tts`: Suppress spoken voice responses.
  - `--device`: Specify audio input device index.

### 3. Running Accuracy & Performance Benchmarks
Evaluate STT WER/CER and intent detection against test audio files in `audio_files/`:
```bash
python evaluate_transcription.py
```
This generates `eval_report.txt` and `eval_results.json`.

---

## 🔌 REST API Reference

| Endpoint | Method | Description | Payload / Parameters |
| :--- | :--- | :--- | :--- |
| `/` | `GET` | Serves Kiosk Web Console (`index.html`) | N/A |
| `/api/destinations` | `GET` | Returns structured venue catalog & waypoints | N/A |
| `/api/status` | `GET` | Returns current robot status & active target | N/A |
| `/api/navigate` | `POST` | Dispatches robot to destination or parses query | `{ "destination_key": "EXAM_CELL" }` or `{ "query": "take me to reception" }` |
| `/api/stop` | `POST` | Triggers emergency stop & clears navigation state | N/A |
| `/api/tts_toggle` | `POST` | Enables/Disables spoken audio response | `{ "enabled": true }` |

---

## 📊 Evaluation & Benchmarking

Benchmarking was conducted using `evaluate_transcription.py` on ground-truth audio test samples.

| Metric | Result | Target Benchmark | Status |
| :--- | :--- | :--- | :--- |
| **Overall Intent Accuracy** | **100.0%** (10/10) | ≥ 95.0% | PASSED |
| **NAVIGATE Intent Accuracy** | **100.0%** (9/9) | ≥ 95.0% | PASSED |
| **Destination Accuracy** | **100.0%** (10/10) | ≥ 95.0% | PASSED |
| **Waypoint ID Match Accuracy**| **100.0%** (10/10) | 100.0% | PASSED |
| **Domain Keyword Hit Rate** | **90.0%** | ≥ 85.0% | PASSED |
| **Average End-to-End Latency**| **482 ms** | < 1000 ms | EXCELLENT |
| **Hallucination Rate** | **0.0%** (0/10) | 0.0% | PASSED |

---

## 📍 Campus Destination Knowledge Base

Curbo supports structured navigation to **25+ key waypoints** across five main categories:

1. **Administration & Governance:**
   - Principal's Office (`WP_ADMIN_PRINCIPAL_01`)
   - Dean Academics (`WP_ADMIN_DEAN_02`)
   - Accounts & Fee Counter (`WP_ADMIN_ACCOUNTS_03`)
   - Exam Cell / COE (`WP_ADMIN_EXAM_04`)
   - HR & Admin Block (`WP_ADMIN_HR_05`)
   - Reception / Front Desk (`WP_ADMIN_RECEPTION_06`)
2. **Academic Departments:**
   - CSE, ECE, EEE, Mechanical, Civil, AI & Data Science (`WP_DEPT_*`)
   - HOD Cabins & Faculty/Staff Rooms
3. **Laboratories & Workshops:**
   - Central Computing Facility (CCF), IoT & Robotics Lab, VLSI Lab, Mechanical Workshop, Physics & Chemistry Labs (`WP_LAB_*`)
4. **Student Support & Facilities:**
   - Central Library, Placement Cell, Main Auditorium, Seminar Hall, Xerox/Stationery Shop, Medical Infirmary, Restrooms (`WP_FACILITY_*`)
5. **Amenities & Campus Living:**
   - Cafeteria / Canteen, Sports Complex & Gym, Campus Hostels, Main Gate & Security (`WP_AMENITY_*`)

---

## 🔮 Future Enhancements & Roadmap

- [ ] **Real-Time Telemetry Streaming:** Upgrade HTTP polling to WebSockets / Server-Sent Events (SSE).
- [ ] **Direct Web Mic Streaming:** Add `/api/voice_navigate` endpoint for recording audio directly in browser UI.
- [ ] **Multi-Turn Campus FAQ:** Expand NLP knowledge base to handle general queries (e.g. fee payment procedure, exam timetables).
- [ ] **Multi-Lingual Support:** Extend Whisper prompts and TTS to support regional languages (Hindi, Telugu, Tamil).
- [ ] **Active Noise Cancellation (ANC):** Integrate RNNoise filter for outdoor noisy environments.

---

## 📜 License & Citation

Distributed under the **MIT License**. See `LICENSE` for more details.

Developed for campus automation and autonomous kiosk robotics. Contributions and pull requests are welcome! 🚀
