// WebSocket connection
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}`);

// DOM elements
const redScoreEl = document.getElementById('red-score');
const blueScoreEl = document.getElementById('blue-score');
const resetBtn = document.getElementById('reset-btn');
const scoreBtns = document.querySelectorAll('.score-btn');
const settingsCog = document.getElementById('settings-cog');
const settingsDropdown = document.getElementById('settings-dropdown');
const modalOverlay = document.getElementById('modal-overlay');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');

// Update display
function updateDisplay(state) {
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
    send({ type: 'updateScore', team, delta });
  });
});

// Settings cog toggle
settingsCog.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsDropdown.classList.toggle('open');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!settingsDropdown.contains(e.target) && !settingsCog.contains(e.target)) {
    settingsDropdown.classList.remove('open');
  }
});

// Modal functions
function openModal() {
  modalOverlay.classList.add('open');
  settingsDropdown.classList.remove('open');
}

function closeModal() {
  modalOverlay.classList.remove('open');
}

// Reset scores - show modal
resetBtn.addEventListener('click', () => {
  openModal();
});

// Modal cancel button
modalCancel.addEventListener('click', () => {
  closeModal();
});

// Modal confirm button
modalConfirm.addEventListener('click', () => {
  send({ type: 'reset' });
  closeModal();
});

// Close modal when clicking overlay background
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    closeModal();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ignore if typing in input
  if (e.target.tagName === 'INPUT') return;
  
  switch (e.key) {
    case 'q':
    case 'Q':
      // Red team +1
      send({ type: 'updateScore', team: 'red', delta: 1 });
      break;
    case 'a':
    case 'A':
      // Red team -1
      send({ type: 'updateScore', team: 'red', delta: -1 });
      break;
    case 'p':
    case 'P':
      // Blue team +1
      send({ type: 'updateScore', team: 'blue', delta: 1 });
      break;
    case 'l':
    case 'L':
      // Blue team -1
      send({ type: 'updateScore', team: 'blue', delta: -1 });
      break;
    case 'r':
    case 'R':
      // Reset (with Shift)
      if (e.shiftKey) {
        send({ type: 'reset' });
      }
      break;
  }
});
