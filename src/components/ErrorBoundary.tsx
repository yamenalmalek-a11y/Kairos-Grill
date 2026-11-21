import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Unexpected error',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8F5F2] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-[16px] border border-[#EAE5DF] p-6 text-center shadow-sm space-y-4">
            <img
              src="/pwa-192x192.png"
              alt="Kairos Grill"
              className="w-16 h-16 mx-auto object-contain"
            />
            <h1 className="font-display text-[20px] font-extrabold text-[#242E30]">
              حدث خطأ غير متوقع / Etwas ist schiefgelaufen
            </h1>
            <p className="text-[13px] text-[#5A6568] leading-relaxed break-words">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full h-11 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white font-bold text-[14px] transition-colors"
            >
              إعادة تحميل الصفحة / Neu laden
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
