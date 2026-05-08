import { useState } from 'react';
import { createPortal } from '../api';

export function BillingCard() {
  const [error, setError] = useState<string | null>(null);

  const handlePortal = async () => {
    setError(null);
    try {
      const { url } = await createPortal();
      window.location.href = url;
    } catch (e: any) {
      setError(e.message || 'Failed to open billing portal');
    }
  };

  return (
    <div className="bg-[#111] border border-white/5 rounded-xl p-6">
      <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-4">Payment Methods</h2>
      <p className="text-sm text-white/40 mb-4">
        Manage your payment methods and billing history. Plans are managed per-knowledgebase in each KB's settings.
      </p>
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
      <button onClick={handlePortal}
        className="px-4 py-2 border border-white/10 text-white/50 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors">
        Manage Payment Methods
      </button>
    </div>
  );
}
