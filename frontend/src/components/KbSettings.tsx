import { useState } from 'react';
import { updateKbSettings, listApiKeys, createApiKey, revokeApiKey } from '../api';
import type { Knowledgebase, ApiKeyInfo } from '../types';
import { useEffect } from 'react';

export function KbSettings({
  kb,
  onUpdated,
}: {
  kb: Knowledgebase;
  onUpdated: (kb: Knowledgebase) => void;
}) {
  const [name, setName] = useState(kb.name);
  const [description, setDescription] = useState(kb.description);
  const [systemPrompt, setSystemPrompt] = useState(kb.system_prompt);
  const [model, setModel] = useState(kb.model);
  const [accentColor, setAccentColor] = useState(kb.accent_color);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    listApiKeys(kb.id).then(setApiKeys).catch(() => {});
  }, [kb.id]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateKbSettings(kb.id, {
        name, description, system_prompt: systemPrompt, model, accent_color: accentColor,
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
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Configuration</h2>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">System Prompt</label>
          <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={4}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs text-gray-400 block mb-1">Model</label>
            <select value={model} onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4.1">gpt-4.1</option>
              <option value="gpt-4.1-mini">gpt-4.1-mini</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Accent Color</label>
            <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)}
              className="h-10 w-14 rounded-xl border border-gray-200 cursor-pointer" />
          </div>
        </div>

        {saveError && <p className="text-xs text-red-500">{saveError}</p>}
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* API Keys */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">API Keys</h2>

        {createdKey && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
            <p className="text-xs text-green-700 mb-1 font-medium">Key created! Copy it now - it won't be shown again.</p>
            <code className="text-xs bg-white px-2 py-1 rounded border select-all">{createdKey}</code>
            <button onClick={() => setCreatedKey(null)} className="ml-3 text-xs text-green-600">Dismiss</button>
          </div>
        )}

        {keyError && <p className="text-xs text-red-500 mb-3">{keyError}</p>}

        <div className="flex gap-2 mb-4">
          <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
            placeholder="Key name (e.g. production)"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          <button onClick={handleCreateKey}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium">
            Generate
          </button>
        </div>

        {apiKeys.length === 0 ? (
          <p className="text-sm text-gray-400">No API keys yet.</p>
        ) : (
          <div className="space-y-2">
            {apiKeys.map((k) => (
              <div key={k.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl">
                <div>
                  <span className="text-sm font-medium">{k.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{k.key_prefix}...</span>
                </div>
                <button onClick={() => handleRevokeKey(k.id)}
                  className="text-xs text-red-400 hover:text-red-600">
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
