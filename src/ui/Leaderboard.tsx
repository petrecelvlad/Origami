import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Organism, FamilyType } from '../domain/types';
import { FAMILY_COLORS } from '../domain/genetics/GeneticOperator';

interface LeaderboardProps {
    population: Organism[];
    familyOrder: FamilyType[]; // Add familyOrder prop
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ population, familyOrder }) => {
    const familyStats = useMemo(() => {
        const stats: Record<FamilyType, { 
            champion: Organism | null, 
            total: number, 
            alive: number 
        }> = {} as any;

        Object.values(FamilyType).forEach(fam => {
            stats[fam] = { champion: null, total: 0, alive: 0 };
        });

        population.forEach(org => {
            const fam = org.family as FamilyType;
            if (!stats[fam]) return;

            stats[fam].total++;
            if (org.isAlive) {
                stats[fam].alive++;
                if (!stats[fam].champion || (org.fitness || 0) > (stats[fam].champion!.fitness || 0)) {
                    stats[fam].champion = org;
                }
            }
        });

        // Convert to array and sort by fitness (descending)
        return Object.entries(stats)
            .map(([fam, data]) => [fam as FamilyType, data] as [FamilyType, typeof stats[FamilyType]])
            .sort((a, b) => (b[1].champion?.fitness || -1) - (a[1].champion?.fitness || -1));
    }, [population]);

    return (
        <div className="absolute top-24 left-4 w-60 bg-slate-950/80 p-3 rounded-xl text-white backdrop-blur-md border border-slate-800 shadow-2xl z-40 max-h-[80vh] overflow-y-auto pointer-events-auto">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Family Leaderboard</h2>
            <div className="space-y-1.5">
                <AnimatePresence mode="popLayout">
                    {familyStats.map(([fam, data]) => (
                        <motion.div 
                            key={fam}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="flex flex-col p-2 rounded-lg bg-slate-900 border border-slate-800"
                            style={{ borderLeftWidth: '3px', borderLeftColor: FAMILY_COLORS[fam as FamilyType] }}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex flex-col shrink-0">
                                    <span className="font-bold text-xs tracking-tight" style={{ color: FAMILY_COLORS[fam as FamilyType] }}>{fam}</span>
                                </div>
                                <div className="flex-1 text-right">
                                    <div className="text-sm font-black font-mono tracking-tighter text-white">{(data.champion?.fitness || 0).toFixed(0)}</div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-[8px] text-emerald-400 font-mono font-bold leading-none">
                                        F: {data.champion?.foodEaten || 0}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Dynamic Population Bars */}
                            <div className="mt-2 flex gap-0.5 h-1 w-full overflow-hidden">
                                {Array.from({ length: Math.max(10, data.alive) }).map((_, i) => (
                                    <div 
                                        key={i}
                                        className="h-full flex-1 rounded-[1px] transition-colors duration-300"
                                        style={{ 
                                            backgroundColor: i < data.alive 
                                                ? FAMILY_COLORS[fam] 
                                                : 'rgba(255,255,255,0.05)' 
                                        }}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};
