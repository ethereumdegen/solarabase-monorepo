import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { logout } from '../api';
import { Footer } from './Footer';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="border-b border-white/5 sticky top-0 z-10 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="text-lg font-medium text-white/90 tracking-tight">
            Solarabase
          </Link>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <span className="text-sm text-white/30">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-white/30 hover:text-white/60 transition-colors"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="px-6 py-8 flex-1">{children}</main>
      <Footer />
    </div>
  );
}
