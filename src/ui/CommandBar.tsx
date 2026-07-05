import React from 'react';
import { Icon } from './Icons';

interface CommandBarProps {
  status: 'EDITING' | 'SIMULATING';
  isRunning: boolean;
  isAutoEvolving: boolean;
  generation: number;
  onPlay: () => void;
  onStop: () => void;
  onTogglePause: () => void;
  onToggleAuto: () => void;
}

export const CommandBar: React.FC<CommandBarProps> = ({
  status,
  isRunning,
  isAutoEvolving,
  generation,
  onPlay,
  onStop,
  onTogglePause,
  onToggleAuto
}) => {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      
      {/* Gen Counter (Only visible in Sim) */}
      <div className={`transition-opacity duration-300 ${status === 'SIMULATING' ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-slate-900/80 backdrop-blur px-3 py-1 rounded-full border border-slate-700 text-xs font-mono text-cyan-400 shadow-lg">
              GENERATION {generation}
          </div>
      </div>

      <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-2 rounded-2xl border border-slate-700 shadow-2xl">
        
        {status === 'EDITING' ? (
          /* EDIT MODE: JUST PLAY */
          <button
            onClick={onPlay}
            className="w-16 h-14 bg-green-600 hover:bg-green-500 text-white rounded-xl flex items-center justify-center transition-all shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:scale-105 active:scale-95"
          >
            <Icon name="play" className="w-8 h-8 ml-1" />
          </button>
        ) : (
          /* SIM MODE: STOP | PAUSE | AUTO */
          <>
            {/* STOP (Return to Editor) */}
            <button
              onClick={onStop}
              className="w-12 h-12 bg-red-600/20 hover:bg-red-600/40 text-red-500 border border-red-600/50 rounded-xl flex items-center justify-center transition-all hover:scale-105"
              title="Stop Simulation & Edit"
            >
              <Icon name="stop" className="w-5 h-5" />
            </button>

            {/* PAUSE / RESUME */}
            <button
              onClick={onTogglePause}
              disabled={isAutoEvolving}
              className={`w-16 h-14 rounded-xl flex items-center justify-center transition-all shadow-lg hover:scale-105 active:scale-95 ${
                  isRunning 
                  ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
                  : 'bg-green-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]'
              } ${isAutoEvolving ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            >
               <Icon name={isRunning ? 'pause' : 'play'} className="w-8 h-8" />
            </button>

            {/* AUTO EVOLVE */}
            <button
              onClick={onToggleAuto}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border ${
                  isAutoEvolving 
                  ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_15px_rgba(147,51,234,0.5)]' 
                  : 'bg-slate-800 text-purple-400 border-slate-600 hover:bg-slate-700'
              }`}
              title="Auto-Evolve (Fast Forward)"
            >
              <Icon name="fast-forward" className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};