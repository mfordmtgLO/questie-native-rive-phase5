# questie-pin — Rive preview bundle

Exported from OpenRive. Everything needed to play `questie-pin.riv` in a browser is in this folder.

## Run it

Browsers block module and `fetch` loads from `file://`. On Windows, double-click `start-preview.bat`; it starts a local server and opens the preview in your browser. It uses Python 3 when available and falls back to built-in PowerShell, so no separate server install is required. Keep the server window open while you use the preview.

On macOS or Linux, run the included local server from this folder:

```bash
python3 serve.py
```

The server opens the preview in your browser and prints its local URL. It binds only to your own device. You get the same preview as in the editor: artboard and
state machine pickers, inputs, data bound properties and an event log.

## What is in here

| File | Purpose |
| --- | --- |
| `index.html` | The preview page |
| `index.js` | The player — `mountPreview()` for the whole UI, `createPlayer()` for just the canvas |
| `styles.css` | Styling for the preview UI |
| `questie-pin.riv` | The animation |
| `start-preview.bat` | Windows launcher for the local preview server |
| `start-preview.ps1` | PowerShell fallback for Windows machines without Python 3 |
| `serve.py` | Local server with the correct JavaScript and WASM content types |
| `runtime/` | The Rive WASM runtime |

## Scenes

- **Pin** 128×136 — state machines: Guide; timelines: Breathe, Blink, Viseme rest, Viseme MBP, Viseme AI, Viseme E, Viseme OU, Viseme FV, Viseme THL, Viseme teeth, Reaction ready, Reaction thinking, Reaction listening, Reaction favorite, Reaction pricedrop, Reaction newhome, Reaction traveling, Reaction arrived, Reaction achievement, Reaction guide, Reaction lookout, Reaction ponder, Reaction speaking

## Embed it in your own page

```html
<canvas id="rive" style="width: 480px; height: 360px"></canvas>
<script type="module">
  import { createPlayer } from './index.js';
  const player = await createPlayer({ canvas: document.getElementById('rive') });
  // player.setInput('Hover', true);
  // player.setProperty('Label', 'string', 'Hello');
  // player.dispose();
</script>
```

## Runtime

The Rive runtime (`runtime/canvas_advanced.mjs` + `runtime/rive.wasm`, version vendored OpenRive runtime) ships in this folder, so the bundle plays with no network access.
