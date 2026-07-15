import React, { useState, useCallback, useRef } from 'react';
import { Organism, ShapeType, FamilyType } from '../domain/types';
import { EvolutionService } from './EvolutionService';

/**
 * @propolis
 * {
 *   "role": "HOOK",
 *   "dependencies": ["@domain/types", "@application/EvolutionService"],
 *   "agent_instructions": "Manages core simulation state (population, generation, running status). Use statsRef for high-frequency telemetry."
 * }
 */
export function useSimulationEngine(serviceRef: React.MutableRefObject<EvolutionService | null>) {
    // The population is no longer in React state to prevent DataCloneError and massive memory dumps
    // Now we rely exclusively on EvolutionService to hold the array internally.
    // Instead of state, we'll provide a getter or just the current reference.
    const getPopulation = useCallback(() => {
        return serviceRef.current?.population || [];
    }, [serviceRef]);

    const [generation, setGeneration] = useState(1);
    const [isRunning, setIsRunning] = useState(false);
    const [isFastForward, setIsFastForward] = useState(false);
    const [fitnessHistory, setFitnessHistory] = useState<number[]>([]);
    
    // Stats Ref should probably be passed or managed here
    const statsRef = useRef({ 
        fitness: 0, 
        avgFitness: 0, 
        foodEaten: 0, 
        totalFoodEaten: 0,
        distance: 0, 
        energy: 0,
        maxEnergy: 100,
        trackedFamily: null as FamilyType | null,
        aliveCount: 0,
        totalCount: 0, 
        globalAge: 0, 
        projectName: '',
        fitnessBreakdown: {
            distanceScore: 0,
            explorationScore: 0,
            survivalScore: 0,
            foodScore: 0
        },
        netProgress: 0,
        odometer: 0
    });

    const reset = useCallback((shape: ShapeType) => {
        setIsRunning(false);
        setIsFastForward(false);
        serviceRef.current?.initializePopulation(shape);
        setGeneration(1);
        setFitnessHistory([]);
    }, [serviceRef]);

    const evolve = useCallback(() => {
        serviceRef.current?.evolve();
        setGeneration(serviceRef.current!.currentGeneration);
    }, [serviceRef]);

    return { 
        population: getPopulation(),
        generation, setGeneration,
        isRunning, setIsRunning,
        isFastForward, setIsFastForward,
        fitnessHistory, setFitnessHistory,
        statsRef,
        reset,
        evolve
    };
}
