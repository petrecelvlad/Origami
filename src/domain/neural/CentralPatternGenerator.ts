/**
 * @propolis
 * {
 *   "role": "NEURAL_CONTROLLER",
 *   "dependencies": [],
 *   "constraints": ["C-002", "C-006"],
 *   "agent_instructions": "The CPG is the rhythmic heartbeat. Use double-buffering for neuron states to prevent race conditions during propagation."
 * }
 */
export interface CPGInputs {
  vestibular: { x: number, y: number, z: number };
  target: { x: number, y: number, z: number };
  clock: number;
}

export class CentralPatternGenerator {
  private size: number = 20; 
  private weights: number[]; 
  
  // DOUBLE BUFFERING (Optimization)
  // We flip between A and B to avoid creating new arrays every tick
  private bufferA: Float32Array;
  private bufferB: Float32Array;
  private usingBufferA: boolean = true;

  constructor(size: number = 20) {
    this.size = size;
    this.bufferA = new Float32Array(size);
    this.bufferB = new Float32Array(size);
    this.weights = [];
  }

  public initialize(weights: number[]): void {
    this.weights = weights;
    if (this.weights.length < this.size * this.size) {
        const missing = (this.size * this.size) - this.weights.length;
        for(let i=0; i<missing; i++) this.weights.push(Math.random() - 0.5);
    }
  }

  public reset(): void {
      for(let i=0; i<this.size; i++) {
          this.bufferA[i] = 0;
          this.bufferB[i] = 0;
      }
      this.usingBufferA = true;
  }

  /**
   * @logic_seal
   * {
   *   "intent": "Perform one step of reservoir computing with leaky integrator dynamics.",
   *   "agent_instructions": "Maintain the leak factor and spatial gating for sensory inputs."
   * }
   */
  public tick(inputs: CPGInputs): void {
    // 1. Select Buffers (Read from current, Write to next)
    const currentNeurons = this.usingBufferA ? this.bufferA : this.bufferB;
    const nextNeurons = this.usingBufferA ? this.bufferB : this.bufferA;

    const leak = 0.2; // 20% new info, 80% memory. Makes the brain "slower" and smoother.
    
    // 2. Update State
    for (let i = 0; i < this.size; i++) {
      let sum = 0;
      const rowOffset = i * this.size;

      // Internal Recurrence (Matrix Multiplication)
      for (let j = 0; j < this.size; j++) {
        const w = this.weights[rowOffset + j] || 0;
        sum += currentNeurons[j] * w;
      }
      
      // Sensory Input - Spatial Gating
      if (i >= 0 && i < 3) sum += inputs.vestibular.x * 0.5; // Neurons 0-2: Vestibular X
      else if (i >= 3 && i < 6) sum += inputs.vestibular.y * 0.5; // Neurons 3-5: Vestibular Y
      else if (i >= 6 && i < 9) sum += inputs.vestibular.z * 0.5; // Neurons 6-8: Vestibular Z
      else if (i >= 9 && i < 11) sum += inputs.target.x * 0.5; // Neurons 9-10: Target X
      else if (i >= 11 && i < 13) sum += inputs.target.y * 0.5; // Neurons 11-12: Target Y
      else if (i >= 13 && i < 15) sum += inputs.target.z * 0.5; // Neurons 13-14: Target Z
      else if (i === 15) sum += inputs.clock * 0.5; // Neuron 15: Clock

      // Activation with Inertia (Leaky Integrator)
      const targetActivation = Math.tanh(sum);
      
      // Smooth transition: New = Old * (1-leak) + Target * leak
      nextNeurons[i] = currentNeurons[i] * (1 - leak) + targetActivation * leak;
    }

    // 3. Swap Buffer Flag
    this.usingBufferA = !this.usingBufferA;
  }

  public getSignal(muscleIndex: number, outputWeights: number[]): number {
    const neurons = this.usingBufferA ? this.bufferA : this.bufferB;
    
    let sum = 0;
    const offset = (muscleIndex * this.size) % outputWeights.length;
    
    for (let i = 0; i < this.size; i++) {
        const wIdx = (offset + i) % outputWeights.length;
        sum += neurons[i] * outputWeights[wIdx];
    }
    
    return Math.tanh(sum); 
  }
}