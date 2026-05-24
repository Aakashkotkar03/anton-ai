// src/components/chat/PersonaSwitcher.jsx — Persona mode switcher for ChatScreen
// 4 circle buttons: General (G), Coder (C), Writer (W), Analyst (A).
// Active = blue fill, Inactive = slate fill. Tooltip on hover.
// Design: PRD Feature 1 — persona icons in header bar.

const PERSONAS = [
  { id: 'general', letter: 'G', label: 'General' },
  { id: 'coder',   letter: 'C', label: 'Coder' },
  { id: 'writer',  letter: 'W', label: 'Writer' },
  { id: 'analyst', letter: 'A', label: 'Analyst' },
];

export default function PersonaSwitcher({ activePersona, onPersonaChange }) {
  return (
    <div className="flex items-center gap-1.5">
      {PERSONAS.map((p) => {
        const isActive = activePersona === p.id;

        return (
          <button
            key={p.id}
            onClick={() => onPersonaChange(p.id)}
            title={p.label}
            className={`flex items-center justify-center w-8 h-8 rounded-full
              text-xs font-bold transition-colors duration-150
              ${isActive
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'dark:bg-[#334155] dark:text-[#64748B] dark:hover:bg-slate-600 dark:hover:text-slate-300 bg-slate-200 text-slate-400 hover:bg-slate-300 hover:text-slate-600'
              }`}
          >
            {p.letter}
          </button>
        );
      })}
    </div>
  );
}

// Export personas array for reuse (e.g. by promptEngine mapping)
export { PERSONAS };
