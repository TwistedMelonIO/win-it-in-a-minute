// WebSocket connection
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}`);

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

// WebSocket event handlers
ws.onopen = () => {
  console.log('WebSocket connected to:', `${protocol}//${window.location.host}`);
};

ws.onmessage = (event) => {
  console.log('WebSocket received:', event.data);
  const msg = JSON.parse(event.data);
  if (msg.type === 'state') {
    updateDisplay(msg.data);
  }
};

ws.onclose = () => {
  console.log('WebSocket disconnected');
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

// Send message to server
async function send(message) {
  console.log('Sending message:', message);
  
  // Try WebSocket first
  if (ws.readyState === WebSocket.OPEN) {
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
async function checkLicenseStatus() {
  try {
    const res = await fetch('/api/license_status');
    const data = await res.json();
    updateLicenseGate(data);
  } catch (e) {
    console.error('License check failed:', e);
  }
}

function updateLicenseGate(data) {
  const gate = document.getElementById('license-gate');
  const machineIdEl = document.getElementById('gate-machine-id');
  const errorEl = document.getElementById('gate-error');

  if (data.machine_id) machineIdEl.textContent = data.machine_id;

  if (data.valid) {
    gate.classList.add('hidden');
  } else {
    gate.classList.remove('hidden');
    errorEl.textContent = data.error || 'License is not valid';
  }
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
