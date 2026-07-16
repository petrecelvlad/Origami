import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Icon } from './Icons';

interface PublicCommandBarProps {
  isRunning: boolean;
  onTogglePause: () => void;
  showBestOnly: boolean;
  onToggleBestOnly: () => void;
  cycleTrackedLeader: (dir: 1 | -1) => void;
  generation: number;
}

/**
 * Minimal spectator-only command bar for the public build: play/pause,
 * prev/next bot, and the show-best-only toggle. No stop, no fast-forward,
 * no editor entry point - visitors watch, they don't build or edit.
 */
export const PublicCommandBar: React.FC<PublicCommandBarProps> = ({
  isRunning,
  onTogglePause,
  showBestOnly,
  onToggleBestOnly,
  cycleTrackedLeader,
  generation
}) => {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      <div className="bg-slate-900/80 backdrop-blur px-3 py-1 rounded-full border border-slate-700 text-xs font-mono text-cyan-400 shadow-lg">
        GENERATION {generation}
      </div>

      <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-2 rounded-2xl border border-slate-700 shadow-2xl">
        <button
          onClick={() => cycleTrackedLeader(-1)}
          className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center justify-center transition-all hover:scale-105"
          title="Previous Bot"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          onClick={onTogglePause}
          className={`w-16 h-14 rounded-xl flex items-center justify-center transition-all shadow-lg hover:scale-105 active:scale-95 ${
              isRunning
              ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]'
              : 'bg-green-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]'
          }`}
        >
          <Icon name={isRunning ? 'pause' : 'play'} className="w-8 h-8" />
        </button>

        <button
          onClick={() => cycleTrackedLeader(1)}
          className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center justify-center transition-all hover:scale-105"
          title="Next Bot"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="w-px h-8 bg-slate-700 mx-1" />

        <button
          onClick={onToggleBestOnly}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              showBestOnly
              ? 'bg-blue-600 text-white ring-2 ring-blue-400'
              : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
          title="Focus Champion"
        >
          <Icon name="eye" className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
