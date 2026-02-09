const express = require('express');
const { Client } = require('node-osc');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = 3000;

// QLab OSC settings - default QLab listens on port 53000
// Use host.docker.internal when running in Docker on macOS
const QLAB_HOST = process.env.QLAB_HOST || 'host.docker.internal';
const QLAB_PORT = parseInt(process.env.QLAB_PORT) || 53000;

// Create OSC client for QLab
const oscClient = new Client(QLAB_HOST, QLAB_PORT);

// Game state
let gameState = {
  redScore: 0,
  blueScore: 0,
  textCueNumber: '1' // Default text cue number in QLab
};

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

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`Win It In A Minute server running at http://localhost:${PORT}`);
  console.log(`OSC sending to QLab at ${QLAB_HOST}:${QLAB_PORT}`);
});

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ server });

// Broadcast to all connected clients
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  oscClient.close();
  server.close();
  process.exit(0);
});
