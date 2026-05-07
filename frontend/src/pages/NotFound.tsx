import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f0f3]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-200 mb-4">404</h1>
        <p className="text-gray-400 mb-6">Page not found</p>
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-900">
          Go home
        </Link>
      </div>
    </div>
  );
}
