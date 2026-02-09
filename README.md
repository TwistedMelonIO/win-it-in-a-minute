# Win It In A Minute

A scoring web application with OSC integration for QLab text cue updates.

## Features

- **Split-screen scoring UI** - Red team on left, Blue team on right
- **Large score displays** - Easy to read from a distance
- **+/- buttons** - Increment or decrement scores
- **Real-time sync** - Multiple browser windows stay in sync via WebSocket
- **OSC to QLab** - Automatically sends score updates to a QLab text cue

## Setup

### Option 1: Docker (Recommended)

```bash
docker compose up -d
```

Or build and run manually:
```bash
docker build -t win-it-in-a-minute .
docker run -d --name win-it-in-a-minute --network host win-it-in-a-minute
```

### Option 2: Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

Open http://localhost:3000 in your browser

## QLab Configuration

- The app sends OSC messages to `127.0.0.1:53000` (QLab's default OSC port)
- Create a Text cue in QLab and note its cue number
- Enter the cue number in the settings panel at the bottom of the web app
- Score updates will be sent as: `/cue/{cue_number}/text "X - Y"`

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Q | Red team +1 |
| A | Red team -1 |
| P | Blue team +1 |
| L | Blue team -1 |
| Shift+R | Reset scores |

## OSC Message Format

The app sends OSC messages in the format:
```
/cue/{cue_number}/text "{redScore} - {blueScore}"
```

For example, with cue number "1" and scores Red: 3, Blue: 2:
```
/cue/1/text "3 - 2"
```
