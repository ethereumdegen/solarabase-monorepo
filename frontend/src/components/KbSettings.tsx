import { useState, useEffect } from 'react';
import { updateKbSettings, listApiKeys, createApiKey, revokeApiKey, listKbMembers, addKbMember, removeKbMember } from '../api';
import type { Knowledgebase, ApiKeyInfo, KbMember, KbRole } from '../types';
import { useAuth } from '../auth';

export function KbSettings({
  kb,
  onUpdated,
}: {
  kb: Knowledgebase;
  onUpdated: (kb: Knowledgebase) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(kb.name);
  const [description, setDescription] = useState(kb.description);
  const [accentColor, setAccentColor] = useState(kb.accent_color);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  // KB Members
  const [kbMembers, setKbMembers] = useState<KbMember[]>([]);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<KbRole>('viewer');
  const [memberError, setMemberError] = useState<string | null>(null);

  useEffect(() => {
    listApiKeys(kb.id).then(setApiKeys).catch(() => {});
    listKbMembers(kb.id).then(setKbMembers).catch(() => {});
  }, [kb.id]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateKbSettings(kb.id, {
        name, description, accent_color: accentColor,
      });
      onUpdated(updated);
    } catch (e: any) {
      setSaveError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setKeyError(null);
    try {
      const result = await createApiKey(kb.id, newKeyName.trim());
      setCreatedKey(result.key);
      setNewKeyName('');
      listApiKeys(kb.id).then(setApiKeys);
    } catch (e: any) {
      setKeyError(e.message || 'Failed to create key');
    }
  };

  const handleAddMember = async () => {
    if (!memberEmail.trim()) return;
    setMemberError(null);
    try {
      await addKbMember(kb.id, memberEmail.trim(), memberRole);
      setMemberEmail('');
      listKbMembers(kb.id).then(setKbMembers);
    } catch (e: any) {
      setMemberError(e.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Remove this member from KB?')) return;
    try {
      await removeKbMember(kb.id, userId);
      listKbMembers(kb.id).then(setKbMembers);
    } catch (e: any) {
      setMemberError(e.message || 'Failed to remove member');
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Revoke this API key?')) return;
    try {
      await revokeApiKey(kb.id, keyId);
      listApiKeys(kb.id).then(setApiKeys);
    } catch (e: any) {
      setKeyError(e.message || 'Failed to revoke key');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#111] border border-white/5 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider">Configuration</h2>

        <div>
          <label className="text-xs text-white/30 block mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20" />
        </div>

        <div>
          <label className="text-xs text-white/30 block mb-1">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20" />
        </div>

        <div>
          <label className="text-xs text-white/30 block mb-1">Accent Color</label>
          <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)}
            className="h-10 w-14 rounded-lg border border-white/10 cursor-pointer bg-transparent" />
        </div>

        {saveError && <p className="text-xs text-red-400">{saveError}</p>}
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-white/15 transition-colors">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* KB Members */}
      <div className="bg-[#111] border border-white/5 rounded-xl p-6">
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-2">KB Access Control</h2>
        <p className="text-xs text-white/25 mb-4">
          {kbMembers.length === 0
            ? 'Only you (the owner) can access. Add members to share.'
            : 'Only you (the owner) and listed members can access this KB.'}
        </p>

        {memberError && <p className="text-xs text-red-400 mb-3">{memberError}</p>}

        <div className="flex gap-2 mb-4">
          <input value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
            placeholder="Email"
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/20" />
          <select value={memberRole} onChange={(e) => setMemberRole(e.target.value as KbRole)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={handleAddMember}
            className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/15 transition-colors">
            Add
          </button>
        </div>

        {kbMembers.length > 0 && (
          <div className="space-y-2">
            {kbMembers.map((m) => (
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
                  {m.user_id !== user?.id && (
                    <button onClick={() => handleRemoveMember(m.user_id)}
                      className="text-xs text-red-400/60 hover:text-red-400">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Keys */}
      <div className="bg-[#111] border border-white/5 rounded-xl p-6">
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-4">API Keys</h2>

        {createdKey && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-4">
            <p className="text-xs text-green-400 mb-1 font-medium">Key created! Copy it now - it won't be shown again.</p>
            <code className="text-xs bg-white/5 px-2 py-1 rounded text-white/70 select-all">{createdKey}</code>
            <button onClick={() => setCreatedKey(null)} className="ml-3 text-xs text-green-400/60 hover:text-green-400">Dismiss</button>
          </div>
        )}

        {keyError && <p className="text-xs text-red-400 mb-3">{keyError}</p>}

        <div className="flex gap-2 mb-4">
          <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
            placeholder="Key name (e.g. production)"
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/20" />
          <button onClick={handleCreateKey}
            className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/15 transition-colors">
            Generate
          </button>
        </div>

        {apiKeys.length === 0 ? (
          <p className="text-sm text-white/25">No API keys yet.</p>
        ) : (
          <div className="space-y-2">
            {apiKeys.map((k) => (
              <div key={k.id} className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-white/70">{k.name}</span>
                  <span className="text-xs text-white/25 ml-2">{k.key_prefix}...</span>
                </div>
                <button onClick={() => handleRevokeKey(k.id)}
                  className="text-xs text-red-400/60 hover:text-red-400">
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
