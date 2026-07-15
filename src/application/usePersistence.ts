import { useCallback } from 'react';
import { toast } from 'sonner';
import { EvolutionService } from './EvolutionService';
import { LineageRecord } from '../domain/types';
import { localVault } from '../infrastructure/local/LocalVault';

function downloadJson(data: unknown, filename: string) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * @propolis
 * {
 *   "role": "HOOK",
 *   "dependencies": ["@application/EvolutionService", "@infrastructure/local/LocalVault", "@domain/types"],
 *   "agent_instructions": "A stored/exported record is a LineageRecord (body shell blueprint + champion brains), per Charter invariants 1-2 — never a per-creature body snapshot."
 * }
 */
export function usePersistence(
    serviceRef: React.MutableRefObject<EvolutionService | null>,
    spawnFromLineage: (record: LineageRecord, autoStart: boolean) => void
) {
    const autosaveLineage = useCallback(async () => {
        const record = serviceRef.current?.getLineageRecord();
        if (record && record.champions.length > 0) {
            await localVault.saveLineage(record);
        }
    }, [serviceRef]);

    const autoloadLineage = useCallback(async () => {
        const record = await localVault.getMostRecentLineage();
        if (record) {
            spawnFromLineage(record, false);
        }
    }, [spawnFromLineage]);

    const saveCreature = useCallback(() => {
        const svc = serviceRef.current;
        if (!svc) return;
        const full = svc.getLineageRecord();
        const best = [...full.champions].sort((a, b) => b.fitness - a.fitness)[0];
        if (!best) return;

        const single: LineageRecord = { ...full, champions: [best] };
        downloadJson(single, `creature_${best.family}_gen${single.generation}_${Date.now()}.json`);

        // Persist the full project (every family), not just the exported one.
        localVault.saveLineage(full);
    }, [serviceRef]);

    const loadCreature = useCallback((file: File, onLoaded?: (record: LineageRecord) => void) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = e.target?.result as string;
                const record = JSON.parse(json) as LineageRecord;
                if (!record.blueprint || !record.champions) {
                    alert("Invalid Creature File");
                    return;
                }
                if (onLoaded) onLoaded(record);
            } catch (err) {
                console.error(err);
                alert("Failed to load creature file.");
            }
        };
        reader.readAsText(file);
    }, []);

    const saveBatchChampions = useCallback(async () => {
        const svc = serviceRef.current;
        if (!svc) return;
        const record = svc.getLineageRecord();
        if (record.champions.length === 0) {
            toast.error("No families to save!");
            return;
        }

        const safeName = record.projectName.replace(/\s+/g, '_');
        downloadJson(record, `${safeName}_gen${record.generation}_${Date.now()}.json`);
        toast.success("Lineage saved successfully!");
    }, [serviceRef]);

    const loadBatchCreatures = useCallback((file: File, onLoaded?: (record: LineageRecord) => void) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const record = JSON.parse(e.target?.result as string) as LineageRecord;
                if (onLoaded) onLoaded(record);
                toast.success(`Loaded ${record.champions.length} champions.`);
            } catch (err) {
                toast.error("Failed to load lineage file: " + (err instanceof Error ? err.message : String(err)));
            }
        };
        reader.readAsText(file);
    }, []);

    return {
        saveCreature,
        loadCreature,
        saveBatchChampions,
        loadBatchCreatures,
        autosaveLineage,
        autoloadLineage
    };
}
