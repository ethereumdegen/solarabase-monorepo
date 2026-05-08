import { useEffect, useState } from 'react';
import { listMembers, inviteMember, removeMember } from '../api';
import type { MemberWithUser } from '../types';
import { useAuth } from '../auth';

export function MemberList({ wsId }: { wsId: string }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    listMembers(wsId).then(setMembers).catch(() => {});
  };

  useEffect(() => { load(); }, [wsId]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setError(null);
    try {
      await inviteMember(wsId, email.trim());
      setEmail('');
      load();
    } catch (e: any) {
      setError(e.message || 'Failed to invite');
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Remove this member?')) return;
    try {
      await removeMember(wsId, userId);
      load();
    } catch (e: any) {
      setError(e.message || 'Failed to remove');
    }
  };

  return (
    <div className="bg-[#111] border border-white/5 rounded-xl p-6">
      <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-4">Members</h2>

      <div className="flex gap-2 mb-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
          placeholder="Email to invite"
          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/20"
        />
        <button onClick={handleInvite}
          className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/15 transition-colors">
          Invite
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
            <div className="flex items-center gap-3">
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="w-7 h-7 rounded-full" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-white/40">
                  {m.name[0]}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-white/70">{m.name}</p>
                <p className="text-xs text-white/30">{m.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/30 capitalize">{m.role}</span>
              {m.role !== 'owner' && m.user_id !== user?.id && (
                <button onClick={() => handleRemove(m.user_id)}
                  className="text-xs text-red-400/60 hover:text-red-400">
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
