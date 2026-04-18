import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface State { hasError: boolean; error?: Error }
interface Props {
  children: React.ReactNode;
  /** Optional label shown in the fallback UI (e.g. "Reports") */
  label?: string;
  /** When true, renders a compact in-page fallback instead of full-screen */
  inline?: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ''}]`, error, info);
  }

  private handleReload = () => window.location.reload();
  private handleHome = () => { window.location.href = '/dashboard'; };

  render() {
    if (this.state.hasError) {
      const { label, inline } = this.props;
      const wrapper = inline
        ? 'flex items-center justify-center bg-background p-6 min-h-[60vh] rounded-lg border'
        : 'min-h-screen flex items-center justify-center bg-background p-6';
      return (
        <div className={wrapper}>
          <div className="max-w-md text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold">
              {label ? `${label} module crashed` : 'Something went wrong'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={this.handleReload}>Reload</Button>
              <Button variant="outline" onClick={this.handleHome}>Go to Dashboard</Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
