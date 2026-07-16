import { ENGINE_CONFIG } from './EngineConfig';

export const DEFAULT_SIMULATION_CONFIG = {
  // Physics Core
  gravity: ENGINE_CONFIG.physics.gravity,
  friction: ENGINE_CONFIG.physics.friction,
  groundDamping: ENGINE_CONFIG.physics.groundDamping,
  timeStep: ENGINE_CONFIG.physics.timeStep,
  
  // Structural Integrity
  shapeMemoryStrength: ENGINE_CONFIG.physics.shapeMemoryStrength,
  globalStiffness: ENGINE_CONFIG.physics.globalStiffness,
  globalContractility: ENGINE_CONFIG.physics.globalContractility,
  rotationalDrag: ENGINE_CONFIG.physics.rotationalDrag,
  
  // Grip Mechanics
  gripDepletionRate: ENGINE_CONFIG.physics.gripDepletionRate,
  gripRechargeRate: ENGINE_CONFIG.physics.gripRechargeRate,
  
  // Advanced Physics
  maxVelocity: ENGINE_CONFIG.physics.maxVelocity,
  staticFrictionThreshold: ENGINE_CONFIG.physics.staticFrictionThreshold,
  maxGripStress: ENGINE_CONFIG.physics.maxGripStress,
  gripCooldown: ENGINE_CONFIG.physics.gripCooldown,
  muscleSignalLimit: ENGINE_CONFIG.physics.muscleSignalLimit,
  muscleSoftness: ENGINE_CONFIG.physics.muscleSoftness,
  slipFactor: ENGINE_CONFIG.physics.slipFactor,
  brokenSlipFactor: ENGINE_CONFIG.physics.brokenSlipFactor,
  waveFreq: ENGINE_CONFIG.physics.waveFreq,
  waveAmp: ENGINE_CONFIG.physics.waveAmp,
  terminalVelocity: ENGINE_CONFIG.physics.terminalVelocity,
  maxYieldRatio: ENGINE_CONFIG.physics.maxYieldRatio,
  globalDamping: ENGINE_CONFIG.physics.globalDamping,
  baseMuscleDamping: ENGINE_CONFIG.physics.baseMuscleDamping,
  constraintIterations: ENGINE_CONFIG.physics.iterations,
  contractionSpeed: ENGINE_CONFIG.physics.contractionSpeed,
  antiSingularityRadius: ENGINE_CONFIG.physics.antiSingularityRadius,
  relaxationFactor: ENGINE_CONFIG.physics.relaxationFactor,

  // Density
  densityMultiplier: ENGINE_CONFIG.physics.densityMultiplier,
  headMass: ENGINE_CONFIG.physics.headMass,
  bodyMass: ENGINE_CONFIG.physics.bodyMass,
  footMass: ENGINE_CONFIG.physics.footMass,

  // Visuals
  showVision: false,
  showMouth: true,
  foodScoreIncrement: ENGINE_CONFIG.evolution.foodScoreIncrement,
};

export const DEFAULT_EVOLUTION_CONFIG = {
  populationSize: ENGINE_CONFIG.evolution.populationSize,
  mutationRate: ENGINE_CONFIG.evolution.mutationRate,
  
  // Scarcity / Environment
  foodSpawnCount: ENGINE_CONFIG.ecosystem.foodSpawnCount,
  foodSpawnRadius: ENGINE_CONFIG.ecosystem.foodSpawnRadius,
  foodSpawnMinHeight: ENGINE_CONFIG.ecosystem.foodSpawnMinHeight,
  foodSpawnMaxHeight: ENGINE_CONFIG.ecosystem.foodSpawnMaxHeight,
  
  // Vision / Interaction
  globalVisionRadius: ENGINE_CONFIG.neural.visionRadius,
  interactionRadius: ENGINE_CONFIG.ecosystem.interactionRadius,
  foodSpreadFactor: ENGINE_CONFIG.ecosystem.foodSpreadFactor,
  
  // Metabolism
  startEnergy: ENGINE_CONFIG.metabolism.startEnergy,
  baseDecay: ENGINE_CONFIG.metabolism.baseDecay,
  movementCost: ENGINE_CONFIG.metabolism.movementCost,
  hungerAccel: ENGINE_CONFIG.metabolism.hungerAccel,
  foodEnergy: ENGINE_CONFIG.metabolism.foodEnergy,
  vaultSaveFrequency: ENGINE_CONFIG.evolution.vaultSaveFrequency,
  groundContactMetabolismMultiplier: ENGINE_CONFIG.metabolism.groundContactMetabolismMultiplier,

  // Family Metabolic Traits
  redBasalMultiplier: ENGINE_CONFIG.metabolism.redBasalMultiplier,
  blueMovementMultiplier: ENGINE_CONFIG.metabolism.blueMovementMultiplier,
  greenMovementMultiplier: ENGINE_CONFIG.metabolism.greenMovementMultiplier,

  // Fitness Scaling
  odometryScale: ENGINE_CONFIG.evolution.odometryScale,
  territoryScale: ENGINE_CONFIG.evolution.territoryScale,
  foodScale: ENGINE_CONFIG.evolution.foodScale,
  foodScoreIncrement: ENGINE_CONFIG.evolution.foodScoreIncrement,
  timeScale: ENGINE_CONFIG.evolution.timeScale,
  
  breedingThreshold: ENGINE_CONFIG.ecosystem.breedingThreshold,
};
