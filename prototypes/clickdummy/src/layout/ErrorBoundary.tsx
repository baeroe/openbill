import { Component, type ReactNode } from 'react'

/** Fängt Render-Fehler ab (z. B. durch alten Speicherstand) und bietet einen Ausweg. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }

  reset = () => {
    Object.keys(localStorage).filter((k) => k.startsWith('openbill:')).forEach((k) => localStorage.removeItem(k))
    window.location.assign('/')
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid min-h-full place-items-center px-4">
        <div className="max-w-md rounded-[3px] border border-line bg-sheet p-6 shadow-sheet">
          <h1 className="font-cond text-2xl font-semibold">Da ist etwas schiefgelaufen</h1>
          <p className="mt-2 text-sm text-muted">Wahrscheinlich passt der gespeicherte Stand nicht mehr zur aktuellen Version des Klickdummys. Setz die Demo-Daten zurück, um weiterzumachen.</p>
          <pre className="mt-3 overflow-auto rounded-[3px] bg-sheet-2 p-2 font-mono text-xs text-muted">{this.state.error.message}</pre>
          <button type="button" onClick={this.reset} className="mt-4 h-9 rounded-[5px] bg-carbon px-3.5 text-sm font-medium text-carbon-ink">Demo-Daten zurücksetzen</button>
        </div>
      </div>
    )
  }
}
