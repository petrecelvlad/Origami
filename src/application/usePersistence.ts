import { useCallback } from 'react';
import JSZip from 'jszip';
import { toast } from 'sonner';
import { EvolutionService } from './EvolutionService';
import { Organism } from '../domain/types';
import { localVault } from '../infrastructure/local/LocalVault';
import { Serializer } from './Serializer';

export function usePersistence(
    serviceRef: React.MutableRefObject<EvolutionService | null>, 
    spawnCustom: (organism: Organism, autoStart: boolean, bulkChampions?: Organism[]) => void
) {

    const saveChampionToVault = useCallback(async (org: Organism) => {
        await localVault.saveChampion(org);
    }, []);

    const autosaveChampions = useCallback(async () => {
        const champions = serviceRef.current?.getAllChampions();
        if (champions && champions.length > 0) {
            await localVault.saveAllChampions(champions);
        }
    }, [serviceRef]);

    const autoloadChampions = useCallback(async () => {
        const champions = await localVault.getAllLocalChampions();
        if (champions && champions.length > 0) {
            // Reconstruct creatures from snapshots
            const orgs = champions.map(c => c.snapshot);
            // Inject into simulation
            spawnCustom(orgs[0], false, orgs);
        }
    }, [spawnCustom]);

    const saveCreature = useCallback(() => {
        const best = serviceRef.current?.getBestOrganism();
        if (!best) return;
        
        const serialized = Serializer.serializeOrganism(best);
        const json = JSON.stringify(serialized, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const globalAge = best.neuralGenome?.meta?.lineageGeneration;
        const filename = globalAge ? `creature_gen${globalAge}_${Date.now()}.json` : `creature_gen${best.generation}_${Date.now()}.json`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Also save to vault
        saveChampionToVault(best);
    }, [serviceRef, saveChampionToVault]);

    const loadCreature = useCallback((file: File, onLoaded?: (org: Organism) => void) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = e.target?.result as string;
                const rawObj = JSON.parse(json);
                const organism = Serializer.deserializeOrganism(rawObj);
                if (!organism.nodes || !organism.muscles || !organism.neuralGenome) {
                    alert("Invalid Creature File");
                    return;
                }
                spawnCustom(organism, false);
                if (onLoaded) onLoaded(organism);
            } catch (err) {
                console.error(err);
                alert("Failed to load creature file.");
            }
        };
        reader.readAsText(file);
    }, [spawnCustom]);

    const saveBatchChampions = useCallback(async () => {
        const champions = serviceRef.current?.getAllChampions();
        if (!champions || champions.length === 0) {
            toast.error("No families to save!");
            return;
        }

        const zip = new JSZip();
        champions.forEach((org: any) => {
            const serialized = Serializer.serializeOrganism(org);
            const json = JSON.stringify(serialized, null, 2);
            zip.file(`${org.family || 'unknown'}_creature.json`, json);
        });

        const content = await zip.generateAsync({type: 'blob'});
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = `creature_batch_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Batch saved successfully!");
    }, [serviceRef]);

    const loadBatchCreatures = useCallback((file: File, onLoaded?: (orgs: Organism[]) => void) => {
        JSZip.loadAsync(file).then(async (zip) => {
            const orgs: Organism[] = [];
            const files = Object.keys(zip.files);
            for (const filename of files) {
                if (filename.endsWith('.json')) {
                    const content = await zip.file(filename)?.async('string');
                    if (content) {
                        const rawObj = JSON.parse(content);
                        const org = Serializer.deserializeOrganism(rawObj);
                        orgs.push(org);
                    }
                }
            }
            if (onLoaded) onLoaded(orgs);
            toast.success(`Loaded ${orgs.length} creatures.`);
        }).catch(err => {
            toast.error("Failed to load batch: " + err.message);
        });
    }, []);

    return {
        saveCreature,
        loadCreature,
        saveBatchChampions,
        loadBatchCreatures,
        autosaveChampions,
        autoloadChampions
    };
}
