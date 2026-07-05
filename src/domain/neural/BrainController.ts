/**
 * @propolis
 * {
 *   "role": "NEURAL_CONTROLLER",
 *   "dependencies": ["@domain/types", "@domain/neural", "@domain/math", "@domain/EngineConfig"],
 *   "constraints": ["C-002", "C-005", "C-006"],
 *   "agent_instructions": "The BrainController must remain a pure orchestrator of neural signals. Sync learned weights back to the genome only via explicit serialization paths."
 * }
 */
import { Organism, Node } from '../types';
import { NeuralNode } from './NeuralNode';
import { CentralPatternGenerator, CPGInputs } from './CentralPatternGenerator';
import { VectorOps } from '../math';
import { SensoryModule } from './SensoryModule';
import { LearningEngine } from './LearningEngine';
import { ENGINE_CONFIG } from '../EngineConfig';

// Optimization Structure
interface Synapse {
    nodeA: NeuralNode;
    nodeB: NeuralNode;
    weightIndex: number;
}

export class BrainController {
  // CHANGED: Map -> Array for fast iteration without iterator objects
  private neuralNodesList: NeuralNode[] = [];
  private neuralNodesMap: Map<string, NeuralNode> = new Map(); // Keep map only for initialization lookups
  
  private cpg: CentralPatternGenerator;
  private sensory: SensoryModule;
  private learning: LearningEngine;
  private organism: Organism | null; 
  private isInitialized = false;

  private synapses: Synapse[] = []; 
  private synapseWeightsCache: Float32Array = new Float32Array(0);

  private internalTime = 0;
  private muscleRestDistances: Float32Array;

  private decisionTimer = 0;
  private readonly DECISION_INTERVAL_BASE = ENGINE_CONFIG.neural.decisionInterval; 

  constructor(organism: Organism) {
    this.organism = organism;
    this.cpg = new CentralPatternGenerator(20);
    this.sensory = new SensoryModule();
    this.learning = new LearningEngine();
    this.learning.initialize(organism.energy);
    
    // Initialize Neural Nodes into Array
    const nodes = organism.nodes;
    const genome = organism.neuralGenome;
    const vM = genome.vestibularMultiplier ?? 1.0;
    const hM = genome.heartbeatMultiplier ?? 1.0;
    
    for(let i=0; i<nodes.length; i++) {
        const nn = new NeuralNode(nodes[i], vM, hM);
        this.neuralNodesList.push(nn);
        this.neuralNodesMap.set(nodes[i].id, nn);
    }
    
    this.muscleRestDistances = new Float32Array(organism.muscles.length);
    this.initializeNervousSystem();

    if (organism.neuralGenome && organism.neuralGenome.reservoirWeights) {
        this.cpg.initialize(organism.neuralGenome.reservoirWeights);
    }
  }
  
  private deferredActivation = true;
  
  public reset(organism: Organism) {
      this.internalTime = 0;
      this.decisionTimer = 0;
      this.learning.initialize(organism.energy);
      this.sensory.reset();
      
      // If anatomy changed, we MUST rebuild the nervous system
      const anatomyChanged = 
          !this.isInitialized || 
          this.neuralNodesList.length !== organism.nodes.length || 
          this.synapses.length !== organism.muscles.length;

      if (anatomyChanged) {
          this.isInitialized = false;
          this.neuralNodesList = [];
          this.neuralNodesMap.clear();
          const nodes = organism.nodes;
          const genome = organism.neuralGenome;
          const vM = genome.vestibularMultiplier ?? 1.0;
          const hM = genome.heartbeatMultiplier ?? 1.0;

          for(let i=0; i<nodes.length; i++) {
              const nn = new NeuralNode(nodes[i], vM, hM);
              this.neuralNodesList.push(nn);
              this.neuralNodesMap.set(nodes[i].id, nn);
          }
          this.muscleRestDistances = new Float32Array(organism.muscles.length);
          this.initializeNervousSystem();
      } else {
          this.neuralNodesList.forEach(nn => nn.reset());
          if (this.cpg) {
              this.cpg.reset();
          }
          this.syncMuscleDistances(organism);
      }
      
      if (organism.neuralGenome && organism.neuralGenome.synapseWeights) {
          if (this.synapseWeightsCache.length !== organism.neuralGenome.synapseWeights.length) {
              this.synapseWeightsCache = new Float32Array(organism.neuralGenome.synapseWeights);
          } else {
              for(let i=0; i<organism.neuralGenome.synapseWeights.length; i++) {
                  this.synapseWeightsCache[i] = organism.neuralGenome.synapseWeights[i];
              }
          }
          this.cpg.initialize(organism.neuralGenome.reservoirWeights);
      }
      
      // Make sure organism reference is up to date safely
      this.organism = organism;
  }

  private syncMuscleDistances(organism: Organism) {
      if (!this.organism) return;
      const headNode = this.organism.headNode || this.organism.nodes[0];
      
      organism.muscles.forEach((m, i) => {
          const nnA = this.neuralNodesMap.get(m.nodeA);
          const nnB = this.neuralNodesMap.get(m.nodeB);
          
          if (nnA && nnB) {
              const nA = (nnA as any).physicalNode;
              const nB = (nnB as any).physicalNode;
              
              const midX = (nA.pos.x + nB.pos.x) / 2;
              const midY = (nA.pos.y + nB.pos.y) / 2;
              const midZ = (nA.pos.z + nB.pos.z) / 2;
              
              const dist = VectorOps.distance(
                  headNode.pos, 
                  { x: midX, y: midY, z: midZ }
              );
              this.muscleRestDistances[i] = dist;
          }
      });
  }

  private initializeNervousSystem() {
      if (!this.organism || this.organism.nodes.length === 0) return;

      let headNode = this.organism.headNode;
      if (!headNode) {
          headNode = this.organism.nodes[0];
          // @ts-ignore
          headNode.isHead = true; 
      }

      // 1. Build Distance Cache
      this.organism.muscles.forEach((m, i) => {
          const nnA = this.neuralNodesMap.get(m.nodeA);
          const nnB = this.neuralNodesMap.get(m.nodeB);
          
          if (nnA && nnB) {
              const nA = (nnA as any).physicalNode;
              const nB = (nnB as any).physicalNode;
              
              const midX = (nA.pos.x + nB.pos.x) / 2;
              const midY = (nA.pos.y + nB.pos.y) / 2;
              const midZ = (nA.pos.z + nB.pos.z) / 2;
              
              const dist = VectorOps.distance(
                  headNode!.pos, 
                  { x: midX, y: midY, z: midZ }
              );
              this.muscleRestDistances[i] = dist;
          }
      });

      // 2. Build Synapse Cache
      this.synapses = [];
      const weights = this.organism?.neuralGenome?.synapseWeights || [];
      const weightCount = weights.length || 1;
      this.synapseWeightsCache = new Float32Array(weights);

      this.organism.muscles.forEach((muscle, i) => {
          const nnA = this.neuralNodesMap.get(muscle.nodeA);
          const nnB = this.neuralNodesMap.get(muscle.nodeB);
          if (nnA && nnB) {
              this.synapses.push({
                  nodeA: nnA,
                  nodeB: nnB,
                  weightIndex: i % weightCount
              });
          }
      });

      this.organism.muscles.forEach(m => {
          m.targetLength = m.baseLength;
          m.phase = Math.random() * Math.PI * 2; 
          m.freq = 1.0; 
          m.amp = 0.0;
      });

      this.isInitialized = true;
  }

  public syncGenome(): void {
    if (!this.organism || !this.organism.neuralGenome) return;
    // Copy back learned weights from the cache to the genome
    // This implements Lamarckian inheritance (lifetime learning -> genome)
    this.organism.neuralGenome.synapseWeights = Array.from(this.synapseWeightsCache);
  }

  /**
   * @logic_seal
   * {
   *   "intent": "Sync simulation time and neural pulses to drive muscle contractions.",
   *   "agent_instructions": "Phase calculation must remain continuous to prevent jitter in muscle actuators."
   * }
   */
  public update(dt: number, powerScale: number = 1.0, visionRadius: number = 4.0): void {
    if (!this.organism) return;
    const genome = this.organism.neuralGenome;
    if (!genome) return;

    const safeDt = Math.min(dt, 0.1); 
    const brainDt = safeDt * (genome.internalClockSpeed || 1.0);

    if (!this.isInitialized) {
        this.initializeNervousSystem();
    }

    this.internalTime += brainDt;
    this.decisionTimer += brainDt;
    
    if (this.decisionTimer >= this.DECISION_INTERVAL_BASE) {
        this.think(brainDt, visionRadius);
        this.learn();
        this.decisionTimer = 0;
    }

    // --- SPINAL WAVE (Optimized Loop) ---
    const WAVE_FREQ = genome.waveFreq || 1.5; 
    const WAVE_SPEED = genome.waveSpeed || 1.0; 
    const FORCED_AMP = 0.15; 
    const MAX_DEFORMATION = 0.3; 
    const PI2 = Math.PI * 2;
    const muscles = this.organism.muscles;
    const mLen = muscles.length;

    for(let i=0; i<mLen; i++) {
        const m = muscles[i];
        
        // --- FULL FREEDOM (No Symmetry Override) ---
        m.phase += m.freq * brainDt * PI2;
        if (m.phase > PI2) m.phase -= PI2;

        const brainSignal = Math.sin(m.phase) * m.amp;

        let totalSignal = brainSignal * powerScale;

        if (isNaN(totalSignal)) totalSignal = 0;
        if (totalSignal > MAX_DEFORMATION) totalSignal = MAX_DEFORMATION;
        if (totalSignal < -MAX_DEFORMATION) totalSignal = -MAX_DEFORMATION;

        const desiredLength = m.baseLength * (1 + totalSignal);
        
        m.targetLength = (m.targetLength || m.baseLength);
        m.targetLength += (desiredLength - m.targetLength) * 0.05;
        m.currentLength = m.targetLength;
    }
  }

  /**
   * @logic_seal
   * {
   *   "intent": "Orchestrate sensory integration, synaptic propagation, and motor output.",
   *   "agent_instructions": "Neural propagation is discrete per tick; do not implement sub-stepping here without updating C-001."
   * }
   */
  private think(dt: number, visionRadius: number): void {
    if (!this.organism) return;
    const genome = this.organism.neuralGenome;
    
    // 1. SENSORY INTEGRATION
    const clockSignal = Math.sin(this.internalTime * (genome.waveFreq || 1.5) * Math.PI * 2);

    const sensoryData = this.sensory.update(
        dt, 
        this.organism, 
        this.neuralNodesList, 
        this.neuralNodesMap, 
        visionRadius, 
        clockSignal
    );
    
    // 2. SYNAPTIC PROPAGATION (Optimized Loop)
    const sLen = this.synapses.length;
    for(let i=0; i<sLen; i++) {
        const s = this.synapses[i];
        const w = this.synapseWeightsCache[s.weightIndex]; 
        s.nodeB.inputSum += s.nodeA.activation * w;
        s.nodeA.inputSum += s.nodeB.activation * w;
    }

    const nnLen = this.neuralNodesList.length;
    for (let i=0; i<nnLen; i++) {
        this.neuralNodesList[i].updateActivation();
    }

    // 3. HEARTBEAT & RESERVOIR COMPUTING
    if (this.deferredActivation) {
        if (this.internalTime > 0.02) { 
            this.deferredActivation = false;
        } else {
            return;
        }
    }
    
    this.cpg.tick({
        vestibular: sensoryData.orientation,
        target: sensoryData.targetDir,
        clock: clockSignal
    });
    
    // 4. MOTOR OUTPUT
    const mus = this.organism!.muscles;
    const len = mus.length;
    for(let i=0; i<len; i++) {
        const muscle = mus[i];
        const rawAmp = this.cpg.getSignal(i, genome.outputWeights); 
        const rawFreq = this.cpg.getSignal(i + 1, genome.outputWeights); 
        
        const targetAmp = Math.min(1.0, Math.abs(rawAmp)) * 0.3; 
        const targetFreq = 0.5 + ((rawFreq + 1) / 2) * 2.5;

        muscle.amp += (targetAmp - muscle.amp) * 0.1;
        muscle.freq += (targetFreq - muscle.freq) * 0.1;
    }

    // 5. SUCTION OUTPUT
    if (genome.gripWeights && genome.gripWeights.length > 0) {
        const nodes = this.organism!.nodes;
        const nLen = nodes.length;
        for(let i=0; i<nLen; i++) {
            const rawSignal = this.cpg.getSignal(i, genome.gripWeights);
            const normalized = (rawSignal + 1) / 2;
            const node = nodes[i];
            const oldGrip = node.gripSignal || 0;
            node.gripSignal = oldGrip + (normalized - oldGrip) * 0.2;
        }
    }
  }

  private learn(): void {
      if (!this.organism) return;
      this.learning.learn(this.organism, this.synapses, this.synapseWeightsCache);
  }
}
