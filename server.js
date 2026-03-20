const express = require('express');
const { Client, Server: OscServer } = require('node-osc');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = 3000;

// QLab OSC settings - default QLab listens on port 53000
// Use host.docker.internal when running in Docker on macOS
const QLAB_HOST = process.env.QLAB_HOST || 'host.docker.internal';
const QLAB_PORT = parseInt(process.env.QLAB_PORT) || 53000;

// OSC listen port for incoming messages from QLab
const OSC_LISTEN_PORT = parseInt(process.env.OSC_LISTEN_PORT) || 3001;

// Create OSC client for QLab
const oscClient = new Client(QLAB_HOST, QLAB_PORT);

// Game state
let gameState = {
  redScore: 0,
  blueScore: 0,
  textCueNumber: '1' // Default text cue number in QLab
};

// ── License state ──────────────────────────────────────
let licenseState = {
  valid: false,
  error: 'License not yet checked',
  licensee: null,
  features: [],
  expiration: null,
  machine_id: null
};

// ── Application log buffer ─────────────────────────────
const MAX_LOG_LINES = 500;
let logBuffer = [];

function addLog(level, message) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message
  };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_LINES) {
    logBuffer = logBuffer.slice(-MAX_LOG_LINES);
  }
  // Also print to console
  console.log(`[${entry.level}] ${entry.message}`);
}

// ── License helpers ────────────────────────────────────
function runPythonScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [path.join(__dirname, scriptName), ...args]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0 || stdout.trim()) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `Process exited with code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

async function initializeLicense() {
  try {
    // Get machine ID
    const machineId = await runPythonScript('machine_id_simple.py');
    addLog('INFO', `Machine ID: ${machineId}`);

    // Validate license
    try {
      const output = await runPythonScript('license_validator_simple.py', [machineId]);
      licenseState = JSON.parse(output);
    } catch (err) {
      // The validator exits code 1 for invalid licenses but still outputs JSON
      try {
        licenseState = JSON.parse(err.message);
      } catch {
        licenseState = {
          valid: false,
          error: err.message || 'License validation failed',
          licensee: null,
          features: [],
          expiration: null,
          machine_id: machineId
        };
      }
    }

    // Ensure machine_id is always set
    if (!licenseState.machine_id) {
      licenseState.machine_id = machineId;
    }

    if (licenseState.valid) {
      addLog('INFO', 'License is VALID');
    } else {
      addLog('WARN', `License invalid: ${licenseState.error}`);
    }
  } catch (err) {
    addLog('ERROR', `License initialization error: ${err.message}`);
    licenseState = {
      valid: false,
      error: `License check error: ${err.message}`,
      licensee: null,
      features: [],
      expiration: null,
      machine_id: null
    };
  }
}

// CORS headers for mobile browsers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API endpoint to get current state
app.get('/api/state', (req, res) => {
  res.json(gameState);
});

// API endpoint to update scores (HTTP fallback)
app.post('/api/update-score', (req, res) => {
  const { team, delta } = req.body;
  if (team === 'red') {
    gameState.redScore = Math.max(0, gameState.redScore + delta);
  } else if (team === 'blue') {
    gameState.blueScore = Math.max(0, gameState.blueScore + delta);
  }
  
  // Broadcast updated state to all WebSocket clients
  broadcast({ type: 'state', data: gameState });
  
  // Send to QLab
  sendToQLab();
  
  res.json({ success: true, state: gameState });
});

// API endpoint to reset scores
app.post('/api/reset', (req, res) => {
  gameState.redScore = 0;
  gameState.blueScore = 0;
  
  // Broadcast updated state to all WebSocket clients
  broadcast({ type: 'state', data: gameState });
  
  // Send to QLab
  sendToQLab();
  
  res.json({ success: true, state: gameState });
});

// API endpoint to set text cue number
app.post('/api/cue-number', (req, res) => {
  const { cueNumber } = req.body;
  if (cueNumber) {
    gameState.textCueNumber = cueNumber;
    res.json({ success: true, cueNumber: gameState.textCueNumber });
  } else {
    res.status(400).json({ error: 'cueNumber required' });
  }
});

// ── License API endpoints ──────────────────────────────
app.get('/api/license_status', (req, res) => {
  res.json(licenseState);
});

app.post('/api/validate_license', async (req, res) => {
  await initializeLicense();
  res.json(licenseState);
});

// Activate license key via web UI
app.post('/api/activate_license', async (req, res) => {
  const { license_key } = req.body;
  if (!license_key || !license_key.trim()) {
    return res.status(400).json({ valid: false, error: 'No license key provided' });
  }

  const key = license_key.trim();

  // Set in current process environment
  process.env.LICENSE_KEY = key;

  // Persist to data directory so it survives container restarts
  const dataDir = '/app/data';
  try {
    if (fs.existsSync(dataDir)) {
      fs.writeFileSync(path.join(dataDir, 'license_key'), key, 'utf8');
      addLog('INFO', 'License key saved to persistent storage');
    }
  } catch (err) {
    addLog('ERROR', 'Failed to persist license key: ' + err.message);
  }

  // Re-validate with the new key
  await initializeLicense();
  res.json(licenseState);
});

// ── Logs API endpoint ──────────────────────────────────
app.get('/api/logs', (req, res) => {
  res.json({ logs: logBuffer });
});

// ── Master Reset API endpoint ──────────────────────────
app.post('/api/master_reset', (req, res) => {
  addLog('WARN', 'Master reset triggered');

  // Reset game state
  gameState.redScore = 0;
  gameState.blueScore = 0;
  gameState.textCueNumber = '1';

  // Broadcast reset to all WebSocket clients
  broadcast({ type: 'state', data: gameState });

  // Send reset to QLab
  sendToQLab();

  // Clear logs
  logBuffer = [];
  addLog('INFO', 'System reset complete');

  res.json({ success: true, message: 'Master reset complete' });
});

// Send score update to QLab via OSC
function sendToQLab() {
  // Send red score to REDSCORE cue
  // Using /cue/{cue_number}/text to set the text cue content
  const redAddress = '/cue/REDSCORE/text';
  oscClient.send(redAddress, String(gameState.redScore), (err) => {
    if (err) {
      console.error('OSC send error (REDSCORE):', err);
    } else {
      console.log(`OSC sent: ${redAddress} "${gameState.redScore}"`);
    }
  });
  
  // Send blue score to BLUESCORE cue
  const blueAddress = '/cue/BLUESCORE/text';
  oscClient.send(blueAddress, String(gameState.blueScore), (err) => {
    if (err) {
      console.error('OSC send error (BLUESCORE):', err);
    } else {
      console.log(`OSC sent: ${blueAddress} "${gameState.blueScore}"`);
    }
  });
}

// Broadcast to all connected WebSocket clients
let wss;

function broadcast(data) {
  if (!wss) return;
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Initialize license then start server
(async function boot() {
  addLog('INFO', 'Win It In A Minute server starting...');
  await initializeLicense();

  // Start HTTP server
  const server = app.listen(PORT, () => {
    addLog('INFO', `Server running at http://localhost:${PORT}`);
    addLog('INFO', `OSC sending to QLab at ${QLAB_HOST}:${QLAB_PORT}`);
  });

  // WebSocket server for real-time updates
  wss = new WebSocket.Server({ server });

  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    console.log('Client connected');
    
    // Send current state on connect
    ws.send(JSON.stringify({ type: 'state', data: gameState }));
    
    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message);
        
        switch (msg.type) {
          case 'updateScore':
            if (msg.team === 'red') {
              gameState.redScore = Math.max(0, gameState.redScore + msg.delta);
            } else if (msg.team === 'blue') {
              gameState.blueScore = Math.max(0, gameState.blueScore + msg.delta);
            }
            break;
            
          case 'setScore':
            if (msg.team === 'red') {
              gameState.redScore = Math.max(0, msg.value);
            } else if (msg.team === 'blue') {
              gameState.blueScore = Math.max(0, msg.value);
            }
            break;
            
          case 'reset':
            gameState.redScore = 0;
            gameState.blueScore = 0;
            break;
            
          case 'setCueNumber':
            gameState.textCueNumber = msg.cueNumber;
            break;
        }
        
        // Broadcast updated state to all clients
        broadcast({ type: 'state', data: gameState });
        
        // Send to QLab
        sendToQLab();
        
      } catch (err) {
        console.error('Message parse error:', err);
      }
    });
    
    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });

  // OSC server to receive messages from QLab (e.g. reset)
  const oscServer = new OscServer(OSC_LISTEN_PORT, '0.0.0.0');

  oscServer.on('listening', () => {
    console.log(`OSC server listening on port ${OSC_LISTEN_PORT}`);
    console.log('');
    console.log('=== Companion / QLab OSC Commands ===');
    console.log(`  /wiiam/red/up        → Red team +1`);
    console.log(`  /wiiam/red/down      → Red team -1`);
    console.log(`  /wiiam/blue/up       → Blue team +1`);
    console.log(`  /wiiam/blue/down     → Blue team -1`);
    console.log(`  /wiiam/reset         → Reset both teams`);
    console.log(`  /wiiam/reset/red     → Reset red team only`);
    console.log(`  /wiiam/reset/blue    → Reset blue team only`);
    console.log('=====================================');
  });

  oscServer.on('message', (msg) => {
    const address = msg[0];
    addLog('INFO', `OSC received: ${address}`);

    switch (address) {
      // ── Score adjustments ────────────────────────────
      case '/wiiam/red/up':
        gameState.redScore = gameState.redScore + 1;
        addLog('INFO', `[Companion] Red +1 → ${gameState.redScore}`);
        break;

      case '/wiiam/red/down':
        gameState.redScore = Math.max(0, gameState.redScore - 1);
        addLog('INFO', `[Companion] Red -1 → ${gameState.redScore}`);
        break;

      case '/wiiam/blue/up':
        gameState.blueScore = gameState.blueScore + 1;
        addLog('INFO', `[Companion] Blue +1 → ${gameState.blueScore}`);
        break;

      case '/wiiam/blue/down':
        gameState.blueScore = Math.max(0, gameState.blueScore - 1);
        addLog('INFO', `[Companion] Blue -1 → ${gameState.blueScore}`);
        break;

      // ── Resets ───────────────────────────────────────
      case '/wiiam/reset':
        gameState.redScore = 0;
        gameState.blueScore = 0;
        addLog('INFO', '[Companion] Both teams reset to 0');
        break;

      case '/wiiam/reset/red':
        gameState.redScore = 0;
        addLog('INFO', '[Companion] Red team reset to 0');
        break;

      case '/wiiam/reset/blue':
        gameState.blueScore = 0;
        addLog('INFO', '[Companion] Blue team reset to 0');
        break;

      default:
        addLog('WARN', `Unknown OSC address: ${address}`);
        return; // Don't broadcast for unknown commands
    }

    // Broadcast updated state and sync to QLab
    broadcast({ type: 'state', data: gameState });
    sendToQLab();
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    oscClient.close();
    oscServer.close();
    server.close();
    process.exit(0);
  });
})();
