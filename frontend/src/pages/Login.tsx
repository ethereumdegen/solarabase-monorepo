import { useState } from 'react';
import { useAuth } from '../auth';
import { Navigate, useNavigate } from 'react-router-dom';

export function Login() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [devEmail, setDevEmail] = useState('');
  const [devError, setDevError] = useState('');
  const [showDev, setShowDev] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  const handleDevLogin = async () => {
    if (!devEmail.trim()) return;
    setDevError('');
    try {
      const res = await fetch('/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: devEmail.trim() }),
      });
      if (!res.ok) {
        const text = await res.text();
        setDevError(text || 'Login failed');
        return;
      }
      await refresh();
      navigate('/dashboard');
    } catch (e: any) {
      setDevError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f0f3] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm p-10 max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold mb-2">Solarabase</h1>
        <p className="text-gray-400 text-sm mb-8">Sign in to your account</p>
        <a
          href="/auth/google"
          className="inline-flex items-center gap-3 px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors w-full justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </a>

        <div className="mt-6">
          {!showDev ? (
            <button
              onClick={() => setShowDev(true)}
              className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
            >
              Dev login
            </button>
          ) : (
            <div className="border-t border-gray-100 pt-4 mt-2">
              <p className="text-xs text-gray-400 mb-3">Dev mode (no OAuth required)</p>
              <input
                type="email"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDevLogin()}
                placeholder="Email address"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
                autoFocus
              />
              {devError && <p className="text-xs text-red-500 mb-2">{devError}</p>}
              <button
                onClick={handleDevLogin}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Sign in with email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
