'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground">
          <div className="max-w-md w-full p-8 space-y-6 text-center border rounded-lg shadow-lg bg-card">
            <h1 className="text-4xl font-bold text-destructive">Oops!</h1>
            <p className="text-xl font-semibold">Something went wrong.</p>
            <p className="text-muted-foreground">
              An unexpected error occurred in the application. We've been notified and are working on a fix.
            </p>
            <div className="pt-4">
              <Button onClick={this.handleReset} variant="default" size="lg" className="w-full">
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

