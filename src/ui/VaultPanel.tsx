import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Archive, X, Trash2, Download, Save, 
    Zap, Database, AlertTriangle, History
} from 'lucide-react';
import { localVault } from '../infrastructure/local/LocalVault';
import { toast } from 'sonner';
import { Organism, FamilyType } from '../domain/types';
import { FAMILY_COLORS } from '../domain/genetics/GeneticOperator';

interface VaultPanelProps {
    isOpen: boolean;
    onClose: () => void;
    activeChampions: Organism[];
    onLoadBulk: (snapshots: Organism[]) => void;
}

export const VaultPanel: React.FC<VaultPanelProps> = ({ isOpen, onClose, activeChampions, onLoadBulk }) => {
    const [localVaultData, setLocalVaultData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showPurgeAllConfirm, setShowPurgeAllConfirm] = useState(false);

    const fetchLocalData = async () => {
        try {
            const data = await localVault.getAllLocalChampions();
            setLocalVaultData(data);
        } catch (err) {
            console.error("Failed to fetch local vault", err);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchLocalData();
        }
    }, [isOpen]);

    const handlePurgeAll = async () => {
        setLoading(true);
        try {
            // Since localVault doesn't have an empty/clear method, we'll suggest manual clearing
            // Or if it does, we should use it. For now let's just toast
            toast.error("Manual purge required via Browser Storage settings");
            setShowPurgeAllConfirm(false);
        } catch (err) {
            toast.error("Mass purge failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                    />

                    {/* Panel */}
                    <motion.div 
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-[400px] bg-slate-900 border-l border-slate-800 z-[101] shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="p-6 border-bottom border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/20 rounded-lg">
                                    <Database className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                                        Cryo-Vault
                                    </h2>
                                    <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Local Genetic Archive</p>
                                </div>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            
                            {/* Manual Snapshot Button */}
                            {activeChampions.length > 0 && (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="p-4 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-800/20 hover:bg-slate-800/40 transition-all space-y-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[10px] font-bold text-slate-200 uppercase tracking-widest">Active Matrix</span>
                                        </div>
                                        <span className="text-[9px] font-mono text-slate-500">{activeChampions.length} Families</span>
                                    </div>
                                    <button 
                                        onClick={async () => {
                                            setLoading(true);
                                            try {
                                                for (const champ of activeChampions) {
                                                    await localVault.saveChampion(champ);
                                                }
                                                fetchLocalData();
                                                toast.success("Matrix Push Successful");
                                            } catch (err) {
                                                toast.error("Matrix Push failed");
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        disabled={loading}
                                        className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20 shadow-xl text-white"
                                    >
                                        <Save className="w-4 h-4" />
                                        {loading ? 'STORING...' : 'PUSH TO LOCAL DRIVE'}
                                    </button>
                                </motion.div>
                            )}

                            {/* Family Slots Grid */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-bold uppercase tracking-widest block text-emerald-400">
                                            IndexedDB Archive
                                        </span>
                                        <span className="text-[9px] font-mono text-slate-600 block">
                                            {localVaultData.length} / 10 STORED
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-2 relative">
                                    {Object.values(FamilyType).map((fam) => {
                                        const entry = localVaultData.find(v => v.snapshot.family === fam || v.id === `slot_${fam}`);
                                        const color = FAMILY_COLORS[fam as FamilyType];

                                        return (
                                            <div 
                                                key={fam}
                                                className={`group relative bg-slate-800/40 border-l-4 border-r border-t border-b rounded-xl p-3 transition-all ${entry ? 'border-slate-700/50 opacity-100' : 'border-slate-800/20 opacity-40'}`}
                                                style={{ borderLeftColor: color }}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold text-slate-200 tracking-tight">{fam}</span>
                                                            {!entry && <span className="text-[8px] font-mono text-slate-600 uppercase">DEPOT VACANT</span>}
                                                        </div>
                                                        
                                                        {entry && (
                                                            <div className="flex items-center gap-3 text-[9px] font-mono text-slate-500">
                                                                <span className="flex items-center gap-1"><History className="w-3 h-3 text-emerald-500/50" /> Gen {entry.snapshot.neuralGenome?.meta?.lineageGeneration || entry.snapshot.generation}</span>
                                                                <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-500/50" /> {Math.round(entry.snapshot.fitness)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {localVaultData.length > 0 && (
                                    <button
                                        onClick={() => {
                                            onLoadBulk(localVaultData.map(d => d.snapshot));
                                        }}
                                        className="w-full mt-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20 shadow-xl text-white"
                                    >
                                        <Download className="w-4 h-4" />
                                        LOAD MATRIX FROM LOCAL DRIVE
                                    </button>
                                )}
                            </div>
                        </div>

                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
