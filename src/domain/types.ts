// Hexagonal Architecture: Domain Layer (Inner Core)
// Zero dependencies on UI or Rendering libraries.

// Type-only: erased at compile time, so this does not create a runtime
// circular dependency with BrainController (which imports Organism/Node
// from this file).
import type { BrainController } from './neural/BrainController';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export enum CellType {
    BODY = 'BODY', // Standard structural (Slippery)
    HEAD = 'HEAD', // Brain/Mouth (The Leader)
    FOOT = 'FOOT'  // Gripper (High Friction)
}

export interface Node {
  id: string;
  pos: Vec3;
  oldPos: Vec3; // For Verlet integration
  mass: number;
  friction: number;
  isFixed?: boolean;
  isHead?: boolean; // NEW: The only node that can eat
  
  // SUCTION MECHANICS (Rhythmic Anchor)
  isGripping?: boolean; 
  gripSignal?: number;    // Deprecated for manual, but kept for compatibility
  
  // NEW: Bio-Mechanical Reflex
  gripStamina?: number;   // 0.0 (Slippery) to 1.0 (Locked). Drains under stress.
  gripCooldown?: number;  // NEW: Hysteresis frames to prevent flickering state
  currentStress?: number; // Visualization/Debug: How much force is pulling this node
  
  // EDITOR METADATA (Preserves shape upon reloading)
  originalGridCoord?: { x: number; y: number; z: number }; 
  cellType?: CellType; // NEW: Stores the type for restoring the blueprint

  // Neural State
  activation?: number; // 0.0 to 1.0 (Visualization Glow)
  // Physics State
}

export interface Muscle {
  id: string;
  nodeA: string; // ID reference
  nodeB: string; // ID reference
  baseLength: number;
  stiffness: number;
  dnaIndex: number; // Maps to a Gene (Index in genome arrays)
  
  // Runtime Physics State
  currentLength?: number; 
  targetLength?: number; 

  // --- RUNTIME OPTIMIZATION (O(1) Access) ---
  nodeRefA?: Node;
  nodeRefB?: Node;
  
  // --- OSCILLATOR STATE (The Anti-Vibration Core) ---
  // The brain controls these parameters, not the length directly.
  phase: number;      // Current position in the sine wave (0 to 2PI)
  freq: number;       // How fast it pulses (Hz). Clamped to prevent jitter.
  amp: number;        // How much it expands (0.0 to 0.4). 

  // --- SYMMETRY (Evolution v2.0) ---
  isMirrored?: boolean;      // Is this muscle on the "Right" side of a pair?
  mirrorMuscleId?: string;   // ID of the corresponding "Left" muscle
}

// Replaced simple Sine Gene with Neural Genome
export interface EvolutionMetadata {
    lineageId: string;       // Unique ID for this genetic project
    projectName: string;     // User-friendly name
    lineageGeneration: number; // Single source of truth for creature age
    originDate: string;      // ISO string
    parentLineageId?: string; 
}

export interface NeuralGenome {
  // GNN Weights: How much signal flows through each muscle (Synapse)
  synapseWeights: number[]; 
  // LSM Weights: The chaotic reservoir weights (simplified as a float array)
  reservoirWeights: number[];
  // Output Weights: Mapping the reservoir state to muscle contraction
  outputWeights: number[];
  // NEW: Grip Control Weights (Reservoir -> Node Suction Release)
  gripWeights: number[]; 
  // Biases for neurons
  biases: number[];

  // --- EVOLVABLE BRAIN DYNAMICS ---
  internalClockSpeed: number; // Multiplier (0.5 to 2.0). How fast the brain thinks relative to physics.
  waveFreq: number;           // Hz (0.5 to 3.0). Base frequency of the spinal generator.
  waveSpeed: number;          // Propagation speed of the wave along the body.

  // NEW: Evolvable Sensor Trusts
  vestibularMultiplier: number;
  heartbeatMultiplier: number;

  // --- LINEAGE METADATA ---
  meta?: EvolutionMetadata; 
}

export interface FoodItem {
    id: string;
    pos: Vec3;
    energyValue: number;
    consumed: boolean;
    // DEBUG VISUALIZATION
    seen?: boolean;      // Inside vision radius?
    targeted?: boolean;  // Is this the specific one the brain is looking at?
}

export enum FamilyType {
    BRUTE = 'BRUTE',       // RED: Power/Speed
    MONOLITH = 'MONOLITH', // BLUE: Stability/Balance
    SCOUT = 'SCOUT',       // GREEN: Efficiency/Vision
    CHARGER = 'CHARGER',   // PURPLE (Brute + Monolith)
    NOMAD = 'NOMAD',       // TEAL (Monolith + Scout)
    HUNTER = 'HUNTER',     // YELLOW (Scout + Brute)
    GUARDIAN = 'GUARDIAN', // PINK (Charger + Nomad)
    PHANTOM = 'PHANTOM',   // CYAN (Nomad + Hunter)
    WARRIOR = 'WARRIOR',   // ORANGE (Hunter + Charger)
    APEX = 'APEX'          // WHITE (The final blend)
}

export interface FitnessBreakdown {
    distanceScore: number;
    explorationScore: number;
    survivalScore: number;
    foodScore: number;
}

export interface Organism {
  id: string;
  family?: FamilyType;
  color?: string; // CSS Color or Hex
  nodes: Node[];
  muscles: Muscle[];
  // The Blueprint
  neuralGenome: NeuralGenome;
  // The Runtime Brain (Controller instance; never persisted — see ChampionRecord)
  brain?: BrainController;
  
  // Stats
  fitness: number; // Total Score
  fitnessBreakdown?: FitnessBreakdown; // Detailed breakdown
  generation: number;
  
  // NEW: Distance Metrics (Replacing Posture)
  initialHeadPos: Vec3; // BENCHMARK: Where the head started
  distanceTraveled: number; // Real-time distance from start
  previousHeadPos?: Vec3; // Per-step raw head position, for EvolutionService's movement-delta tracking
  previousDistanceTraveled?: number; // Last-seen distanceTraveled, for MetabolicService's movement-cost delta

  // ODOMETER STATE (Sampled distance tracking)
  lastSampledPos?: Vec3;
  odometer: number;        // NEW: Filtered cumulative distance
  visitedTiles?: Record<string, boolean>; // NEW: Territory tracking (1m x 1m grid)
  visitedTileCount?: number; // Maintained counter — avoids Object.keys() per frame
  odometerTimer?: number;

  // NEW: Metabolism & Survival
  energy: number;          // 0 to 100
  maxEnergy: number;       
  hungerTime: number;      // Time since last meal (drives exponential decay)
  timeAlive: number;       // NEW: Total time survived in ms
  isAlive: boolean;
  isInPain?: boolean;
  foodEaten: number;
  foodForBreeding: number; // NEW: Counter used to trigger breeding
  totalFoodEaten?: number; // NEW: Lifetime food stats for fitness scoring
  visibleFood: FoodItem[]; // Each creature has its own reality/food track

  // OPTIMIZATION: Cached reference
  headNode?: Node;
}

export interface SimulationConfig {
  gravity: number;
  friction: number;
  groundDamping: number;
  timeStep: number;
  // NEW: Structural Integrity
  shapeMemoryStrength: number;
  
  // NEW: Real-time Physics Tweaks
  globalStiffness: number;     // Multiplier for bone rigidity (0.1 to 2.0)
  globalContractility: number; // Multiplier for muscle power (0.0 to 2.0)
  
  // NEW: Exposed Tuning
  rotationalDrag?: number;
  densityMultiplier?: number;
  headMass?: number;
  bodyMass?: number;
  footMass?: number;

  // Evolution & Neural
  mutationRate?: number;
  internalClockSpeed?: number;
  waveFreq?: number;           // Spinal wave base frequency
  waveAmp?: number;            // Spinal wave base amplitude
  
  // Advanced Physics
  substeps?: number;
  constraintIterations?: number;
  maxYieldRatio?: number;
  terminalVelocity?: number;
  globalDamping?: number;
  contractionSpeed?: number;
  antiSingularityRadius?: number;
  maxVelocity?: number;
  staticFrictionThreshold?: number;
  maxGripStress?: number;
  gripCooldown?: number;
  muscleSignalLimit?: number;
  muscleSoftness?: number; // Smoothing factor
  slipFactor?: number;
  brokenSlipFactor?: number;
  baseMuscleDamping?: number;
  relaxationFactor?: number;

  // NEW: Grip Mechanics
  gripDepletionRate?: number; // How fast stamina drains under stress
  gripRechargeRate?: number;  // How fast it recovers

  // NEW: Visual Toggles
  showVision?: boolean;
  showMouth?: boolean;

  // NEW: Fitness Scoring
  foodScoreIncrement?: number;
}

// --- ARCHITECT TYPES ---
export type GridCoord = { x: number; y: number; z: number };

// NEW: Blueprint Cell now carries Type info
export interface BlueprintCell extends GridCoord {
    type: CellType;
}

// --- PERSISTENCE TYPES (Charter invariants 1-2) ---
// A stored champion is a brain plus identity — never a body.
export interface ChampionRecord {
    family: FamilyType;
    generation: number;
    fitness: number;
    genome: NeuralGenome; // deep copy; meta carries lineage identity
}

// The body shell is stored ONCE per lineage, as editor blueprint DNA.
export interface LineageRecord {
    lineageId: string;
    projectName: string;
    generation: number;
    blueprint: BlueprintCell[];
    champions: ChampionRecord[];
    updatedAt: number;
}
