import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { logout } from '../api';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#f0f0f3]">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="text-xl font-bold text-gray-900 tracking-tight">
            Solarabase
          </Link>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <span className="text-sm text-gray-400">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
