/* ==========================================================================
   CURBO CAMPUS GUIDE ROBOT - FRONTEND APPLICATION SCRIPT
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  let allDestinations = {};
  let categories = {};
  let currentCategory = 'ALL';
  let isRecording = false;
  let recognition = null;

  // DOM Elements
  const destinationGrid = document.getElementById('destination-grid');
  const searchInput = document.getElementById('search-input');
  const btnSearch = document.getElementById('btn-search');
  const btnMic = document.getElementById('btn-mic');
  const btnStop = document.getElementById('btn-emergency-stop');
  const categoryTabs = document.getElementById('category-tabs');
  const curboNotice = document.getElementById('curbo-notice');
  const statusBadge = document.getElementById('robot-status-badge');
  const statusText = document.getElementById('status-text');
  const activeTargetText = document.getElementById('active-target-text');
  const activeWaypointText = document.getElementById('active-waypoint-text');
  const lastTime = document.getElementById('last-time');
  const curboRobotMarker = document.getElementById('curbo-map-robot');

  // Node Map Coordinates
  const nodeCoords = {
    'WP_ADMIN_RECEPTION_06': { x: 50, y: 190 },
    'WP_ADMIN_EXAM_04': { x: 120, y: 120 },
    'WP_DEPT_CSE_01': { x: 220, y: 120 },
    'WP_ADMIN_HR_05': { x: 220, y: 60 },
    'WP_FAC_CAFETERIA_01': { x: 340, y: 120 },
    'WP_ADMIN_PRINCIPAL_01': { x: 340, y: 60 },
    'WP_ADMIN_ACCOUNTS_03': { x: 120, y: 120 },
    'WP_ADMIN_DEAN_02': { x: 340, y: 60 }
  };

  // Icon Mappings for Destinations
  const iconMap = {
    'PRINCIPAL_OFFICE': '🏛️',
    'DEAN_ACADEMICS': '🎓',
    'ACCOUNTS_SECTION': '💳',
    'EXAM_CELL': '📝',
    'HR_OFFICE': '💼',
    'RECEPTION': 'ℹ️',
    'CSE_DEPARTMENT': '💻',
    'ECE_DEPARTMENT': '⚡',
    'EEE_DEPARTMENT': '🔌',
    'MECH_DEPARTMENT': '⚙️',
    'CIVIL_DEPARTMENT': '🏗️',
    'AIML_DEPARTMENT': '🧠',
    'MAIN_CAFETERIA': '☕',
    'CENTRAL_LIBRARY': '📚',
    'AUDITORIUM': '🎭'
  };

  /* ==========================================================================
     1. ANIMATED CANVAS BACKGROUND
     ========================================================================== */
  function initAnimatedBackground() {
    const canvas = document.getElementById('animated-bg');
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    let step = 0;
    function draw() {
      ctx.clearRect(0, 0, width, height);
      
      // Draw background gradient waves
      step += 0.008;

      ctx.beginPath();
      ctx.fillStyle = 'rgba(30, 86, 160, 0.04)';
      ctx.moveTo(0, height);
      for (let x = 0; x < width; x += 20) {
        let y = Math.sin(x * 0.003 + step) * 40 + height * 0.7;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.fill();

      ctx.beginPath();
      ctx.fillStyle = 'rgba(37, 99, 235, 0.03)';
      ctx.moveTo(0, height);
      for (let x = 0; x < width; x += 20) {
        let y = Math.cos(x * 0.004 + step * 1.5) * 50 + height * 0.75;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.fill();

      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ==========================================================================
     2. FETCH DESTINATIONS & RENDER TOUCH GRID
     ========================================================================== */
  async function fetchDestinations() {
    try {
      const res = await fetch('/api/destinations');
      const data = await res.json();
      if (data.status === 'success') {
        categories = data.categories;
        allDestinations = data.raw_destinations;
        renderGrid();
      }
    } catch (err) {
      console.error('Failed to load destinations:', err);
      destinationGrid.innerHTML = '<div style="padding:20px; color:var(--red-danger);">Failed to load destinations from server. Make sure server.py is running.</div>';
    }
  }

  function renderGrid() {
    destinationGrid.innerHTML = '';
    const searchTerm = searchInput.value.toLowerCase().trim();

    let itemsToRender = [];

    // Filter by Category & Search query
    Object.keys(categories).forEach(cat => {
      if (currentCategory === 'ALL' || currentCategory === cat) {
        categories[cat].forEach(item => {
          const matchTitle = item.canonical_name.toLowerCase().includes(searchTerm);
          const matchAlias = item.aliases.some(a => a.toLowerCase().includes(searchTerm));
          const matchWaypoint = item.waypoint_id.toLowerCase().includes(searchTerm);
          
          if (!searchTerm || matchTitle || matchAlias || matchWaypoint) {
            itemsToRender.push(item);
          }
        });
      }
    });

    if (itemsToRender.length === 0) {
      destinationGrid.innerHTML = `
        <div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: var(--border-radius);">
          No matching destinations found for "<strong>${searchTerm}</strong>".
        </div>
      `;
      return;
    }

    itemsToRender.forEach(item => {
      const icon = iconMap[item.key] || '📍';
      const card = document.createElement('div');
      card.className = 'dest-card';
      card.onclick = () => dispatchNavigation(item.key);

      card.innerHTML = `
        <div class="dest-icon">${icon}</div>
        <div class="dest-title">${item.canonical_name}</div>
        <div class="dest-waypoint">${item.waypoint_id}</div>
        <div class="dest-action">Navigate Here ➔</div>
      `;
      destinationGrid.appendChild(card);
    });
  }

  /* ==========================================================================
     3. DISPATCH NAVIGATION GOAL
     ========================================================================== */
  async function dispatchNavigation(destKey, queryText = null) {
    curboNotice.innerHTML = `⏳ Sending navigation goal to Curbo...`;
    
    try {
      const payload = destKey ? { destination_key: destKey } : { query: queryText };
      const res = await fetch('/api/navigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.status === 'success') {
        curboNotice.innerHTML = `✅ <strong>${data.destination}</strong><br>${data.message}`;
        activeTargetText.innerText = data.destination;
        activeWaypointText.innerText = data.waypoint_id || '--';
        
        // Speak using Browser Speech Synthesis if supported
        if ('speechSynthesis' in window) {
          const utter = new SpeechSynthesisUtterance(data.message);
          window.speechSynthesis.speak(utter);
        }

        updateStatusUI(data.robot_state);
      } else {
        curboNotice.innerHTML = `⚠️ ${data.message}`;
      }
    } catch (err) {
      console.error('Error dispatching navigation:', err);
      curboNotice.innerHTML = `❌ Connection error. Could not reach Curbo server.`;
    }
  }

  /* ==========================================================================
     4. EMERGENCY STOP
     ========================================================================== */
  async function emergencyStop() {
    try {
      const res = await fetch('/api/stop', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        curboNotice.innerHTML = `🛑 <strong>Navigation Stopped</strong><br>${data.message}`;
        updateStatusUI(data.robot_state);
      }
    } catch (err) {
      console.error('Failed to stop robot:', err);
    }
  }

  /* ==========================================================================
     5. STATUS POLLING & MAP MARKER UPDATES
     ========================================================================== */
  async function pollStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.status === 'success') {
        updateStatusUI(data.robot_state);
      }
    } catch (err) {
      // Server down or offline
    }
  }

  function updateStatusUI(state) {
    if (!state) return;

    statusText.innerText = state.status;
    statusBadge.className = `status-badge ${state.status.toLowerCase()}`;
    activeTargetText.innerText = state.active_destination || 'None';
    activeWaypointText.innerText = state.waypoint_id || '--';
    lastTime.innerText = state.last_command_time || '--:--';

    // Highlight map node and move robot marker
    const wayId = state.waypoint_id;
    document.querySelectorAll('.node').forEach(n => n.classList.remove('active'));

    if (wayId && nodeCoords[wayId]) {
      const nodeElem = document.getElementById(`node-${wayId}`);
      if (nodeElem) nodeElem.classList.add('active');

      const coord = nodeCoords[wayId];
      curboRobotMarker.setAttribute('transform', `translate(${coord.x}, ${coord.y})`);
    } else {
      // Default to Reception position
      curboRobotMarker.setAttribute('transform', `translate(50, 190)`);
    }
  }

  /* ==========================================================================
     6. SPEECH RECOGNITION (BROWSER MIC FALLBACK)
     ========================================================================== */
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      btnMic.style.display = 'none';
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isRecording = true;
      btnMic.classList.add('recording');
      btnMic.innerText = '🔴';
      searchInput.placeholder = 'Listening to your voice...';
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      searchInput.value = transcript;
      dispatchNavigation(null, transcript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      stopRecording();
    };

    recognition.onend = () => {
      stopRecording();
    };
  }

  function stopRecording() {
    isRecording = false;
    btnMic.classList.remove('recording');
    btnMic.innerText = '🎤';
    searchInput.placeholder = "Type destination or question (e.g. 'Exam Cell', 'Where is HR office?')...";
  }

  /* ==========================================================================
     7. EVENT LISTENERS & INIT
     ========================================================================== */
  initAnimatedBackground();
  fetchDestinations();
  initSpeechRecognition();
  setInterval(pollStatus, 2500);

  // Search input filter on typing
  searchInput.addEventListener('input', renderGrid);

  // Search button click
  btnSearch.addEventListener('click', () => {
    const val = searchInput.value.trim();
    if (val) dispatchNavigation(null, val);
  });

  // Enter key press in search box
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const val = searchInput.value.trim();
      if (val) dispatchNavigation(null, val);
    }
  });

  // Mic button click
  btnMic.addEventListener('click', () => {
    if (!recognition) return;
    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });

  // Emergency stop click
  btnStop.addEventListener('click', emergencyStop);

  // Category tab clicks
  categoryTabs.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentCategory = e.target.getAttribute('data-category');
      renderGrid();
    }
  });
});
