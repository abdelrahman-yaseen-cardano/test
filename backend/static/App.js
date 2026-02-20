/**
 * App.js – Root application component
 */
import * as React from 'react'
import htm from 'htm'
import { useStore } from './store.js'
import {
  NodeEditor,
  UploadZone,
  FramePreviewModal,
  ExportPanel,
} from './components.js'

const html = htm.bind(React.createElement)

export function App() {
  const ssimThreshold    = useStore(s => s.ssimThreshold)
  const setSsimThreshold = useStore(s => s.setSsimThreshold)
  const nodeCount        = useStore(s => s.nodes.length)
  const [showExport, setShowExport] = React.useState(false)

  return html`
    <div class="app-shell">

      <!-- ── Top Bar ──────────────────────────────── -->
      <header class="topbar">
        <div class="topbar__brand">
          <span class="topbar__logo">⊞</span>
          <span class="topbar__title">Loop Engine</span>
          <span class="topbar__badge">${nodeCount} node${nodeCount !== 1 ? 's' : ''}</span>
        </div>

        <div class="topbar__controls">
          <label class="slider-label">
            <span>SSIM ≥ ${ssimThreshold.toFixed(2)}</span>
            <input type="range" min="0.5" max="1" step="0.01"
                   value=${ssimThreshold}
                   onInput=${e => setSsimThreshold(parseFloat(e.target.value))} />
          </label>

          <button class="btn btn-primary btn-sm"
                  disabled=${nodeCount === 0}
                  onClick=${() => setShowExport(true)}>
            ⊞ Export…
          </button>
        </div>
      </header>

      <!-- ── Main Layout ──────────────────────────── -->
      <div class="app-body">

        <!-- Sidebar -->
        <aside class="sidebar">
          <${UploadZone} />

          <div class="sidebar__tips">
            <p class="sidebar__tip-title">Quick Guide</p>
            <ul class="sidebar__tip-list">
              <li>Upload videos — they become nodes</li>
              <li>Click a <span class="chip chip-indigo">right knob</span> then a <span class="chip chip-green">left knob</span> to connect</li>
              <li>Green knobs = SSIM-compatible frames</li>
              <li>Shift-click multiple nodes, then <em>Group</em></li>
              <li>Open <em>Export</em> to build cycles &amp; download JSON</li>
            </ul>
          </div>
        </aside>

        <!-- Canvas -->
        <main class="canvas-container">
          <${NodeEditor} />
        </main>

      </div>

      <!-- ── Modals ────────────────────────────────── -->
      <${FramePreviewModal} />
      ${showExport && html`<${ExportPanel} onClose=${() => setShowExport(false)} />`}

    </div>`
}
