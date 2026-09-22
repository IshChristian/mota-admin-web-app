import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Admin dashboard render failure', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-white">
          <section className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-400">System error</p>
            <h1 className="mt-3 text-3xl font-black">The dashboard could not finish loading</h1>
            <p className="mt-3 text-slate-300">Your data was not changed. Reload the dashboard or open the server-status page.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button className="rounded-xl bg-red-600 px-5 py-3 font-bold hover:bg-red-500" onClick={() => window.location.reload()}>
                Retry
              </button>
              <a className="rounded-xl border border-white/20 px-5 py-3 font-bold hover:bg-white/10" href="/status/500">
                View status
              </a>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
