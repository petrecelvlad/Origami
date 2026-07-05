import { Organism } from '../../domain/types';

/**
 * PHASE 1: Structure of Arrays (SoA) Layout
 * Instead of thousands of Javascript objects, we allocate massive contiguous 
 * Float32Arrays. This is the exact format WebGPU natively understands.
 * 
 * We use a "Stride of 4" (vec4) to perfectly align with WGSL memory padding rules.
 */
/**
 * @propolis
 * {
 *   "role": "PIPELINE",
 *   "dependencies": ["@domain/types"],
 *   "constraints": ["C-001", "C-002"],
 *   "agent_instructions": "This class manages the contiguous Float32Arrays for WebGPU. Data must be aligned to vec4 (Stride of 4) for WGSL compatibility."
 * }
 */
export class SimulationMemory {
    public maxNodes: number;
    public maxMuscles: number;

    // --- NODE BUFFERS (vec4 arrays) ---
    // Stride 4: [x, y, z, padding]
    public nodePositions: Float32Array; 
    // Stride 4: [vx, vy, vz, padding]
    public nodeVelocities: Float32Array; 
    // Stride 4: [mass, friction, isFixed, cellType]
    public nodeProperties: Float32Array; 
    
    // NEW Stride 4: [stamina, cooldown, signal, isGripping]
    public nodeGripState: Float32Array;

    // --- MUSCLE BUFFERS (vec4 arrays) ---
    // Stride 4: [nodeA_index, nodeB_index, mirror_index, isMirrored]
    public muscleIndices: Float32Array; 
    // Stride 4: [baseLength, targetLength, currentLength, stiffness]
    public muscleProperties: Float32Array; 
    // Stride 4: [phase, frequency, amplitude, padding]
    public muscleOscillators: Float32Array;

    // --- NEURAL BUFFERS ---
    // Instead of CPG object arrays, we store them globally.
    // Assuming max nodes per network is 20 (CPG size=20 currently).
    public cpgBufferA: Float32Array;
    public cpgBufferB: Float32Array;
    // Each organism has a max of 400 (20x20) reservoir weights
    public brainWeights: Float32Array;
    public networkParams: Float32Array; // [internalClockSpeed, waveFreq, waveSpeed, padding]

    // --- VISION BUFFERS ---
    public headNodeIndices: Uint32Array; 
    public foodPositions: Float32Array; // Stride 4: [x,y,z, consumedStatus]

    // Tracking how much of the buffer is actively used
    public activeNodeCount: number = 0;
    public activeMuscleCount: number = 0;
    public activeOrganismCount: number = 0;

    constructor(maxNodes: number = 20000, maxMuscles: number = 40000) {
        this.maxNodes = maxNodes;
        this.maxMuscles = maxMuscles;
        const maxOrganisms = 2000;
        const maxFoodPerOrg = 20;

        console.log(`[WebGPU Memory] Allocating master buffers for ${maxNodes} nodes...`);

        // Multiply by 4 because each vec4 has 4 floats
        this.nodePositions = new Float32Array(maxNodes * 4);
        this.nodeVelocities = new Float32Array(maxNodes * 4);
        this.nodeProperties = new Float32Array(maxNodes * 4);
        this.nodeGripState = new Float32Array(maxNodes * 4);

        this.muscleIndices = new Float32Array(maxMuscles * 4);
        this.muscleProperties = new Float32Array(maxMuscles * 4);
        this.muscleOscillators = new Float32Array(maxMuscles * 4);

        this.cpgBufferA = new Float32Array(maxOrganisms * 20);
        this.cpgBufferB = new Float32Array(maxOrganisms * 20);
        this.brainWeights = new Float32Array(maxOrganisms * 400);
        this.networkParams = new Float32Array(maxOrganisms * 4);

        this.headNodeIndices = new Uint32Array(maxOrganisms);
        this.foodPositions = new Float32Array(maxOrganisms * maxFoodPerOrg * 4);
    }

    /**
     * Re-syncs the object-oriented positions from the contiguous array 
     * after the graphic card has finished calculating physics.
     */
    public syncToPopulation(population: Organism[]): void {
        let nodeOffset = 0;
        let muscleOffset = 0;

        for (const org of population) {
            if (!org.isAlive) continue;

            for (let i = 0; i < org.nodes.length; i++) {
                const n = org.nodes[i];
                const idx = (nodeOffset + i) * 4;

                // Sync new positions back from GPU
                n.oldPos.x = n.pos.x;
                n.oldPos.y = n.pos.y;
                n.oldPos.z = n.pos.z;

                n.pos.x = this.nodePositions[idx + 0];
                n.pos.y = this.nodePositions[idx + 1];
                n.pos.z = this.nodePositions[idx + 2];

                // Sync Grip State back from GPU
                const gIdx = (nodeOffset + i) * 4;
                n.gripStamina = this.nodeGripState[gIdx + 0];
                n.gripCooldown = this.nodeGripState[gIdx + 1];
                n.isGripping = this.nodeGripState[gIdx + 3] > 0.5;
            }

            for (let i = 0; i < org.muscles.length; i++) {
                const m = org.muscles[i];
                const idx = (muscleOffset + i) * 4;
                // Sync lengths 
                m.currentLength = this.muscleProperties[idx + 2];
            }

            nodeOffset += org.nodes.length;
            muscleOffset += org.muscles.length;
        }
    }

    /**
     * The Bridge: Converts the Object-Oriented JS array into the flat Float32Arrays 
     * ready to be shipped directly to VRAM.
     */
    /**
     * @logic_seal
     * {
     *   "intent": "Flatten the object-oriented population into primitive buffers for GPU transfer.",
     *   "agent_instructions": "Mapping logic must account for global node/muscle offsets to maintain relational integrity."
     * }
     */
    public syncFromPopulation(population: Organism[], dt: number): void {
        let nodeOffset = 0;
        let muscleOffset = 0;
        let orgOffset = 0;

        for (const org of population) {
            if (!org.isAlive) continue;

            const orgBaseNodeIdx = nodeOffset;

            // 1. Flatten Neural Params
            const bIdx = orgOffset * 4;
            const genome = org.neuralGenome;
            this.networkParams[bIdx + 0] = genome?.internalClockSpeed || 1.0;
            this.networkParams[bIdx + 1] = genome?.waveFreq || 1.5;
            this.networkParams[bIdx + 2] = genome?.waveSpeed || 1.0;
            this.networkParams[bIdx + 3] = 0.0;

            if (genome?.reservoirWeights) {
                // Limit to 400 weights (20x20)
                const copyLen = Math.min(genome.reservoirWeights.length, 400);
                const wOffset = orgOffset * 400;
                for (let w = 0; w < copyLen; w++) {
                    this.brainWeights[wOffset + w] = genome.reservoirWeights[w];
                }
            }

            // 1. Flatten Nodes
            for (let i = 0; i < org.nodes.length; i++) {
                const n = org.nodes[i];
                const idx = (nodeOffset + i) * 4;

                // Positions
                this.nodePositions[idx + 0] = n.pos.x;
                this.nodePositions[idx + 1] = n.pos.y;
                this.nodePositions[idx + 2] = n.pos.z;
                this.nodePositions[idx + 3] = 0.0; // padding

                // Calculate Velocities (Verlet -> Velocity)
                this.nodeVelocities[idx + 0] = (n.pos.x - n.oldPos.x) / dt;
                this.nodeVelocities[idx + 1] = (n.pos.y - n.oldPos.y) / dt;
                this.nodeVelocities[idx + 2] = (n.pos.z - n.oldPos.z) / dt;
                this.nodeVelocities[idx + 3] = 0.0; // padding

                // Properties
                this.nodeProperties[idx + 0] = n.mass;
                this.nodeProperties[idx + 1] = n.friction;
                this.nodeProperties[idx + 2] = n.isFixed ? 1.0 : 0.0;
                
                let typeId = 2.0; // BODY
                if (n.cellType === 'HEAD' as any || n.isHead) typeId = 1.0;
                else if (n.cellType === 'FOOT' as any) typeId = 3.0;
                this.nodeProperties[idx + 3] = typeId;

                // 2. Flatten Grip State
                const gIdx = (nodeOffset + i) * 4;
                this.nodeGripState[gIdx + 0] = n.gripStamina ?? 1.0;
                this.nodeGripState[gIdx + 1] = n.gripCooldown ?? 0.0;
                this.nodeGripState[gIdx + 2] = n.gripSignal ?? 0.0;
                this.nodeGripState[gIdx + 3] = n.isGripping ? 1.0 : 0.0;
            }

            // 2. Flatten Muscles
            for (let i = 0; i < org.muscles.length; i++) {
                const m = org.muscles[i];
                const idx = (muscleOffset + i) * 4;

                // Find local indices (A and B) and offset them to global buffer indices
                const localIdxA = org.nodes.findIndex(n => n.id === m.nodeA);
                const localIdxB = org.nodes.findIndex(n => n.id === m.nodeB);
                
                let localMirrorIdx = -1;
                if (m.isMirrored && m.mirrorMuscleId) {
                    localMirrorIdx = org.muscles.findIndex(om => om.id === m.mirrorMuscleId);
                }

                this.muscleIndices[idx + 0] = orgBaseNodeIdx + localIdxA;
                this.muscleIndices[idx + 1] = orgBaseNodeIdx + localIdxB;
                this.muscleIndices[idx + 2] = localMirrorIdx !== -1 ? (muscleOffset + localMirrorIdx) : -1.0;
                this.muscleIndices[idx + 3] = m.isMirrored ? 1.0 : 0.0;

                this.muscleProperties[idx + 0] = m.baseLength;
                this.muscleProperties[idx + 1] = m.targetLength || m.baseLength;
                this.muscleProperties[idx + 2] = m.currentLength || m.baseLength;
                this.muscleProperties[idx + 3] = m.stiffness;

                this.muscleOscillators[idx + 0] = m.phase || 0.0;
                this.muscleOscillators[idx + 1] = m.freq || 1.0;
                this.muscleOscillators[idx + 2] = m.amp || 0.0;
                this.muscleOscillators[idx + 3] = 0.0; // padding
            }

            nodeOffset += org.nodes.length;
            muscleOffset += org.muscles.length;
            orgOffset += 1;
        }

        this.activeNodeCount = nodeOffset;
        this.activeMuscleCount = muscleOffset;
        this.activeOrganismCount = orgOffset;
    }

    /**
     * Refreshes the locations of the Heads and Food targets each frame.
     */
    public syncDynamicSensors(population: Organism[]): void {
        let orgOffset = 0;
        let nodeOffset = 0;

        for (const org of population) {
            if (!org.isAlive) {
                // If dead, ensure they can't sense food
                this.headNodeIndices[orgOffset] = 0;
                orgOffset++;
                continue;
            }

            const localHeadIdx = org.headNode ? org.nodes.findIndex(n => n.id === org.headNode?.id) : 0;
            this.headNodeIndices[orgOffset] = nodeOffset + Math.max(0, localHeadIdx);

            const fIdxStart = orgOffset * 20 * 4;
            const foods = org.visibleFood || [];
            for (let f = 0; f < 20; f++) {
                const fIdx = fIdxStart + f * 4;
                if (f < foods.length) {
                    this.foodPositions[fIdx + 0] = foods[f].pos.x;
                    this.foodPositions[fIdx + 1] = foods[f].pos.y;
                    this.foodPositions[fIdx + 2] = foods[f].pos.z;
                    this.foodPositions[fIdx + 3] = foods[f].consumed ? 1.0 : 0.0;
                } else {
                    this.foodPositions[fIdx + 3] = 1.0; // Mask out non-existent food
                }
            }

            nodeOffset += org.nodes.length;
            orgOffset++;
        }
    }
}
