/**
 * @propolis
 * {
 *   "role": "NEURAL_CONTROLLER",
 *   "dependencies": ["@domain/types", "@domain/EngineConfig"],
 *   "constraints": ["C-005", "C-006"],
 *   "agent_instructions": "Sensory data must be normalized to prevent genetic bias across different body sizes."
 * }
 */
import { Organism, Node, FoodItem } from '../types';
import { NeuralNode } from './NeuralNode';
import { ENGINE_CONFIG } from '../EngineConfig';

export interface SensoryData {
  orientation: { x: number; y: number; z: number };
  targetDir: { x: number; y: number; z: number };
  globalSensoryInput: number;
}

export class SensoryModule {
  private currentTargetId: string | null = null;
  private currentAttention: number = 0.0;
  private readonly ATTENTION_SPAN = ENGINE_CONFIG.neural.attentionSpan;

  /**
   * @logic_seal
   * {
   *   "intent": "Extract orientation and target-seeking vectors from the physical simulation.",
   *   "agent_instructions": "Maintain attention-locking logic to prevent oscillatory target switching."
   * }
   */
  public update(
    dt: number,
    organism: Organism,
    neuralNodesList: NeuralNode[],
    neuralNodesMap: Map<string, NeuralNode>,
    visionRadius: number,
    clockSignal: number
  ): SensoryData {
    const nodeCount = organism.nodes.length;
    const sensoryScale = 10 / (nodeCount || 1);

    // 1. GATHER VESTIBULAR DATA & PROPRIOCEPTION
    const orientation = this.calculateOrientation(organism);

    // Update Attention
    if (this.currentAttention > 0) {
      const decayPerSecond = 1.0 / this.ATTENTION_SPAN;
      this.currentAttention -= decayPerSecond * dt;
      if (this.currentAttention < 0) this.currentAttention = 0;
    }

    let globalSensoryInput = 0;
    for (let i = 0; i < neuralNodesList.length; i++) {
      const nn = neuralNodesList[i];
      nn.sense(dt, nodeCount, orientation, clockSignal);
      globalSensoryInput += nn.inputSum;
    }

    // 2. VISION & DESIRE SYSTEM
    const head = organism.headNode || organism.nodes[0];
    let targetDir = { x: 0, y: 0, z: 0 };

    if (head) {
      const target = this.processVision(organism, head, visionRadius);
      if (target) {
        const { bestCandidate, bestCost, stability } = target;
        
        const dist = Math.sqrt(bestCost);
        const dx = bestCandidate.pos.x - head.pos.x;
        const dy = bestCandidate.pos.y - head.pos.y;
        const dz = bestCandidate.pos.z - head.pos.z;

        if (dist > 0.0001) {
            targetDir = { x: dx / dist, y: dy / dist, z: dz / dist };
            
            if (stability > 0.1) {
                const headNeural = neuralNodesMap.get(head.id);
                if (headNeural) {
                    const signalStrength = Math.max(0, 1.0 - (dist / visionRadius)) * stability;
                    headNeural.inputSum += (dx / dist) * signalStrength * ENGINE_CONFIG.neural.visionSignalMultiplier * sensoryScale;
                    headNeural.inputSum += (dy / dist) * signalStrength * ENGINE_CONFIG.neural.visionSignalMultiplier * sensoryScale;
                    headNeural.inputSum += (dz / dist) * signalStrength * ENGINE_CONFIG.neural.visionSignalMultiplier * sensoryScale;
                    globalSensoryInput += signalStrength * ENGINE_CONFIG.neural.globalSensoryScale;
                }
            }
        }
      }
    }

    globalSensoryInput /= (neuralNodesList.length || 1);
    if (isNaN(globalSensoryInput)) globalSensoryInput = 0;

    return { orientation, targetDir, globalSensoryInput };
  }

  private calculateOrientation(organism: Organism) {
    let comX = 0, comY = 0, comZ = 0;
    const nodeCount = organism.nodes.length;
    for (let i = 0; i < nodeCount; i++) {
      const p = organism.nodes[i].pos;
      comX += p.x; comY += p.y; comZ += p.z;
    }
    comX /= nodeCount; comY /= nodeCount; comZ /= nodeCount;

    const head = organism.headNode || organism.nodes[0];
    let orientation = { x: 0, y: 1, z: 0 };
    if (head) {
      const dx = head.pos.x - comX;
      const dy = head.pos.y - comY;
      const dz = head.pos.z - comZ;
      const mag = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      orientation = { x: dx / mag, y: dy / mag, z: dz / mag };
    }
    return orientation;
  }

  private processVision(organism: Organism, head: Node, visionRadius: number) {
    const stability = Math.min(1.0, Math.max(0, (head.pos.y - 0.2)));
    const vRadSq = visionRadius * visionRadius;

    for (const food of organism.visibleFood) {
      food.seen = false;
      food.targeted = false;
    }

    let lockedFood: FoodItem | null = null;
    let lockedRealDistSq = Infinity;

    if (this.currentTargetId) {
      const found = organism.visibleFood.find(f => f.id === this.currentTargetId);
      if (found && !found.consumed) {
        const dx = found.pos.x - head.pos.x;
        const dy = found.pos.y - head.pos.y;
        const dz = found.pos.z - head.pos.z;
        const dSq = dx * dx + dy * dy + dz * dz;

        if (dSq < vRadSq * 1.5) {
          lockedFood = found;
          lockedRealDistSq = dSq;
        }
      }
    }

    if (!lockedFood) {
      this.currentAttention = 0;
      this.currentTargetId = null;
    }

    let currentPerceivedCost = Infinity;
    if (lockedFood) {
      const lockFactor = this.currentAttention * 0.95;
      currentPerceivedCost = lockedRealDistSq * (1.0 - lockFactor);
    }

    let bestCandidate: FoodItem | null = lockedFood;
    let bestCost = currentPerceivedCost;
    let switched = false;

    const foods = organism.visibleFood;
    for (let i = 0; i < foods.length; i++) {
        const food = foods[i];
        if (food.consumed) continue;
        if (lockedFood && food.id === lockedFood.id) continue;

        const dx = food.pos.x - head.pos.x;
        const dy = food.pos.y - head.pos.y;
        const dz = food.pos.z - head.pos.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < vRadSq) {
            food.seen = true;
            const cost = distSq;
            if (cost < bestCost) {
                bestCost = cost;
                bestCandidate = food;
                switched = true;
            }
        }
    }

    if (bestCandidate) {
      if (switched) {
        this.currentTargetId = bestCandidate.id;
        this.currentAttention = 1.0;
      }
      bestCandidate.targeted = true;
      return { bestCandidate, bestCost, stability };
    }

    return null;
  }
  
  public reset() {
      this.currentTargetId = null;
      this.currentAttention = 0;
  }
}
