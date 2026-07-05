import { Organism, Node, Muscle, NeuralGenome, FoodItem } from '../domain/types';

/**
 * @propolis
 * {
 *   "role": "VAULT",
 *   "dependencies": ["@domain/types"],
 *   "agent_instructions": "Handles the deep serialization of complex organisms. Ensure circular references are stripped before storage."
 * }
 */
export class Serializer {
    /**
     * Deeply freezes/serializes an organism for storage (IndexedDB/Firebase)
     * Strips out circular references and runtime instances (like brain, nodeRefs).
     */
    public static serializeOrganism(org: Organism): Omit<Organism, 'brain' | 'headNode'> {
        return {
            id: org.id,
            family: org.family,
            color: org.color,
            shape: org.shape,
            // Reconstruct nodes without potentially problematic states
            nodes: org.nodes.map(n => ({
                id: n.id,
                pos: { x: n.pos.x, y: n.pos.y, z: n.pos.z },
                oldPos: { x: n.oldPos.x, y: n.oldPos.y, z: n.oldPos.z },
                mass: n.mass,
                friction: n.friction,
                isFixed: n.isFixed,
                isHead: n.isHead,
                isGripping: n.isGripping,
                gripSignal: n.gripSignal,
                gripStamina: n.gripStamina,
                gripCooldown: n.gripCooldown,
                currentStress: n.currentStress,
                originalGridCoord: n.originalGridCoord ? { ...n.originalGridCoord } : undefined,
                cellType: n.cellType
            })),
            // Reconstruct muscles without nodeRefs
            muscles: org.muscles.map(m => ({
                id: m.id,
                nodeA: m.nodeA,
                nodeB: m.nodeB,
                baseLength: m.baseLength,
                stiffness: m.stiffness,
                dnaIndex: m.dnaIndex,
                currentLength: m.currentLength,
                targetLength: m.targetLength,
                phase: m.phase,
                freq: m.freq,
                amp: m.amp,
                isMirrored: m.isMirrored,
                mirrorMuscleId: m.mirrorMuscleId
            })),
            neuralGenome: { ...org.neuralGenome, meta: org.neuralGenome.meta ? { ...org.neuralGenome.meta } : undefined },
            fitness: org.fitness,
            generation: org.generation,
            initialHeadPos: { x: org.initialHeadPos.x, y: org.initialHeadPos.y, z: org.initialHeadPos.z },
            distanceTraveled: org.distanceTraveled,
            lastSampledPos: org.lastSampledPos ? { x: org.lastSampledPos.x, y: org.lastSampledPos.y, z: org.lastSampledPos.z } : undefined,
            odometer: org.odometer,
            visitedTiles: org.visitedTiles ? { ...org.visitedTiles } : undefined,
            // odometerTimer skipped or included
            odometerTimer: org.odometerTimer,
            energy: org.energy,
            maxEnergy: org.maxEnergy,
            hungerTime: org.hungerTime,
            timeAlive: org.timeAlive,
            isAlive: org.isAlive,
            foodEaten: org.foodEaten,
            foodForBreeding: org.foodForBreeding,
            totalFoodEaten: org.totalFoodEaten,
            visibleFood: org.visibleFood.map(f => ({ ...f })), // Shallow copy visible defaults
        } as Omit<Organism, 'brain' | 'headNode'>;
    }

    /**
     * Parses a stringified or raw JSON organism and returns a safely formatted complete Organism.
     * Note: "brain" property is omitted inherently and must be re-attached using a Neural engine.
     */
    public static deserializeOrganism(data: any): Organism {
        // Fallback for when data parsed might be null or deeply malformed
        if (!data || typeof data !== 'object') throw new Error('Invalid organism data structure');
        
        const nodes: Node[] = (data.nodes || []).map((n: any) => ({
            ...n
        }));

        const muscles: Muscle[] = (data.muscles || []).map((m: any) => ({
            ...m
        }));

        // Link nodeRefs dynamically 
        muscles.forEach(m => {
             m.nodeRefA = nodes.find(node => node.id === m.nodeA);
             m.nodeRefB = nodes.find(node => node.id === m.nodeB);
        });

        const orgBase: Organism = {
            id: data.id || `org_${Math.random().toString(36).substring(7)}`,
            family: data.family,
            color: data.color || '#ffffff',
            shape: data.shape || 'CUBE',
            nodes,
            muscles,
            neuralGenome: { ...data.neuralGenome },
            fitness: typeof data.fitness === 'number' ? data.fitness : 0,
            generation: typeof data.generation === 'number' ? data.generation : 0,
            initialHeadPos: data.initialHeadPos || { x: 0, y: 0, z: 0 },
            distanceTraveled: typeof data.distanceTraveled === 'number' ? data.distanceTraveled : 0,
            odometer: typeof data.odometer === 'number' ? data.odometer : 0,
            lastSampledPos: data.lastSampledPos,
            visitedTiles: data.visitedTiles || {},
            energy: typeof data.energy === 'number' ? data.energy : 100,
            maxEnergy: typeof data.maxEnergy === 'number' ? data.maxEnergy : 100,
            hungerTime: typeof data.hungerTime === 'number' ? data.hungerTime : 0,
            timeAlive: typeof data.timeAlive === 'number' ? data.timeAlive : 0,
            isAlive: data.isAlive ?? true,
            foodEaten: typeof data.foodEaten === 'number' ? data.foodEaten : 0,
            foodForBreeding: typeof data.foodForBreeding === 'number' ? data.foodForBreeding : 0,
            totalFoodEaten: typeof data.totalFoodEaten === 'number' ? data.totalFoodEaten : (typeof data.foodEaten === 'number' ? data.foodEaten : 0),
            visibleFood: data.visibleFood || []
        };

        orgBase.headNode = nodes.find(n => n.isHead);
        
        return orgBase;
    }
}
