/**
 * @propolis
 * {
 *   "role": "NEURAL_CONTROLLER",
 *   "dependencies": ["@domain/types", "@domain/EngineConfig"],
 *   "constraints": ["C-005", "C-006"],
 *   "agent_instructions": "Nodes bridge the physical and neural worlds. Keep activation functions lightweight."
 * }
 */
import { Node } from '../types';
import { ENGINE_CONFIG } from '../EngineConfig';

export class NeuralNode {
  public id: string;
  public inputSum: number = 0;
  public activation: number = 0;
  public output: number = 0;
  
  // Corresponding physical node
  private physicalNode: Node;
  
  private vestibularMultiplier: number;
  private heartbeatMultiplier: number;

  constructor(node: Node, vestibularMultiplier: number, heartbeatMultiplier: number) {
    this.id = node.id;
    this.physicalNode = node;
    this.vestibularMultiplier = vestibularMultiplier;
    this.heartbeatMultiplier = heartbeatMultiplier;
  }

  public reset(): void {
    this.inputSum = 0;
    this.activation = 0;
    this.output = 0;
  }

  // 1. Sense: Gather data from the physical world
  /**
   * @logic_seal
   * {
   *   "intent": "Convert physical world state (touch, velocity, orientation) into neural drive.",
   *   "agent_instructions": "Scale sensory inputs relative to the baseline node count for fitness consistency."
   * }
   */
  public sense(dt: number, nodeCount: number, orientation?: {x: number, y: number, z: number}, heartbeat?: number): void {
    // Sensory Normalization (Phase 1)
    // Standardize inputs based on a 10-node baseline
    const scale = 10 / (nodeCount || 1);

    // Proprioception: "Am I touching the ground?"
    const isTouchingGround = this.physicalNode.pos.y <= 0.1 ? 1.0 : 0.0;
    
    // Proprioception: "How fast am I moving?"
    const vx = this.physicalNode.pos.x - this.physicalNode.oldPos.x;
    const vy = this.physicalNode.pos.y - this.physicalNode.oldPos.y;
    const vz = this.physicalNode.pos.z - this.physicalNode.oldPos.z;
    
    let velocitySq = vx*vx + vy*vy + vz*vz; 
    let velocity = Math.sqrt(velocitySq) / (dt || 0.016);
    
    // SENSORY CLAMP
    if (velocity > ENGINE_CONFIG.neural.maxVelocitySensory) velocity = ENGINE_CONFIG.neural.maxVelocitySensory;

    // Feed into input sum (bias + sense)
    this.inputSum += (isTouchingGround * ENGINE_CONFIG.neural.touchGroundDrive * scale); 
    this.inputSum += (velocity * ENGINE_CONFIG.neural.velocitySenseScale * scale); 

    // --- VESTIBULAR SENSE (The Inner Ear) ---
    if (orientation) {
        // Feed orientation (XYZ rotation relative to gravity) as sensory input
        // Scaled to prioritize Y (up/down) while allowing perception of tilt (X, Z). Multiplied by evolved trust factor.
        this.inputSum += orientation.x * ENGINE_CONFIG.neural.orientationXDrive * scale * this.vestibularMultiplier; 
        this.inputSum += orientation.y * ENGINE_CONFIG.neural.orientationYDrive * scale * this.vestibularMultiplier; 
        this.inputSum += orientation.z * ENGINE_CONFIG.neural.orientationZDrive * scale * this.vestibularMultiplier; 
    }

    // --- BIOLOGICAL CLOCK (Heartbeat) ---
    if (heartbeat !== undefined) {
        this.inputSum += heartbeat * ENGINE_CONFIG.neural.heartbeatDrive * this.heartbeatMultiplier; // Strong rhythmic driver, multiplied by trust factor
    }
  }

  // 2. Propagate: Send signal to neighbors (Handled by BrainController via synapses)
  
  // 3. Activate: Nonlinear transfer function
  public updateActivation(): void {
    // METHOD 4 REVERTED: Algebraic Sigmoid was changing the shape of the activation 
    // too heavily and preventing full muscle contraction. Back to standard Sigmoid.
    this.activation = 1 / (1 + Math.exp(-this.inputSum));
    
    // Store in physical node for Renderer to see
    this.physicalNode.activation = this.activation;
    
    // HARD RESET input for next frame (Architecture decision: Discrete timesteps)
    // We clear it here because `sense()` and `think()` rebuild it every frame.
    this.inputSum = 0; 
  }
}