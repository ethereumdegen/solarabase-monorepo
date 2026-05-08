import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white/10 mb-4">404</h1>
        <p className="text-white/30 mb-6">Page not found</p>
        <Link to="/" className="text-sm text-white/40 hover:text-white/70 transition-colors">
          Go home
        </Link>
      </div>
    </div>
  );
}
