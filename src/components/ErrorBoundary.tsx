import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { FirestoreErrorInfo } from '../firebase';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function parseFirestoreError(err: Error | null): FirestoreErrorInfo | null {
  if (!err?.message) return null;
  try {
    const parsed = JSON.parse(err.message) as Partial<FirestoreErrorInfo>;
    if (parsed && typeof parsed.error === 'string' && 'operationType' in parsed) {
      return parsed as FirestoreErrorInfo;
    }
  } catch {
    // Standard runtime error
  }
  return null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Application ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const fsInfo = parseFirestoreError(this.state.error);
    const displayMessage = fsInfo
      ? fsInfo.error
      : this.state.error?.message || 'An unexpected application error occurred.';

    return (
      <div className="min-h-[100dvh] w-full bg-[#F6F6F6] dark:bg-[#0B0C0E] flex items-center justify-center p-5">
        <div className="w-full max-w-[420px] rounded-3xl bg-white dark:bg-[#141416] border border-black/10 dark:border-white/10 shadow-2xl p-6 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FEECEB] dark:bg-red-950/60 text-[#E11900] dark:text-red-300 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h2 className="text-[20px] font-extrabold text-black dark:text-white">
              {fsInfo ? 'Cloud Sync Issue' : 'Something went wrong'}
            </h2>
            <p className="text-[13.5px] text-[#545454] dark:text-neutral-300 leading-relaxed">
              {displayMessage}
            </p>
          </div>

          {fsInfo && (
            <div className="rounded-xl bg-[#F6F6F6] dark:bg-white/5 p-3 text-[12px] space-y-1 text-[#545454] dark:text-neutral-400">
              <p>
                <span className="font-bold text-black dark:text-white">Operation:</span>{' '}
                {fsInfo.operationType}
              </p>
              {fsInfo.path && (
                <p className="truncate">
                  <span className="font-bold text-black dark:text-white">Path:</span> {fsInfo.path}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={this.handleReset}
              className="h-11 rounded-xl bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 text-[13.5px] font-bold text-black dark:text-white transition-colors"
            >
              Try Continue
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="h-11 rounded-xl bg-[#276EF1] hover:bg-[#1E5CD4] text-white text-[13.5px] font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload App
            </button>
          </div>
        </div>
      </div>
    );
  }
}
