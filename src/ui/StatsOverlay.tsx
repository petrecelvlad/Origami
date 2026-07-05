import React, { useEffect, useRef, MutableRefObject } from 'react';

interface StatsOverlayProps {
    status: 'EDITING' | 'SIMULATING';
    stats?: { fitness: number; foodEaten: number; distance: number }; // Legacy prop support
    statsRef?: MutableRefObject<{ 
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
    }>; // New Fast Prop
    aliveCount?: number;
    totalCount?: number;
    cellCount: number;
    isProcessing?: boolean;
    progress?: number;
    fitnessHistory: number[]; 
    currentGeneration: number;
    cycleTrackedLeader: (dir: 1 | -1) => void;
}

const FitnessGraph: React.FC<{ history: number[], currentGen: number }> = ({ history, currentGen }) => {
    if (!history || history.length < 2) return null;

    const width = 140;
    const height = 40;
    const padding = 2;

    const maxVal = Math.max(...history, 1); // Remove hardcoded 10
    const minVal = Math.min(...history, 0); 
    
    const range = (maxVal - minVal) * 1.1 || 1; // Add 10% breathing room
    
    // Calculate start generation for the graph
    const startGen = Math.max(1, currentGen - history.length + 1);
    
    const points = history.map((val, i) => {
        const x = (i / (history.length - 1)) * (width - padding * 2) + padding;
        const normalizedY = (val - minVal) / range;
        const y = height - (normalizedY * (height - padding * 2) + padding);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="mt-2">
            <div className="flex justify-between text-[9px] text-slate-500 font-mono mb-1">
                <span>GEN {startGen}</span>
                <span>GEN {currentGen}</span>
            </div>
            <div className="relative border border-slate-700 bg-slate-900/50 rounded overflow-hidden shadow-inner">
                <div className="absolute inset-x-0 h-[1px] bg-slate-800 top-1/2 opacity-50" />
                <svg width={width} height={height} className="block overflow-visible">
                    <defs>
                        <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style={{stopColor:'rgb(74, 222, 128)', stopOpacity:0.4}} />
                        <stop offset="100%" style={{stopColor:'rgb(74, 222, 128)', stopOpacity:0}} />
                        </linearGradient>
                    </defs>
                    <polygon 
                        points={`0,${height} ${points} ${width},${height}`} 
                        fill="url(#grad1)" 
                    />
                    <polyline 
                        fill="none" 
                        stroke="#4ade80" 
                        strokeWidth="2" 
                        strokeLinejoin="round"
                        points={points} 
                        vectorEffect="non-scaling-stroke"
                    />
                    {/* Pulsing Dot at current value */}
                    {history.length > 0 && (
                        <circle 
                            cx={width - padding} 
                            cy={height - ((history[history.length-1] - minVal) / range * (height - padding * 2) + padding)} 
                            r="2" 
                            fill="#4ade80" 
                        />
                    )}
                </svg>
                <div className="absolute top-0 right-1 text-[9px] text-green-400 font-bold opacity-100 bg-slate-900/40 px-1 rounded">
                    {Math.round(maxVal).toLocaleString()}
                </div>
            </div>
        </div>
    );
};

export const StatsOverlay: React.FC<StatsOverlayProps> = ({ status, stats, statsRef, aliveCount, totalCount, cellCount, isProcessing, progress, fitnessHistory, currentGeneration, cycleTrackedLeader }) => {
    const fitnessEl = useRef<HTMLDivElement>(null);
    const avgFitnessEl = useRef<HTMLDivElement>(null);
    const aliveEl = useRef<HTMLDivElement>(null);
    const projectEl = useRef<HTMLHeadingElement>(null);
    const globalAgeEl = useRef<HTMLSpanElement>(null);
    const reqId = useRef<number>(0);

    // High Frequency Update Loop
    useEffect(() => {
        if (status !== 'SIMULATING' || !statsRef) return;

        const update = () => {
            if (statsRef.current) {
                if (fitnessEl.current) {
                    fitnessEl.current.textContent = Math.round(statsRef.current.fitness).toLocaleString();
                }
                if (avgFitnessEl.current) {
                    avgFitnessEl.current.textContent = Math.round(statsRef.current.avgFitness).toLocaleString();
                }
                if (aliveEl.current) {
                    aliveEl.current.textContent = `${statsRef.current.aliveCount}/${statsRef.current.totalCount}`;
                }
                if (projectEl.current) {
                    projectEl.current.textContent = statsRef.current.projectName || 'ORIGAMI';
                }
                if (globalAgeEl.current) {
                    globalAgeEl.current.textContent = statsRef.current.globalAge > 0 
                        ? `TOTAL AGE: ${statsRef.current.globalAge} GENS`
                        : '';
                }
            }
            reqId.current = requestAnimationFrame(update);
        };
        
        reqId.current = requestAnimationFrame(update);
        
        return () => cancelAnimationFrame(reqId.current);
    }, [status, statsRef, aliveCount, totalCount]);

    return (
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-xl overflow-hidden shadow-2xl pointer-events-auto">
            {/* Title */}
                <div className="flex items-center gap-2 pl-4 py-2 border-b border-slate-800">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <div>
                        <h1 ref={projectEl} className="text-[10px] font-bold text-slate-300 tracking-widest leading-none">ORIGAMI</h1>
                        <span ref={globalAgeEl} className="text-[8px] font-bold text-blue-400 font-mono uppercase tracking-wider block mt-0.5"></span>
                    </div>
                </div>

                {/* Dynamic Content */}
                {status === 'EDITING' ? (
                     <div className="bg-slate-900/50 backdrop-blur border-l-2 border-blue-500 pl-3 py-1 pr-4 rounded-r-lg">
                         <div className="text-xs text-slate-500 font-mono uppercase tracking-tighter">Genetic Blueprint</div>
                         <div className="text-xl font-bold text-white leading-none mt-1">{cellCount} <span className="text-xs text-slate-600 font-normal">CELLS</span></div>
                     </div>
                ) : (
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                             <div className="flex items-center gap-1">
                                 <button onClick={() => cycleTrackedLeader(-1)} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs">◀</button>
                                 <button onClick={() => cycleTrackedLeader(1)} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs">▶</button>
                             </div>
                             <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Follow Camera</div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <div className="text-[9px] text-slate-500 font-bold font-mono uppercase tracking-widest mb-0.5">Peak Fitness</div>
                                <div ref={fitnessEl} className="text-xl font-black text-emerald-400 font-mono tracking-tighter leading-none">0</div>
                            </div>
                            <div className="flex-1">
                                <div className="text-[9px] text-slate-500 font-bold font-mono uppercase tracking-widest mb-0.5">Gen Avg</div>
                                <div ref={avgFitnessEl} className="text-xl font-bold text-slate-400 font-mono tracking-tighter leading-none">0</div>
                            </div>
                            <div className="flex-1">
                                <div className="text-[9px] text-slate-500 font-bold font-mono uppercase tracking-widest mb-0.5">Bots</div>
                                <div ref={aliveEl} className="text-xl font-bold text-white font-mono tracking-tighter leading-none">0/0</div>
                            </div>
                        </div>
                        
                        <FitnessGraph history={fitnessHistory} currentGen={currentGeneration} />
                    </div>
                )}
            
                {isProcessing && (
                    <div className="w-full bg-slate-900/80 rounded border border-slate-700 overflow-hidden">
                        <div className="h-1 bg-purple-500 transition-all duration-300" style={{ width: `${(progress || 0) * 100}%` }} />
                        <div className="px-2 py-1 text-[10px] text-purple-300 font-bold text-center">
                            WARPING... {Math.round((progress || 0) * 100)}%
                        </div>
                    </div>
                )}
            </div>
    );
};