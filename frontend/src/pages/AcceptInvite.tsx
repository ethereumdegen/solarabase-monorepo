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
        .then(() => navigate('/dashboard'))
        .catch((e) => setError(e.message));
    }
  }, [params, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">Go to Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">
      Accepting invitation...
    </div>
  );
}
