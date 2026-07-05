import { Organism, FoodItem } from '../domain/types';
import { ENGINE_CONFIG } from '../domain/EngineConfig';

export interface EcosystemConfig {
  foodSpawnCount: number;
  foodSpawnRadius: number;
  foodSpawnMinHeight: number;
  foodSpawnMaxHeight: number;
  foodEnergy: number;
  interactionRadius: number;
  magnetForce: number;
  breedingThreshold: number;
  foodSpreadFactor: number;
}

export class EcosystemService {
  /**
   * Generates or redistributes food around an organism.
   */
  public generateFoodTrack(organism: Organism, config: EcosystemConfig): void {
    const numFood = config.foodSpawnCount; 
    if (!organism.visibleFood) organism.visibleFood = [];

    const head = organism.headNode;
    let centerX = head ? head.pos.x : 0;
    let centerZ = head ? head.pos.z : 0;
    
    const spread = config.foodSpawnRadius; 
    const minY = config.foodSpawnMinHeight;
    const maxY = Math.max(minY, config.foodSpawnMaxHeight);
    const rangeY = maxY - minY;
    
    // Relative distance calculation: 0 = random, 1 = maximum ideal spread
    // The area is roughly PI * (spread+1)^2. We use a more conservative ideal separation.
    const idealSeparation = (spread + 1.0) * 1.5 / Math.sqrt(numFood);
    const targetMinD = config.foodSpreadFactor * idealSeparation; 

    for (let i = 0; i < numFood; i++) {
        let x = 0, y = 0, z = 0;
        let valid = false;
        let attempts = 0;
        let currentMinD = targetMinD;
        let currentMinD2 = currentMinD * currentMinD;
        
        while(!valid && attempts < 150) {
            const theta = Math.random() * Math.PI * 2;
            const radius = 1.0 + Math.random() * spread; 
            x = centerX + Math.cos(theta) * radius;
            z = centerZ + Math.sin(theta) * radius;
            y = minY + Math.random() * rangeY;
            
            valid = true;
            if (currentMinD2 > 0) {
                for(let j = 0; j < i; j++) {
                    const prev = organism.visibleFood[j];
                    const dx = x - prev.pos.x;
                    const dy = y - prev.pos.y;
                    const dz = z - prev.pos.z;
                    if (dx*dx+dy*dy+dz*dz < currentMinD2) {
                        valid = false;
                        break;
                    }
                }
            }
            
            attempts++;
            
            // If struggling to find a spot, relax the constraint slightly
            if (!valid && attempts % 10 === 0) {
                currentMinD *= 0.9;
                currentMinD2 = currentMinD * currentMinD;
            }
        }

        if (organism.visibleFood[i]) {
            organism.visibleFood[i].pos.x = x!;
            organism.visibleFood[i].pos.y = y!;
            organism.visibleFood[i].pos.z = z!;
            organism.visibleFood[i].energyValue = config.foodEnergy;
            organism.visibleFood[i].consumed = false;
        } else {
            organism.visibleFood.push({
                id: `f_${i}`,
                pos: { x: x!, y: y!, z: z! },
                energyValue: config.foodEnergy,
                consumed: false
            });
        }
    }

    // Trim extraneous food items if settings were lowered during simulation
    if (organism.visibleFood.length > numFood) {
        organism.visibleFood.length = numFood;
    }
  }

  /**
   * Handles the physics-level interaction between the organism and its food.
   * Includes the "Magnet" pull and the physical consumption.
   */
  public async harvest(organism: Organism, config: EcosystemConfig, onBreedingTrigger: (parent: Organism) => Promise<void>): Promise<void> {
    const head = organism.headNode;
    if (!head || !organism.visibleFood) return;

    for (const food of organism.visibleFood) {
        if (food.consumed) continue;

        const dx = head.pos.x - food.pos.x;
        const dy = head.pos.y - food.pos.y;
        const dz = head.pos.z - food.pos.z;
        const distSq = dx*dx + dy*dy + dz*dz;
        
        if (distSq < config.interactionRadius * config.interactionRadius) {
            const dist = Math.sqrt(distSq);

            if (dist < 0.0001) {
                 food.pos.x += 0.01; 
                 continue;
            }
            
            const strength = 1.0 - (dist / config.interactionRadius);
            const force = config.magnetForce * (1.0 + strength);
            
            food.pos.x += dx * force * 0.1;
            food.pos.y += dy * force * 0.1;
            food.pos.z += dz * force * 0.1;

            // Recheck Distance after pull
            const nx = head.pos.x - food.pos.x;
            const ny = head.pos.y - food.pos.y;
            const nz = head.pos.z - food.pos.z;
            const nDistSq = nx*nx + ny*ny + nz*nz;
            
            if (nDistSq < config.interactionRadius * config.interactionRadius) {
                food.consumed = true;
                organism.energy += food.energyValue;
                if (organism.energy > organism.maxEnergy) organism.energy = organism.maxEnergy;
                organism.hungerTime = 0;
                
                organism.foodEaten++;
                organism.foodForBreeding++;
                if (organism.totalFoodEaten === undefined) organism.totalFoodEaten = 0;
                organism.totalFoodEaten++;

                if (organism.foodForBreeding >= config.breedingThreshold) {
                    organism.foodForBreeding -= config.breedingThreshold;
                    await onBreedingTrigger(organism);
                }
            }
        }
    }
  }

  public refreshAll(population: Organism[], config: EcosystemConfig): void {
      population.forEach(org => this.generateFoodTrack(org, config));
  }
}
