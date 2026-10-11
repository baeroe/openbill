import { Component, type ReactNode } from 'react'
import { ErrorState } from '@/components/ui'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown }
  static getDerivedStateFromError(error: unknown) { return { error } }
  render() {
    if (this.state.error) return <ErrorState error={this.state.error} title="Hier ist etwas schiefgelaufen" onRetry={() => location.reload()} />
    return this.props.children
  }
}
