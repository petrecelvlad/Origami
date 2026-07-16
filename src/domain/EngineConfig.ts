
/**
 * ENGINE_CONFIG
 * The Single Source of Truth for all simulation parameters.
 * Consolidates Physics, Metabolism, Ecosystem, and Neural constants.
 */

export const ENGINE_CONFIG = {
  physics: {
    gravity: -100.0,
    friction: 0.99,
    groundDamping: 0.5,
    timeStep: 0.016,
    
    // Core Constraints
    maxVelocity: 30.0,
    relaxationFactor: 0.8,
    iterations: 5,

    // Damping & Resistance
    baseMuscleDamping: 0.08,
    adaptiveDampingFactor: 0.12,
    dragCoefficient: 0.05,
    rotationalDrag: 2.0,

    // Solid Body Physics
    nodeRadius: 0.1,
    hardContactLimit: 0.22,

    // Realism & Stress
    maxGripStress: 10.0,
    bucklingThreshold: 20.0,
    tippingForceMagnitude: 0.25,
    maxCorrection: 5.0,
    worldCeiling: 100.0,

    // Friction & Grip
    staticFrictionThreshold: 0.2,
    gripCooldown: 60.0,
    gripDepletionRate: 0.20,
    gripRechargeRate: 0.05,

    // Muscle Limits
    slipFactor: 0.4,
    brokenSlipFactor: 0.8,

    // Density
    densityMultiplier: 2.0,
    headMass: 2.5,
    bodyMass: 0.5,
    footMass: 2.5,
    
    // Structural
    shapeMemoryStrength: 0.8,
    globalStiffness: 0.7,
    globalContractility: 3.0,
  },
  
  metabolism: {
    startEnergy: 100,
    baseDecay: 0.5,
    movementCost: 2.0,
    hungerAccel: 1.00,
    foodEnergy: 50,
    groundContactMetabolismMultiplier: 5.0,
    
    // Family Traits
    redBasalMultiplier: 0.1,
    blueMovementMultiplier: 1.5,
    greenMovementMultiplier: 2.5,
    
    // Ageing
    ageTaxThreshold: 3000,
    ageTaxRate: 0.001,
  },
  
  ecosystem: {
    foodSpawnCount: 100,
    foodSpawnRadius: 10.0,
    foodSpawnMinHeight: 1.6,
    foodSpawnMaxHeight: 1.8,
    
    interactionRadius: 0.5,
    magnetForce: 0.5,
    breedingThreshold: 15,
    foodSpreadFactor: 0.8,
  },
  
  neural: {
    decisionInterval: 0.08,
    hebbianRate: 0.15,
    attentionSpan: 6.0,
    
    // Drive Strengths
    heartbeatDrive: 1.5,
    touchGroundDrive: 2.0,
    velocitySenseScale: 0.1,
    maxVelocitySensory: 5.0,
    
    // Orientation Gains
    orientationXDrive: 2.0,
    orientationYDrive: 3.0,
    orientationZDrive: 1.0,
    
    // Vision
    visionSignalMultiplier: 3.0,
    globalSensoryScale: 2.0,
    visionRadius: 10.0,
  },
  
  evolution: {
    populationSize: 100,
    mutationRate: 0.01,
    vaultSaveFrequency: 1,
    
    // Fitness Scaling
    odometryScale: 0.25,
    territoryScale: 5.0,
    foodScale: 50,
    foodScoreIncrement: 3,
    timeScale: 0.2,

    socialLearningRate: 0.001,
    breedingMutationRate: 0.01,
  }
};

export type EngineConfigType = typeof ENGINE_CONFIG;
