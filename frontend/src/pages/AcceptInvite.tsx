import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { acceptInvite } from '../api';

export function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      acceptInvite(token)
        .then((kb) => navigate(`/kb/${kb.id}`))
        .catch((e) => setError(e.message));
    }
  }, [params, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="bg-[#111] border border-white/10 rounded-xl p-8 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <a href="/dashboard" className="text-sm text-white/30 hover:text-white/60 transition-colors">Go to Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white/30">
      Accepting invitation...
    </div>
  );
}
