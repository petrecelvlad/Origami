import React, { useEffect, useRef, MutableRefObject } from 'react';

interface EnergyBarProps {
    status: 'EDITING' | 'SIMULATING';
    statsRef: MutableRefObject<{ 
        fitness: number; 
        foodEaten: number; 
        distance: number; 
        energy: number; 
        maxEnergy: number; 
    }>;
}

export const EnergyBar: React.FC<EnergyBarProps> = ({ status, statsRef }) => {
    const barRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const reqId = useRef<number>(0);

    useEffect(() => {
        if (status !== 'SIMULATING' || !statsRef) return;

        const update = () => {
            if (statsRef.current) {
                const { energy, maxEnergy } = statsRef.current;
                const percent = Math.max(0, Math.min(100, (energy / maxEnergy) * 100));
                
                if (barRef.current) {
                    barRef.current.style.width = `${percent}%`;
                    
                    // Color shift based on energy
                    if (percent < 25) {
                        barRef.current.className = "h-full bg-red-500 transition-all duration-150 shadow-[0_0_10px_rgba(239,68,68,0.5)]";
                    } else if (percent < 50) {
                        barRef.current.className = "h-full bg-amber-500 transition-all duration-150";
                    } else {
                        barRef.current.className = "h-full bg-green-500 transition-all duration-150 shadow-[0_0_10px_rgba(34,197,94,0.3)]";
                    }
                }
                
                if (textRef.current) {
                    textRef.current.textContent = `${Math.round(energy)} / ${Math.round(maxEnergy)}`;
                }
            }
            reqId.current = requestAnimationFrame(update);
        };
        
        reqId.current = requestAnimationFrame(update);
        
        return () => cancelAnimationFrame(reqId.current);
    }, [status, statsRef]);

    if (status !== 'SIMULATING') return null;

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-none">
            <div className="relative h-6 bg-slate-900/80 backdrop-blur rounded-full border border-slate-700 overflow-hidden shadow-2xl">
                {/* Background Track */}
                <div className="absolute inset-0 bg-slate-800/50"></div>
                
                {/* Fill Bar */}
                <div 
                    ref={barRef}
                    className="h-full bg-green-500 transition-all duration-150"
                    style={{ width: '100%' }}
                >
                    {/* Glossy Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
                </div>

                {/* Label */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] tracking-widest uppercase flex items-center gap-2">
                        <span className="opacity-70">Vitality</span>
                        <span ref={textRef}>100 / 100</span>
                    </span>
                </div>
            </div>
            
            {/* Pulse effect when low */}
            <div className="mt-1 text-center">
                <span className="text-[8px] text-slate-500 font-mono uppercase tracking-tighter">Champion Energy Monitor</span>
            </div>
        </div>
    );
};
