/**
 * @propolis
 * {
 *   "role": "GENETIC_OPERATOR",
 *   "dependencies": ["@domain/types", "@domain/fitness/NoveltyService", "@domain/constants"],
 *   "constraints": ["C-005", "C-006"],
 *   "agent_instructions": "This evaluator defines the selection pressure. Fitness values must be positive and finite."
 * }
 */
import { Organism, FamilyType, CellType } from '../types';
import { DEFAULT_EVOLUTION_CONFIG } from '../constants';

export interface IFitnessEvaluator {
    evaluate(organism: Organism, dt: number): void;
    finalize(organism: Organism): void;
}

export class StandardFitnessEvaluator implements IFitnessEvaluator {
    /**
     * @logic_seal
     * {
     *   "intent": "Calculate the real-time fitness score based on odometer (distance), territory exploration, and food consumption.",
     *   "agent_instructions": "Maintain the staggered food score increment to prioritize consistent foragers over simple wanderers."
     * }
     */
    evaluate(organism: Organism, dt: number): void {
        if (organism.timeAlive === undefined) organism.timeAlive = 0;
        organism.timeAlive += dt * 1000;

        // Initialize Territory Tracking
        if (!organism.visitedTiles) organism.visitedTiles = {};
        if (organism.odometer === undefined) organism.odometer = 0;

        const head = organism.headNode;
        if (head) {
            // --- ODOMETRY ---
            if (!organism.lastSampledPos) {
                organism.lastSampledPos = { ...head.pos };
            } else {
                const dx = head.pos.x - organism.lastSampledPos.x;
                const dy = head.pos.y - organism.lastSampledPos.y;
                const dz = head.pos.z - organism.lastSampledPos.z;
                const frameDist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                
                if (frameDist > 0.01 && frameDist < 2.0) {
                    organism.odometer += frameDist;
                    organism.distanceTraveled = organism.odometer;
                }
                organism.lastSampledPos = { ...head.pos };
            }

            // --- TERRITORY ---
            const gridX = Math.floor(head.pos.x);
            const gridZ = Math.floor(head.pos.z);
            const tileKey = `${gridX},${gridZ}`;
            
            if (!organism.visitedTiles[tileKey]) {
                organism.visitedTiles[tileKey] = true;
            }
            const visitedCount = Object.keys(organism.visitedTiles).length;

            // --- FINAL CALCULATION ---
            const pathScore = organism.odometer * DEFAULT_EVOLUTION_CONFIG.odometryScale;
            const explorationScore = visitedCount * DEFAULT_EVOLUTION_CONFIG.territoryScale;
            const timeScore = (organism.timeAlive / 1000) * DEFAULT_EVOLUTION_CONFIG.timeScale;
            
            const foodScore = (organism.foodEaten * (organism.foodEaten + 1) / 2) * DEFAULT_EVOLUTION_CONFIG.foodScoreIncrement || 3;

            organism.fitness = pathScore + explorationScore + timeScore + foodScore;

            organism.fitnessBreakdown = {
                distanceScore: pathScore,
                explorationScore: explorationScore,
                survivalScore: timeScore,
                foodScore: foodScore
            };
        }
        
        if (!isFinite(organism.fitness)) organism.fitness = 0;
        if (organism.fitness < 0) organism.fitness = 0;
    }

    finalize(organism: Organism): void {
        // Cleanup 
        delete (organism as any)._feetNodes;
        delete (organism as any)._behaviorSamples;
        delete (organism as any)._heightSumSq;
    }
}
