# Win It In A Minute

A split-screen gameshow scoring system by [Twisted Melon](https://twistedmelon.com), with real-time QLab integration via OSC.

Requires **Docker** and a **license key** to run.

---

## Quick Install

Make sure [Docker Desktop](https://www.docker.com/products/docker-desktop/) is running, then copy and paste into Terminal:

```bash
cd ~ && git clone https://github.com/TwistedMelonIO/win-it-in-a-minute.git && cd win-it-in-a-minute && ./install_license.sh
```

The script will guide you through:

1. Building and starting the Docker container
2. Retrieving your **Machine ID** (copied to clipboard)
3. Entering your **license key** (or skip and add later)

For the full setup guide, see [INSTALL.md](INSTALL.md).

## Reinstall / Update

Already installed? From inside the `win-it-in-a-minute` folder, copy and paste:

```bash
git pull && docker compose up -d --build
```

Or to do a full clean reinstall (re-downloads everything):

```bash
cd ~ && rm -rf win-it-in-a-minute && git clone https://github.com/TwistedMelonIO/win-it-in-a-minute.git && cd win-it-in-a-minute && ./install_license.sh
```

---

## Features

- Split-screen scoring UI (Red team vs Blue team)
- Large score displays, easy to read from a distance
- Real-time sync across multiple browser windows via WebSocket
- QLab 5 integration via OSC (sends score updates to text cues)
- Incoming OSC commands for remote score control
- Docker containerized deployment
- Keyboard shortcuts for fast scoring

## Usage

| | |
|---|---|
| **Web UI** | http://localhost:4000 |
| **Settings Panel** | Bottom of the web app |
| **OSC Output** | Sends to QLab on port 53000 |
| **OSC Input** | Listens on port 3001 (UDP) |

### Keyboard Shortcuts

| Key | Action |
|---|---|
| `Q` | Red team +1 |
| `A` | Red team -1 |
| `P` | Blue team +1 |
| `L` | Blue team -1 |
| `Shift+R` | Reset all scores |

### Incoming OSC Commands (Port 3001 UDP)

| Command | Action |
|---|---|
| `/wiiam/red/up` | Red team +1 |
| `/wiiam/red/down` | Red team -1 |
| `/wiiam/blue/up` | Blue team +1 |
| `/wiiam/blue/down` | Blue team -1 |
| `/wiiam/reset/red` | Reset red to 0 |
| `/wiiam/reset/blue` | Reset blue to 0 |
| `/wiiam/reset` | Reset all scores |

### Outgoing OSC (to QLab)

Create two text cues in QLab named `REDSCORE` and `BLUESCORE`. The app sends:

```
/cue/REDSCORE/text "{score}"
/cue/BLUESCORE/text "{score}"
```

## Uninstall

To completely remove Win It In A Minute from a machine (containers, images, volumes, and project files):

```bash
./uninstall.sh
```

You will be asked to type `YES` to confirm. This cannot be undone.

## Docker Commands

| Task | Command |
|---|---|
| Rebuild after an update | `docker compose up -d --build` |
| Stop | `docker compose stop` |
| View logs | `docker compose logs -f win-it-in-a-minute` |

## Support

For license keys and technical support, contact [hello@twistedmelon.com](mailto:hello@twistedmelon.com).

---

*"Engineering the live experience." — Twisted Melon*
