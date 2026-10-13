import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * Any render error used to leave a blank page. On a wedding day that is a guest
 * with no way in — so offer a reload, and the plain invitation as a way out.
 */
class Rescue extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="grid h-full place-items-center bg-wood-900 p-6 text-center">
        <div className="grid max-w-[320px] gap-4">
          <p className="m-0 font-display text-[22px] font-bold text-parchment-100">Taman sedang tidak bisa dibuka</p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>MUAT ULANG</button>
          <a className="btn-secondary text-center" href={`/undangan/${window.location.search}`}>BUKA UNDANGAN BIASA</a>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Rescue>
      <App />
    </Rescue>
  </StrictMode>,
);
