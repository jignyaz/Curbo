"""
Curbo Campus Guide Robot - Web API & Kiosk Server
-------------------------------------------------
Serves the web application UI and REST API endpoints for remote robot control,
interactive destination navigation, speech search parsing, and live telemetry.
"""

import os
import sys
import time
from typing import Dict, Any
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# Import Curbo Speech Core components
try:
    from curbo_speech import DESTINATIONS, IntentParser, CurboIntentResult
except ImportError as e:
    print(f"[Error] Failed to import curbo_speech: {e}")
    sys.exit(1)

app = Flask(__name__, static_folder="web")
CORS(app)

# Initialize Intent Parser
parser = IntentParser()

# Global State for Curbo Robot
curbo_state: Dict[str, Any] = {
    "status": "IDLE",  # IDLE, NAVIGATING, ARRIVED, ERROR
    "active_destination": None,
    "waypoint_id": None,
    "confirmation_msg": "Curbo is standing by at the main lobby.",
    "last_command_time": None,
    "tts_enabled": True
}


@app.route("/")
def serve_index():
    return send_from_directory("web", "index.html")


@app.route("/<path:path>")
def serve_static(path):
    if os.path.exists(os.path.join("web", path)):
        return send_from_directory("web", path)
    return send_from_directory("web", "index.html")


@app.route("/api/destinations", methods=["GET"])
def get_destinations():
    """Returns structured list of available destinations for the kiosk grid."""
    categories = {
        "Administration": [],
        "Academic Departments": [],
        "Facilities & Amenities": []
    }

    for key, data in DESTINATIONS.items():
        # Assign category based on key prefix
        if key.startswith("WP_ADMIN") or "ADMIN" in data["waypoint_id"] or key in ["PRINCIPAL_OFFICE", "DEAN_ACADEMICS", "ACCOUNTS_SECTION", "EXAM_CELL", "HR_OFFICE", "RECEPTION"]:
            cat = "Administration"
        elif "DEPT" in data["waypoint_id"] or key.endswith("_DEPARTMENT"):
            cat = "Academic Departments"
        else:
            cat = "Facilities & Amenities"

        categories[cat].append({
            "key": key,
            "canonical_name": data["canonical_name"],
            "aliases": data["aliases"],
            "waypoint_id": data["waypoint_id"],
            "confirmation_msg": data["confirmation_msg"]
        })

    return jsonify({
        "status": "success",
        "categories": categories,
        "raw_destinations": DESTINATIONS
    })


@app.route("/api/status", methods=["GET"])
def get_status():
    """Returns current robot state & telemetry."""
    return jsonify({
        "status": "success",
        "robot_state": curbo_state
    })


@app.route("/api/navigate", methods=["POST"])
def navigate():
    """
    Accepts direct destination selection or text query input.
    Payload: { "destination_key": "EXAM_CELL" } or { "query": "take me to reception" }
    """
    data = request.json or {}
    dest_key = data.get("destination_key")
    query_text = data.get("query")

    target_info = None

    if dest_key and dest_key in DESTINATIONS:
        target_info = DESTINATIONS[dest_key]
        intent_type = "NAVIGATE"
        waypoint_id = target_info["waypoint_id"]
        canonical_name = target_info["canonical_name"]
        msg = target_info["confirmation_msg"]
    elif query_text:
        res: CurboIntentResult = parser.parse(query_text)
        intent_type = res.intent_type
        if res.intent_type == "NAVIGATE" and res.target in DESTINATIONS:
            target_info = DESTINATIONS[res.target]
            waypoint_id = target_info["waypoint_id"]
            canonical_name = target_info["canonical_name"]
            msg = target_info["confirmation_msg"]
        elif res.intent_type == "MOTION_CONTROL":
            waypoint_id = None
            canonical_name = f"Motion Command: {res.target}"
            msg = f"Executing motion action: {res.target}"
        else:
            return jsonify({
                "status": "warning",
                "message": f"Could not determine destination from '{query_text}'. Please pick from the list.",
                "intent_result": {
                    "intent": res.intent_type,
                    "target": res.target,
                    "confidence": res.confidence
                }
            }), 400
    else:
        return jsonify({"status": "error", "message": "Missing 'destination_key' or 'query' parameter"}), 400

    # Update robot state
    curbo_state["status"] = "NAVIGATING"
    curbo_state["active_destination"] = canonical_name
    curbo_state["waypoint_id"] = waypoint_id
    curbo_state["confirmation_msg"] = msg
    curbo_state["last_command_time"] = time.strftime("%H:%M:%S")

    print(f"\n[ROBOT WEB DISPATCH] Destination: {canonical_name} | Waypoint: {waypoint_id}")

    return jsonify({
        "status": "success",
        "message": msg,
        "destination": canonical_name,
        "waypoint_id": waypoint_id,
        "robot_state": curbo_state
    })


@app.route("/api/stop", methods=["POST"])
def stop_robot():
    """Emergency stop / clear navigation goal."""
    curbo_state["status"] = "IDLE"
    curbo_state["active_destination"] = None
    curbo_state["waypoint_id"] = None
    curbo_state["confirmation_msg"] = "Curbo navigation stopped. Ready for next command."
    curbo_state["last_command_time"] = time.strftime("%H:%M:%S")

    print("\n[ROBOT EMERGENCY STOP] Robot paused by user request.")

    return jsonify({
        "status": "success",
        "message": "Curbo has stopped navigation.",
        "robot_state": curbo_state
    })


@app.route("/api/tts_toggle", methods=["POST"])
def toggle_tts():
    data = request.json or {}
    curbo_state["tts_enabled"] = bool(data.get("enabled", True))
    return jsonify({"status": "success", "tts_enabled": curbo_state["tts_enabled"]})


if __name__ == "__main__":
    os.makedirs("web", exist_ok=True)
    port = int(os.environ.get("PORT", 5000))
    print(f"\n=======================================================")
    print(f"      CURBO CAMPUS GUIDE ROBOT - WEB & KIOSK SERVER")
    print(f"=======================================================")
    print(f" Access URL : http://localhost:{port}")
    print(f" Network URL: http://0.0.0.0:{port}")
    print(f" Press Ctrl+C to stop the server.")
    print(f"=======================================================\n")
    app.run(host="0.0.0.0", port=port, debug=True)
