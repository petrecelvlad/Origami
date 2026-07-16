import { ENGINE_CONFIG } from '../domain/EngineConfig';
import { usePhysicsSettings } from '../application/usePhysicsSettings';

type PhysicsSettings = ReturnType<typeof usePhysicsSettings>;

/**
 * Regenerates EngineConfig.ts's exact source text, with every panel-exposed
 * value swapped for its current live setting - so tweaking a slider and
 * pasting this back over the file makes the change permanent. Fields with
 * no panel control (timeStep, nodeRadius, ageTaxRate, etc.) fall back to
 * whatever ENGINE_CONFIG currently holds, i.e. unchanged from the file on
 * disk. Mirrors the file's own section comments and field order exactly.
 */
export function generateEngineConfigSource(settings: PhysicsSettings): string {
  const c = ENGINE_CONFIG;

  return `
/**
 * ENGINE_CONFIG
 * The Single Source of Truth for all simulation parameters.
 * Consolidates Physics, Metabolism, Ecosystem, and Neural constants.
 */

export const ENGINE_CONFIG = {
  physics: {
    gravity: ${-settings.gravity},
    friction: ${settings.friction},
    groundDamping: ${c.physics.groundDamping},
    timeStep: ${c.physics.timeStep},

    // Core Constraints
    maxVelocity: ${settings.maxVelocity},
    relaxationFactor: ${settings.relaxationFactor},
    iterations: ${settings.constraintIterations},

    // Damping & Resistance
    baseMuscleDamping: ${settings.baseMuscleDamping},
    adaptiveDampingFactor: ${c.physics.adaptiveDampingFactor},
    dragCoefficient: ${c.physics.dragCoefficient},
    rotationalDrag: ${settings.rotationalDrag},

    // Solid Body Physics
    nodeRadius: ${c.physics.nodeRadius},
    hardContactLimit: ${c.physics.hardContactLimit},

    // Realism & Stress
    maxGripStress: ${settings.maxGripStress},
    bucklingThreshold: ${c.physics.bucklingThreshold},
    tippingForceMagnitude: ${c.physics.tippingForceMagnitude},
    maxCorrection: ${c.physics.maxCorrection},
    worldCeiling: ${c.physics.worldCeiling},

    // Friction & Grip
    staticFrictionThreshold: ${settings.staticFrictionThreshold},
    gripCooldown: ${settings.gripCooldown},
    gripDepletionRate: ${settings.gripDepletion},
    gripRechargeRate: ${settings.gripRecharge},

    // Muscle Limits
    slipFactor: ${settings.slipFactor},
    brokenSlipFactor: ${settings.brokenSlipFactor},

    // Density
    densityMultiplier: ${settings.density},
    headMass: ${settings.headMass},
    bodyMass: ${settings.bodyMass},
    footMass: ${settings.footMass},

    // Structural
    shapeMemoryStrength: ${settings.shapeMemory},
    globalStiffness: ${settings.globalStiffness},
    globalContractility: ${settings.globalContractility},
  },

  metabolism: {
    startEnergy: ${c.metabolism.startEnergy},
    baseDecay: ${settings.baseDecay},
    movementCost: ${settings.movementCost},
    hungerAccel: ${c.metabolism.hungerAccel},
    foodEnergy: ${settings.foodEnergy},
    groundContactMetabolismMultiplier: ${settings.groundContactMetabolismMultiplier},

    // Family Traits
    redBasalMultiplier: ${settings.redBasalMultiplier},
    blueMovementMultiplier: ${settings.blueMovementMultiplier},
    greenMovementMultiplier: ${settings.greenMovementMultiplier},

    // Ageing
    ageTaxThreshold: ${c.metabolism.ageTaxThreshold},
    ageTaxRate: ${c.metabolism.ageTaxRate},
  },

  ecosystem: {
    foodSpawnCount: ${settings.foodSpawnCount},
    foodSpawnRadius: ${settings.foodSpawnRadius},
    foodSpawnMinHeight: ${settings.foodSpawnMinHeight},
    foodSpawnMaxHeight: ${settings.foodSpawnMaxHeight},

    interactionRadius: ${settings.interactionRadius},
    magnetForce: ${c.ecosystem.magnetForce},
    breedingThreshold: ${settings.breedingThreshold},
    foodSpreadFactor: ${settings.foodSpreadFactor},
  },

  neural: {
    decisionInterval: ${c.neural.decisionInterval},
    hebbianRate: ${c.neural.hebbianRate},
    attentionSpan: ${c.neural.attentionSpan},

    // Drive Strengths
    heartbeatDrive: ${c.neural.heartbeatDrive},
    touchGroundDrive: ${c.neural.touchGroundDrive},
    velocitySenseScale: ${c.neural.velocitySenseScale},
    maxVelocitySensory: ${c.neural.maxVelocitySensory},

    // Orientation Gains
    orientationXDrive: ${c.neural.orientationXDrive},
    orientationYDrive: ${c.neural.orientationYDrive},
    orientationZDrive: ${c.neural.orientationZDrive},

    // Vision
    visionSignalMultiplier: ${c.neural.visionSignalMultiplier},
    globalSensoryScale: ${c.neural.globalSensoryScale},
    visionRadius: ${settings.visionRadius},
  },

  evolution: {
    populationSize: ${settings.populationSize},
    mutationRate: ${c.evolution.mutationRate},
    vaultSaveFrequency: ${settings.vaultSaveFrequency},

    // Fitness Scaling
    odometryScale: ${settings.odometryScale},
    territoryScale: ${settings.territoryScale},
    foodScale: ${c.evolution.foodScale},
    foodScoreIncrement: ${settings.foodScoreIncrement},
    timeScale: ${c.evolution.timeScale},

    socialLearningRate: ${c.evolution.socialLearningRate},
    breedingMutationRate: ${c.evolution.breedingMutationRate},
  }
};

export type EngineConfigType = typeof ENGINE_CONFIG;
`.trimStart();
}
