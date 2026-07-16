/**
 * @propolis
 * {
 *   "role": "GENETIC_OPERATOR",
 *   "dependencies": ["@domain/types", "@domain/genetics/FamilyRegistry"],
 *   "constraints": ["C-003", "C-005"],
 *   "agent_instructions": "Genetic DNA represents the stable blueprint. All mutations must pass through this class to ensure valid parameter clamping."
 * }
 */
import { NeuralGenome, FamilyType } from '../types';
import { FamilyRegistry } from './FamilyRegistry';

export const FAMILY_COLORS: Record<FamilyType, string> = {
    [FamilyType.BRUTE]: '#ef4444',    // Red
    [FamilyType.MONOLITH]: '#3b82f6', // Blue
    [FamilyType.SCOUT]: '#22c55e',    // Green
    [FamilyType.CHARGER]: '#a855f7',  // Purple (R+B)
    [FamilyType.NOMAD]: '#14b8a6',    // Teal (B+G)
    [FamilyType.HUNTER]: '#eab308',   // Yellow (G+R)
    [FamilyType.GUARDIAN]: '#f472b6', // Pink (Charger+Nomad) 
    [FamilyType.PHANTOM]: '#06b6d4',  // Cyan (Nomad+Hunter)
    [FamilyType.WARRIOR]: '#f97316',  // Orange (Hunter+Charger)
    [FamilyType.APEX]: '#ffffff'      // White (The final blend)
};

export class GeneticOperator {
    private mutationRate: number;

    constructor(mutationRate: number = 0.05) {
        this.mutationRate = mutationRate;
    }

    public createRandomGenome(numMuscles: number, numNodes: number, reservoirSize: number = 20, family?: FamilyType): NeuralGenome {
        const genome = {
            synapseWeights: this.randomArray(numMuscles * 2),
            reservoirWeights: this.randomArray(reservoirSize * reservoirSize),
            outputWeights: this.randomArray(numMuscles * reservoirSize),
            gripWeights: this.randomArray(numNodes * reservoirSize),
            biases: this.randomArray(numNodes),
            // Default Evolvable Params
            internalClockSpeed: 1.0,
            waveFreq: 1.5,
            waveSpeed: 1.0,
            vestibularMultiplier: 1.0,
            heartbeatMultiplier: 1.0
        };

        return genome;
    }

    public cloneGenome(source: NeuralGenome, target?: NeuralGenome): NeuralGenome {
        if (!source) {
            throw new Error("cloneGenome failed: source genome is undefined.");
        }

        const copyArray = (src: number[], tgt?: number[]) => {
            if (!src) return tgt || [];
            if (!tgt || tgt.length !== src.length) {
                return [...src];
            }
            for (let i = 0; i < src.length; i++) {
                tgt[i] = src[i];
            }
            return tgt;
        };

        if (target) {
            target.synapseWeights = copyArray(source.synapseWeights, target.synapseWeights);
            target.reservoirWeights = copyArray(source.reservoirWeights, target.reservoirWeights);
            target.outputWeights = copyArray(source.outputWeights, target.outputWeights);
            target.gripWeights = source.gripWeights ? copyArray(source.gripWeights, target.gripWeights) : [];
            target.biases = copyArray(source.biases, target.biases);
            target.internalClockSpeed = source.internalClockSpeed ?? 1.0;
            target.waveFreq = source.waveFreq ?? 1.5;
            target.waveSpeed = source.waveSpeed ?? 1.0;
            target.vestibularMultiplier = source.vestibularMultiplier ?? 1.0;
            target.heartbeatMultiplier = source.heartbeatMultiplier ?? 1.0;
            target.meta = source.meta ? { ...source.meta } : undefined;
            return target;
        }

        return {
            synapseWeights: source.synapseWeights ? [...source.synapseWeights] : [],
            reservoirWeights: source.reservoirWeights ? [...source.reservoirWeights] : [],
            outputWeights: source.outputWeights ? [...source.outputWeights] : [],
            gripWeights: source.gripWeights ? [...source.gripWeights] : [],
            biases: source.biases ? [...source.biases] : [],
            internalClockSpeed: source.internalClockSpeed ?? 1.0,
            waveFreq: source.waveFreq ?? 1.5,
            waveSpeed: source.waveSpeed ?? 1.0,
            vestibularMultiplier: source.vestibularMultiplier ?? 1.0,
            heartbeatMultiplier: source.heartbeatMultiplier ?? 1.0,
            meta: source.meta ? { ...source.meta } : undefined
        };
    }

    public mutateGenome(genome: NeuralGenome, customRate?: number): void {
        const rate = customRate ?? this.mutationRate;
        const mutateArray = (arr: number[]) => {
            if (!arr) return;
            for(let i=0; i<arr.length; i++) {
                if (Math.random() < rate) {
                    arr[i] += (Math.random() - 0.5) * 0.5;
                    if (arr[i] > 2) arr[i] = 2;
                    if (arr[i] < -2) arr[i] = -2;
                }
            }
        };

        mutateArray(genome.synapseWeights);
        mutateArray(genome.reservoirWeights);
        mutateArray(genome.outputWeights);
        mutateArray(genome.gripWeights);
        mutateArray(genome.biases);

        // Mutate Parameters
        if (Math.random() < rate) {
            genome.internalClockSpeed += (Math.random() - 0.5) * 0.2;
            genome.internalClockSpeed = Math.max(0.5, Math.min(2.0, genome.internalClockSpeed));
        }
        if (Math.random() < rate) {
            genome.waveFreq += (Math.random() - 0.5) * 0.5;
            genome.waveFreq = Math.max(0.2, Math.min(4.0, genome.waveFreq));
        }
        if (Math.random() < rate) {
            genome.waveSpeed += (Math.random() - 0.5) * 0.2;
            genome.waveSpeed = Math.max(0.1, Math.min(3.0, genome.waveSpeed));
        }
        if (Math.random() < rate) {
            genome.vestibularMultiplier += (Math.random() - 0.5) * 0.2;
            genome.vestibularMultiplier = Math.max(0.0, Math.min(2.0, genome.vestibularMultiplier));
        }
        if (Math.random() < rate) {
            genome.heartbeatMultiplier += (Math.random() - 0.5) * 0.2;
            genome.heartbeatMultiplier = Math.max(0.0, Math.min(2.0, genome.heartbeatMultiplier));
        }
    }

    /**
     * @logic_seal
     * {
     *   "intent": "Perform module-aware crossover between two parents, favoring functional blocks over random weight mixing.",
     *   "agent_instructions": "Maintain the 80/20 dominance bias to preserve successful behavioral modules."
     * }
     */
    public crossoverGenomes(parentA: NeuralGenome, parentB: NeuralGenome, target?: NeuralGenome): NeuralGenome {
        // MODULE-AWARE CROSSOVER (Block Swapping)
        // Instead of randomizing every single weight (scrambling the brain), 
        // we swap entire functional modules with a heavy bias towards Parent A.
        const crossoverModule = (arrA: number[], arrB: number[], tgt?: number[]) => {
            if (!arrA || !arrB) return arrA || arrB || [];
            
            // Bias: 80% chance to take the functional plan of Parent A
            const dominance = Math.random();
            if (dominance < 0.8) return [...arrA];
            if (dominance > 0.95) return [...arrB];
            
            // 15% chance of a "Block Swap" crossover
            let res = tgt;
            if (!res || res.length !== arrA.length) {
                res = new Array(arrA.length);
            }
            // Continuous chunk swap
            const split = Math.floor(Math.random() * arrA.length);
            for(let i=0; i<arrA.length; i++) {
                res[i] = i < split ? arrA[i] : arrB[i];
            }
            return res;
        };

        if (target) {
            target.synapseWeights = crossoverModule(parentA.synapseWeights, parentB.synapseWeights, target.synapseWeights);
            target.reservoirWeights = crossoverModule(parentA.reservoirWeights, parentB.reservoirWeights, target.reservoirWeights);
            target.outputWeights = crossoverModule(parentA.outputWeights, parentB.outputWeights, target.outputWeights);
            target.gripWeights = crossoverModule(parentA.gripWeights || [], parentB.gripWeights || [], target.gripWeights);
            target.biases = crossoverModule(parentA.biases, parentB.biases, target.biases);
            
            // Parameters swap as single units
            const pBias = Math.random();
            target.internalClockSpeed = pBias < 0.8 ? parentA.internalClockSpeed : parentB.internalClockSpeed;
            target.waveFreq = pBias < 0.8 ? parentA.waveFreq : parentB.waveFreq;
            target.waveSpeed = pBias < 0.8 ? parentA.waveSpeed : parentB.waveSpeed;
            target.vestibularMultiplier = pBias < 0.8 ? parentA.vestibularMultiplier : parentB.vestibularMultiplier;
            target.heartbeatMultiplier = pBias < 0.8 ? parentA.heartbeatMultiplier : parentB.heartbeatMultiplier;
            
            target.meta = parentA.meta ? { ...parentA.meta } : (parentB.meta ? { ...parentB.meta } : undefined);
            return target;
        }

        return {
            synapseWeights: crossoverModule(parentA.synapseWeights, parentB.synapseWeights),
            reservoirWeights: crossoverModule(parentA.reservoirWeights, parentB.reservoirWeights),
            outputWeights: crossoverModule(parentA.outputWeights, parentB.outputWeights),
            gripWeights: crossoverModule(parentA.gripWeights || [], parentB.gripWeights || []),
            biases: crossoverModule(parentA.biases, parentB.biases),
            internalClockSpeed: Math.random() < 0.8 ? parentA.internalClockSpeed : parentB.internalClockSpeed,
            waveFreq: Math.random() < 0.8 ? parentA.waveFreq : parentB.waveFreq,
            waveSpeed: Math.random() < 0.8 ? parentA.waveSpeed : parentB.waveSpeed,
            vestibularMultiplier: Math.random() < 0.8 ? parentA.vestibularMultiplier : parentB.vestibularMultiplier,
            heartbeatMultiplier: Math.random() < 0.8 ? parentA.heartbeatMultiplier : parentB.heartbeatMultiplier,
            meta: parentA.meta ? { ...parentA.meta } : (parentB.meta ? { ...parentB.meta } : undefined)
        };
    }

    private randomArray(size: number): number[] {
        return Array.from({ length: size }, () => (Math.random() * 1.0) - 0.5);
    }

    public static synthesizeFamily(p1: FamilyType, p2: FamilyType): FamilyType {
        return FamilyRegistry.synthesize(p1, p2);
    }
}
