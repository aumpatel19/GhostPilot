# GhostPilot for Windows

A floating, always-on-top AI browser panel for Windows 11 that is **invisible to screen sharing software** (Zoom, Teams, Google Meet, OBS). Built with Electron.

---

## Features

- **Screen capture invisible** — uses Windows `SetWindowDisplayAffinity` API, window is hidden from all screen recording and sharing tools
- **No taskbar entry** — doesn't appear in the taskbar or Alt+Tab switcher
- **Always on top** — floats above all other windows
- **Frosted glass UI** — dark grey transparent panel with rounded corners
- **4 built-in AI sites** — ChatGPT, Claude, Google, Gemini with one-click switching
- **Persistent sessions** — stays logged in between launches (cookies saved locally)
- **Google OAuth fix** — opens Google sign-in in a proper popup so login works
- **Adjustable opacity** — fade the window in/out on the fly
- **System tray** — lives in the tray, launch/hide from there

---

## Quick Start (No install needed)

1. Download the latest release
2. Extract the zip
3. Double-click **`GhostPilot.exe`**

That's it. No Node.js, no terminal, no install.

---

## Run from Source

**Requirements:** [Node.js LTS](https://nodejs.org)

**First time:**
```
Double-click setup.bat
```

**After that:**
```
Double-click start.bat
```

---

## Build Exe Yourself

```bash
npm install
npm run build
```

Output: `dist/GhostPilot-win32-x64/GhostPilot.exe`

---

## Hotkeys

| Shortcut | Action |
|---|---|
| `Ctrl+Alt+G` | Toggle show / hide |
| `Ctrl+Alt+H` | Panic hide |
| `Ctrl+Alt+1` | Switch to ChatGPT |
| `Ctrl+Alt+2` | Switch to Claude |
| `Ctrl+Alt+3` | Switch to Google |
| `Ctrl+Alt+4` | Switch to Gemini |
| `Ctrl+Alt+R` | Reload current page |
| `Ctrl+Alt+=` | Increase opacity |
| `Ctrl+Alt+-` | Decrease opacity |

You can also right-click the tray icon to switch sites or quit.

---

## Project Structure

```
GhostPilot-Windows/
├── main.js          # Electron main process — window, tray, hotkeys
├── preload.js       # Context bridge between main and renderer
├── src/
│   ├── index.html   # UI layout
│   ├── styles.css   # Frosted glass dark theme
│   └── renderer.js  # Tab switching, webview logic
├── start.bat        # Launch script
└── setup.bat        # First-time install + launch
```

---

## Tech Stack

- **Electron 28** — cross-platform desktop shell
- **Vanilla JS / HTML / CSS** — no frontend framework
- **Electron webview tag** — sandboxed browser inside the panel
- **Windows `SetWindowDisplayAffinity`** — via Electron's `setContentProtection(true)`

---

## Notes

- On first launch the app appears on the **right side of your screen**
- The window is **draggable** from the top bar
- The window is **resizable** from the edges
- Opacity range is **15% – 100%**, shown in the bottom bar
- All site logins are saved locally in `%AppData%\GhostPilot-v2`

---

## License

MIT