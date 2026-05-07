import { useEffect, useState } from 'react';
import { listMembers, inviteMember, removeMember } from '../api';
import type { MemberWithUser } from '../types';
import { useAuth } from '../auth';

export function MemberList({ wsId }: { wsId: string }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [email, setEmail] = useState('');

  const load = () => {
    listMembers(wsId).then(setMembers).catch(() => {});
  };

  useEffect(() => { load(); }, [wsId]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    await inviteMember(wsId, email.trim());
    setEmail('');
    load();
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Remove this member?')) return;
    await removeMember(wsId, userId);
    load();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Members</h2>

      <div className="flex gap-2 mb-4">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
          placeholder="Email to invite"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <button onClick={handleInvite}
          className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium">
          Invite
        </button>
      </div>

      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="w-7 h-7 rounded-full" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-500">
                  {m.name[0]}
                </div>
              )}
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-gray-400">{m.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 capitalize">{m.role}</span>
              {m.role !== 'owner' && m.user_id !== user?.id && (
                <button onClick={() => handleRemove(m.user_id)}
                  className="text-xs text-red-400 hover:text-red-600">
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
