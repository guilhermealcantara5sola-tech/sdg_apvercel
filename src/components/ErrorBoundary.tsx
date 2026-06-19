import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-[#09090b] text-[#f4f4f5] font-sans">
          <div className="max-w-md w-full bg-[#18181b] border border-red-900/50 rounded-2xl p-6 shadow-xl text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-3 bg-red-950/50 rounded-full border border-red-500/20 text-red-500">
                <AlertOctagon size={48} className="animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-red-400">Ops! Algo deu errado</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Ocorreu um erro inesperado ao carregar esta seção. Para evitar perda de dados, você pode tentar recarregar a página ou voltar para o painel de automação.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-black/40 border border-zinc-800 rounded-lg p-3 text-left">
                <p className="text-xs font-mono text-red-300 break-all overflow-x-auto max-h-24">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-600/20 hover:scale-[1.02]"
              >
                <RotateCw size={16} />
                Recarregar Página
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-zinc-700 hover:scale-[1.02]"
              >
                <Home size={16} />
                Voltar ao Início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
