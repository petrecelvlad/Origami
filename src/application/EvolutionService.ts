/**
 * @propolis
 * {
 *   "role": "SERVICE",
 *   "dependencies": ["@domain/genetics", "@application/LineageManager", "@application/Serializer"],
 *   "constraints": ["C-003", "C-005"],
 *   "agent_instructions": "Batch updates to the vault every 10 generations. Maintain lineage consistency."
 * }
 */
import { BioPhysicsEngine } from '../domain/BioPhysicsEngine';
import { Organism, ShapeType, NeuralGenome, FoodItem, Node, Muscle, CellType, FamilyType } from '../domain/types';
import { ShapeFactory } from '../domain/ShapeFactory';
import { VectorOps } from '../domain/math';
import { GeneticOperator, FAMILY_COLORS } from '../domain/genetics/GeneticOperator';
import { IFitnessEvaluator, StandardFitnessEvaluator } from '../domain/fitness/FitnessEvaluator';
import { BrainController } from '../domain/neural/BrainController';
import { DEFAULT_EVOLUTION_CONFIG, DEFAULT_SIMULATION_CONFIG } from '../domain/constants';
import { LatticeFactory } from '../domain/lattice/LatticeStrategy';
import { AtomicNormalizer } from '../domain/AtomicNormalizer';
import { FamilyRegistry } from '../domain/genetics/FamilyRegistry';

// GPU MIGRATION
import { GpuBridge } from './GpuBridge';
import { MetabolicService, MetabolicConfig } from './MetabolicService';
import { EcosystemService, EcosystemConfig } from './EcosystemService';
import { LineageManager } from './LineageManager';
import { ENGINE_CONFIG } from '../domain/EngineConfig';
import { localVault } from '../infrastructure/local/LocalVault';

import { Serializer } from './Serializer';

export class EvolutionService {
  public population: Organism[] = [];
  public simulationTime = 0;
  
  // Services
  public gpu: GpuBridge;
  private metabolicService: MetabolicService;
  private ecosystemService: EcosystemService;
  private lineage: LineageManager;

  public get currentGeneration(): number { return this.lineage.generation; }
  public get useGPU(): boolean { return this.gpu.isActive; }

  private engine: BioPhysicsEngine;
  private geneticOperator: GeneticOperator;
  private fitnessEvaluator: IFitnessEvaluator;

  private populationSize = DEFAULT_EVOLUTION_CONFIG.populationSize;
  public setPopulationSize(val: number) { 
      this.populationSize = val; 
  }
  public getPopulationSize() { return this.populationSize; }

  private template: Organism | null = null; 
  
  public startEnergy = DEFAULT_EVOLUTION_CONFIG.startEnergy;
  public baseDecay = DEFAULT_EVOLUTION_CONFIG.baseDecay; 
  public movementCost = DEFAULT_EVOLUTION_CONFIG.movementCost; // Energy per meter
  public hungerAccel = DEFAULT_EVOLUTION_CONFIG.hungerAccel; 
  public foodEnergy = DEFAULT_EVOLUTION_CONFIG.foodEnergy;
  
  // Family Metabolic Traits
  public redBasalMultiplier = DEFAULT_EVOLUTION_CONFIG.redBasalMultiplier;
  public blueMovementMultiplier = DEFAULT_EVOLUTION_CONFIG.blueMovementMultiplier;
  public greenMovementMultiplier = DEFAULT_EVOLUTION_CONFIG.greenMovementMultiplier;
  
  // Updated: Interaction radius consolidates eat and magnet for visual consistency
  public interactionRadius = DEFAULT_EVOLUTION_CONFIG.interactionRadius;

  public foodSpawnCount = DEFAULT_EVOLUTION_CONFIG.foodSpawnCount; 
  public foodSpawnRadius = DEFAULT_EVOLUTION_CONFIG.foodSpawnRadius; 
  public foodSpreadFactor = DEFAULT_EVOLUTION_CONFIG.foodSpreadFactor;
  
  public foodSpawnMinHeight = DEFAULT_EVOLUTION_CONFIG.foodSpawnMinHeight;
  public foodSpawnMaxHeight = DEFAULT_EVOLUTION_CONFIG.foodSpawnMaxHeight;
  
  public globalVisionRadius = DEFAULT_EVOLUTION_CONFIG.globalVisionRadius;
  
  public vaultSaveFrequency = DEFAULT_EVOLUTION_CONFIG.vaultSaveFrequency;
  
  public groundContactMetabolismMultiplier = DEFAULT_EVOLUTION_CONFIG.groundContactMetabolismMultiplier;
  public breedingThreshold = DEFAULT_EVOLUTION_CONFIG.breedingThreshold;

  // DENSITY CONTROL
  private densityMultiplier = DEFAULT_SIMULATION_CONFIG.densityMultiplier;
  private headMass = DEFAULT_SIMULATION_CONFIG.headMass || 4.0;
  private bodyMass = DEFAULT_SIMULATION_CONFIG.bodyMass || 1.0;
  private footMass = DEFAULT_SIMULATION_CONFIG.footMass || 2.5;

  // METHOD 2: Object Pooling
  private deadPool: Organism[] = [];

  private updateListeners: ((pop: Organism[], time: number) => void)[] = [];
  private genCompleteListeners: ((best: Organism, gen: number) => void)[] = [];
  private newGenListeners: ((pop: Organism[]) => void)[] = [];
  private pulseListeners: ((champions: Organism[], gen: number) => void)[] = [];

  constructor() {
    this.engine = new BioPhysicsEngine();
    this.geneticOperator = new GeneticOperator(DEFAULT_EVOLUTION_CONFIG.mutationRate);
    this.fitnessEvaluator = new StandardFitnessEvaluator();
    
    // Services
    this.gpu = new GpuBridge();
    this.metabolicService = new MetabolicService();
    this.ecosystemService = new EcosystemService();
    this.lineage = new LineageManager();

    // GPU path disabled for release: the WebGPU physics port diverges from
    // BioPhysicsEngine (slow cumulative collapse under load) and the fix was not
    // localized — see docs/05_ARCHIVE/05_ISSUES.md Issue #6 and
    // cone/agent/sessions/07_July/Week_1/2026-07-05/02_LAPTOP_GPU_PHYSICS_BUG.md.
    // Leaving gpu.isActive at its default `false` routes every device through the
    // CPU path unconditionally (see EvolutionService.step()). Do not re-enable by
    // calling initGPU() until that divergence is numerically resolved via the
    // CPU/GPU parity harness.
    // this.initGPU();
  }

  private async initGPU() {
      const success = await this.gpu.initialize();
      if (success) {
          if (this.population.length > 0) {
              this.gpu.syncPopulation(this.population, 0.016);
          }
          console.log("Hardware Acceleration ENGAGED! GPU Brain & Physics ready.");
      }
  }
  
  // --- PHYSICS CONFIGURATION ---
  public setGlobalStiffness(val: number) { this.engine.setConfig({ globalStiffness: val }); }
  public setGlobalContractility(val: number) { this.engine.setConfig({ globalContractility: val }); }
  public setGravity(val: number) { this.engine.setConfig({ gravity: val }); }
  public setFriction(val: number) { this.engine.setConfig({ friction: val }); }
  public setRotationalDrag(val: number) { this.engine.setConfig({ rotationalDrag: val }); }
  public setShapeMemoryStrength(val: number) { this.engine.setConfig({ shapeMemoryStrength: val }); }
  
  public setGripDepletionRate(val: number) { this.engine.setConfig({ gripDepletionRate: val }); }
  public setGripRechargeRate(val: number) { this.engine.setConfig({ gripRechargeRate: val }); }
  
  // Advanced Physics
  public setMaxGripStress(val: number) { this.engine.setConfig({ maxGripStress: val }); }
  public setGripCooldown(val: number) { this.engine.setConfig({ gripCooldown: val }); }
  public setStaticFrictionThreshold(val: number) { this.engine.setConfig({ staticFrictionThreshold: val }); }
  public setMuscleSignalLimit(val: number) { this.engine.setConfig({ muscleSignalLimit: val }); }
  public setMuscleSoftness(val: number) { this.engine.setConfig({ muscleSoftness: val }); }
  public setMaxVelocity(val: number) { this.engine.setConfig({ maxVelocity: val }); }
  public setSlipFactor(val: number) { this.engine.setConfig({ slipFactor: val }); }
  public setBrokenSlipFactor(val: number) { this.engine.setConfig({ brokenSlipFactor: val }); }
  public setWaveFreq(val: number) { this.engine.setConfig({ waveFreq: val }); }
  public setWaveAmp(val: number) { this.engine.setConfig({ waveAmp: val }); }
  public setTerminalVelocity(val: number) { this.engine.setConfig({ terminalVelocity: val }); }
  public setMaxYieldRatio(val: number) { this.engine.setConfig({ maxYieldRatio: val }); }
  public setGlobalDamping(val: number) { this.engine.setConfig({ globalDamping: val }); }
  public setBaseMuscleDamping(val: number) { this.engine.setConfig({ baseMuscleDamping: val }); }
  public setConstraintIterations(val: number) { this.engine.setConfig({ constraintIterations: val }); }
  public setContractionSpeed(val: number) { this.engine.setConfig({ contractionSpeed: val }); }
  public setAntiSingularityRadius(val: number) { this.engine.setConfig({ antiSingularityRadius: val }); }
  public setRelaxationFactor(val: number) { this.engine.setConfig({ relaxationFactor: val }); }

  // NEW: DENSITY CONTROL
  public setDensity(val: number) {
      this.densityMultiplier = val;
      this.refreshNodeMasses();
  }

  public setHeadMass(val: number) { this.headMass = val; this.refreshNodeMasses(); }
  public setBodyMass(val: number) { this.bodyMass = val; this.refreshNodeMasses(); }
  public setFootMass(val: number) { this.footMass = val; this.refreshNodeMasses(); }

  private refreshNodeMasses() {
      // Update existing population immediately
      this.population.forEach(org => {
          org.nodes.forEach(n => {
              let base = this.bodyMass;
              if (n.cellType === CellType.HEAD || n.isHead) base = this.headMass;
              if (n.cellType === CellType.FOOT) base = this.footMass;
              
              n.mass = base * this.densityMultiplier;
          });
      });

      // SYNC TO GPU IMMEDIATELY
      if (this.gpu && this.gpu.isActive) {
          this.gpu.syncPopulation(this.population, 0.016);
      }
  }

  private getEcosystemConfig(): EcosystemConfig {
      return {
          foodSpawnCount: this.foodSpawnCount,
          foodSpawnRadius: this.foodSpawnRadius,
          foodSpawnMinHeight: this.foodSpawnMinHeight,
          foodSpawnMaxHeight: this.foodSpawnMaxHeight,
          foodEnergy: this.foodEnergy,
          interactionRadius: this.interactionRadius,
          magnetForce: 0.8,
          breedingThreshold: this.breedingThreshold,
          foodSpreadFactor: this.foodSpreadFactor
      };
  }

  private getMetabolicConfig(): MetabolicConfig {
      return {
          baseDecay: this.baseDecay,
          movementCost: this.movementCost,
          hungerAccel: this.hungerAccel,
          redBasalMultiplier: this.redBasalMultiplier,
          blueMovementMultiplier: this.blueMovementMultiplier,
          greenMovementMultiplier: this.greenMovementMultiplier,
          groundContactMetabolismMultiplier: this.groundContactMetabolismMultiplier
      };
  }

  public updateFoodDistribution(): void {
      this.ecosystemService.refreshAll(this.population, this.getEcosystemConfig());
  }

  public initializePopulation(shape: ShapeType): void {
    this.deadPool = []; 
    this.population = [];
    this.lineage.initialize(`Subject ${shape}`);
    this.template = ShapeFactory.create(shape, 'template');
    
    // Inject initial meta into template genome
    if (this.template.neuralGenome) {
        this.template.neuralGenome.meta = {
            lineageId: this.lineage.lineageId,
            projectName: this.lineage.projectName,
            lineageGeneration: 1, 
            originDate: new Date().toISOString()
        };
        this.template.generation = 1;
    }
    
    this.spawnGeneration([], true);
  }

  public setTemplateAndReset(organism: Organism, preloadedChampions?: Organism[]): void {
    this.deadPool = []; 
    this.population = [];
    
    const sanitized = AtomicNormalizer.sanitize(organism);
    this.lineage.adopt(sanitized);

    this.template = sanitized;
    this.template!.headNode = this.template!.nodes.find(n => n.isHead) ?? this.template!.nodes[0];
    this.template!.generation = this.lineage.generation;
    
    console.log(`[EvolutionService] Lineage Adopted: ID ${this.lineage.lineageId}, Name ${this.lineage.projectName}, Age ${this.lineage.generation}`);
    
    if (preloadedChampions && preloadedChampions.length > 0) {
        this.lineage.bulkLoadChampions(preloadedChampions);
        this.spawnGeneration([], false); 
    } else {
        const fam = this.template.family || FamilyType.BRUTE;
        this.template.family = fam;
        this.lineage.setChampion(fam as FamilyType, this.template);
        this.spawnGeneration([], false); 
    }
  }

  private cleanupAndPoolCurrentPopulation() {
      // Clean brains and push to dead pool instead of letting GC collect
      this.population.forEach(org => {
          if (org.brain && typeof org.brain.reset === 'function') {
              org.brain.reset(org);
          }
          // Fix exponential memory leak by capping the dead pool!
          if (this.deadPool.length < this.populationSize * 2) {
              this.deadPool.push(org);
          }
      });
  }

  private spawnGeneration(tournamentPool: Organism[], resetGen: boolean): void {
      if (!this.template) return;

      this.cleanupAndPoolCurrentPopulation();
      this.population = [];

      if (resetGen) {
          this.lineage.clearChampions();
      }
      this.simulationTime = 0;

      const primals = [FamilyType.BRUTE, FamilyType.MONOLITH, FamilyType.SCOUT];
      const allFamilies = [
          ...primals,
          FamilyType.CHARGER, FamilyType.NOMAD, FamilyType.HUNTER,
          FamilyType.GUARDIAN, FamilyType.PHANTOM, FamilyType.WARRIOR,
          FamilyType.APEX
      ];

      // Equal distribution
      const botsPerFamily = Math.floor(this.populationSize / allFamilies.length);
      let remainder = this.populationSize % allFamilies.length;

      for (const fam of allFamilies) {
          let numBots = botsPerFamily;
          if (remainder > 0) {
              numBots++;
              remainder--;
          }
          
          let champion = this.lineage.getChampion(fam);
          
          for (let i = 0; i < numBots; i++) {
              const child = this.createOrganismFromTemplate(this.template, `fam_${fam}_s${i}_g${this.currentGeneration}`);
              child.family = fam;
              child.color = FAMILY_COLORS[fam];
              child.generation = this.currentGeneration;
              
              if (child.neuralGenome) {
                  if (!child.neuralGenome.meta) {
                      child.neuralGenome.meta = {
                          lineageId: this.lineage.lineageId,
                          projectName: this.lineage.projectName,
                          lineageGeneration: child.generation,
                          originDate: new Date().toISOString()
                      };
                  } else {
                      child.neuralGenome.meta.lineageGeneration = child.generation;
                  }
              }
              
              if (i === 0 && champion) {
                  this.geneticOperator.cloneGenome(champion.neuralGenome, child.neuralGenome);
              } else {
                  if (!champion) {
                      this.seedGenerationOne(child, fam);
                  } else {
                      this.geneticOperator.cloneGenome(champion.neuralGenome, child.neuralGenome);
                      const mutationRate = i * 0.005;
                      this.geneticOperator.mutateGenome(child.neuralGenome, mutationRate);
                  }
              }
              
              this.ecosystemService.generateFoodTrack(child, this.getEcosystemConfig());
              this.population.push(child);
          }
      }

      if (this.useGPU) {
          this.gpu.syncPopulation(this.population, 0.016);
      }

      this.notifyNewGeneration(this.population);
  }

  private seedGenerationOne(child: Organism, fam: FamilyType) {
      if (!this.template) return;
      const numMuscles = this.template.muscles.length;
      const numNodes = this.template.nodes.length;

      const createRoot = (f: FamilyType) => this.geneticOperator.createRandomGenome(numMuscles, numNodes, 20, f);
      
      switch(fam) {
          case FamilyType.BRUTE:
          case FamilyType.MONOLITH:
          case FamilyType.SCOUT:
              this.geneticOperator.cloneGenome(createRoot(fam), child.neuralGenome);
              break;
          case FamilyType.CHARGER: // R + B
              this.geneticOperator.crossoverGenomes(createRoot(FamilyType.BRUTE), createRoot(FamilyType.MONOLITH), child.neuralGenome);
              break;
          case FamilyType.NOMAD: // B + G
              this.geneticOperator.crossoverGenomes(createRoot(FamilyType.MONOLITH), createRoot(FamilyType.SCOUT), child.neuralGenome);
              break;
          case FamilyType.HUNTER: // G + R
              this.geneticOperator.crossoverGenomes(createRoot(FamilyType.SCOUT), createRoot(FamilyType.BRUTE), child.neuralGenome);
              break;
          case FamilyType.GUARDIAN: // Charger + Nomad
              this.geneticOperator.crossoverGenomes(createRoot(FamilyType.CHARGER), createRoot(FamilyType.NOMAD), child.neuralGenome);
              break;
          case FamilyType.PHANTOM: // Nomad + Hunter
              this.geneticOperator.crossoverGenomes(createRoot(FamilyType.NOMAD), createRoot(FamilyType.HUNTER), child.neuralGenome);
              break;
          case FamilyType.WARRIOR: // Hunter + Charger
              this.geneticOperator.crossoverGenomes(createRoot(FamilyType.HUNTER), createRoot(FamilyType.CHARGER), child.neuralGenome);
              break;
          case FamilyType.APEX: // Everything blend
              this.geneticOperator.crossoverGenomes(createRoot(FamilyType.GUARDIAN), createRoot(FamilyType.PHANTOM), child.neuralGenome);
              break;
      }
      // Apply initial mutation
      this.geneticOperator.mutateGenome(child.neuralGenome, 0.1);
  }

  private generateFoodTrack(organism: Organism): void {
      const numFood = this.foodSpawnCount; 
      // Reuse the existing array to prevent creating massive garbage every generation
      if (!organism.visibleFood) organism.visibleFood = [];

      let centerX = 0;
      let centerZ = 0;

      // OPTIMIZATION: Use cached headNode
      const head = organism.headNode;

      if (head) {
          centerX = head.pos.x;
          centerZ = head.pos.z;
      }
      
      const spread = this.foodSpawnRadius; 
      
      // Vertical Range Logic
      const minY = this.foodSpawnMinHeight;
      const maxY = Math.max(minY, this.foodSpawnMaxHeight);
      const rangeY = maxY - minY;

      for(let i=0; i<numFood; i++) {
          const theta = Math.random() * Math.PI * 2;
          const radius = 1.0 + Math.random() * spread; 
          const x = centerX + Math.cos(theta) * radius;
          const z = centerZ + Math.sin(theta) * radius;
          
          // Use configurable height range
          const y = minY + Math.random() * rangeY;

          if (organism.visibleFood[i]) {
              organism.visibleFood[i].pos.x = x;
              organism.visibleFood[i].pos.y = y;
              organism.visibleFood[i].pos.z = z;
              organism.visibleFood[i].energyValue = this.foodEnergy;
              organism.visibleFood[i].consumed = false;
          } else {
              organism.visibleFood.push({
                  id: `f_${i}`,
                  pos: { x, y, z },
                  energyValue: this.foodEnergy,
                  consumed: false
              });
          }
      }
      // Trim extraneous food items if settings were lowered
      if (organism.visibleFood.length > numFood) {
          organism.visibleFood.length = numFood;
      }
  }

  public getAllChampions(): Organism[] {
      return this.lineage.getAllChampions();
  }

  public getBestOrganism(): Organism | null {
      if (this.population.length === 0) return null;
      const sorted = [...this.population].sort((a, b) => b.fitness - a.fitness);
      const best = sorted[0];
      
      const cleanCopy = Serializer.deserializeOrganism(Serializer.serializeOrganism(best));
      cleanCopy.generation = this.currentGeneration;
      
      return cleanCopy;
  }
  
  public getLeader(): Organism | null {
      if (this.population.length === 0) return null;
      
      let bestAlive: Organism | null = null;
      let maxZAlive = -Infinity;
      
      let bestDead: Organism | null = null;
      let maxZDead = -Infinity;

      for (const org of this.population) {
          let cz = 0;
          for(const n of org.nodes) cz += n.pos.z;
          cz /= org.nodes.length;
          
          if (org.isAlive) {
              if (cz > maxZAlive) { maxZAlive = cz; bestAlive = org; }
          } else {
              if (cz > maxZDead) { maxZDead = cz; bestDead = org; }
          }
      }
      
      return bestAlive || bestDead || this.population[0];
  }

  public async step(dt: number): Promise<void> {
    this.simulationTime += dt;
    
    if (this.useGPU) {
        await this.gpu.executeStep(
            this.population, 
            dt, 
            (this.engine as any).config.gravity,
            (this.engine as any).config.globalStiffness,
            this.globalVisionRadius,
            (this.engine as any).config
        );
        await this.updateMetabolism(dt);
        this.postPhysicsLogic();
    } else {
        this.updatePhysics(dt, false);
        await this.updateMetabolism(dt);
        this.postPhysicsLogic();
    }
  }

  private postPhysicsLogic() {
    this.processBreedingQueue();

    if (Math.floor(this.simulationTime * 100) % 100 === 0) {
        this.applySocialLearning();
    }

    const allDead = !this.population.some(org => org.isAlive);
    if (allDead) {
        this.evolve();
    }

    this.notifyUpdate(this.population, this.simulationTime);
  }
  
  private breedingQueue: Organism[] = [];

  private processBreedingQueue() {
      if (this.breedingQueue.length > 0) {
          if (this.useGPU) {
              let currentNodes = this.population.reduce((sum, o) => sum + o.nodes.length, 0);
              let currentMuscles = this.population.reduce((sum, o) => sum + o.muscles.length, 0);
              
              // We must strictly enforce WebGPU buffer limits to prevent DEVICE_LOSS crashes
              for (let i = 0; i < this.breedingQueue.length; i++) {
                  const child = this.breedingQueue[i];
                  if (this.population.length >= 1950) break;
                  if (currentNodes + child.nodes.length >= 19500) break;
                  if (currentMuscles + child.muscles.length >= 39500) break;
                  
                  this.population.push(child);
                  currentNodes += child.nodes.length;
                  currentMuscles += child.muscles.length;
              }
              this.gpu.syncPopulation(this.population, 0.016);
          } else {
              // Same 2x ratio as the dead-pool cap: without a bound, sustained
              // breeding grows the population until the frame loop collapses.
              const cap = this.populationSize * 2;
              for (const child of this.breedingQueue) {
                  if (this.population.length >= cap) break;
                  this.population.push(child);
              }
          }
          this.breedingQueue = [];
      }
  }

  private positionChildNearParent(child: Organism, parent: Organism) {
      if (!parent.headNode || !child.headNode) return;
      const offsetX = (Math.random() - 0.5) * 2;
      const offsetZ = (Math.random() - 0.5) * 2;
      
      const px = parent.headNode.pos.x;
      const py = parent.headNode.pos.y;
      const pz = parent.headNode.pos.z;
      
      const dx = px - child.headNode.pos.x;
      const dy = py - child.headNode.pos.y + 0.5; // Spawn a bit higher
      const dz = pz - child.headNode.pos.z;
      
      for(let n of child.nodes) {
          n.pos.x += dx + offsetX;
          n.pos.y += dy;
          n.pos.z += dz + offsetZ;
          n.oldPos.x = n.pos.x;
          n.oldPos.y = n.pos.y;
          n.oldPos.z = n.pos.z;
      }
      child.initialHeadPos = { ...child.headNode.pos };
  }

  private setupChild(child: Organism, parent: Organism) {
      this.positionChildNearParent(child, parent);
      this.ecosystemService.generateFoodTrack(child, this.getEcosystemConfig());
      this.breedingQueue.push(child);
  }

  private getPartnersFor(family: FamilyType): FamilyType[] {
      const primals = [FamilyType.BRUTE, FamilyType.MONOLITH, FamilyType.SCOUT];
      const secondaries = [FamilyType.CHARGER, FamilyType.NOMAD, FamilyType.HUNTER];
      const tertiaries = [FamilyType.GUARDIAN, FamilyType.PHANTOM, FamilyType.WARRIOR];

      if (primals.includes(family)) {
          return primals.filter(f => f !== family);
      }
      if (secondaries.includes(family)) {
          return secondaries.filter(f => f !== family);
      }
      if (tertiaries.includes(family)) {
          return tertiaries.filter(f => f !== family);
      }
      return [family, family];
  }

  /**
   * Triggers the 3-kid breeding protocol:
   * 1. Kid 1: Perfect Clone (no mutation).
   * 2. Kids 2 & 3: Cross-breeds with compatible family champions (or self-mutated clones for Apex).
   * PII/Identity: Uses local vault as fallback to ensure partnership always works.
   */
  private async triggerBreeding(parent: Organism) {
      if (!parent.family || !this.template) return;
      
      // RULE: ALWAYS 3 KIDS
      
      // KID 1: PERFECT CLONE (NO MUTATION)
      const cloneKid = this.createOrganismFromTemplate(this.template, `fam_${parent.family}_g${this.currentGeneration}_clone_${Date.now()}`);
      cloneKid.family = parent.family;
      cloneKid.color = FAMILY_COLORS[parent.family];
      this.geneticOperator.cloneGenome(parent.neuralGenome, cloneKid.neuralGenome);
      this.setupChild(cloneKid, parent);

      if (parent.family === FamilyType.APEX) {
          // APEX CASE
          // Kid 2: Clone + 2.5% mutation
          const kid2 = this.createOrganismFromTemplate(this.template, `fam_${parent.family}_g${this.currentGeneration}_mut1_${Date.now()}`);
          kid2.family = parent.family;
          kid2.color = FAMILY_COLORS[parent.family];
          this.geneticOperator.cloneGenome(parent.neuralGenome, kid2.neuralGenome);
          this.geneticOperator.mutateGenome(kid2.neuralGenome, 0.025);
          this.setupChild(kid2, parent);

          // Kid 3: Clone + 5.0% mutation
          const kid3 = this.createOrganismFromTemplate(this.template, `fam_${parent.family}_g${this.currentGeneration}_mut2_${Date.now()}`);
          kid3.family = parent.family;
          kid3.color = FAMILY_COLORS[parent.family];
          this.geneticOperator.cloneGenome(parent.neuralGenome, kid3.neuralGenome);
          this.geneticOperator.mutateGenome(kid3.neuralGenome, 0.05);
          this.setupChild(kid3, parent);
      } else {
          // NON-APEX: CROSS-BREEDING
          const partners = this.getPartnersFor(parent.family);
          
          for (const partnerFam of partners) {
              const idx = partners.indexOf(partnerFam);
              let partnerChampion = this.lineage.getChampion(partnerFam);
              
              // FALLBACK: If no champion in memory, try to pull from the Vault (Local DB)
              if (!partnerChampion) {
                  const vaultChamp = await localVault.getChampionByFamily(partnerFam);
                  if (vaultChamp) {
                      partnerChampion = vaultChamp;
                      // Update memory map so we don't have to hit DB every single time for this partner
                      this.lineage.setChampion(partnerFam, vaultChamp);
                  }
              }

              const targetFamily = FamilyRegistry.synthesize(parent.family!, partnerFam);
              
              const hybridKid = this.createOrganismFromTemplate(this.template!, `fam_${targetFamily}_g${this.currentGeneration}_h${idx}_${Date.now()}`);
              hybridKid.family = targetFamily;
              hybridKid.color = FAMILY_COLORS[targetFamily];
              
              if (partnerChampion) {
                  // Crossover 80% parent dominance
                  this.geneticOperator.crossoverGenomes(parent.neuralGenome, partnerChampion.neuralGenome, hybridKid.neuralGenome);
                  // Apply minor mutation to prevent stagnation
                  this.geneticOperator.mutateGenome(hybridKid.neuralGenome, ENGINE_CONFIG.evolution.breedingMutationRate); 
              } else {
                  // Fallback: Clone parent and mutate more heavily to explore
                  this.geneticOperator.cloneGenome(parent.neuralGenome, hybridKid.neuralGenome);
                  this.geneticOperator.mutateGenome(hybridKid.neuralGenome, 0.1);
              }
              
              this.setupChild(hybridKid, parent);
          }
      }
  }

  private applySocialLearning() {
      // SPECIATED SOCIAL LEARNING: Bots only learn from their own family champion.
      // This prevents specialized knowledge (Stability vs Speed) from being averaged out.
      for(const learner of this.population) {
          if (!learner.isAlive || !learner.family) continue;
          
          const champion = this.lineage.getChampion(learner.family);
          if (!champion || champion.id === learner.id) continue;
          
          const learningRate = ENGINE_CONFIG.evolution.socialLearningRate; 
          const lg = learner.neuralGenome;
          const bg = champion.neuralGenome;
          
          for(let k=0; k<lg.synapseWeights.length; k++) {
              if (bg.synapseWeights[k] !== undefined) {
                  lg.synapseWeights[k] += (bg.synapseWeights[k] - lg.synapseWeights[k]) * learningRate;
              }
          }
          for(let k=0; k<lg.biases.length; k++) {
              if (bg.biases[k] !== undefined) {
                  lg.biases[k] += (bg.biases[k] - lg.biases[k]) * learningRate;
              }
          }
      }
  }

  private updatePhysics(dt: number, fastMode: boolean): void {
    const contractility = (this.engine as any).config?.globalContractility ?? 4.0;

    this.population.forEach(org => {
      // 1. DEAD CHECK: Remove from calculations (Frozen Statue Logic)
      if (!org.isAlive) return;

      // 2. BRAIN UPDATE
      if (!org.brain) {
          org.brain = new BrainController(org);
      }
      
      // All bots use the same physical parameters
      org.brain.update(dt, contractility, this.globalVisionRadius);
      
      // 3. PHYSICS UPDATE
      this.engine.updateOrganism(org, this.simulationTime, fastMode);
    });
  }

  private async updateMetabolism(dt: number): Promise<void> {
      const metabolicConfig = this.getMetabolicConfig();
      const ecoConfig = this.getEcosystemConfig();

      for (const org of this.population) {
          if (org.isAlive) {
              this.fitnessEvaluator.evaluate(org, dt);
              
              // 1. Position tracking for metabolism
              const head = org.headNode;
              if (head) {
                  const lastPos = (org as any)._lastHeadPos;
                  if (!lastPos) {
                      (org as any)._lastHeadPos = { ...head.pos };
                  } else {
                      const dx = head.pos.x - lastPos.x;
                      const dy = head.pos.y - lastPos.y;
                      const dz = head.pos.z - lastPos.z;
                      const stepDist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                      if (isFinite(stepDist)) org.distanceTraveled += stepDist;
                      (org as any)._lastHeadPos = { ...head.pos };
                  }
              }

              // 2. High-level biological processes
              this.metabolicService.process(org, dt, metabolicConfig);
              await this.ecosystemService.harvest(org, ecoConfig, (parent) => this.triggerBreeding(parent));
          }
      }
  }

  private finalizeFitness() {
      this.population.forEach(org => {
          // REMOVED: Lamarckian sync. DNA is now a stable blueprint.
          // if (org.brain) { org.brain.syncGenome(); }
          this.fitnessEvaluator.finalize(org);
      });
  }

  /**
   * @logic_seal
   * {
   *   "intent": "Execute family-based speciated evolution, archiving champions and spawning the next batch.",
   *   "agent_instructions": "Ensure cross-breeding between niches preserves genetic diversity."
   * }
   */
  public evolve(): void {
    if (!this.template) return;

    this.finalizeFitness(); 

    const familyOrder = [
        FamilyType.BRUTE, FamilyType.MONOLITH, FamilyType.SCOUT,
        FamilyType.CHARGER, FamilyType.NOMAD, FamilyType.HUNTER,
        FamilyType.GUARDIAN, FamilyType.PHANTOM, FamilyType.WARRIOR,
        FamilyType.APEX
    ];

    familyOrder.forEach(fam => {
        const familyMembers = this.population.filter(org => org.family === fam);
        if (familyMembers.length > 0) {
            familyMembers.sort((a,b) => b.fitness - a.fitness);
            const safeOrg = Serializer.deserializeOrganism(Serializer.serializeOrganism(familyMembers[0]));
            // Update to new generation before setting
            safeOrg.generation = this.lineage.generation + 1;
            if (safeOrg.neuralGenome?.meta) {
                safeOrg.neuralGenome.meta.lineageGeneration = this.lineage.generation + 1;
            }
            this.lineage.setChampion(fam, safeOrg);
        }
    });

    this.population.sort((a, b) => b.fitness - a.fitness);
    const bestOrganism = this.population[0];

    this.lineage.incrementGeneration();
    if (this.template?.neuralGenome) {
        if (!this.template.neuralGenome.meta) {
            this.template.neuralGenome.meta = {
                lineageId: this.lineage.lineageId,
                projectName: this.lineage.projectName,
                lineageGeneration: this.lineage.generation,
                originDate: new Date().toISOString()
            };
        }
        this.template.neuralGenome.meta.lineageGeneration = this.lineage.generation;
        this.template.generation = this.lineage.generation;
    }

    this.notifyGenComplete(bestOrganism, this.lineage.generation);

    if (this.lineage.generation % this.vaultSaveFrequency === 0) {
        this.pulseListeners.forEach(l => l(this.lineage.getAllChampions(), this.lineage.generation)); 
    }

    const poolSize = Math.max(2, Math.floor(this.populationSize * 0.2));
    const tournamentPool = this.population.slice(0, poolSize).map(org => {
        const serialized = Serializer.serializeOrganism(org);
        serialized.nodes = [];
        serialized.muscles = [];
        return Serializer.deserializeOrganism(serialized);
    });

    this.spawnGeneration(tournamentPool, false);
  }

  private createOrganismFromTemplate(template: Organism, newId: string): Organism {
      // Attempt to reuse from pool
      const pooled = this.deadPool.pop();
      
      const newNodes: Node[] = [];
      const lenN = template.nodes.length;
      for (let i = 0; i < lenN; i++) {
          const n = template.nodes[i];
          let base = this.bodyMass;
          if (n.cellType === CellType.HEAD || n.isHead) base = this.headMass;
          if (n.cellType === CellType.FOOT) base = this.footMass;
          
          newNodes.push({
              ...n,
              pos: { ...n.pos },
              oldPos: { ...n.pos }, 
              mass: base * this.densityMultiplier, 
              activation: 0,
              gripSignal: 0,
              isGripping: false,
              gripStamina: 1.0,
              gripCooldown: 0,
              currentStress: 0
          });
      }

      const newMuscles: Muscle[] = [];
      const lenM = template.muscles.length;
      for (let i = 0; i < lenM; i++) {
          const m = template.muscles[i];
          newMuscles.push({
              ...m,
              currentLength: m.baseLength,
              targetLength: m.baseLength,
              phase: Math.random() * Math.PI * 2,
              nodeRefA: undefined,
              nodeRefB: undefined
          });
      }

      if (!template.neuralGenome) {
          throw new Error("Cannot create organism from template: neuralGenome is missing.");
      }
      
      const newGenome = this.geneticOperator.cloneGenome(template.neuralGenome, pooled?.neuralGenome);

      const clone: Organism = pooled || {
          id: newId,
          shape: template.shape,
          nodes: newNodes,
          muscles: newMuscles,
          neuralGenome: newGenome,
          fitness: 0,
          odometer: 0,
          visitedTiles: {},
          generation: template.generation || 1, // Inherit from template
          brain: undefined,
          energy: this.startEnergy,
          maxEnergy: this.startEnergy,
          hungerTime: 0,
          isAlive: true,
          foodEaten: 0,
          foodForBreeding: 0,
          totalFoodEaten: 0,
          timeAlive: 0,
          visibleFood: [],
          initialHeadPos: { x:0,y:0,z:0 },
          distanceTraveled: 0
      };

      if (pooled) {
          clone.id = newId;
          clone.shape = template.shape;
          clone.nodes = newNodes; 
          clone.muscles = newMuscles;
          clone.neuralGenome = newGenome;
          clone.fitness = 0;
          clone.odometer = 0;
          clone.visitedTiles = {};
          clone.generation = template.generation || 1; 
          clone.brain = pooled.brain;
          clone.energy = this.startEnergy;
          clone.maxEnergy = this.startEnergy;
          clone.hungerTime = 0;
          clone.isAlive = true;
          clone.foodEaten = 0;
          clone.foodForBreeding = 0;
          clone.totalFoodEaten = 0;
          clone.timeAlive = 0;
          clone.visibleFood = [];
          clone.distanceTraveled = 0;

          if (clone.brain) {
            clone.brain.reset(clone);
          }
      }

      clone.initialHeadPos = template.initialHeadPos ? { ...template.initialHeadPos } : { x: 0, y: 0, z: 0 };
      
      if (!clone.initialHeadPos || (clone.initialHeadPos.x===0 && clone.initialHeadPos.y===0 && clone.initialHeadPos.z===0)) {
           const head = clone.nodes.find(n => n.isHead);
           clone.initialHeadPos = head ? { ...head.pos } : { x: 0, y: 0, z: 0 };
      }
      
      const head = clone.nodes.find(n => n.isHead);
      if (head) clone.headNode = head;

      return clone;
  }

  public subscribe(type: 'update', cb: (pop: Organism[], time: number) => void): () => void;
  public subscribe(type: 'genComplete', cb: (best: Organism, gen: number) => void): () => void;
  public subscribe(type: 'newGen', cb: (pop: Organism[]) => void): () => void;
  public subscribe(type: 'pulse', cb: (champions: Organism[], gen: number) => void): () => void;
  public subscribe(type: string, cb: any): () => void {
      if (type === 'update') {
          this.updateListeners.push(cb);
          return () => this.updateListeners = this.updateListeners.filter(l => l !== cb);
      }
      if (type === 'genComplete') {
          this.genCompleteListeners.push(cb);
          return () => this.genCompleteListeners = this.genCompleteListeners.filter(l => l !== cb);
      }
      if (type === 'newGen') {
          this.newGenListeners.push(cb);
          return () => this.newGenListeners = this.newGenListeners.filter(l => l !== cb);
      }
      if (type === 'pulse') {
          this.pulseListeners.push(cb);
          return () => this.pulseListeners = this.pulseListeners.filter(l => l !== cb);
      }
      return () => {};
  }
  
  public onUpdate(cb: (pop: Organism[], time: number) => void) { this.subscribe('update', cb); }
  public onGenComplete(cb: (best: Organism, gen: number) => void) { this.subscribe('genComplete', cb); }
  public onNewGeneration(cb: (pop: Organism[]) => void) { this.subscribe('newGen', cb); }
  public onPulse(cb: (champions: Organism[], gen: number) => void) { this.subscribe('pulse', cb); }

  private notifyUpdate(pop: Organism[], time: number) { this.updateListeners.forEach(l => l(pop, time)); }
  private notifyGenComplete(best: Organism, gen: number) { this.genCompleteListeners.forEach(l => l(best, gen)); }
  private notifyNewGeneration(pop: Organism[]) { this.newGenListeners.forEach(l => l(pop)); }
}