import React, { useEffect, useRef, MutableRefObject } from 'react';

interface ChampionAnalysisProps {
    statsRef: MutableRefObject<{ 
        fitness: number; 
        avgFitness: number; 
        foodEaten: number; 
        totalFoodEaten: number;
        distance: number;
        energy: number;
        maxEnergy: number;
        aliveCount: number;
        totalCount: number;
        globalAge: number;
        projectName: string;
        fitnessBreakdown: {
            distanceScore: number;
            explorationScore: number;
            survivalScore: number;
            foodScore: number;
        };
        netProgress: number;
        odometer: number;
    }>;
}

export const ChampionAnalysis: React.FC<ChampionAnalysisProps> = ({ statsRef }) => {
    const fitnessEl = useRef<HTMLDivElement>(null);
    const distanceEl = useRef<HTMLDivElement>(null);
    const explorationEl = useRef<HTMLDivElement>(null);
    const survivalEl = useRef<HTMLDivElement>(null);
    const foodScoreEl = useRef<HTMLDivElement>(null);
    const foodCountEl = useRef<HTMLDivElement>(null);
    const foodBarEl = useRef<HTMLDivElement>(null);
    
    const reqId = useRef<number>(0);

    useEffect(() => {
        const update = () => {
            const s = statsRef.current;
            if (s) {
                if (fitnessEl.current) fitnessEl.current.textContent = Math.round(s.fitness).toLocaleString();
                
                const b = s.fitnessBreakdown;
                if (b) {
                    if (distanceEl.current) distanceEl.current.textContent = Math.round(b.distanceScore).toLocaleString();
                    if (explorationEl.current) explorationEl.current.textContent = Math.round(b.explorationScore).toLocaleString();
                    if (survivalEl.current) survivalEl.current.textContent = Math.round(b.survivalScore).toLocaleString();
                    if (foodScoreEl.current) foodScoreEl.current.textContent = Math.round(b.foodScore).toLocaleString();
                }

                if (foodCountEl.current) foodCountEl.current.textContent = `${s.totalFoodEaten || 0}`;
                if (foodBarEl.current) {
                    const fill = Math.min(100, s.foodEaten);
                    foodBarEl.current.style.width = `${fill}%`;
                }

            }
            reqId.current = requestAnimationFrame(update);
        };
        reqId.current = requestAnimationFrame(update);
        return () => cancelAnimationFrame(reqId.current);
    }, [statsRef]);

    return (
        <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden shadow-2xl pointer-events-auto">
            {/* Header */}
                <div className="bg-slate-900/50 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] font-mono">Champion Analysis</span>
                    <div className="flex gap-1">
                        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                        <div className="w-1 h-1 rounded-full bg-emerald-500/50"></div>
                    </div>
                </div>

                {/* Score Summary */}
                <div className="p-4">
                    <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Current Champion Fitness</div>
                    <div ref={fitnessEl} className="text-4xl font-black text-white font-mono tracking-tighter leading-none mb-4">0</div>

                    {/* Breakdown Grid */}
                    <div className="space-y-3">
                        <AnalysisRow label="Movement" refObj={distanceEl} icon="↔" />
                        <AnalysisRow label="Exploration" refObj={explorationEl} icon="🧭" />
                        <AnalysisRow label="Survival" refObj={survivalEl} icon="⏳" />
                        <AnalysisRow label="Food Bonus" refObj={foodScoreEl} icon="⚡" />
                    </div>

                    {/* Food Target */}
                    <div className="mt-5 pt-4 border-t border-slate-800/50">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ultimate Goal</span>
                            <span ref={foodCountEl} className="text-xs font-mono font-bold text-emerald-400 tracking-tighter">0</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/50">
                            <div ref={foodBarEl} className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500" style={{ width: '0%' }}></div>
                        </div>
                        <div className="text-[8px] text-slate-600 mt-1 uppercase text-center tracking-widest font-bold">Pellets consumed</div>
                    </div>
                </div>

                {/* Sub-Metrics Footer */}
                {/* Odometer/Net Progress Removed */}
            </div>
    );
};

const AnalysisRow = ({ label, refObj, icon }: { label: string, refObj: React.RefObject<HTMLDivElement | null>, icon: string }) => (
    <div className="flex items-center justify-between group">
        <div className="flex items-center gap-2">
            <span className="text-[11px] opacity-40 grayscale group-hover:grayscale-0 transition-all">{icon}</span>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{label}</span>
        </div>
        <div ref={refObj} className="text-[11px] font-bold text-slate-200 font-mono tracking-tight">0</div>
    </div>
);
