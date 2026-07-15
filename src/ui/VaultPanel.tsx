import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    X, Download, Save,
    Zap, Database, History, CloudUpload
} from 'lucide-react';
import { localVault } from '../infrastructure/local/LocalVault';
import { championCloudVault } from '../infrastructure/cloud/ChampionCloudVault';
import { toast } from 'sonner';
import { FamilyType, LineageRecord } from '../domain/types';
import { FAMILY_COLORS } from '../domain/genetics/GeneticOperator';
import { isAdminBuild } from '../config';

interface VaultPanelProps {
    isOpen: boolean;
    onClose: () => void;
    activeLineage: LineageRecord;
    onLoadBulk: (record: LineageRecord) => void;
}

export const VaultPanel: React.FC<VaultPanelProps> = ({ isOpen, onClose, activeLineage, onLoadBulk }) => {
    const [storedLineage, setStoredLineage] = useState<LineageRecord | null>(null);
    const [loading, setLoading] = useState(false);
    const [cloudLoading, setCloudLoading] = useState(false);

    const fetchLocalData = async () => {
        try {
            const record = await localVault.getMostRecentLineage();
            setStoredLineage(record);
        } catch (err) {
            console.error("Failed to fetch local vault", err);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchLocalData();
        }
    }, [isOpen]);

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
                            {activeLineage.champions.length > 0 && (
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
                                        <span className="text-[9px] font-mono text-slate-500">{activeLineage.champions.length} Families</span>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            setLoading(true);
                                            try {
                                                await localVault.saveLineage(activeLineage);
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

                                    {isAdminBuild && (
                                        <button
                                            onClick={async () => {
                                                setCloudLoading(true);
                                                try {
                                                    await championCloudVault.pushLineage(activeLineage);
                                                    toast.success(`Pushed to Cloud: generation ${activeLineage.generation}`);
                                                } catch (err) {
                                                    toast.error(err instanceof Error ? err.message : 'Cloud push failed');
                                                } finally {
                                                    setCloudLoading(false);
                                                }
                                            }}
                                            disabled={cloudLoading}
                                            className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 bg-sky-600 hover:bg-sky-500 shadow-sky-900/20 shadow-xl text-white"
                                        >
                                            <CloudUpload className="w-4 h-4" />
                                            {cloudLoading ? 'PUSHING...' : 'PUSH TO CLOUD'}
                                        </button>
                                    )}
                                </motion.div>
                            )}

                            {/* Stored Lineage Summary */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-bold uppercase tracking-widest block text-emerald-400">
                                            IndexedDB Archive
                                        </span>
                                        <span className="text-[9px] font-mono text-slate-600 block">
                                            {storedLineage ? `${storedLineage.champions.length} / 10 STORED` : 'EMPTY'}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-2 relative">
                                    {Object.values(FamilyType).map((fam) => {
                                        const champ = storedLineage?.champions.find(c => c.family === fam);
                                        const color = FAMILY_COLORS[fam as FamilyType];

                                        return (
                                            <div
                                                key={fam}
                                                className={`group relative bg-slate-800/40 border-l-4 border-r border-t border-b rounded-xl p-3 transition-all ${champ ? 'border-slate-700/50 opacity-100' : 'border-slate-800/20 opacity-40'}`}
                                                style={{ borderLeftColor: color }}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold text-slate-200 tracking-tight">{fam}</span>
                                                            {!champ && <span className="text-[8px] font-mono text-slate-600 uppercase">DEPOT VACANT</span>}
                                                        </div>

                                                        {champ && (
                                                            <div className="flex items-center gap-3 text-[9px] font-mono text-slate-500">
                                                                <span className="flex items-center gap-1"><History className="w-3 h-3 text-emerald-500/50" /> Gen {champ.generation}</span>
                                                                <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-500/50" /> {Math.round(champ.fitness)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {storedLineage && storedLineage.champions.length > 0 && (
                                    <button
                                        onClick={() => {
                                            if (storedLineage) onLoadBulk(storedLineage);
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
