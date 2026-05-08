import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { KnowledgebaseView } from './pages/KnowledgebaseView';
import { Account } from './pages/Account';
import { Admin } from './pages/Admin';
import { AcceptInvite } from './pages/AcceptInvite';
import { Docs } from './pages/Docs';
import { ApiDocs } from './pages/ApiDocs';
import { NotFound } from './pages/NotFound';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/docs/api" element={<ApiDocs />} />
      <Route
        path="/dashboard"
        element={<RequireAuth><Dashboard /></RequireAuth>}
      />
      <Route
        path="/account"
        element={<RequireAuth><Account /></RequireAuth>}
      />
      <Route
        path="/admin"
        element={<RequireAdmin><Admin /></RequireAdmin>}
      />
      <Route
        path="/kb/:kbId"
        element={<RequireAuth><KnowledgebaseView /></RequireAuth>}
      />
      <Route
        path="/invite"
        element={<RequireAuth><AcceptInvite /></RequireAuth>}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
