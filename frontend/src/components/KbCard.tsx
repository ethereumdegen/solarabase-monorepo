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
      className="bg-white rounded-2xl shadow-sm p-5 text-left hover:shadow-md transition-shadow w-full h-32 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: kb.accent_color }}
          />
          <h3 className="font-semibold text-gray-900 text-sm truncate">{kb.name}</h3>
        </div>
        {kb.description && (
          <p className="text-xs text-gray-400 line-clamp-2">{kb.description}</p>
        )}
      </div>
      <p className="text-xs text-gray-300">Model: {kb.model}</p>
    </button>
  );
}
