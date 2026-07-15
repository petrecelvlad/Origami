import React, { useEffect, useRef, useState, MutableRefObject } from 'react';
import { FamilyType } from '../domain/types';
import { FAMILY_COLORS } from '../domain/genetics/GeneticOperator';

interface EnergyBarProps {
    status: 'EDITING' | 'SIMULATING';
    statsRef: MutableRefObject<{
        fitness: number;
        foodEaten: number;
        distance: number;
        energy: number;
        maxEnergy: number;
        trackedFamily?: FamilyType | null;
    }>;
    trackedLeaderId?: string | null;
}

export const EnergyBar: React.FC<EnergyBarProps> = ({ status, statsRef, trackedLeaderId }) => {
    const barRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const familyLabelRef = useRef<HTMLSpanElement>(null);
    const familyDotRef = useRef<HTMLSpanElement>(null);
    const reqId = useRef<number>(0);

    const prevLeaderId = useRef<string | null | undefined>(undefined);
    const [justHandedOff, setJustHandedOff] = useState(false);

    // Signal every leader handoff explicitly, instead of letting the bar
    // silently jump to a different creature's energy (read as "healed").
    useEffect(() => {
        if (prevLeaderId.current !== undefined && trackedLeaderId !== prevLeaderId.current) {
            setJustHandedOff(true);
            const timeout = setTimeout(() => setJustHandedOff(false), 1200);
            prevLeaderId.current = trackedLeaderId;
            return () => clearTimeout(timeout);
        }
        prevLeaderId.current = trackedLeaderId;
    }, [trackedLeaderId]);

    useEffect(() => {
        if (status !== 'SIMULATING' || !statsRef) return;

        const update = () => {
            if (statsRef.current) {
                const { energy, maxEnergy, trackedFamily } = statsRef.current;
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

                if (familyLabelRef.current) {
                    familyLabelRef.current.textContent = trackedFamily ? `${trackedFamily} · Vitality` : 'Vitality';
                }
                if (familyDotRef.current) {
                    familyDotRef.current.style.backgroundColor = trackedFamily ? FAMILY_COLORS[trackedFamily] : '#64748b';
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
            <div className={`relative h-6 bg-slate-900/80 backdrop-blur rounded-full border overflow-hidden shadow-2xl transition-all duration-300 ${
                justHandedOff ? 'border-white ring-2 ring-white/70' : 'border-slate-700'
            }`}>
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

            {/* Identity of the creature currently being tracked */}
            <div className="mt-1 flex items-center justify-center gap-1.5">
                <span ref={familyDotRef} className="w-1.5 h-1.5 rounded-full transition-colors duration-300" />
                <span ref={familyLabelRef} className="text-[8px] text-slate-500 font-mono uppercase tracking-tighter">
                    Vitality
                </span>
                {justHandedOff && (
                    <span className="text-[8px] text-white font-mono uppercase tracking-tighter animate-pulse">
                        · New Leader
                    </span>
                )}
            </div>
        </div>
    );
};
