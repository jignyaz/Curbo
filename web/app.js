/* ==========================================================================
   CURBO CAMPUS GUIDE ROBOT - NEXT-GEN FRONTEND SCRIPT
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

  // Map Waypoint to Key mapping for map clickability
  const waypointToKey = {
    'WP_ADMIN_RECEPTION_06': 'RECEPTION',
    'WP_ADMIN_EXAM_04': 'EXAM_CELL',
    'WP_DEPT_CSE_01': 'CSE_DEPARTMENT',
    'WP_ADMIN_HR_05': 'HR_OFFICE',
    'WP_FAC_CAFETERIA_01': 'MAIN_CAFETERIA',
    'WP_ADMIN_PRINCIPAL_01': 'PRINCIPAL_OFFICE'
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
     1. CYBER CONSTELLATION ANIMATED CANVAS BACKGROUND
     ========================================================================== */
  function initAnimatedBackground() {
    const canvas = document.getElementById('animated-bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    let mouse = { x: width / 2, y: height / 2 };

    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles();
    });

    let particles = [];
    const particleCount = Math.min(Math.floor(width * 0.04), 60);

    function initParticles() {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: Math.random() * 2 + 1,
          alpha: Math.random() * 0.5 + 0.2
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      // Draw subtle ambient glow gradients
      const grad1 = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 450);
      grad1.addColorStop(0, 'rgba(56, 189, 248, 0.06)');
      grad1.addColorStop(0.5, 'rgba(99, 102, 241, 0.03)');
      grad1.addColorStop(1, 'transparent');
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, width, height);

      // Render Particles & Constellation Lines
      for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${p.alpha})`;
        ctx.fill();

        // Connect nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          let p2 = particles[j];
          let dx = p.x - p2.x;
          let dy = p.y - p2.y;
          let dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.15 * (1 - dist / 130)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(draw);
    }

    initParticles();
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
      destinationGrid.innerHTML = '<div style="grid-column: 1/-1; padding:30px; text-align:center; color:var(--accent-rose);">⚠️ Connection to Curbo server failed. Ensure server.py is running.</div>';
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
        <div style="grid-column: 1/-1; padding: 48px; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-glass);">
          <div style="font-size: 32px; margin-bottom: 12px;">🔍</div>
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
        <div class="dest-card-header">
          <div class="dest-icon">${icon}</div>
          <div class="dest-waypoint">${item.waypoint_id}</div>
        </div>
        <div class="dest-title">${item.canonical_name}</div>
        <div class="dest-action">
          <span>Navigate Here</span>
          <span style="font-size:14px;">➔</span>
        </div>
      `;
      destinationGrid.appendChild(card);
    });
  }

  /* ==========================================================================
     3. DISPATCH NAVIGATION GOAL
     ========================================================================== */
  async function dispatchNavigation(destKey, queryText = null) {
    curboNotice.innerHTML = `
      <div class="notice-icon">⏳</div>
      <div class="notice-content">Dispatching navigation command to Curbo AI...</div>
    `;
    
    try {
      const payload = destKey ? { destination_key: destKey } : { query: queryText };
      const res = await fetch('/api/navigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.status === 'success') {
        curboNotice.innerHTML = `
          <div class="notice-icon">✅</div>
          <div class="notice-content">
            <strong style="color:var(--accent-cyan);">${data.destination}</strong><br>
            ${data.message}
          </div>
        `;
        activeTargetText.innerText = data.destination;
        activeWaypointText.innerText = data.waypoint_id || '--';
        
        // Speak using Browser Speech Synthesis if supported
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(data.message);
          utter.rate = 1.0;
          utter.pitch = 1.0;
          window.speechSynthesis.speak(utter);
        }

        updateStatusUI(data.robot_state);
      } else {
        curboNotice.innerHTML = `
          <div class="notice-icon">⚠️</div>
          <div class="notice-content">${data.message}</div>
        `;
      }
    } catch (err) {
      console.error('Error dispatching navigation:', err);
      curboNotice.innerHTML = `
        <div class="notice-icon">❌</div>
        <div class="notice-content">Could not connect to robot backend server.</div>
      `;
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
        curboNotice.innerHTML = `
          <div class="notice-icon">🛑</div>
          <div class="notice-content">
            <strong style="color:var(--accent-rose);">Emergency Stop Triggered</strong><br>
            ${data.message}
          </div>
        `;
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance("Robot navigation stopped.");
          window.speechSynthesis.speak(utter);
        }
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
      btnMic.innerHTML = '🔴';
      searchInput.placeholder = 'Listening... Speak your destination...';
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
    btnMic.innerHTML = '<span class="mic-icon">🎤</span>';
    searchInput.placeholder = "Type a location or ask a question ('Exam Cell', 'Where is Principal office?')...";
  }

  /* ==========================================================================
     7. MAP NODE CLICK EVENT LISTENERS
     ========================================================================== */
  function initMapNodeClicks() {
    document.querySelectorAll('.node').forEach(node => {
      node.addEventListener('click', () => {
        const id = node.id.replace('node-', '');
        const key = waypointToKey[id];
        if (key) {
          dispatchNavigation(key);
        }
      });
    });
  }

  /* ==========================================================================
     8. EVENT LISTENERS & INIT
     ========================================================================== */
  initAnimatedBackground();
  fetchDestinations();
  initSpeechRecognition();
  initMapNodeClicks();
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

  // Quick Suggestion Chips click
  document.querySelectorAll('.chip-btn').forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-query');
      if (q) {
        searchInput.value = q;
        renderGrid();
        dispatchNavigation(null, q);
      }
    });
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
    const tabBtn = e.target.closest('.tab-btn');
    if (tabBtn) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      currentCategory = tabBtn.getAttribute('data-category');
      renderGrid();
    }
  });
});
