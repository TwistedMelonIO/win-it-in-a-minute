// WebSocket connection with auto-reconnect
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}`;
let ws = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 5000;

function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  try {
    ws = new WebSocket(wsUrl);
  } catch (e) {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log('WebSocket connected');
    reconnectDelay = 1000;
    // Server sends current state automatically on connection (server.js line 309)
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'state') {
      updateDisplay(msg.data);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    scheduleReconnect();
  };

  ws.onerror = () => {
    // onclose will fire after onerror, so reconnect happens there
  };
}

function scheduleReconnect() {
  setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
    connectWebSocket();
  }, reconnectDelay);
}

// Reconnect when iPad Safari resumes the tab
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reconnectDelay = 1000;
      connectWebSocket();
    }
  }
});

connectWebSocket();

// Local score state
let localState = { redScore: 0, blueScore: 0 };

// DOM elements
const redScoreEl = document.getElementById('red-score');
const blueScoreEl = document.getElementById('blue-score');
const scoreBtns = document.querySelectorAll('.score-btn');

// Update display
function updateDisplay(state) {
  localState.redScore = state.redScore;
  localState.blueScore = state.blueScore;
  redScoreEl.textContent = state.redScore;
  blueScoreEl.textContent = state.blueScore;
}

// Send message to server
async function send(message) {
  console.log('Sending message:', message);
  
  // Try WebSocket first
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    return;
  }
  
  // Fallback to HTTP if WebSocket not ready
  console.log('WebSocket not ready, using HTTP fallback');
  try {
    let endpoint;
    switch (message.type) {
      case 'updateScore':
        endpoint = '/api/update-score';
        break;
      case 'reset':
        endpoint = '/api/reset';
        break;
      default:
        console.error('Unknown message type:', message.type);
        return;
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('HTTP response:', result);
      // Update local display
      if (result.state) {
        updateDisplay(result.state);
      }
    } else {
      console.error('HTTP error:', response.status);
    }
  } catch (error) {
    console.error('HTTP fallback error:', error);
  }
}

// Score button handlers
scoreBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const team = btn.dataset.team;
    const delta = parseInt(btn.dataset.delta, 10);
    // Optimistic local update
    if (team === 'red') {
      localState.redScore = Math.max(0, localState.redScore + delta);
    } else if (team === 'blue') {
      localState.blueScore = Math.max(0, localState.blueScore + delta);
    }
    updateDisplay(localState);
    send({ type: 'updateScore', team, delta });
  });
});


// ── License gate ──────────────────────────────────────
let licenseConfirmedValid = false;

async function checkLicenseStatus() {
  try {
    const res = await fetch('/api/license_status');
    if (!res.ok) return;
    const data = await res.json();
    if (data && typeof data.valid === 'boolean') {
      updateLicenseGate(data);
    }
  } catch (e) {
    // Network failure — never show gate on network errors
    console.error('License check failed:', e);
  }
}

function updateLicenseGate(data) {
  const gate = document.getElementById('license-gate');
  const machineIdEl = document.getElementById('gate-machine-id');
  const errorEl = document.getElementById('gate-error');

  if (data.machine_id) machineIdEl.textContent = data.machine_id;

  if (data.valid) {
    licenseConfirmedValid = true;
    gate.classList.add('hidden');
  } else if (!licenseConfirmedValid) {
    // Only show gate if license has NEVER been confirmed valid
    gate.classList.remove('hidden');
    errorEl.textContent = data.error || 'License is not valid';
  }
  // If licenseConfirmedValid is true but data.valid is false, ignore — don't show gate
}

async function activateLicense() {
  const input = document.getElementById('gate-license-input');
  const btn = document.getElementById('gate-activate-btn');
  const status = document.getElementById('gate-activate-status');
  const key = input ? input.value.trim() : '';

  if (!key) {
    status.textContent = 'Please paste a license key first.';
    status.className = 'activate-status error';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Activating...';
  status.textContent = '';
  status.className = 'activate-status';

  try {
    const res = await fetch('/api/activate_license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: key })
    });
    const data = await res.json();

    if (data.valid) {
      status.textContent = 'License activated successfully!';
      status.className = 'activate-status success';
      licenseConfirmedValid = true;
      updateLicenseGate(data);
    } else {
      status.textContent = data.error || 'Invalid license key.';
      status.className = 'activate-status error';
    }
  } catch (e) {
    status.textContent = 'Failed to contact server. Please try again.';
    status.className = 'activate-status error';
  }

  btn.disabled = false;
  btn.textContent = 'Activate License';
}

function copyMachineId() {
  const mid = document.getElementById('gate-machine-id').textContent;
  if (!mid || mid === 'Loading...') return;

  const hint = document.getElementById('gate-copy-hint');

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(mid).then(() => {
      hint.textContent = 'Copied!';
      setTimeout(() => { hint.textContent = 'Click to copy'; }, 2000);
    }).catch(() => fallbackCopy(mid));
  } else {
    fallbackCopy(mid);
  }
}

function fallbackCopy(text) {
  const hint = document.getElementById('gate-copy-hint');
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const ok = document.execCommand('copy');
    hint.textContent = ok ? 'Copied!' : 'Copy failed - try manual copy';
  } catch (err) {
    hint.textContent = 'Copy failed - try manual copy';
  }
  document.body.removeChild(textArea);
  setTimeout(() => { hint.textContent = 'Click to copy'; }, 2000);
}

checkLicenseStatus();
setInterval(checkLicenseStatus, 30000);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ignore if typing in input
  if (e.target.tagName === 'INPUT') return;
  
  switch (e.key) {
    case 'q':
    case 'Q':
      // Red team +1
      localState.redScore = Math.max(0, localState.redScore + 1);
      updateDisplay(localState);
      send({ type: 'updateScore', team: 'red', delta: 1 });
      break;
    case 'a':
    case 'A':
      // Red team -1
      localState.redScore = Math.max(0, localState.redScore - 1);
      updateDisplay(localState);
      send({ type: 'updateScore', team: 'red', delta: -1 });
      break;
    case 'p':
    case 'P':
      // Blue team +1
      localState.blueScore = Math.max(0, localState.blueScore + 1);
      updateDisplay(localState);
      send({ type: 'updateScore', team: 'blue', delta: 1 });
      break;
    case 'l':
    case 'L':
      // Blue team -1
      localState.blueScore = Math.max(0, localState.blueScore - 1);
      updateDisplay(localState);
      send({ type: 'updateScore', team: 'blue', delta: -1 });
      break;
    case 'r':
    case 'R':
      // Reset (with Shift)
      if (e.shiftKey) {
        localState.redScore = 0;
        localState.blueScore = 0;
        updateDisplay(localState);
        send({ type: 'reset' });
      }
      break;
  }
});
