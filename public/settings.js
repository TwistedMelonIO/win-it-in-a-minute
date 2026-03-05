// ── Passcode Logic ──────────────────────────────────────
const CORRECT_PASSCODE = '8888';
let enteredDigits = [];

const passcodeScreen = document.getElementById('passcode-screen');
const settingsPanel = document.getElementById('settings-panel');
const passcodeError = document.getElementById('passcode-error');
const dots = [
  document.getElementById('dot-0'),
  document.getElementById('dot-1'),
  document.getElementById('dot-2'),
  document.getElementById('dot-3')
];

function updateDots() {
  dots.forEach((dot, i) => {
    if (i < enteredDigits.length) {
      dot.classList.add('filled');
    } else {
      dot.classList.remove('filled');
    }
  });
}

function checkPasscode() {
  const code = enteredDigits.join('');
  if (code === CORRECT_PASSCODE) {
    passcodeScreen.classList.add('hidden');
    settingsPanel.classList.remove('hidden');
    loadLicenseStatus();
    loadLogs();
  } else {
    // Wrong passcode — shake + reset
    const dotsContainer = document.querySelector('.passcode-dots');
    dotsContainer.classList.add('shake');
    passcodeError.textContent = 'Incorrect passcode';

    setTimeout(() => {
      dotsContainer.classList.remove('shake');
      enteredDigits = [];
      updateDots();
    }, 500);

    setTimeout(() => {
      passcodeError.textContent = '';
    }, 2000);
  }
}

// Number pad button handlers
document.querySelectorAll('.numpad-btn[data-num]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (enteredDigits.length >= 4) return;
    enteredDigits.push(btn.dataset.num);
    updateDots();

    if (enteredDigits.length === 4) {
      setTimeout(checkPasscode, 150);
    }
  });
});

// Delete button
document.getElementById('numpad-delete').addEventListener('click', () => {
  if (enteredDigits.length > 0) {
    enteredDigits.pop();
    updateDots();
  }
});

// Keyboard support for passcode
document.addEventListener('keydown', (e) => {
  if (!passcodeScreen.classList.contains('hidden')) {
    if (e.key >= '0' && e.key <= '9' && enteredDigits.length < 4) {
      enteredDigits.push(e.key);
      updateDots();
      if (enteredDigits.length === 4) {
        setTimeout(checkPasscode, 150);
      }
    } else if (e.key === 'Backspace') {
      if (enteredDigits.length > 0) {
        enteredDigits.pop();
        updateDots();
      }
    }
  }
});

// ── License Status ──────────────────────────────────────
async function loadLicenseStatus() {
  try {
    const res = await fetch('/api/license_status');
    const data = await res.json();

    const statusEl = document.getElementById('license-status');
    const machineIdEl = document.getElementById('license-machine-id');
    const expiryRow = document.getElementById('license-expiry-row');
    const expiryEl = document.getElementById('license-expiry');
    const errorRow = document.getElementById('license-error-row');
    const errorEl = document.getElementById('license-error');

    // Status
    if (data.valid) {
      statusEl.textContent = 'Active';
      statusEl.className = 'info-value status-valid';
    } else {
      statusEl.textContent = 'Invalid';
      statusEl.className = 'info-value status-invalid';
    }

    // Machine ID
    if (data.machine_id) {
      machineIdEl.textContent = data.machine_id;
    } else {
      machineIdEl.textContent = 'Unavailable';
    }

    // Expiry
    if (data.expiration) {
      expiryRow.style.display = 'flex';
      try {
        const d = new Date(data.expiration);
        expiryEl.textContent = d.toLocaleDateString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric'
        });
      } catch {
        expiryEl.textContent = data.expiration;
      }
    } else if (data.valid) {
      expiryRow.style.display = 'flex';
      expiryEl.textContent = 'Never';
    }

    // Error
    if (!data.valid && data.error) {
      errorRow.style.display = 'flex';
      errorEl.textContent = data.error;
    } else {
      errorRow.style.display = 'none';
    }

    // Update footer license status
    updateFooterLicenseStatus(data);

  } catch (err) {
    console.error('Failed to load license status:', err);
  }
}

// ── Update Footer License Status ──────────────────────
function updateFooterLicenseStatus(data) {
  const footerLicenseStatus = document.getElementById('footer-license-status');
  const footerLicensee = document.getElementById('footer-licensee');
  const footerLicenseExpiry = document.getElementById('footer-license-expiry');

  if (!footerLicenseStatus) return; // Footer might not exist in some pages

  // Status
  if (data.valid) {
    footerLicenseStatus.className = 'footer-license-item';
    footerLicenseStatus.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>
      <span>Valid License</span>
    `;
  } else {
    footerLicenseStatus.className = 'footer-license-item invalid';
    footerLicenseStatus.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>
      <span>Invalid License</span>
    `;
  }

  // Licensee
  if (footerLicensee) {
    if (data.licensee) {
      footerLicensee.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>${data.licensee}</span>
      `;
    } else {
      footerLicensee.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>Licensed User</span>
      `;
    }
  }

  // Expiry
  if (footerLicenseExpiry) {
    let expiryText = 'No expiry';
    if (data.expiration) {
      try {
        const d = new Date(data.expiration);
        expiryText = d.toLocaleDateString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric'
        });
      } catch {
        expiryText = data.expiration;
      }
    }
    footerLicenseExpiry.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
      <span>${expiryText}</span>
    `;
  }
}


// ── Logs ────────────────────────────────────────────────
async function loadLogs() {
  try {
    const res = await fetch('/api/logs');
    const data = await res.json();
    const container = document.getElementById('logs-container');

    if (!data.logs || data.logs.length === 0) {
      container.innerHTML = '<div class="log-placeholder">No logs yet</div>';
      return;
    }

    container.innerHTML = data.logs.map(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      return `<div class="log-entry">
        <span class="log-timestamp">${time}</span>
        <span class="log-level ${entry.level}">${entry.level}</span>
        <span class="log-message">${escapeHtml(entry.message)}</span>
      </div>`;
    }).join('');

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;

  } catch (err) {
    console.error('Failed to load logs:', err);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Refresh logs button
document.getElementById('refresh-logs-btn').addEventListener('click', () => {
  loadLogs();
});

// ── Master Reset ────────────────────────────────────────
const modalOverlay = document.getElementById('modal-overlay');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');

document.getElementById('master-reset-btn').addEventListener('click', () => {
  modalOverlay.classList.add('open');
});

modalCancel.addEventListener('click', () => {
  modalOverlay.classList.remove('open');
});

modalConfirm.addEventListener('click', async () => {
  modalOverlay.classList.remove('open');

  const btn = document.getElementById('master-reset-btn');
  btn.disabled = true;
  btn.style.opacity = '0.5';

  try {
    const res = await fetch('/api/master_reset', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      // Reload logs to show reset
      await loadLogs();
    }
  } catch (err) {
    console.error('Master reset failed:', err);
  }

  btn.disabled = false;
  btn.style.opacity = '1';
});

// Close modal on background click
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    modalOverlay.classList.remove('open');
  }
});

// ── Copy helper ─────────────────────────────────────────
function copyText(el) {
  const text = el.textContent;
  if (!text || text === 'Loading...' || text === 'Unavailable') return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showCopyFeedback(el);
    }).catch(() => fallbackCopyText(text, el));
  } else {
    fallbackCopyText(text, el);
  }
}

function fallbackCopyText(text, el) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showCopyFeedback(el);
  } catch (err) {
    // silent fail
  }
  document.body.removeChild(textArea);
}

function showCopyFeedback(el) {
  const original = el.textContent;
  el.textContent = 'Copied!';
  el.style.color = '#00e676';
  setTimeout(() => {
    el.textContent = original;
    el.style.color = '';
  }, 1500);
}
