# Win It In A Minute — Installation Guide

**Win It In A Minute** is a split-screen gameshow scoring system by Twisted Melon. It runs as a Docker application with a browser-based UI, real-time WebSocket sync across multiple windows, and OSC integration with QLab 5.

A valid license key is required to run the application.

---

## Prerequisites

- **macOS** — required for QLab integration
- **Docker Desktop** — [download here](https://www.docker.com/products/docker-desktop/)
- **QLab 5 or later**

Ensure Docker Desktop is running before proceeding.

---

## Installation

### 1. Clone and Run

Copy and paste this into Terminal:

```bash
cd ~/Desktop && git clone https://github.com/TwistedMelonIO/win-it-in-a-minute.git && cd win-it-in-a-minute && ./install_license.sh
```

The script will walk you through the full setup:

1. **Docker Build** — builds and starts the Docker container
2. **Machine ID** — retrieves your unique Machine ID and copies it to your clipboard

### 2. Request your license key

Send your Machine ID to [hello@twistedmelon.com](mailto:hello@twistedmelon.com). You will receive a license key tied to your machine.

### 3. Apply the license key

Once you have your license key, re-run the install script:

```bash
./install_license.sh
```

When prompted, paste your license key. The script will validate it and restart the container with the license applied.

### 4. Open the application

Navigate to [http://localhost:4000](http://localhost:4000) in your browser.

---

## Reinstall / Update

### Quick update (keeps your settings)

From inside the `win-it-in-a-minute` folder:

```bash
git pull && docker compose up -d --build
```

Your license key is preserved.

### Full clean reinstall

Removes everything and starts fresh. You will need to enter your license key again.

```bash
cd ~/Desktop && rm -rf win-it-in-a-minute && git clone https://github.com/TwistedMelonIO/win-it-in-a-minute.git && cd win-it-in-a-minute && ./install_license.sh
```

---

## QLab Setup

Win It In A Minute sends score updates to QLab via OSC. QLab must be running and listening on port **53000**.

### Create the score cues

In QLab, create two **Text cues** with the following cue names:

| Cue Name   | Purpose          |
|------------|------------------|
| `REDSCORE` | Red team score   |
| `BLUESCORE`| Blue team score  |

The app sends the following OSC messages when scores change:

```
/cue/REDSCORE/text "{score}"
/cue/BLUESCORE/text "{score}"
```

### Connect QLab cue numbers

In the settings panel at the bottom of the web app, enter the cue numbers that correspond to your `REDSCORE` and `BLUESCORE` cues. This tells the app which cues to target.

---

## Incoming OSC Commands

The app listens for OSC commands on **port 3001 (UDP)**. You can trigger scoring actions from QLab or any OSC-capable device using the following addresses:

| OSC Address       | Action                  |
|-------------------|-------------------------|
| `/wiiam/red/up`   | Red team +1             |
| `/wiiam/red/down` | Red team -1             |
| `/wiiam/blue/up`  | Blue team +1            |
| `/wiiam/blue/down`| Blue team -1            |
| `/wiiam/reset/red`| Reset red team to 0     |
| `/wiiam/reset/blue`| Reset blue team to 0   |
| `/wiiam/reset`    | Reset all scores        |

---

## Keyboard Shortcuts

When the browser window is in focus, the following keyboard shortcuts are available:

| Key       | Action           |
|-----------|------------------|
| `Q`       | Red team +1      |
| `A`       | Red team -1      |
| `P`       | Blue team +1     |
| `L`       | Blue team -1     |
| `Shift+R` | Reset all scores |

---

## Ongoing Use

| Task                     | Command                                        |
|--------------------------|------------------------------------------------|
| Rebuild after an update  | `docker compose up -d --build`                 |
| Stop the application     | `docker compose stop`                          |
| View live logs           | `docker compose logs -f win-it-in-a-minute`    |

---

## Uninstall

To completely remove Win It In A Minute from a machine, run from inside the project folder:

```bash
./uninstall.sh
```

This removes all Docker containers, images, volumes (including license and settings), and the project folder itself. You will be asked to type `YES` to confirm.

---

## Troubleshooting

**Docker not running**
Start Docker Desktop and wait for it to fully initialise before running the install script.

**Cannot retrieve Machine ID**
The container may still be starting up. Wait a few seconds and re-run the install script.

**License key invalid**
Confirm that the key was issued for this machine. The Machine ID must match exactly. Contact [hello@twistedmelon.com](mailto:hello@twistedmelon.com) if you believe there is an error.

**QLab not receiving score updates**
Verify that QLab is configured to listen for OSC on port **53000**. Check that the cue names match `REDSCORE` and `BLUESCORE` exactly (case-sensitive).

**Port 4000 already in use**
Another service may be occupying port 4000. Stop that service before starting Win It In A Minute.

**OSC input commands not working**
Ensure that port **3001 UDP** is not blocked by a firewall or in use by another application.

---

## Support

For license keys and technical support, contact [hello@twistedmelon.com](mailto:hello@twistedmelon.com).

---

*"Engineering the live experience." — Twisted Melon*
