# GhostPilot — Project Report

## Overview

**GhostPilot** is a stealth AI assistant overlay for macOS, designed to be invisible to screen sharing and interview proctoring software. It loads AI services (ChatGPT, Claude, Google Search) in a floating panel that never triggers tab-change or focus-loss warnings.

**Repository:** [github.com/krushil298/ghost_browser](https://github.com/krushil298/ghost_browser)

---

## The Journey

### Phase 1: Electron Prototype

Built an Electron app with a `<webview>` tag to embed AI sites in a floating overlay.

**Features implemented:**
- Frameless transparent window with `type: 'panel'`
- `setContentProtection(true)` to hide from screen capture
- Global hotkeys (`⌘⇧Space` toggle, `⌘⇧H` panic hide, `⌘⇧↑/↓` opacity)
- System tray menu
- Site picker (GPT, Claude, Search)
- Dark/light mode toggle
- Persistent settings via `electron-store`

**Issues encountered:**
1. **"Browser not secure" warning** — Google blocks sign-in from Electron webviews
2. **Focus steal on click** — Every click on the Electron window caused the browser to lose focus, triggering interview platform warnings

### Phase 2: Attempts to Fix Focus Steal in Electron

| Approach | Result |
|---|---|
| `blur()` after each button click | Still detected — blur event visible to browser |
| `focusable: false` | No focus steal, but couldn't type in webview |
| `setIgnoreMouseEvents(true)` | Click-through worked, but required keyboard-only UX |
| `showInactive()` + `type: 'panel'` | Showing worked, but clicking still activated the app |

**Root cause:** Electron (Chromium) cannot fully implement macOS `NSWindowStyleMaskNonactivatingPanel`. Native Swift/AppKit apps like ChatGPT use this at the OS level to receive input without activating the application.

### Phase 3: Native Swift Rewrite ✅

Rebuilt the entire app in Swift/AppKit to achieve true non-activating panel behavior.

---

## Final Architecture (Swift)

```
GhostPilot/
├── Package.swift                     # SPM manifest (macOS 13+)
└── Sources/GhostPilot/
    ├── main.swift                    # Entry point, sets .accessory policy
    ├── GhostPanel.swift              # NSPanel + .nonactivatingPanel
    ├── AppDelegate.swift             # WKWebView, hotkeys, status bar
    └── GhostToolbar.swift            # Site picker, drag-to-move
```

### Key Technical Details

| Component | Implementation |
|---|---|
| **Non-activating panel** | `NSPanel` subclass with `.nonactivatingPanel` style mask |
| **Screen capture invisible** | `window.sharingType = .none` |
| **No dock icon** | `app.setActivationPolicy(.accessory)` |
| **Web engine** | `WKWebView` with custom Chrome user agent |
| **Global hotkeys** | `NSEvent.addGlobalMonitorForEvents` + local monitor |
| **System tray** | `NSStatusItem` with 👻 icon |
| **Drag to move** | Custom `mouseDown`/`mouseDragged` on toolbar |
| **Always on top** | `window.level = .floating` |

### Hotkeys

| Shortcut | Action |
|---|---|
| `⌘⇧Space` | Toggle visibility |
| `⌘⇧H` | Panic hide |
| `⌘⇧1` | ChatGPT |
| `⌘⇧2` | Claude |
| `⌘⇧3` | Google Search |
| `⌘⇧R` | Reload |
| `⌘⇧↑/↓` | Opacity ±5% |

---

## How to Build & Run

```bash
cd GhostPilot
swift build
.build/debug/GhostPilot
```

> macOS may prompt for Accessibility permissions for global hotkeys.

---

## Git History (key commits)

| Commit | Description |
|---|---|
| Initial | Electron prototype with webview overlay |
| Session permissions | Fix "browser not secure" with certificate trust |
| Webview → BrowserWindow | Attempt to fix Google auth block |
| Revert to webview | Accepted webview limitations |
| Light/dark mode | CSS variables with theme toggle |
| Monochrome theme | Pure black & white, no colors |
| Blur after click | First attempt at focus-steal fix |
| focusable: false | Non-activating attempt |
| Click-through overlay | `setIgnoreMouseEvents` keyboard-only mode |
| showInactive panel | ChatGPT-style `showInactive()` attempt |
| **Native Swift app** | **Final solution — true NSPanel non-activating** |
| Cleanup | Removed all Electron files |
