/**
 * @propolis
 * {
 *   "role": "NEURAL_CONTROLLER",
 *   "dependencies": ["@domain/types", "@domain/EngineConfig"],
 *   "constraints": ["C-002", "C-006"],
 *   "agent_instructions": "Implements instance-specific synaptic plasticity. Do not persist learned weights to DNA metadata."
 * }
 */
import { Organism } from '../types';
import { NeuralNode } from './NeuralNode';
import { ENGINE_CONFIG } from '../EngineConfig';

interface Synapse {
    nodeA: NeuralNode;
    nodeB: NeuralNode;
    weightIndex: number;
}

export class LearningEngine {
  private previousEnergy: number = 0;
  private readonly HEBBIAN_RATE = ENGINE_CONFIG.neural.hebbianRate;

  public initialize(energy: number) {
    this.previousEnergy = energy;
  }

  /**
   * @logic_seal
   * {
   *   "intent": "Execute Hebbian learning rules based on metabolic success (energy gain) and physical stress (pain).",
   *   "agent_instructions": "Synapse weight adjustment should be clamped to prevent divergence."
   * }
   */
  public learn(organism: Organism, synapses: Synapse[], synapseWeightsCache: Float32Array): void {
    let learningSignal = 0;

    const currentEnergy = organism.energy;
    const energyDelta = currentEnergy - this.previousEnergy;
    if (energyDelta > 0.5) learningSignal += 1.0;
    this.previousEnergy = currentEnergy;

    const head = organism.headNode;
    if (head && head.pos.y < 0.2) {
      learningSignal -= 0.5;
    }

    if (Math.abs(learningSignal) > 0.1) {
      const len = synapses.length;
      for (let i = 0; i < len; i++) {
        const s = synapses[i];
        const coActivity = s.nodeA.activation * s.nodeB.activation;

        if (coActivity > 0.1) {
          let w = synapseWeightsCache[s.weightIndex];
          w += this.HEBBIAN_RATE * learningSignal * coActivity;

          if (w > 3.0) w = 3.0;
          else if (w < -3.0) w = -3.0;

          synapseWeightsCache[s.weightIndex] = w;
        }
      }
    }
  }
}
