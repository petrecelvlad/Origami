import { Organism, ShapeType } from './types';
import { BlueprintService } from './BlueprintService';
import { Serializer } from '../application/Serializer';

/**
 * The AtomicNormalizer protocol guarantees that any Organism JSON snapshot, 
 * regardless of its physical state at save-time, is structurally reset to a
 * pristine, stable, and simulation-ready state without destroying neural mappings.
 */
export class AtomicNormalizer {
    public static sanitize(org: Organism): Organism {
        console.log(`[AtomicNormalizer] Re-growing pristine clone for ID: ${org.id}, Shape: ${org.shape}`);
        
        // 1. Defensively copy to strip any runtime references (like 'brain')
        const safeOrgSource = Serializer.deserializeOrganism(Serializer.serializeOrganism(org));

        // 2. Instantiate an isolated blueprint re-builder
        const blueprint = new BlueprintService();
        blueprint.setType(safeOrgSource.shape || ShapeType.CUBE);
        
        // 3. Extract pure layout DNA (ignores all physics state, velocities, rotations, 
        // twisted shapes, and CPU-crashing subnormal floats)
        blueprint.importOrganism(safeOrgSource);
        
        // 4. Generate a 100% mathematically pristine body in a default T-pose at [0,0,0]
        // and automatically graft the original neural genome onto it.
        const pristineClone = blueprint.generateOrganism(safeOrgSource.id, safeOrgSource);
        
        // 5. Lineage Guard (Metadata Sanitization)
        if (!pristineClone.neuralGenome) {
            console.warn(`[LineageGuard] Missing neuralGenome in snapshot. Engine may reject this organism.`);
        } else {
            let meta = pristineClone.neuralGenome.meta;
            if (!meta) {
                console.warn(`[LineageGuard] Missing LineageMetadata! Defaulting to Generation 1.`);
                meta = {
                    lineageId: `lin_recovery_${Date.now()}`,
                    projectName: 'Recovered Subject',
                    lineageGeneration: org.generation || 1,
                    originDate: new Date().toISOString()
                };
                pristineClone.neuralGenome.meta = meta;
            }
            
            if (typeof meta.lineageGeneration !== 'number' || isNaN(meta.lineageGeneration)) {
                console.warn(`[LineageGuard] lineageGeneration corrupted. Resetting to Generation 1.`);
                meta.lineageGeneration = 1;
            }

            // Sync top-level generation to absolute SOT
            pristineClone.generation = meta.lineageGeneration;
        }

        pristineClone.family = org.family;

        console.log(`[AtomicNormalizer] Brain Transplant Complete. Spawned pristine body with ${pristineClone.nodes.length} nodes and ${pristineClone.muscles.length} pure muscles.`);
        return pristineClone;
    }
}
