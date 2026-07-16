/**
 * ENGINE_CONFIG
 * The Single Source of Truth for all simulation parameters.
 * Consolidates Physics, Metabolism, Ecosystem, and Neural constants.
 */

export const ENGINE_CONFIG = {
  physics: {
    gravity: -100,
    friction: 0.99,
    groundDamping: 0.5,
    timeStep: 0.016,

    // Core Constraints
    maxVelocity: 35,
    relaxationFactor: 0.8,
    iterations: 6,

    // Damping & Resistance
    baseMuscleDamping: 0.1,
    adaptiveDampingFactor: 0.12,
    dragCoefficient: 0.05,
    rotationalDrag: 2,

    // Solid Body Physics
    nodeRadius: 0.1,
    hardContactLimit: 0.22,

    // Realism & Stress
    maxGripStress: 10,
    bucklingThreshold: 20,
    tippingForceMagnitude: 0.25,
    maxCorrection: 5,
    worldCeiling: 100,

    // Friction & Grip
    staticFrictionThreshold: 0.2,
    gripCooldown: 20,
    gripDepletionRate: 0.1,
    gripRechargeRate: 0.1,

    // Muscle Limits
    slipFactor: 0.3,
    brokenSlipFactor: 0.8,

    // Density
    densityMultiplier: 3,
    headMass: 3,
    bodyMass: 0.25,
    footMass: 2.5,

    // Structural
    shapeMemoryStrength: 0.8,
    globalStiffness: 0.8,
    globalContractility: 4,
  },

  metabolism: {
    startEnergy: 100,
    baseDecay: 0.5,
    movementCost: 1,
    hungerAccel: 1,
    foodEnergy: 50,
    groundContactMetabolismMultiplier: 5,

    // Family Traits
    redBasalMultiplier: 0.1,
    blueMovementMultiplier: 0.5,
    greenMovementMultiplier: 1.5,

    // Ageing
    ageTaxThreshold: 3000,
    ageTaxRate: 0.001,
  },

  ecosystem: {
    foodSpawnCount: 100,
    foodSpawnRadius: 10,
    foodSpawnMinHeight: 1.6,
    foodSpawnMaxHeight: 1.8,

    interactionRadius: 0.5,
    magnetForce: 0.5,
    breedingThreshold: 10,
    foodSpreadFactor: 0.8,
  },

  neural: {
    decisionInterval: 0.08,
    hebbianRate: 0.15,
    attentionSpan: 6,

    // Drive Strengths
    heartbeatDrive: 1.5,
    touchGroundDrive: 2,
    velocitySenseScale: 0.1,
    maxVelocitySensory: 5,

    // Orientation Gains
    orientationXDrive: 2,
    orientationYDrive: 3,
    orientationZDrive: 1,

    // Vision
    visionSignalMultiplier: 3,
    globalSensoryScale: 2,
    visionRadius: 10,
  },

  evolution: {
    populationSize: 100,
    mutationRate: 0.01,
    vaultSaveFrequency: 1,

    // Fitness Scaling
    odometryScale: 0.25,
    territoryScale: 5,
    foodScale: 50,
    foodScoreIncrement: 3,
    timeScale: 0.2,

    socialLearningRate: 0.001,
    breedingMutationRate: 0.01,
  }
};

export type EngineConfigType = typeof ENGINE_CONFIG;
