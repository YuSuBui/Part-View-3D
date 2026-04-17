import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { getMetadataForPart } from './data/MetaData'
import { Viewer, type SelectionInfo } from './viewer/Viewer'

const DEFAULT_MODEL = '/models/car.glb'

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<SelectionInfo | null>(null)

  useEffect(() => {
    if (!canvasRef.current) {
      return
    }

    const viewer = new Viewer(canvasRef.current, {
      onLoading: setIsLoading,
      onError: setError,
      onSelectionChange: setSelection,
    })

    viewerRef.current = viewer
    viewer.loadModel(DEFAULT_MODEL)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'r') {
        viewer.resetView()
      }

      if (event.key === 'Escape') {
        viewer.clearSelection()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      viewer.dispose()
      viewerRef.current = null
    }
  }, [])

  const metadata = useMemo(() => {
    if (!selection) {
      return null
    }

    return getMetadataForPart(selection.name)
  }, [selection])

  return (
    <main className="app-shell">
      <header className="toolbar">
        <h1>PartView3D</h1>
        <div className="toolbar-actions">
          <button type="button" onClick={() => viewerRef.current?.resetView()}>
            Reset view
          </button>
          <button type="button" onClick={() => viewerRef.current?.clearSelection()}>
            Clear selection
          </button>
        </div>
      </header>

      <section className="viewer-layout">
        <div className="viewer-frame">
          <canvas ref={canvasRef} aria-label="Interactive 3D viewer" />
          {isLoading && <div className="overlay">Loading model...</div>}
          {error && (
            <div className="overlay error-overlay">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void viewerRef.current?.loadModel(DEFAULT_MODEL)}
              >
                Retry
              </button>
            </div>
          )}
        </div>

        <aside className="info-panel">
          <h2>Mesh Information</h2>
          {!selection && (
            <p className="empty-state">
              Tap or click any part of the model to inspect it.
            </p>
          )}
          {selection && metadata && (
            <dl>
              <div>
                <dt>Name</dt>
                <dd>{selection.name}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{metadata.category}</dd>
              </div>
              <div>
                <dt>Finish</dt>
                <dd>{metadata.finish}</dd>
              </div>
              <div>
                <dt>Material</dt>
                <dd>{selection.materialName}</dd>
              </div>
              <div>
                <dt>Vertex count</dt>
                <dd>{selection.vertexCount.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Notes</dt>
                <dd>{metadata.notes}</dd>
              </div>
            </dl>
          )}
          <p className="mobile-tip">Mobile tip: drag to rotate, pinch to zoom.</p>
        </aside>
      </section>

      <footer className="shortcut-note">
        Shortcuts: <kbd>R</kbd> reset view, <kbd>Esc</kbd> clear selection.
      </footer>
    </main>
  )
}

export default App
