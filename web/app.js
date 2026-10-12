/* ==========================================================================
   CURBO CAMPUS GUIDE ROBOT - 2D NAVIGATION SIMULATION & LIVE SPEECH ENGINE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================================================
     1. GLOBAL CONSTANTS & DESTINATION DEFINITIONS (5 DESTINATIONS)
     ========================================================================== */
  const DEST_CONFIG = {
    'RECEPTION': {
      key: 'RECEPTION',
      canonical_name: "Reception & Base Dock",
      waypoint_id: "WP_ADMIN_RECEPTION_06",
      zone: "BASE DOCK",
      icon: "🏛️",
      color: "#10b981",
      roomRect: { x: 50, y: 330, w: 200, h: 150 },
      dockPos: { x: 150, y: 410 },
      doorPos: { x: 150, y: 310 },
      insidePos: { x: 150, y: 410 },
      aliases: ["reception", "reception desk", "front desk", "lobby", "dock", "base", "start", "entrance", "help desk", "section", "counter"],
      confirmation: "Navigating to Reception and Base Dock. Following the south corridor."
    },
    'LIBRARY': {
      key: 'LIBRARY',
      canonical_name: "Central Library",
      waypoint_id: "WP_FACILITY_LIB_01",
      zone: "ZONE A",
      icon: "📚",
      color: "#3b82f6",
      roomRect: { x: 50, y: 40, w: 200, h: 150 },
      dockPos: null,
      doorPos: { x: 150, y: 210 },
      insidePos: { x: 150, y: 110 },
      aliases: ["library", "central library", "reading room", "books", "study", "study hall", "book bank", "digital library"],
      confirmation: "Taking you to the Central Library. Please follow me."
    },
    'EXAM_CELL': {
      key: 'EXAM_CELL',
      canonical_name: "Exam Cell & COE",
      waypoint_id: "WP_ADMIN_EXAM_04",
      zone: "ZONE B",
      icon: "📝",
      color: "#f59e0b",
      roomRect: { x: 350, y: 40, w: 200, h: 150 },
      dockPos: null,
      doorPos: { x: 450, y: 210 },
      insidePos: { x: 450, y: 110 },
      aliases: ["exam cell", "examination", "exam branch", "exam", "controller of examinations", "coe", "hall ticket", "tests", "marksheet desk"],
      confirmation: "Understood! Leading you to the Exam Cell and Controller of Examinations."
    },
    'CSE_DEPARTMENT': {
      key: 'CSE_DEPARTMENT',
      canonical_name: "CSE Tech Lab & Dept",
      waypoint_id: "WP_DEPT_CSE_01",
      zone: "ZONE C",
      icon: "💻",
      color: "#8b5cf6",
      roomRect: { x: 650, y: 40, w: 200, h: 150 },
      dockPos: null,
      doorPos: { x: 750, y: 210 },
      insidePos: { x: 750, y: 110 },
      aliases: ["cse", "cse department", "computer science", "computer lab", "tech lab", "programming", "software lab", "cse block", "it department"],
      confirmation: "Alright! Guiding you to the Computer Science & Engineering Department."
    },
    'CAFETERIA': {
      key: 'CAFETERIA',
      canonical_name: "Cafeteria & Lounge",
      waypoint_id: "WP_AMENITY_CANTEEN_01",
      zone: "ZONE D",
      icon: "☕",
      color: "#f43f5e",
      roomRect: { x: 650, y: 330, w: 200, h: 150 },
      dockPos: null,
      doorPos: { x: 750, y: 310 },
      insidePos: { x: 750, y: 410 },
      aliases: ["cafeteria", "canteen", "cafe", "food", "coffee", "lunch", "snacks", "refreshments", "food court", "mess", "tea"],
      confirmation: "Heading to the Cafeteria and Lounge. Follow me!"
    }
  };

  /* ==========================================================================
     2. CORRIDOR NAVIGATION GRAPH (NODES & EDGES)
     ========================================================================== */
  const GRAPH_NODES = {
    // Room Waypoints
    'RECEP_DOCK': { x: 150, y: 410, type: 'dock' },
    'RECEP_DOOR': { x: 150, y: 310, type: 'door' },
    'LIB_INSIDE': { x: 150, y: 110, type: 'inside' },
    'LIB_DOOR':   { x: 150, y: 210, type: 'door' },
    'EXAM_INSIDE':{ x: 450, y: 110, type: 'inside' },
    'EXAM_DOOR':  { x: 450, y: 210, type: 'door' },
    'CSE_INSIDE': { x: 750, y: 110, type: 'inside' },
    'CSE_DOOR':   { x: 750, y: 210, type: 'door' },
    'CAFE_INSIDE':{ x: 750, y: 410, type: 'inside' },
    'CAFE_DOOR':  { x: 750, y: 310, type: 'door' },

    // Hallway Junctions
    'J_WEST':     { x: 150, y: 260, type: 'junction' },
    'J_CENTER':   { x: 450, y: 260, type: 'junction' },
    'J_EAST':     { x: 750, y: 260, type: 'junction' },
    'J_SOUTH':    { x: 450, y: 310, type: 'junction' }
  };

  const GRAPH_EDGES = [
    // Room connects to doors
    { u: 'RECEP_DOCK', v: 'RECEP_DOOR' },
    { u: 'LIB_INSIDE',  v: 'LIB_DOOR' },
    { u: 'EXAM_INSIDE', v: 'EXAM_DOOR' },
    { u: 'CSE_INSIDE',  v: 'CSE_DOOR' },
    { u: 'CAFE_INSIDE', v: 'CAFE_DOOR' },

    // Doors connect to junctions / corridors
    { u: 'LIB_DOOR',    v: 'J_WEST' },
    { u: 'RECEP_DOOR',  v: 'J_WEST' },
    { u: 'EXAM_DOOR',   v: 'J_CENTER' },
    { u: 'CSE_DOOR',    v: 'J_EAST' },
    { u: 'CAFE_DOOR',   v: 'J_EAST' },

    // South corridor connections
    { u: 'RECEP_DOOR',  v: 'J_SOUTH' },
    { u: 'CAFE_DOOR',   v: 'J_SOUTH' },
    { u: 'J_CENTER',    v: 'J_SOUTH' },

    // Main middle corridor
    { u: 'J_WEST',      v: 'J_CENTER' },
    { u: 'J_CENTER',    v: 'J_EAST' }
  ];

  /* ==========================================================================
     3. SIMULATION ROBOT STATE & ENGINE
     ========================================================================== */
  const robot = {
    x: 150,
    y: 410,
    theta: -Math.PI / 2, // facing North
    targetTheta: -Math.PI / 2,
    radius: 18,
    speed: 0,
    maxSpeed: 100, // px per second
    turnSpeed: 3.8, // rad per second
    speedMultiplier: 1,
    status: 'STANDBY', // STANDBY, PLANNING, NAVIGATING, OBSTACLE_DETECTED, ARRIVED
    currentDestinationKey: 'RECEPTION',
    waypointQueue: [],
    pathChevrons: [],
    trail: [],
    battery: 98,
    lidarAngle: 0,
    lidarHits: [],
    hasObstacleNear: false,
    soundEnabled: true,
    lastCommandTime: null
  };

  // Dynamic Obstacles placed by user
  let obstacles = [];
  let isPlacingObstacle = false;
  let autoTourActive = false;
  let autoTourIndex = 0;
  const tourOrder = ['LIBRARY', 'EXAM_CELL', 'CSE_DEPARTMENT', 'CAFETERIA', 'RECEPTION'];

  /* ==========================================================================
     4. AUDIO SYNTHESIS & SOUND EFFECTS (WEB AUDIO API)
     ========================================================================== */
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (!robot.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (type === 'start_listen') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'dispatch') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'arrived') {
        // Glorious 3-tone arrival chime
        [523.25, 659.25, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.12);
          gain.gain.setValueAtTime(0.18, now + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.45);
        });
      } else if (type === 'alert') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.setValueAtTime(400, now + 0.08);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
      }
    } catch (e) {
      // Audio playback failed
    }
  }

  function speakText(text) {
    if (!robot.soundEnabled) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.02;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    }
  }

  /* ==========================================================================
     5. SHORTEST PATHFINDING (DIJKSTRA ALGORITHM)
     ========================================================================== */
  function findClosestGraphNode(x, y) {
    let closestKey = null;
    let minDist = Infinity;
    for (const [key, node] of Object.entries(GRAPH_NODES)) {
      const d = Math.hypot(node.x - x, node.y - y);
      if (d < minDist) {
        minDist = d;
        closestKey = key;
      }
    }
    return closestKey;
  }

  function computeShortestPath(startNodeKey, targetNodeKey) {
    const distances = {};
    const previous = {};
    const unvisited = new Set(Object.keys(GRAPH_NODES));

    for (const key of unvisited) {
      distances[key] = Infinity;
      previous[key] = null;
    }
    distances[startNodeKey] = 0;

    // Check blocked edges by obstacles
    function isEdgeBlocked(uKey, vKey) {
      const u = GRAPH_NODES[uKey];
      const v = GRAPH_NODES[vKey];
      for (const obs of obstacles) {
        // Distance from point to line segment
        const d = distToSegment(obs.x, obs.y, u.x, u.y, v.x, v.y);
        if (d < obs.radius + 15) return true;
      }
      return false;
    }

    while (unvisited.size > 0) {
      let current = null;
      let lowestDist = Infinity;
      for (const nodeKey of unvisited) {
        if (distances[nodeKey] < lowestDist) {
          lowestDist = distances[nodeKey];
          current = nodeKey;
        }
      }

      if (current === null || current === targetNodeKey) break;
      unvisited.delete(current);

      // Inspect neighbors
      for (const edge of GRAPH_EDGES) {
        let neighbor = null;
        if (edge.u === current) neighbor = edge.v;
        else if (edge.v === current) neighbor = edge.u;

        if (neighbor && unvisited.has(neighbor)) {
          if (isEdgeBlocked(current, neighbor)) continue; // Blocked by dynamic obstacle!

          const uNode = GRAPH_NODES[current];
          const vNode = GRAPH_NODES[neighbor];
          const weight = Math.hypot(uNode.x - vNode.x, uNode.y - vNode.y);
          const alt = distances[current] + weight;
          if (alt < distances[neighbor]) {
            distances[neighbor] = alt;
            previous[neighbor] = current;
          }
        }
      }
    }

    // Reconstruct path
    const pathKeys = [];
    let curr = targetNodeKey;
    while (curr) {
      pathKeys.unshift(curr);
      curr = previous[curr];
    }

    if (pathKeys.length > 0 && pathKeys[0] === startNodeKey) {
      return pathKeys.map(k => ({ ...GRAPH_NODES[k], key: k }));
    }
    return [];
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  /* ==========================================================================
     6. SPEECH RECOGNITION (WEB SPEECH API & FUZZY MATCHER)
     ========================================================================== */
  let recognition = null;
  let isListening = false;
  let isContinuous = false;

  const btnSimMic = document.getElementById('btn-sim-mic');
  const btnContinuous = document.getElementById('btn-continuous-mic');
  const micLabel = document.getElementById('mic-btn-label');
  const listenToggleText = document.getElementById('listen-toggle-text');
  const speechTranscriptBubble = document.getElementById('speech-transcript-bubble');
  const speechIntentPill = document.getElementById('speech-intent-pill');
  const speechRobotResponse = document.getElementById('speech-robot-response');

  function initSpeechEngine() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      speechTranscriptBubble.innerHTML = "⚠️ <em>Speech Recognition API not supported in this browser. Please use the Quick Commands or Text Input below.</em>";
      btnSimMic.style.opacity = '0.5';
      return;
    }

    recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isListening = true;
      btnSimMic.classList.add('recording');
      micLabel.innerText = "LISTENING NOW...";
      speechIntentPill.className = "intent-pill idle";
      speechIntentPill.innerText = "Listening...";
      playSound('start_listen');
    };

    recognition.onresult = (event) => {
      let interim = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (interim) {
        speechTranscriptBubble.innerHTML = `Heard: "<em>${interim}</em>"`;
      }

      if (finalTranscript) {
        const text = finalTranscript.trim();
        speechTranscriptBubble.innerHTML = `You said: "<strong>${text}</strong>"`;
        logEvent(`[VOICE INPUT] User spoke: "${text}"`, 'log-highlight');
        processSpeechCommand(text);
      }
    };

    recognition.onerror = (e) => {
      console.warn("Speech recognition notice:", e.error);
      stopListeningUI();
      if (isContinuous && e.error !== 'not-allowed') {
        setTimeout(startListening, 600);
      }
    };

    recognition.onend = () => {
      stopListeningUI();
      if (isContinuous) {
        setTimeout(startListening, 400);
      }
    };
  }

  function startListening() {
    if (!recognition || isListening) return;
    try {
      recognition.start();
    } catch (e) {
      // Already running
    }
  }

  function stopListening() {
    if (!recognition) return;
    try {
      recognition.stop();
    } catch (e) {}
    stopListeningUI();
  }

  function stopListeningUI() {
    isListening = false;
    btnSimMic.classList.remove('recording');
    micLabel.innerText = "SPEAK COMMAND";
  }

  // Fuzzy intent matcher for the 5 destinations & motion controls
  function processSpeechCommand(rawText) {
    const text = rawText.toLowerCase().trim();

    // Check motion commands
    if (text.includes("stop") || text.includes("halt") || text.includes("freeze") || text.includes("wait")) {
      emergencyStop();
      speechIntentPill.className = "intent-pill matched";
      speechIntentPill.innerText = "MOTION: EMERGENCY STOP";
      speechRobotResponse.innerHTML = `🤖 <strong>Curbo:</strong> "Navigation halted by voice command."`;
      speakText("Robot stopped.");
      return;
    }

    if (text.includes("resume") || text.includes("continue") || text.includes("go ahead")) {
      if (robot.status === 'STANDBY' && robot.currentDestinationKey) {
        triggerDestination(robot.currentDestinationKey);
      }
      return;
    }

    // Check destinations
    let bestMatchKey = null;
    let highestScore = 0;

    for (const [key, dest] of Object.entries(DEST_CONFIG)) {
      for (const alias of dest.aliases) {
        if (text.includes(alias)) {
          const score = alias.length; // Prioritize longer, more specific matches
          if (score > highestScore) {
            highestScore = score;
            bestMatchKey = key;
          }
        }
      }
    }

    if (bestMatchKey) {
      const dest = DEST_CONFIG[bestMatchKey];
      speechIntentPill.className = "intent-pill matched";
      speechIntentPill.innerText = `INTENT: ${bestMatchKey} (100% CONFIDENCE)`;
      speechRobotResponse.innerHTML = `🤖 <strong>Curbo:</strong> "${dest.confirmation}"`;
      logEvent(`[INTENT CLASSIFIED] Mapped to ${dest.canonical_name} (${dest.waypoint_id})`, 'log-success');

      // Dispatch navigation
      triggerDestination(bestMatchKey);
      speakText(dest.confirmation);
    } else {
      speechIntentPill.className = "intent-pill idle";
      speechIntentPill.innerText = "UNRECOGNIZED DESTINATION";
      speechRobotResponse.innerHTML = `🤖 <strong>Curbo:</strong> "I didn't recognize that destination. Please ask for Reception, Library, Exam Cell, CSE Lab, or Cafeteria."`;
      speakText("I could not find that destination. Please pick from Reception, Library, Exam Cell, CSE Lab, or Cafeteria.");
      logEvent(`[INTENT FALLBACK] Could not map: "${rawText}"`, 'log-warning');
    }
  }

  /* ==========================================================================
     7. LIVE AUDIO WAVEFORM VISUALIZER (CANVAS)
     ========================================================================== */
  const waveCanvas = document.getElementById('audio-wave-canvas');
  const waveCtx = waveCanvas ? waveCanvas.getContext('2d') : null;
  let wavePhase = 0;

  function renderWaveform() {
    if (!waveCtx) return;
    waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);

    const width = waveCanvas.width;
    const height = waveCanvas.height;
    const midY = height / 2;

    waveCtx.lineWidth = 2;
    waveCtx.beginPath();

    const isRec = isListening;
    const baseAmp = isRec ? 18 : 3;
    wavePhase += isRec ? 0.18 : 0.04;

    const grad = waveCtx.createLinearGradient(0, 0, width, 0);
    if (isRec) {
      grad.addColorStop(0, '#DC2626');
      grad.addColorStop(0.5, '#2563EB');
      grad.addColorStop(1, '#059669');
    } else {
      grad.addColorStop(0, 'rgba(37, 99, 235, 0.7)');
      grad.addColorStop(1, 'rgba(30, 58, 95, 0.8)');
    }
    waveCtx.strokeStyle = grad;

    for (let x = 0; x < width; x += 3) {
      const normalizedX = x / width;
      const envelope = Math.sin(normalizedX * Math.PI); // tapering at edges
      const y = midY + Math.sin(normalizedX * 14 + wavePhase) * baseAmp * envelope +
                       Math.cos(normalizedX * 22 - wavePhase * 1.5) * (baseAmp * 0.4) * envelope;
      if (x === 0) waveCtx.moveTo(x, y);
      else waveCtx.lineTo(x, y);
    }
    waveCtx.stroke();

    requestAnimationFrame(renderWaveform);
  }
  renderWaveform();

  /* ==========================================================================
     8. SIMULATION NAVIGATION DISPATCHER
     ========================================================================== */
  window.triggerDestination = function(destKey) {
    if (!DEST_CONFIG[destKey]) return;
    const dest = DEST_CONFIG[destKey];

    playSound('dispatch');
    robot.currentDestinationKey = destKey;
    robot.status = 'NAVIGATING';
    robot.lastCommandTime = new Date().toLocaleTimeString();

    // Compute route using graph
    const startNodeKey = findClosestGraphNode(robot.x, robot.y);
    const targetInsideKey = Object.keys(GRAPH_NODES).find(k => {
      const node = GRAPH_NODES[k];
      return node.x === dest.insidePos.x && node.y === dest.insidePos.y;
    }) || 'RECEP_DOCK';

    const path = computeShortestPath(startNodeKey, targetInsideKey);

    if (path.length > 0) {
      // Waypoint queue includes destination door and inside point
      robot.waypointQueue = path.map(p => ({ x: p.x, y: p.y, key: p.key }));
      logEvent(`[ROUTE PLANNED] ${path.length} waypoints -> ${dest.canonical_name}`, 'log-success');
    } else {
      // Direct waypoint fallback
      robot.waypointQueue = [{ x: dest.doorPos.x, y: dest.doorPos.y }, { x: dest.insidePos.x, y: dest.insidePos.y }];
      logEvent(`[DIRECT ROUTE] Fallback corridor route -> ${dest.canonical_name}`, 'log-warning');
    }

    updateUI();
    syncWithServer(destKey);
  };

  function emergencyStop() {
    playSound('alert');
    robot.status = 'STANDBY';
    robot.speed = 0;
    robot.waypointQueue = [];
    autoTourActive = false;
    logEvent(`[EMERGENCY STOP] Robot paused by user. Waypoint queue cleared.`, 'log-error');
    updateUI();

    fetch('/api/stop', { method: 'POST' }).catch(() => {});
  }

  function syncWithServer(destKey) {
    fetch('/api/navigate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination_key: destKey })
    }).catch(() => {});
  }

  /* ==========================================================================
     9. 2D SIMULATION CANVAS RENDERING & KINEMATICS ENGINE
     ========================================================================== */
  const simCanvas = document.getElementById('sim-canvas');
  const ctx = simCanvas ? simCanvas.getContext('2d') : null;

  let lastFrameTime = performance.now();

  function updateSimulation(dt) {
    // 1. Waypoint Following
    if (robot.waypointQueue.length > 0 && robot.status === 'NAVIGATING') {
      const target = robot.waypointQueue[0];
      const dx = target.x - robot.x;
      const dy = target.y - robot.y;
      const dist = Math.hypot(dx, dy);

      // Target orientation
      const targetAngle = Math.atan2(dy, dx);
      let angleDiff = targetAngle - robot.theta;
      // Normalize angle difference between -PI and PI
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // Turning towards waypoint
      if (Math.abs(angleDiff) > 0.08) {
        const turnStep = robot.turnSpeed * robot.speedMultiplier * dt;
        if (Math.abs(angleDiff) <= turnStep) {
          robot.theta = targetAngle;
        } else {
          robot.theta += Math.sign(angleDiff) * turnStep;
        }
      }

      // Linear motion
      const currentMaxSpeed = robot.maxSpeed * robot.speedMultiplier;
      // Decelerate if close to final waypoint or turning sharply
      let targetSpeed = currentMaxSpeed;
      if (Math.abs(angleDiff) > 0.6) {
        targetSpeed = currentMaxSpeed * 0.35; // Slow down during sharp turn
      }
      if (robot.waypointQueue.length === 1 && dist < 40) {
        targetSpeed = Math.max(25, currentMaxSpeed * (dist / 40));
      }

      // Accelerate / decelerate smoothly
      if (robot.speed < targetSpeed) {
        robot.speed = Math.min(targetSpeed, robot.speed + 160 * dt);
      } else {
        robot.speed = Math.max(targetSpeed, robot.speed - 220 * dt);
      }

      // Translate position
      const moveDist = robot.speed * dt;
      robot.x += Math.cos(robot.theta) * moveDist;
      robot.y += Math.sin(robot.theta) * moveDist;

      // Drain battery slightly during drive
      robot.battery = Math.max(5, robot.battery - 0.003 * dt);

      // Breadcrumb trail
      if (robot.trail.length === 0 || Math.hypot(robot.x - robot.trail[robot.trail.length - 1].x, robot.y - robot.trail[robot.trail.length - 1].y) > 10) {
        robot.trail.push({ x: robot.x, y: robot.y, alpha: 1.0 });
        if (robot.trail.length > 80) robot.trail.shift();
      }

      // Waypoint arrival check
      if (dist < 10) {
        robot.waypointQueue.shift();
        if (robot.waypointQueue.length === 0) {
          // Final Destination Reached!
          robot.status = 'ARRIVED';
          robot.speed = 0;
          playSound('arrived');

          const dest = DEST_CONFIG[robot.currentDestinationKey];
          logEvent(`[ARRIVED] Successfully reached ${dest.canonical_name}!`, 'log-success');
          speechRobotResponse.innerHTML = `🤖 <strong>Curbo:</strong> "We have arrived at ${dest.canonical_name}. Standing by for next command."`;
          speakText(`We have arrived at ${dest.canonical_name}.`);

          // Recharge battery if at Reception dock
          if (robot.currentDestinationKey === 'RECEPTION') {
            robot.battery = 100;
          }

          updateUI();

          // Auto Tour handling
          if (autoTourActive) {
            setTimeout(() => {
              if (autoTourActive) {
                autoTourIndex = (autoTourIndex + 1) % tourOrder.length;
                triggerDestination(tourOrder[autoTourIndex]);
              }
            }, 3000);
          }
        }
      }
    } else {
      robot.speed = 0;
    }

    // 2. Trail decay
    robot.trail.forEach(t => t.alpha = Math.max(0, t.alpha - 0.004));
    robot.trail = robot.trail.filter(t => t.alpha > 0.05);

    // 3. LiDAR Sweep & Obstacle Scanning
    robot.lidarAngle += (Math.PI * 4) * dt; // 2 revolutions per second
    robot.lidarHits = [];
    robot.hasObstacleNear = false;

    // Cast 24 radial laser rays
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2 + robot.lidarAngle;
      const rayLen = 95;
      let hitX = robot.x + Math.cos(angle) * rayLen;
      let hitY = robot.y + Math.sin(angle) * rayLen;
      let hitDist = rayLen;

      // Check collision with dynamic obstacles
      for (const obs of obstacles) {
        const d = distToSegment(obs.x, obs.y, robot.x, robot.y, hitX, hitY);
        if (d < obs.radius) {
          hitDist = Math.hypot(obs.x - robot.x, obs.y - robot.y);
          hitX = robot.x + Math.cos(angle) * hitDist;
          hitY = robot.y + Math.sin(angle) * hitDist;

          // Check if obstacle is right in front of the robot's heading
          let forwardDiff = angle - robot.theta;
          while (forwardDiff > Math.PI) forwardDiff -= Math.PI * 2;
          while (forwardDiff < -Math.PI) forwardDiff += Math.PI * 2;

          if (Math.abs(forwardDiff) < Math.PI / 4 && hitDist < 65) {
            robot.hasObstacleNear = true;
          }
        }
      }

      robot.lidarHits.push({ x: hitX, y: hitY, dist: hitDist });
    }

    // Obstacle avoidance reaction
    if (robot.hasObstacleNear && robot.status === 'NAVIGATING') {
      robot.status = 'OBSTACLE_DETECTED';
      playSound('alert');
      logEvent(`[LIDAR WARNING] Obstacle detected within safety perimeter! Re-evaluating path...`, 'log-warning');
      // Re-route dynamically around the obstacle
      setTimeout(() => {
        if (robot.status === 'OBSTACLE_DETECTED') {
          triggerDestination(robot.currentDestinationKey);
        }
      }, 1200);
    }
  }

  function renderSimulation() {
    if (!ctx) return;
    const w = simCanvas.width;
    const h = simCanvas.height;

    // Clear background with soft blueprint canvas tone
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, w, h);

    // 1. Grid pattern (subtle architectural grid)
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.5)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 2. Corridors (Walkway centerlines)
    ctx.lineWidth = 28;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#E2E8F0';
    GRAPH_EDGES.forEach(e => {
      const u = GRAPH_NODES[e.u];
      const v = GRAPH_NODES[e.v];
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(v.x, v.y);
      ctx.stroke();
    });

    // Corridor dashed guideline
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#94A3B8';
    ctx.setLineDash([6, 6]);
    GRAPH_EDGES.forEach(e => {
      const u = GRAPH_NODES[e.u];
      const v = GRAPH_NODES[e.v];
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(v.x, v.y);
      ctx.stroke();
    });
    ctx.setLineDash([]); // Reset dash

    // 3. Render 5 Destination Rooms
    for (const [key, dest] of Object.entries(DEST_CONFIG)) {
      const r = dest.roomRect;
      const isTarget = robot.currentDestinationKey === key;

      // Room floor
      ctx.fillStyle = isTarget ? '#EFF6FF' : '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 10);
      ctx.fill();

      // Room border
      ctx.lineWidth = isTarget ? 2.5 : 1.5;
      ctx.strokeStyle = isTarget ? '#2563EB' : '#CBD5E1';
      ctx.stroke();

      // Room Doorway opening
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(dest.doorPos.x, dest.doorPos.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isTarget ? '#2563EB' : '#94A3B8';
      ctx.stroke();

      // Doorway label
      ctx.fillStyle = '#64748B';
      ctx.font = '8px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('DOOR', dest.doorPos.x, dest.doorPos.y + 3);

      // Room Icon & Title
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(dest.icon, r.x + r.w / 2, r.y + 44);

      ctx.font = 'bold 13px "Inter", sans-serif';
      ctx.fillStyle = '#1E3A5F';
      ctx.fillText(dest.canonical_name, r.x + r.w / 2, r.y + 74);

      ctx.font = '10px "JetBrains Mono"';
      ctx.fillStyle = isTarget ? '#2563EB' : '#475569';
      ctx.fillText(dest.waypoint_id, r.x + r.w / 2, r.y + 94);

      ctx.font = '9px "Inter", sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(dest.zone, r.x + r.w / 2, r.y + 114);

      // Docking icon for Reception
      if (dest.dockPos) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
        ctx.beginPath();
        ctx.arc(dest.dockPos.x, dest.dockPos.y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#059669';
        ctx.font = '10px "JetBrains Mono"';
        ctx.fillText('⚡ BASE DOCK', dest.dockPos.x, dest.dockPos.y + 4);
      }
    }

    // 4. Render Dynamic Obstacles
    obstacles.forEach((obs, idx) => {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
      ctx.beginPath();
      ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#DC2626';
      ctx.stroke();

      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️', obs.x, obs.y + 5);

      ctx.font = '8px "JetBrains Mono"';
      ctx.fillStyle = '#B91C1C';
      ctx.fillText(`OBSTACLE #${idx + 1}`, obs.x, obs.y + obs.radius + 10);
    });

    // 5. Render Planned Path Chevrons & Dashed Line
    if (robot.waypointQueue.length > 0) {
      ctx.beginPath();
      ctx.moveTo(robot.x, robot.y);
      robot.waypointQueue.forEach(wp => ctx.lineTo(wp.x, wp.y));
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Waypoint target rings
      robot.waypointQueue.forEach((wp, idx) => {
        ctx.fillStyle = idx === robot.waypointQueue.length - 1 ? '#059669' : '#2563EB';
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 6. Breadcrumb Trail
    robot.trail.forEach(t => {
      ctx.fillStyle = `rgba(37, 99, 235, ${t.alpha * 0.35})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // 7. LiDAR Laser Rays
    ctx.lineWidth = 1;
    robot.lidarHits.forEach(hit => {
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.14)';
      ctx.beginPath();
      ctx.moveTo(robot.x, robot.y);
      ctx.lineTo(hit.x, hit.y);
      ctx.stroke();

      // Laser bounce point
      ctx.fillStyle = '#2563EB';
      ctx.beginPath();
      ctx.arc(hit.x, hit.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 8. Robot Chassis & Kinematics
    ctx.save();
    ctx.translate(robot.x, robot.y);
    ctx.rotate(robot.theta);

    // Sonar forward wavefront arc
    if (robot.speed > 5) {
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, robot.radius + 14, -Math.PI / 4, Math.PI / 4);
      ctx.stroke();
    }

    // Left and Right Drive Wheels
    ctx.fillStyle = '#1F2937';
    ctx.fillRect(-robot.radius + 2, -robot.radius - 4, 12, 5); // Left wheel
    ctx.fillRect(-robot.radius + 2, robot.radius - 1, 12, 5);  // Right wheel

    // Main Chassis Circle
    const chassisGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, robot.radius);
    chassisGrad.addColorStop(0, '#FFFFFF');
    chassisGrad.addColorStop(0.7, '#E2E8F0');
    chassisGrad.addColorStop(1, '#CBD5E1');
    ctx.fillStyle = chassisGrad;
    ctx.beginPath();
    ctx.arc(0, 0, robot.radius, 0, Math.PI * 2);
    ctx.fill();

    // Chassis Ring
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = robot.hasObstacleNear ? '#DC2626' : (robot.status === 'NAVIGATING' ? '#2563EB' : '#059669');
    ctx.stroke();

    // Heading Forward Direction Arrow
    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.moveTo(robot.radius + 4, 0);
    ctx.lineTo(robot.radius - 6, -5);
    ctx.lineTo(robot.radius - 6, 5);
    ctx.closePath();
    ctx.fill();

    // Rotating LiDAR Puck in Center
    ctx.fillStyle = '#1E3A5F';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Robot Sensors / Eyes
    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.arc(6, -4, 2, 0, Math.PI * 2);
    ctx.arc(6, 4, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Celebratory pulse when arrived
    if (robot.status === 'ARRIVED') {
      const pulseSize = 24 + Math.sin(Date.now() * 0.008) * 8;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(robot.x, robot.y, pulseSize, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function animationLoop(timestamp) {
    const dt = Math.min((timestamp - lastFrameTime) / 1000, 0.1);
    lastFrameTime = timestamp;

    updateSimulation(dt);
    renderSimulation();

    requestAnimationFrame(animationLoop);
  }
  requestAnimationFrame(animationLoop);

  /* ==========================================================================
     10. ARENA INTERACTION (CLICK MAP TO NAVIGATE OR DROP OBSTACLE)
     ========================================================================== */
  if (simCanvas) {
    simCanvas.addEventListener('click', (e) => {
      const rect = simCanvas.getBoundingClientRect();
      const scaleX = simCanvas.width / rect.width;
      const scaleY = simCanvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // 1. If in Obstacle Placement Mode
      if (isPlacingObstacle) {
        // Check if clicking existing obstacle to remove
        const existingIdx = obstacles.findIndex(o => Math.hypot(o.x - clickX, o.y - clickY) < o.radius + 10);
        if (existingIdx !== -1) {
          obstacles.splice(existingIdx, 1);
          logEvent(`[OBSTACLE REMOVED] Cleared obstacle #${existingIdx + 1}`, 'log-highlight');
        } else {
          obstacles.push({ x: clickX, y: clickY, radius: 18 });
          logEvent(`[OBSTACLE PLACED] Dropped dynamic obstacle at (${(clickX / 60).toFixed(1)}m, ${(clickY / 60).toFixed(1)}m)`, 'log-warning');
          playSound('alert');
        }
        return;
      }

      // 2. Check if clicked inside any Destination Room
      for (const [key, dest] of Object.entries(DEST_CONFIG)) {
        const r = dest.roomRect;
        if (clickX >= r.x && clickX <= r.x + r.w && clickY >= r.y && clickY <= r.y + r.h) {
          triggerDestination(key);
          return;
        }
      }

      // 3. Otherwise, navigate to clicked hallway location
      logEvent(`[MANUAL CLICK] Navigating to clicked coordinates (${(clickX / 60).toFixed(1)}m, ${(clickY / 60).toFixed(1)}m)`, 'log-highlight');
      robot.waypointQueue = [{ x: clickX, y: clickY }];
      robot.status = 'NAVIGATING';
      updateUI();
    });
  }

  /* ==========================================================================
     11. TELEMETRY HUD & UI UPDATES
     ========================================================================== */
  const hudStatus = document.getElementById('hud-status');
  const hudDest = document.getElementById('hud-destination');
  const hudCoords = document.getElementById('hud-coords');
  const hudHeading = document.getElementById('hud-heading');
  const hudSpeed = document.getElementById('hud-speed');
  const hudDistance = document.getElementById('hud-distance');
  const hudLidar = document.getElementById('hud-lidar');
  const headerStatusBadge = document.getElementById('robot-status-badge');
  const headerStatusText = document.getElementById('status-text');
  const headerBattery = document.getElementById('header-battery');

  const activeTargetText = document.getElementById('active-target-text');
  const activeWaypointText = document.getElementById('active-waypoint-text');
  const curboNotice = document.getElementById('curbo-notice');
  const lastTimeEl = document.getElementById('last-time');

  function updateUI() {
    const dest = DEST_CONFIG[robot.currentDestinationKey] || DEST_CONFIG['RECEPTION'];

    if (hudStatus) hudStatus.innerText = robot.status;
    if (hudDest) hudDest.innerText = dest.canonical_name;
    if (headerStatusText) headerStatusText.innerText = robot.status;
    if (activeTargetText) activeTargetText.innerText = dest.canonical_name;
    if (activeWaypointText) activeWaypointText.innerText = dest.waypoint_id;
    if (lastTimeEl) {
      lastTimeEl.innerText = robot.lastCommandTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Update assistant notice message dynamically
    if (curboNotice) {
      const noticeContent = curboNotice.querySelector('.notice-content');
      if (noticeContent) {
        if (robot.status === 'NAVIGATING') {
          noticeContent.innerText = `Curbo is currently guiding towards ${dest.canonical_name}. Please follow safely.`;
        } else if (robot.status === 'ARRIVED') {
          noticeContent.innerText = `Arrived at ${dest.canonical_name}. Standing by for next destination.`;
        } else if (robot.status === 'OBSTACLE_DETECTED') {
          noticeContent.innerText = `Safety perimeter active: Obstacle detected. Re-evaluating corridor path.`;
        } else if (robot.status === 'STANDBY' && robot.speed === 0) {
          noticeContent.innerText = `Welcome to Campus Guide! Select any destination or use voice search to navigate.`;
        }
      }
    }

    // Meter scale: 60px = 1.0 meter
    const xm = (robot.x / 60).toFixed(2);
    const ym = (robot.y / 60).toFixed(2);
    if (hudCoords) hudCoords.innerText = `X: ${xm}m | Y: ${ym}m`;

    let deg = Math.round((robot.theta * 180 / Math.PI)) % 360;
    if (deg < 0) deg += 360;
    let compass = "E";
    if (deg >= 45 && deg < 135) compass = "S";
    else if (deg >= 135 && deg < 225) compass = "W";
    else if (deg >= 225 && deg < 315) compass = "N";
    if (hudHeading) hudHeading.innerText = `🧭 ${deg}° [${compass}]`;

    const speedMps = ((robot.speed / 60) * 1.0).toFixed(2);
    if (hudSpeed) hudSpeed.innerText = `${speedMps} m/s`;

    // Distance to goal
    let distToGoal = 0;
    if (robot.waypointQueue.length > 0) {
      let prev = { x: robot.x, y: robot.y };
      robot.waypointQueue.forEach(wp => {
        distToGoal += Math.hypot(wp.x - prev.x, wp.y - prev.y);
        prev = wp;
      });
    }
    const distM = (distToGoal / 60).toFixed(1);
    if (hudDistance) hudDistance.innerText = `${distM} m`;

    if (hudLidar) {
      if (robot.hasObstacleNear) {
        hudLidar.innerText = "OBSTACLE ALERT (<0.8m)";
        hudLidar.className = "hud-value text-danger";
        hudLidar.style.color = "#DC2626";
      } else {
        hudLidar.innerText = "ALL CLEAR (360°)";
        hudLidar.className = "hud-value text-success";
        hudLidar.style.color = "#059669";
      }
    }

    if (headerBattery) headerBattery.innerText = `${Math.round(robot.battery)}% Batt`;

    // Status badge class
    if (headerStatusBadge) {
      headerStatusBadge.className = `status-badge ${robot.status.toLowerCase()}`;
    }

    // Update the 5 Destination Cards
    for (const [key, d] of Object.entries(DEST_CONFIG)) {
      const card = document.getElementById(`card-dest-${key}`);
      const distEl = document.getElementById(`dist-${key}`);

      const dDist = Math.hypot(d.insidePos.x - robot.x, d.insidePos.y - robot.y);
      const isAt = dDist < 30;

      if (distEl) {
        if (isAt) distEl.innerText = "At Location";
        else distEl.innerText = `${(dDist / 60).toFixed(1)} m away`;
      }

      if (card) {
        card.classList.remove('active-target', 'active-location');
        if (robot.currentDestinationKey === key && robot.status === 'NAVIGATING') {
          card.classList.add('active-target');
        } else if (isAt) {
          card.classList.add('active-location');
        }
      }
    }
  }
  setInterval(updateUI, 200);

  function logEvent(msg, cls = '') {
    const term = document.getElementById('sim-terminal-body');
    if (!term) return;
    const now = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `log-line ${cls}`;
    line.innerHTML = `<span class="log-time">[${now}]</span> ${msg}`;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;
  }

  /* ==========================================================================
     12. UI TOOLBAR & EVENT LISTENERS
     ========================================================================== */
  // View mode switcher (Simulation Arena vs Kiosk Directory)
  const tabSimView = document.getElementById('tab-sim-view');
  const tabKioskView = document.getElementById('tab-kiosk-view');
  const simView = document.getElementById('simulation-view');
  const kioskView = document.getElementById('kiosk-view');

  if (tabSimView && tabKioskView) {
    tabSimView.addEventListener('click', () => {
      tabSimView.classList.add('active');
      tabKioskView.classList.remove('active');
      simView.style.display = 'block';
      kioskView.style.display = 'none';
    });

    tabKioskView.addEventListener('click', () => {
      tabKioskView.classList.add('active');
      tabSimView.classList.remove('active');
      simView.style.display = 'none';
      kioskView.style.display = 'block';
      fetchKioskDestinations();
    });
  }

  // Mic Button Click
  if (btnSimMic) {
    btnSimMic.addEventListener('click', () => {
      if (isListening) stopListening();
      else startListening();
    });
  }

  // Continuous listening toggle
  if (btnContinuous) {
    btnContinuous.addEventListener('click', () => {
      isContinuous = !isContinuous;
      if (isContinuous) {
        btnContinuous.classList.add('active');
        listenToggleText.innerText = "Always Listening: ON";
        logEvent("[VOICE MODE] Continuous hands-free listening enabled.", 'log-success');
        startListening();
      } else {
        btnContinuous.classList.remove('active');
        listenToggleText.innerText = "Always Listening: OFF";
        logEvent("[VOICE MODE] Continuous listening turned off.", 'log-warning');
        stopListening();
      }
    });
  }

  // Quick speech chips
  document.querySelectorAll('.speech-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cmd = chip.getAttribute('data-command');
      if (cmd) {
        speechTranscriptBubble.innerHTML = `Command: "<strong>${cmd}</strong>"`;
        logEvent(`[QUICK COMMAND] "${cmd}"`, 'log-highlight');
        processSpeechCommand(cmd);
      }
    });
  });

  // Text input fallback
  const simTextInput = document.getElementById('sim-text-input');
  const btnSimTextSend = document.getElementById('btn-sim-text-send');
  if (btnSimTextSend && simTextInput) {
    btnSimTextSend.addEventListener('click', () => {
      const val = simTextInput.value.trim();
      if (val) {
        simTextInput.value = '';
        speechTranscriptBubble.innerHTML = `Typed: "<strong>${val}</strong>"`;
        processSpeechCommand(val);
      }
    });
    simTextInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const val = simTextInput.value.trim();
        if (val) {
          simTextInput.value = '';
          speechTranscriptBubble.innerHTML = `Typed: "<strong>${val}</strong>"`;
          processSpeechCommand(val);
        }
      }
    });
  }

  // Speed controls
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      robot.speedMultiplier = parseFloat(btn.getAttribute('data-speed')) || 1;
      logEvent(`[SPEED SET] Simulation speed multiplier set to ${robot.speedMultiplier}x`, 'log-highlight');
    });
  });

  // Toggle Obstacle Mode
  const btnToggleObs = document.getElementById('btn-toggle-obstacle');
  if (btnToggleObs) {
    btnToggleObs.addEventListener('click', () => {
      isPlacingObstacle = !isPlacingObstacle;
      if (isPlacingObstacle) {
        btnToggleObs.classList.add('active');
        btnToggleObs.innerText = "⚠️ Click Map to Drop";
        logEvent("[OBSTACLE MODE] Active. Click any corridor on canvas to place/remove obstacle.", 'log-warning');
      } else {
        btnToggleObs.classList.remove('active');
        btnToggleObs.innerText = "⚠️ Place Obstacle";
        logEvent("[OBSTACLE MODE] Deactivated.", 'log-highlight');
      }
    });
  }

  // Auto Tour
  const btnAutoTour = document.getElementById('btn-auto-tour');
  if (btnAutoTour) {
    btnAutoTour.addEventListener('click', () => {
      autoTourActive = !autoTourActive;
      if (autoTourActive) {
        btnAutoTour.classList.add('active');
        btnAutoTour.innerText = "🛑 Stop Tour";
        autoTourIndex = 0;
        logEvent("[AUTO TOUR] Continuous 5-destination patrol started.", 'log-success');
        triggerDestination(tourOrder[0]);
      } else {
        btnAutoTour.classList.remove('active');
        btnAutoTour.innerText = "🎲 Auto Tour";
        logEvent("[AUTO TOUR] Patrol tour halted.", 'log-highlight');
      }
    });
  }

  // Return to dock
  const btnDock = document.getElementById('btn-dock-reception');
  if (btnDock) {
    btnDock.addEventListener('click', () => {
      triggerDestination('RECEPTION');
    });
  }

  // Clear trail & obstacles
  const btnClearTrail = document.getElementById('btn-clear-trail');
  if (btnClearTrail) {
    btnClearTrail.addEventListener('click', () => {
      robot.trail = [];
      obstacles = [];
      logEvent("[VIEW RESET] Cleared breadcrumbs and dynamic obstacles.", 'log-highlight');
    });
  }

  // Sound toggle
  const btnSound = document.getElementById('btn-toggle-sound');
  const soundIcon = document.getElementById('sound-icon');
  if (btnSound) {
    btnSound.addEventListener('click', () => {
      robot.soundEnabled = !robot.soundEnabled;
      soundIcon.innerText = robot.soundEnabled ? "🔊 Sound ON" : "🔇 Sound OFF";
    });
  }

  // Emergency stop header button
  const btnEmergency = document.getElementById('btn-emergency-stop');
  if (btnEmergency) {
    btnEmergency.addEventListener('click', emergencyStop);
  }

  // Clear terminal log
  const btnClearLog = document.getElementById('btn-clear-log');
  if (btnClearLog) {
    btnClearLog.addEventListener('click', () => {
      const term = document.getElementById('sim-terminal-body');
      if (term) term.innerHTML = '';
    });
  }

  /* ==========================================================================
     13. BACKEND SERVER STATE POLLING (BIDIRECTIONAL SYNC)
     ========================================================================== */
  async function pollServerStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.status === 'success' && data.robot_state) {
        const state = data.robot_state;
        // If an external script (e.g. curbo_live.py) changed destination, drive robot!
        if (state.destination_key && state.destination_key !== robot.currentDestinationKey && state.status === 'NAVIGATING') {
          if (DEST_CONFIG[state.destination_key]) {
            logEvent(`[EXTERNAL DISPATCH] Received server goal: ${state.destination_key}`, 'log-highlight');
            triggerDestination(state.destination_key);
          }
        }
      }
    } catch (e) {
      // Backend offline or polling
    }
  }
  setInterval(pollServerStatus, 2500);

  /* ==========================================================================
     14. CAMPUS KIOSK DIRECTORY TAB (25 LOCATIONS, CATEGORIES & SEARCH)
     ========================================================================== */
  const DEFAULT_25_DESTINATIONS = {
    // 1. Administration & Governance
    "PRINCIPAL_OFFICE": {
      canonical_name: "Principal's Office / Director Cabin",
      waypoint_id: "WP_ADMIN_PRINCIPAL_01",
      category: "Administration"
    },
    "DEAN_ACADEMICS": {
      canonical_name: "Dean Academics Office",
      waypoint_id: "WP_ADMIN_DEAN_02",
      category: "Administration"
    },
    "ACCOUNTS_SECTION": {
      canonical_name: "Accounts & Fee Counter",
      waypoint_id: "WP_ADMIN_ACCOUNTS_03",
      category: "Administration"
    },
    "EXAM_CELL": {
      canonical_name: "Exam Cell / Controller of Examinations",
      waypoint_id: "WP_ADMIN_EXAM_04",
      category: "Administration"
    },
    "HR_OFFICE": {
      canonical_name: "HR & Administrative Block",
      waypoint_id: "WP_ADMIN_HR_05",
      category: "Administration"
    },
    "RECEPTION": {
      canonical_name: "Reception & Base Dock",
      waypoint_id: "WP_ADMIN_RECEPTION_06",
      category: "Administration"
    },

    // 2. Academic Departments & Labs
    "CSE_DEPARTMENT": {
      canonical_name: "Computer Science & Engineering (CSE)",
      waypoint_id: "WP_DEPT_CSE_01",
      category: "Academic Departments"
    },
    "ECE_DEPARTMENT": {
      canonical_name: "Electronics & Communication (ECE)",
      waypoint_id: "WP_DEPT_ECE_02",
      category: "Academic Departments"
    },
    "EEE_DEPARTMENT": {
      canonical_name: "Electrical & Electronics (EEE)",
      waypoint_id: "WP_DEPT_EEE_03",
      category: "Academic Departments"
    },
    "MECH_DEPARTMENT": {
      canonical_name: "Mechanical Engineering",
      waypoint_id: "WP_DEPT_MECH_04",
      category: "Academic Departments"
    },
    "CIVIL_DEPARTMENT": {
      canonical_name: "Civil Engineering",
      waypoint_id: "WP_DEPT_CIVIL_05",
      category: "Academic Departments"
    },
    "AIML_DEPARTMENT": {
      canonical_name: "AI & Data Science (AIML/AIDS)",
      waypoint_id: "WP_DEPT_AIML_06",
      category: "Academic Departments"
    },
    "HOD_OFFICE": {
      canonical_name: "HOD Cabin / Department Head",
      waypoint_id: "WP_DEPT_HOD_07",
      category: "Academic Departments"
    },
    "MY_OFFICE": {
      canonical_name: "Faculty & Staff Room",
      waypoint_id: "WP_DEPT_FACULTY_08",
      category: "Academic Departments"
    },
    "CENTRAL_COMPUTING_FACILITY": {
      canonical_name: "Central Computing Facility (CCF)",
      waypoint_id: "WP_LAB_CCF_01",
      category: "Academic Departments"
    },
    "IOT_ROBOTICS_LAB": {
      canonical_name: "IoT & Robotics Lab",
      waypoint_id: "WP_LAB_ROBOTICS_02",
      category: "Academic Departments"
    },
    "VLSI_HARDWARE_LAB": {
      canonical_name: "VLSI & Digital Electronics Lab",
      waypoint_id: "WP_LAB_VLSI_03",
      category: "Academic Departments"
    },
    "MECHANICAL_WORKSHOP": {
      canonical_name: "Mechanical Workshop & CAD Lab",
      waypoint_id: "WP_LAB_WORKSHOP_04",
      category: "Academic Departments"
    },
    "PHYSICS_CHEMISTRY_LAB": {
      canonical_name: "Physics & Chemistry Labs",
      waypoint_id: "WP_LAB_SCI_05",
      category: "Academic Departments"
    },

    // 3. Facilities & Student Amenities
    "LIBRARY": {
      canonical_name: "Central Library & Digital Reading Room",
      waypoint_id: "WP_FACILITY_LIB_01",
      category: "Facilities & Amenities"
    },
    "PLACEMENT_CELL": {
      canonical_name: "Training & Placement (T&P) Cell",
      waypoint_id: "WP_FACILITY_TPO_02",
      category: "Facilities & Amenities"
    },
    "AUDITORIUM": {
      canonical_name: "Main Auditorium",
      waypoint_id: "WP_FACILITY_AUDI_03",
      category: "Facilities & Amenities"
    },
    "SEMINAR_HALL": {
      canonical_name: "Seminar Hall & Conference Room",
      waypoint_id: "WP_FACILITY_SEMINAR_04",
      category: "Facilities & Amenities"
    },
    "STATIONERY_XEROX": {
      canonical_name: "Stationery & Photocopy Shop",
      waypoint_id: "WP_FACILITY_XEROX_05",
      category: "Facilities & Amenities"
    },
    "INFIRMARY_MEDICAL": {
      canonical_name: "First Aid & Medical Dispensary",
      waypoint_id: "WP_FACILITY_MED_06",
      category: "Facilities & Amenities"
    },
    "RESTROOMS": {
      canonical_name: "Campus Restrooms & Washrooms",
      waypoint_id: "WP_FACILITY_WASHROOM_07",
      category: "Facilities & Amenities"
    },
    "CAFETERIA": {
      canonical_name: "Cafeteria & Lounge",
      waypoint_id: "WP_AMENITY_CANTEEN_01",
      category: "Facilities & Amenities"
    },
    "SPORTS_COMPLEX": {
      canonical_name: "Sports Complex & Gymnasium",
      waypoint_id: "WP_AMENITY_SPORTS_02",
      category: "Facilities & Amenities"
    },
    "HOSTELS": {
      canonical_name: "Campus Hostels",
      waypoint_id: "WP_AMENITY_HOSTEL_03",
      category: "Facilities & Amenities"
    },
    "SECURITY_MAIN_GATE": {
      canonical_name: "Main Gate & Security Desk",
      waypoint_id: "WP_AMENITY_SECURITY_04",
      category: "Facilities & Amenities"
    }
  };

  const SIM_FALLBACK_MAP = {
    // Administration wing -> Reception or Exam Cell
    'PRINCIPAL_OFFICE': 'RECEPTION',
    'DEAN_ACADEMICS': 'RECEPTION',
    'ACCOUNTS_SECTION': 'EXAM_CELL',
    'HR_OFFICE': 'RECEPTION',

    // Academic & Engineering wing -> CSE_DEPARTMENT or LIBRARY
    'ECE_DEPARTMENT': 'CSE_DEPARTMENT',
    'EEE_DEPARTMENT': 'CSE_DEPARTMENT',
    'MECH_DEPARTMENT': 'CSE_DEPARTMENT',
    'CIVIL_DEPARTMENT': 'CSE_DEPARTMENT',
    'AIML_DEPARTMENT': 'CSE_DEPARTMENT',
    'HOD_OFFICE': 'CSE_DEPARTMENT',
    'MY_OFFICE': 'CSE_DEPARTMENT',
    'CENTRAL_COMPUTING_FACILITY': 'CSE_DEPARTMENT',
    'IOT_ROBOTICS_LAB': 'CSE_DEPARTMENT',
    'VLSI_HARDWARE_LAB': 'CSE_DEPARTMENT',
    'MECHANICAL_WORKSHOP': 'CSE_DEPARTMENT',
    'PHYSICS_CHEMISTRY_LAB': 'LIBRARY',

    // Facilities & Amenities -> LIBRARY or CAFETERIA
    'PLACEMENT_CELL': 'LIBRARY',
    'AUDITORIUM': 'CAFETERIA',
    'SEMINAR_HALL': 'LIBRARY',
    'STATIONERY_XEROX': 'CAFETERIA',
    'INFIRMARY_MEDICAL': 'RECEPTION',
    'RESTROOMS': 'CAFETERIA',
    'SPORTS_COMPLEX': 'CAFETERIA',
    'HOSTELS': 'CAFETERIA',
    'SECURITY_MAIN_GATE': 'RECEPTION'
  };

  let kioskDestinations = { ...DEFAULT_25_DESTINATIONS };
  let currentCategory = 'ALL';
  let currentSearchQuery = '';

  function classifyCategory(key, item) {
    if (item.category) return item.category;
    const wp = item.waypoint_id || '';
    if (wp.includes('ADMIN') || ['PRINCIPAL_OFFICE', 'DEAN_ACADEMICS', 'ACCOUNTS_SECTION', 'EXAM_CELL', 'HR_OFFICE', 'RECEPTION'].includes(key)) {
      return 'Administration';
    } else if (wp.includes('DEPT') || wp.includes('LAB') || wp.includes('WORKSHOP') || wp.includes('SCI') || key.endsWith('_DEPARTMENT')) {
      return 'Academic Departments';
    } else {
      return 'Facilities & Amenities';
    }
  }

  function getCategoryIcon(cat, key) {
    if (cat === 'Administration') return '🏛️';
    if (cat === 'Academic Departments') {
      if (key.includes('LAB') || key.includes('WORKSHOP') || key.includes('CCF')) return '🔬';
      return '🎓';
    }
    if (key.includes('LIB')) return '📚';
    if (key.includes('CANTEEN') || key.includes('CAFE')) return '☕';
    if (key.includes('SPORTS')) return '🏅';
    if (key.includes('MED')) return '🩺';
    if (key.includes('XEROX')) return '🖨️';
    if (key.includes('AUDI') || key.includes('SEMINAR')) return '🎤';
    return '📍';
  }

  async function fetchKioskDestinations() {
    try {
      const res = await fetch('/api/destinations');
      const data = await res.json();
      if (data.status === 'success' && data.raw_destinations) {
        // Merge server destinations
        for (const [key, d] of Object.entries(data.raw_destinations)) {
          kioskDestinations[key] = {
            canonical_name: d.canonical_name,
            waypoint_id: d.waypoint_id,
            category: classifyCategory(key, d),
            aliases: d.aliases,
            confirmation_msg: d.confirmation_msg
          };
        }
      }
    } catch (e) {
      console.warn("Using local kiosk destination catalog:", e);
    }
    applyKioskFilters();
  }

  function renderKioskGrid(destMap) {
    const grid = document.getElementById('destination-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const entries = Object.entries(destMap);
    if (entries.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 36px 20px; text-align: center; color: var(--text-muted); background: #FFFFFF; border: 1px dashed var(--border-light); border-radius: var(--radius-md);">
          <div style="font-size: 28px; margin-bottom: 8px;">🔍</div>
          <h4 style="font-size: 15px; color: var(--text-main); margin-bottom: 4px;">No campus locations match your filter</h4>
          <p style="font-size: 13px;">Try searching for "Library", "Exam", "CSE", or select "All Locations".</p>
        </div>
      `;
      return;
    }

    for (const [key, data] of entries) {
      const cat = classifyCategory(key, data);
      const icon = getCategoryIcon(cat, key);
      const isCurrentActive = robot.currentDestinationKey === key;

      const card = document.createElement('div');
      card.className = `dest-card ${isCurrentActive ? 'selected' : ''}`;
      card.setAttribute('data-key', key);

      card.innerHTML = `
        <div class="dest-card-header">
          <div class="dest-icon-badge">${icon}</div>
          <span class="dest-category-tag">${cat}</span>
        </div>
        <div class="dest-title">${data.canonical_name}</div>
        <div class="dest-waypoint-row">
          <span class="waypoint-badge">${data.waypoint_id}</span>
        </div>
        <div class="dest-action">
          <button type="button" class="btn-card-action">
            <span>Navigate to Location</span>
            <span style="font-size:13px;">➔</span>
          </button>
        </div>
      `;

      card.addEventListener('click', () => {
        // Update active selection styling
        document.querySelectorAll('.dest-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        // Update assistant sidebar immediately
        if (activeTargetText) activeTargetText.innerText = data.canonical_name;
        if (activeWaypointText) activeWaypointText.innerText = data.waypoint_id;
        if (lastTimeEl) lastTimeEl.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (curboNotice) {
          const content = curboNotice.querySelector('.notice-content');
          if (content) {
            content.innerText = `Dispatching Curbo towards ${data.canonical_name}. Switching to live 2D arena.`;
          }
        }

        logEvent(`[KIOSK DISPATCH] Selected location: ${data.canonical_name} (${data.waypoint_id})`, 'log-success');

        // Switch to simulation view
        if (tabSimView) tabSimView.click();

        // Dispatch simulator
        if (DEST_CONFIG[key]) {
          triggerDestination(key);
        } else {
          // Route to nearest simulated wing
          const fallbackWingKey = SIM_FALLBACK_MAP[key] || 'RECEPTION';
          triggerDestination(fallbackWingKey);

          // Override HUD destination title with clicked canonical name
          setTimeout(() => {
            if (hudDest) hudDest.innerText = data.canonical_name;
            if (activeTargetText) activeTargetText.innerText = data.canonical_name;
            if (activeWaypointText) activeWaypointText.innerText = data.waypoint_id;
          }, 50);
        }
      });

      grid.appendChild(card);
    }
  }

  function applyKioskFilters() {
    const filtered = {};
    const totalCount = Object.keys(kioskDestinations).length;

    for (const [k, v] of Object.entries(kioskDestinations)) {
      const cat = classifyCategory(k, v);
      const matchesCategory = (currentCategory === 'ALL' || cat.toLowerCase() === currentCategory.toLowerCase());
      
      const q = currentSearchQuery;
      const matchesQuery = !q || 
        v.canonical_name.toLowerCase().includes(q) || 
        v.waypoint_id.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q);

      if (matchesCategory && matchesQuery) {
        filtered[k] = v;
      }
    }

    renderKioskGrid(filtered);

    // Update count badge
    const countBadge = document.getElementById('waypoint-count-badge');
    const filteredCount = Object.keys(filtered).length;
    if (countBadge) {
      if (currentCategory === 'ALL' && !currentSearchQuery) {
        countBadge.innerText = `${totalCount} Waypoints Available`;
      } else {
        countBadge.innerText = `Showing ${filteredCount} of ${totalCount} Waypoints`;
      }
    }
  }

  // Kiosk Search Input Listener
  const kioskSearch = document.getElementById('search-input');
  if (kioskSearch) {
    kioskSearch.addEventListener('input', () => {
      currentSearchQuery = kioskSearch.value.trim().toLowerCase();
      applyKioskFilters();
    });
  }

  // Kiosk Search Button
  const btnKioskSearch = document.getElementById('btn-kiosk-search');
  if (btnKioskSearch && kioskSearch) {
    btnKioskSearch.addEventListener('click', () => {
      currentSearchQuery = kioskSearch.value.trim().toLowerCase();
      applyKioskFilters();
    });
  }

  // Category Tabs Listener
  const categoryTabButtons = document.querySelectorAll('#category-tabs .tab-btn, #category-tabs .category-tab-btn');
  categoryTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryTabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.getAttribute('data-category') || 'ALL';
      applyKioskFilters();
    });
  });

  // Initial population of kiosk grid
  fetchKioskDestinations();

  // Initialize Speech Engine on load
  initSpeechEngine();
  logEvent("[STARTUP] System initialized. Ready for speech commands.", 'log-success');
});
