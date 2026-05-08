import type { Knowledgebase } from '../types';

export function KbCard({
  kb,
  onClick,
}: {
  kb: Knowledgebase;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-[#111] border border-white/5 rounded-xl p-5 text-left hover:border-white/15 transition-colors w-full h-32 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: kb.accent_color }}
          />
          <h3 className="font-medium text-white/90 text-sm truncate">{kb.name}</h3>
        </div>
        {kb.description && (
          <p className="text-xs text-white/30 line-clamp-2">{kb.description}</p>
        )}
      </div>
      <p className="text-xs text-white/15 font-mono">{kb.model}</p>
    </button>
  );
}
