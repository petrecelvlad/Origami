import { useState, useEffect, useRef, useCallback } from 'react';
import { EvolutionService } from './EvolutionService';
import { Organism, ShapeType, FamilyType } from '../domain/types';
import { INITIAL_SHAPE } from '../domain/constants';
import { useSimulationEngine } from './useSimulationEngine';
import { usePhysicsSettings } from './usePhysicsSettings';
import { usePersistence } from './usePersistence';
import { localVault } from '../infrastructure/local/LocalVault';
import { toast } from 'sonner';

/**
 * @propolis
 * {
 *   "role": "HOOK",
 *   "dependencies": ["@application/EvolutionService", "@domain/types"],
 *   "agent_instructions": "Coordinates the main simulation requestAnimationFrame loop. Avoid setting high-frequency state inside the loop."
 * }
 */
export function useEvolutionLoop() {
  const serviceRef = useRef<EvolutionService | null>(null);
  if (!serviceRef.current) {
      serviceRef.current = new EvolutionService();
  }
  
  const requestRef = useRef<number>(0);
  const trackedLeaderIdRef = useRef<string | null>(null);
  const [trackedLeaderId, setTrackedLeaderId] = useState<string | null>(null);
  const [familyOrder, setFamilyOrder] = useState<FamilyType[]>(Object.values(FamilyType));
  
  const engine = useSimulationEngine(serviceRef);
  const settings = usePhysicsSettings(serviceRef);
  
  const settingsRef = useRef(settings);
  useEffect(() => {
      settingsRef.current = settings;
  }, [settings]);
  
  const spawnCustom = useCallback((organism: Organism, autoStart: boolean = false, bulkChampions?: Organism[]) => {
    serviceRef.current!.setTemplateAndReset(organism, bulkChampions);
    const restoredGen = serviceRef.current!.currentGeneration;
    
    // Removed setPopulation calls to prevent DataCloneError
    engine.setGeneration(restoredGen);
    
    engine.statsRef.current = { 
        ...engine.statsRef.current,
        fitness: 0, 
        avgFitness: 0,
        energy: 100,
        maxEnergy: 100,
        trackedFamily: null,
        foodEaten: 0,
        totalFoodEaten: 0,
        aliveCount: serviceRef.current!.population.length
    };
    
    trackedLeaderIdRef.current = null;
    setTrackedLeaderId(null);
    engine.setFitnessHistory([]); 
    
    engine.setIsRunning(autoStart);
    engine.setIsFastForward(false);
  }, [engine, serviceRef]);

  const persistence = usePersistence(serviceRef, spawnCustom);

  // Initialize
  useEffect(() => {
    const service = serviceRef.current!;
    
    // Setup Autosave Interval
    // NOTE: Removed interval-based autosave per user request. 
    // Autosave now only triggers on genComplete.

    const unsubUpdate = service.subscribe('update', (pop, time) => {
        let bestCandidate: Organism | null = null;
        let bestZ = -Infinity;

        for (const org of pop) {
            if (!org.isAlive) continue;
            let cz = 0;
            for (const n of org.nodes) cz += n.pos.z;
            cz /= org.nodes.length;
            if (cz > bestZ) {
                bestZ = cz;
                bestCandidate = org;
            }
        }

        let trackedLeader = pop.find(o => o.id === trackedLeaderIdRef.current);
        
        if (!trackedLeader || !trackedLeader.isAlive) {
            const nextLeader = bestCandidate || pop[0];
            if (nextLeader?.id !== trackedLeaderIdRef.current) {
                trackedLeaderIdRef.current = nextLeader?.id || null;
                setTrackedLeaderId(trackedLeaderIdRef.current);
            }
            trackedLeader = nextLeader;
        }

        let alive = 0;
        let peakFitness = 0;
        let totalFitness = 0;
        for (const org of pop) {
            if (org.isAlive) alive++;
            if (org.fitness > peakFitness) peakFitness = org.fitness;
            totalFitness += org.fitness;
        }

        if (trackedLeader) {
            engine.statsRef.current.fitness = trackedLeader.fitness || 0; // Use leader fitness specifically
            engine.statsRef.current.avgFitness = totalFitness / (pop.length || 1);
            engine.statsRef.current.foodEaten = trackedLeader.foodEaten;
            engine.statsRef.current.totalFoodEaten = trackedLeader.totalFoodEaten || 0;
            engine.statsRef.current.distance = trackedLeader.distanceTraveled || 0;
            engine.statsRef.current.energy = trackedLeader.energy;
            engine.statsRef.current.maxEnergy = trackedLeader.maxEnergy;
            engine.statsRef.current.trackedFamily = trackedLeader.family || null;
            
            if (trackedLeader.fitnessBreakdown) {
                engine.statsRef.current.fitnessBreakdown = { ...trackedLeader.fitnessBreakdown };
            }

            // Real-time update for leaderboard
            // Removed engine.setPopulation([...pop]) to prevent severe React performance dumps and DataCloneError
            // Leaderboard will update via generation changes instead

            // Calculate net progress for breakdown display
            const startPos = trackedLeader.initialHeadPos || { x: 0, y: 0, z: 0 };
            const head = trackedLeader.headNode || trackedLeader.nodes[0];
            if (head) {
                const dx = head.pos.x - startPos.x;
                const dz = head.pos.z - startPos.z;
                engine.statsRef.current.netProgress = Math.sqrt(dx*dx + dz*dz);
            }
            engine.statsRef.current.odometer = trackedLeader.odometer || 0;

            const meta = trackedLeader.neuralGenome?.meta;
            if (meta) {
                engine.statsRef.current.globalAge = meta.lineageGeneration || 1;
                engine.statsRef.current.projectName = meta.projectName || '';
            }
        }
        engine.statsRef.current.aliveCount = alive;
        engine.statsRef.current.totalCount = pop.length;
    });

    const unsubGen = service.subscribe('genComplete', (best, gen) => {
        const avg = engine.statsRef.current.avgFitness;
        engine.setFitnessHistory(prev => [...prev, avg]);
        engine.setGeneration(gen);
        engine.statsRef.current.globalAge = gen;

        // Calculate and update family ranking order
        const stats: Record<FamilyType, number> = {} as any;
        Object.values(FamilyType).forEach(fam => stats[fam] = 0);
        serviceRef.current!.population.forEach(org => {
            const fam = org.family as FamilyType;
            if (!stats[fam] || (org.fitness || 0) > stats[fam]) stats[fam] = org.fitness || 0;
        });
        
        const newOrder = Object.values(FamilyType).sort((a,b) => (stats[b] || 0) - (stats[a] || 0));
        setFamilyOrder(newOrder);

        // Use persistence instead of direct vault call
        if (gen % settingsRef.current.vaultSaveFrequency === 0) {
            persistence.autosaveChampions()
                .then(() => toast.success(`Generation ${gen} saved to vault!`))
                .catch(err => {
                    console.error("Generation save failed", err);
                    toast.error("Failed to save generation to vault.");
                });
        }
    });
    
    const unsubNewGen = service.subscribe('newGen', (newPop) => {
        // Removed setPopulation
        engine.setGeneration(service.currentGeneration);
        engine.statsRef.current.fitness = 0;
        engine.statsRef.current.avgFitness = 0;
        engine.statsRef.current.foodEaten = 0;
        engine.statsRef.current.totalFoodEaten = 0;
        engine.statsRef.current.distance = 0;
    });

    service.initializePopulation(INITIAL_SHAPE);
    
    // Use persistence.autoloadChampions
    persistence.autoloadChampions().catch(err => {
        console.error("Failed to load vault", err);
        // Removed setPopulation
    });

    return () => {
        cancelAnimationFrame(requestRef.current!);
        unsubUpdate();
        unsubGen();
        unsubNewGen();
    };
  }, []); // orchestration

  const reset = useCallback((shape: ShapeType) => {
    engine.reset(shape);
    trackedLeaderIdRef.current = null;
    setTrackedLeaderId(null);
  }, [engine]);
  
  const evolve = useCallback(() => {
    engine.evolve();
  }, [engine]);

  const isLoopingRef = useRef(false);

  const loop = useCallback(async () => {
    if (!engine.isRunning || isLoopingRef.current) return;
    
    isLoopingRef.current = true;
    const iterations = engine.isFastForward ? 8 : 1;
    
    for(let i=0; i<iterations; i++) {
        if (!engine.isRunning) break;
        await serviceRef.current!.step(0.016);
    }
    
    isLoopingRef.current = false;
    if (engine.isRunning) {
        requestRef.current = requestAnimationFrame(loop);
    }
  }, [engine.isRunning, engine.isFastForward, serviceRef]);

  useEffect(() => {
    if (engine.isRunning) {
      if (!isLoopingRef.current) {
          requestRef.current = requestAnimationFrame(loop);
      }
    } else {
      cancelAnimationFrame(requestRef.current!);
      isLoopingRef.current = false;
    }
    return () => {
        cancelAnimationFrame(requestRef.current!);
        isLoopingRef.current = false;
    };
  }, [engine.isRunning, loop]);

  const getAllChampions = useCallback(() => {
      return serviceRef.current!.getAllChampions();
  }, []);

  return {
    ...engine,
    settings,
    ...persistence,
    trackedLeaderId,
    spawnCustom,
    reset,
    evolve,
    getAllChampions,
    familyOrder,
    cycleTrackedLeader: (dir: 1 | -1) => {
        const sorted = [...serviceRef.current!.population].sort((a,b) => b.fitness - a.fitness);
        const currentIndex = sorted.findIndex(o => o.id === trackedLeaderIdRef.current);
        let nextIndex = currentIndex + dir;
        if (nextIndex < 0) nextIndex = sorted.length - 1;
        if (nextIndex >= sorted.length) nextIndex = 0;
        
        trackedLeaderIdRef.current = sorted[nextIndex].id;
        setTrackedLeaderId(trackedLeaderIdRef.current);
    },
    isAutoEvolving: engine.isFastForward,
    toggleAutoEvolve: () => {
        engine.setIsFastForward(prev => !prev);
        if (!engine.isFastForward) engine.setIsRunning(true);
    }
  };
}
