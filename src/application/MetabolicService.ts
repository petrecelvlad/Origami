/**
 * @propolis
 * {
 *   "role": "SERVICE",
 *   "dependencies": ["@domain/types", "@domain/EngineConfig"],
 *   "constraints": ["C-004", "C-005"],
 *   "agent_instructions": "The metabolic service enforces the cost of life. Energy decay variables must be tuned to prevent 'immortal stasis' in zero-g environments."
 * }
 */
import { Organism, FamilyType, CellType } from '../domain/types';
import { ENGINE_CONFIG } from '../domain/EngineConfig';

export interface MetabolicConfig {
  baseDecay: number;
  movementCost: number;
  hungerAccel: number;
  redBasalMultiplier: number;
  blueMovementMultiplier: number;
  greenMovementMultiplier: number;
  groundContactMetabolismMultiplier: number;
}

export class MetabolicService {
  /**
   * Processes energy loss and state changes for a given organism.
   */
  /**
   * @logic_seal
   * {
   *   "intent": "Calculate energy loss based on basal rates, movement, age, and physical stress (pain).",
   *   "agent_instructions": "Ensure the age tax threshold is strictly enforced to maintain generational turnover."
   * }
   */
  public process(org: Organism, dt: number, config: MetabolicConfig): void {
    if (!org.isAlive) return;

    // 1. Calculate Hunger Multiplier
    org.hungerTime += dt;
    const hungerMultiplier = Math.pow(config.hungerAccel, org.hungerTime);
    
    // 2. Basal Metabolism
    let basalRate = config.baseDecay;
    if (org.family === FamilyType.BRUTE) {
        basalRate = config.redBasalMultiplier;
    }
    const timeLoss = basalRate * hungerMultiplier * dt;
    
    // 3. Age Tax (Generational Turnover Pressure)
    const ageInSeconds = org.timeAlive / 1000;
    let ageTax = 0;
    if (ageInSeconds > ENGINE_CONFIG.metabolism.ageTaxThreshold) {
        ageTax = (ageInSeconds - ENGINE_CONFIG.metabolism.ageTaxThreshold) * ENGINE_CONFIG.metabolism.ageTaxRate * dt;
    }

    // 4. Ground Contact Penalty
    const groundPenalty = this.calculateGroundPenalty(org, config.groundContactMetabolismMultiplier);

    // 5. Movement Cost
    const moveLoss = this.calculateMovementLoss(org, config);

    // 6. Pain Multiplier (Stress-based)
    let frictionMultiplier = 1.0;
    if (org.isInPain) {
        frictionMultiplier = 2.0;
    }

    // Total Deduction
    const totalDeduction = (timeLoss * frictionMultiplier + moveLoss + ageTax) * groundPenalty;
    org.energy -= totalDeduction;

    if (org.energy <= 0) {
        org.energy = 0;
        org.isAlive = false;
    }
  }

  private calculateGroundPenalty(org: Organism, multiplier: number): number {
    let bodyGrounded = false;
    for (const n of org.nodes) {
        if (n.cellType === CellType.BODY && n.pos.y <= 0.15) {
            bodyGrounded = true;
            break;
        }
    }
    return bodyGrounded ? multiplier : 1.0;
  }

  private calculateMovementLoss(org: Organism, config: MetabolicConfig): number {
    // We assume EvolutionService handles the cumulative distanceTraveled calculation per step
    const prevDist = org.previousDistanceTraveled || 0;
    const distDelta = Math.max(0, org.distanceTraveled - prevDist);
    org.previousDistanceTraveled = org.distanceTraveled;

    let dynamicMovementCost = config.movementCost;
    if (org.family === FamilyType.SCOUT) {
        dynamicMovementCost = config.greenMovementMultiplier;
    } else if (org.family === FamilyType.MONOLITH) {
        dynamicMovementCost = config.blueMovementMultiplier;
    }

    let moveLoss = distDelta * dynamicMovementCost;
    if (org.isInPain) {
        moveLoss *= 2.0;
    }
    return moveLoss;
  }
}
