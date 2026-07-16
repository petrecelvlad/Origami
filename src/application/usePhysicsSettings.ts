import { useState, useCallback } from 'react';
import { EvolutionService } from './EvolutionService';
import { DEFAULT_SIMULATION_CONFIG, DEFAULT_EVOLUTION_CONFIG } from '../domain/constants';

export function usePhysicsSettings(serviceRef: React.MutableRefObject<EvolutionService | null>) {
    // Physics State
    const [globalStiffness, setGlobalStiffnessState] = useState(DEFAULT_SIMULATION_CONFIG.globalStiffness);
    const [globalContractility, setGlobalContractilityState] = useState(DEFAULT_SIMULATION_CONFIG.globalContractility);
    const [shapeMemory, setShapeMemoryState] = useState(DEFAULT_SIMULATION_CONFIG.shapeMemoryStrength);
    const [gravity, setGravityState] = useState(-DEFAULT_SIMULATION_CONFIG.gravity);
    const [friction, setFrictionState] = useState(DEFAULT_SIMULATION_CONFIG.friction);
    const [rotationalDrag, setRotationalDragState] = useState(DEFAULT_SIMULATION_CONFIG.rotationalDrag);
    const [density, setDensityState] = useState(DEFAULT_SIMULATION_CONFIG.densityMultiplier);
    const [headMass, setHeadMassState] = useState(DEFAULT_SIMULATION_CONFIG.headMass || 4.0);
    const [bodyMass, setBodyMassState] = useState(DEFAULT_SIMULATION_CONFIG.bodyMass || 1.0);
    const [footMass, setFootMassState] = useState(DEFAULT_SIMULATION_CONFIG.footMass || 2.5);
    const [gripDepletion, setGripDepletionState] = useState(DEFAULT_SIMULATION_CONFIG.gripDepletionRate);
    const [gripRecharge, setGripRechargeState] = useState(DEFAULT_SIMULATION_CONFIG.gripRechargeRate);
    
    // Advanced Physics
    const [maxVelocity, setMaxVelocityState] = useState(DEFAULT_SIMULATION_CONFIG.maxVelocity || 30.0);
    const [staticFrictionThreshold, setStaticFrictionThresholdState] = useState(DEFAULT_SIMULATION_CONFIG.staticFrictionThreshold || 0.2);
    const [maxGripStress, setMaxGripStressState] = useState(DEFAULT_SIMULATION_CONFIG.maxGripStress || 10.0);
    const [gripCooldown, setGripCooldownState] = useState(DEFAULT_SIMULATION_CONFIG.gripCooldown || 60.0);
    const [slipFactor, setSlipFactorState] = useState(DEFAULT_SIMULATION_CONFIG.slipFactor || 0.4);
    const [brokenSlipFactor, setBrokenSlipFactorState] = useState(DEFAULT_SIMULATION_CONFIG.brokenSlipFactor || 0.8);
    const [baseMuscleDamping, setBaseMuscleDampingState] = useState(DEFAULT_SIMULATION_CONFIG.baseMuscleDamping || 0.08);
    const [constraintIterations, setConstraintIterationsState] = useState(DEFAULT_SIMULATION_CONFIG.constraintIterations || 5);
    const [relaxationFactor, setRelaxationFactorState] = useState(DEFAULT_SIMULATION_CONFIG.relaxationFactor || 0.25);
    
    // Scarcity Controls
    const [foodSpawnCount, setFoodSpawnCountState] = useState(DEFAULT_EVOLUTION_CONFIG.foodSpawnCount);
    const [foodSpawnRadius, setFoodSpawnRadiusState] = useState(DEFAULT_EVOLUTION_CONFIG.foodSpawnRadius);
    const [foodSpawnMinHeight, setFoodSpawnMinHeightState] = useState(DEFAULT_EVOLUTION_CONFIG.foodSpawnMinHeight);
    const [foodSpawnMaxHeight, setFoodSpawnMaxHeightState] = useState(DEFAULT_EVOLUTION_CONFIG.foodSpawnMaxHeight);
    
    // Metabolism
    const [baseDecay, setBaseDecayState] = useState(DEFAULT_EVOLUTION_CONFIG.baseDecay);
    const [movementCost, setMovementCostState] = useState(DEFAULT_EVOLUTION_CONFIG.movementCost);
    const [foodEnergy, setFoodEnergyState] = useState(DEFAULT_EVOLUTION_CONFIG.foodEnergy);
    const [foodSpreadFactor, setFoodSpreadFactorState] = useState(DEFAULT_EVOLUTION_CONFIG.foodSpreadFactor);
    const [redBasalMultiplier, setRedBasalMultiplierState] = useState(DEFAULT_EVOLUTION_CONFIG.redBasalMultiplier);
    const [blueMovementMultiplier, setBlueMovementMultiplierState] = useState(DEFAULT_EVOLUTION_CONFIG.blueMovementMultiplier);
    const [greenMovementMultiplier, setGreenMovementMultiplierState] = useState(DEFAULT_EVOLUTION_CONFIG.greenMovementMultiplier);
    
    // Fitness Scaling
    const [odometryScale, setOdometryScaleState] = useState(DEFAULT_EVOLUTION_CONFIG.odometryScale);
    const [territoryScale, setTerritoryScaleState] = useState(DEFAULT_EVOLUTION_CONFIG.territoryScale);
    const [foodScale, setFoodScaleState] = useState(DEFAULT_EVOLUTION_CONFIG.foodScale);
    const [timeScale, setTimeScaleState] = useState(DEFAULT_EVOLUTION_CONFIG.timeScale);
    const [foodScoreIncrement, setFoodScoreIncrementState] = useState(DEFAULT_EVOLUTION_CONFIG.foodScoreIncrement);
    
    // Misc
    const [populationSize, setPopulationSizeState] = useState(DEFAULT_EVOLUTION_CONFIG.populationSize);
    const [vaultSaveFrequency, setVaultSaveFrequencyState] = useState(DEFAULT_EVOLUTION_CONFIG.vaultSaveFrequency);
    const [groundContactMetabolismMultiplier, setGroundContactMetabolismMultiplierState] = useState(DEFAULT_EVOLUTION_CONFIG.groundContactMetabolismMultiplier);
    const [breedingThreshold, setBreedingThresholdState] = useState(DEFAULT_EVOLUTION_CONFIG.breedingThreshold);
    const [visionRadius, setVisionRadiusState] = useState(DEFAULT_EVOLUTION_CONFIG.globalVisionRadius);
    const [interactionRadius, setInteractionRadiusState] = useState(DEFAULT_EVOLUTION_CONFIG.interactionRadius);
    const [showVision, setShowVision] = useState(DEFAULT_SIMULATION_CONFIG.showVision);
    const [showMouth, setShowMouth] = useState(DEFAULT_SIMULATION_CONFIG.showMouth);

    // Helpers to update both state and engine
    const setGlobalStiffness = useCallback((val: number) => { setGlobalStiffnessState(val); serviceRef.current?.setGlobalStiffness(val); }, [serviceRef]);
    const setGlobalContractility = useCallback((val: number) => { setGlobalContractilityState(val); serviceRef.current?.setGlobalContractility(val); }, [serviceRef]);
    const setGravity = useCallback((val: number) => { setGravityState(val); serviceRef.current?.setGravity(-val); }, [serviceRef]);
    const setFriction = useCallback((val: number) => { setFrictionState(val); serviceRef.current?.setFriction(val); }, [serviceRef]);
    const setRotationalDrag = useCallback((val: number) => { setRotationalDragState(val); serviceRef.current?.setRotationalDrag(val); }, [serviceRef]);
    const setShapeMemory = useCallback((val: number) => { setShapeMemoryState(val); serviceRef.current?.setShapeMemoryStrength(val); }, [serviceRef]);
    const setDensity = useCallback((val: number) => { setDensityState(val); serviceRef.current?.setDensity(val); }, [serviceRef]);
    const setHeadMass = useCallback((val: number) => { setHeadMassState(val); serviceRef.current?.setHeadMass(val); }, [serviceRef]);
    const setBodyMass = useCallback((val: number) => { setBodyMassState(val); serviceRef.current?.setBodyMass(val); }, [serviceRef]);
    const setFootMass = useCallback((val: number) => { setFootMassState(val); serviceRef.current?.setFootMass(val); }, [serviceRef]);
    const setGripDepletion = useCallback((val: number) => { setGripDepletionState(val); serviceRef.current?.setGripDepletionRate(val); }, [serviceRef]);
    const setGripRecharge = useCallback((val: number) => { setGripRechargeState(val); serviceRef.current?.setGripRechargeRate(val); }, [serviceRef]);
    
    const setMaxVelocity = useCallback((val: number) => { setMaxVelocityState(val); serviceRef.current?.setMaxVelocity(val); }, [serviceRef]);
    const setStaticFrictionThreshold = useCallback((val: number) => { setStaticFrictionThresholdState(val); serviceRef.current?.setStaticFrictionThreshold(val); }, [serviceRef]);
    const setMaxGripStress = useCallback((val: number) => { setMaxGripStressState(val); serviceRef.current?.setMaxGripStress(val); }, [serviceRef]);
    const setGripCooldown = useCallback((val: number) => { setGripCooldownState(val); serviceRef.current?.setGripCooldown(val); }, [serviceRef]);
    const setSlipFactor = useCallback((val: number) => { setSlipFactorState(val); serviceRef.current?.setSlipFactor(val); }, [serviceRef]);
    const setBrokenSlipFactor = useCallback((val: number) => { setBrokenSlipFactorState(val); serviceRef.current?.setBrokenSlipFactor(val); }, [serviceRef]);
    const setBaseMuscleDamping = useCallback((val: number) => { setBaseMuscleDampingState(val); serviceRef.current?.setBaseMuscleDamping(val); }, [serviceRef]);
    const setConstraintIterations = useCallback((val: number) => { setConstraintIterationsState(val); serviceRef.current?.setConstraintIterations(val); }, [serviceRef]);
    const setRelaxationFactor = useCallback((val: number) => { setRelaxationFactorState(val); serviceRef.current?.setRelaxationFactor(val); }, [serviceRef]);
    
    // ... add all other setters following the same pattern ...
    const setFoodSpawnCount = useCallback((val: number) => { setFoodSpawnCountState(val); serviceRef.current!.foodSpawnCount = val; serviceRef.current?.updateFoodDistribution(); }, [serviceRef]);
    const setFoodSpawnRadius = useCallback((val: number) => { setFoodSpawnRadiusState(val); serviceRef.current!.foodSpawnRadius = val; serviceRef.current?.updateFoodDistribution(); }, [serviceRef]);
    const setFoodSpawnMinHeight = useCallback((val: number) => { setFoodSpawnMinHeightState(val); serviceRef.current!.foodSpawnMinHeight = val; serviceRef.current?.updateFoodDistribution(); }, [serviceRef]);
    const setFoodSpawnMaxHeight = useCallback((val: number) => { setFoodSpawnMaxHeightState(val); serviceRef.current!.foodSpawnMaxHeight = val; serviceRef.current?.updateFoodDistribution(); }, [serviceRef]);

    const setVisionRadius = useCallback((val: number) => { setVisionRadiusState(val); serviceRef.current!.globalVisionRadius = val; }, [serviceRef]);
    const setInteractionRadius = useCallback((val: number) => { setInteractionRadiusState(val); serviceRef.current!.interactionRadius = val; }, [serviceRef]);
    const setGroundContactMetabolismMultiplier = useCallback((val: number) => { setGroundContactMetabolismMultiplierState(val); serviceRef.current!.groundContactMetabolismMultiplier = val; }, [serviceRef]);
    
    const setOdometryScale = useCallback((val: number) => { setOdometryScaleState(val); DEFAULT_EVOLUTION_CONFIG.odometryScale = val; }, []);
    const setTerritoryScale = useCallback((val: number) => { setTerritoryScaleState(val); DEFAULT_EVOLUTION_CONFIG.territoryScale = val; }, []);
    const setFoodScale = useCallback((val: number) => { setFoodScaleState(val); DEFAULT_EVOLUTION_CONFIG.foodScale = val; }, []);
    const setTimeScale = useCallback((val: number) => { setTimeScaleState(val); DEFAULT_EVOLUTION_CONFIG.timeScale = val; }, []);
    const setFoodScoreIncrement = useCallback((val: number) => { setFoodScoreIncrementState(val); DEFAULT_EVOLUTION_CONFIG.foodScoreIncrement = val; }, []);

    const setPopulationSize = useCallback((val: number) => { setPopulationSizeState(val); serviceRef.current?.setPopulationSize(val); }, [serviceRef]);
    const setVaultSaveFrequency = useCallback((val: number) => { setVaultSaveFrequencyState(val); serviceRef.current!.vaultSaveFrequency = val; }, [serviceRef]);
    const setBreedingThreshold = useCallback((val: number) => { setBreedingThresholdState(val); serviceRef.current!.breedingThreshold = val; }, [serviceRef]);

    const setBaseDecay = useCallback((val: number) => { setBaseDecayState(val); serviceRef.current!.baseDecay = val; }, [serviceRef]);
    const setMovementCost = useCallback((val: number) => { setMovementCostState(val); serviceRef.current!.movementCost = val; }, [serviceRef]);
    const setFoodEnergy = useCallback((val: number) => { setFoodEnergyState(val); serviceRef.current!.foodEnergy = val; }, [serviceRef]);
    const setFoodSpreadFactor = useCallback((val: number) => { setFoodSpreadFactorState(val); serviceRef.current!.foodSpreadFactor = val; serviceRef.current?.updateFoodDistribution(); }, [serviceRef]);
    const setRedBasalMultiplier = useCallback((val: number) => { setRedBasalMultiplierState(val); serviceRef.current!.redBasalMultiplier = val; }, [serviceRef]);
    const setBlueMovementMultiplier = useCallback((val: number) => { setBlueMovementMultiplierState(val); serviceRef.current!.blueMovementMultiplier = val; }, [serviceRef]);
    const setGreenMovementMultiplier = useCallback((val: number) => { setGreenMovementMultiplierState(val); serviceRef.current!.greenMovementMultiplier = val; }, [serviceRef]);

    return {
        globalStiffness, setGlobalStiffness,
        globalContractility, setGlobalContractility,
        shapeMemory, setShapeMemory,
        gravity, setGravity,
        friction, setFriction,
        rotationalDrag, setRotationalDrag,
        density, setDensity,
        headMass, setHeadMass,
        bodyMass, setBodyMass,
        footMass, setFootMass,
        gripDepletion, setGripDepletion,
        gripRecharge, setGripRecharge,
        maxVelocity, setMaxVelocity,
        staticFrictionThreshold, setStaticFrictionThreshold,
        maxGripStress, setMaxGripStress,
        gripCooldown, setGripCooldown,
        slipFactor, setSlipFactor,
        brokenSlipFactor, setBrokenSlipFactor,
        baseMuscleDamping, setBaseMuscleDamping,
        constraintIterations, setConstraintIterations,
        relaxationFactor, setRelaxationFactor,
        foodSpawnCount, setFoodSpawnCount,
        foodSpawnRadius, setFoodSpawnRadius,
        foodSpawnMinHeight, setFoodSpawnMinHeight,
        foodSpawnMaxHeight, setFoodSpawnMaxHeight,
        visionRadius, setVisionRadius,
        interactionRadius, setInteractionRadius,
        groundContactMetabolismMultiplier, setGroundContactMetabolismMultiplier,
        populationSize, setPopulationSize,
        vaultSaveFrequency, setVaultSaveFrequency,
        breedingThreshold, setBreedingThreshold,
        baseDecay, setBaseDecay,
        movementCost, setMovementCost,
        foodEnergy, setFoodEnergy,
        foodSpreadFactor, setFoodSpreadFactor,
        redBasalMultiplier, setRedBasalMultiplier,
        blueMovementMultiplier, setBlueMovementMultiplier,
        greenMovementMultiplier, setGreenMovementMultiplier,
        odometryScale, setOdometryScale,
        territoryScale, setTerritoryScale,
        foodScale, setFoodScale,
        timeScale, setTimeScale,
        foodScoreIncrement, setFoodScoreIncrement,
        showVision, setShowVision,
        showMouth, setShowMouth
    };
}
