/**
 * @propolis
 * {
 *   "role": "PHYSICS_ENGINE",
 *   "dependencies": ["@domain/types", "@domain/neural", "@domain/EngineConfig"],
 *   "constraints": ["C-002", "C-005", "C-006"],
 *   "agent_instructions": "Verlet integration must remain stable; do not introduce side effects in the solver loop."
 * }
 */
import { Node, Muscle, Organism, SimulationConfig, CellType } from './types';
import { BrainController } from './neural/BrainController';
import { DEFAULT_SIMULATION_CONFIG } from './constants';
import { ENGINE_CONFIG } from './EngineConfig';

export class BioPhysicsEngine {
  private config: SimulationConfig;
  private readonly MAX_VELOCITY = ENGINE_CONFIG.physics.maxVelocity;
  
  // SOLVER SETTINGS (Optimized)
  private readonly RELAXATION_FACTOR = ENGINE_CONFIG.physics.relaxationFactor; 
  private readonly ITERATIONS = ENGINE_CONFIG.physics.iterations; 
  
  // DAMPING SETTINGS
  private readonly BASE_MUSCLE_DAMPING = ENGINE_CONFIG.physics.baseMuscleDamping; 
  private readonly ADAPTIVE_DAMPING_FACTOR = ENGINE_CONFIG.physics.adaptiveDampingFactor; 
  
  // AIR RESISTANCE
  private readonly DRAG_COEFFICIENT = ENGINE_CONFIG.physics.dragCoefficient; 

  // --- SOLIDITY CONSTANTS ---
  private readonly NODE_RADIUS = ENGINE_CONFIG.physics.nodeRadius; 
  private readonly HARD_CONTACT_LIMIT = ENGINE_CONFIG.physics.hardContactLimit; 
  
  // --- REALISM CONSTANTS ---
  private readonly MAX_GRIP_STRESS = ENGINE_CONFIG.physics.maxGripStress; 
  private readonly BUCKLING_THRESHOLD = ENGINE_CONFIG.physics.bucklingThreshold; 
  private readonly TIPPING_FORCE_MAGNITUDE = ENGINE_CONFIG.physics.tippingForceMagnitude; 
  
  // --- SAFETY ---
  private readonly MAX_CORRECTION = ENGINE_CONFIG.physics.maxCorrection; 
  private readonly WORLD_CEILING = ENGINE_CONFIG.physics.worldCeiling; 

  // --- GRIP CONSTANTS (Reflexive System) ---
  private readonly STATIC_FRICTION_THRESHOLD = ENGINE_CONFIG.physics.staticFrictionThreshold; 

  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = {
      ...DEFAULT_SIMULATION_CONFIG,
      ...config
    };
  }
  
  public setConfig(config: Partial<SimulationConfig>) {
      this.config = { ...this.config, ...config };
  }

  public updateOrganism(organism: Organism, totalTime: number, fastMode: boolean = false): void {
    if (!organism.isAlive) return; 
    
    organism.isInPain = false;

    const subSteps = fastMode ? 3 : 8; 
    const subDt = this.config.timeStep / subSteps;
    const gY = this.config.gravity * subDt * subDt; 

    const nodes = organism.nodes;
    const len = nodes.length;

    for(let s=0; s < subSteps; s++) {
        if (!organism.isAlive) break;

        // RESET STRESS
        for(let i=0; i<len; i++) {
            nodes[i].currentStress = 0;
        }

        // --- NEW: CENTER OF MASS TIPPING ---
        this.applyTippingForces(organism, subDt);

        this.integrate(organism, subDt, gY);
        if (!fastMode) this.applyRotationalDrag(organism); 
        
        const loops = fastMode ? 2 : this.ITERATIONS;

        for (let i = 0; i < loops; i++) {
            this.resolveMuscles(organism);
            if (!fastMode && i === loops - 1) {
                this.resolveSelfCollisions(organism); 
            }
        }
        
        this.resolveFloor(organism);
        
        // --- EXPLOSION CHECK ---
        const checkNode = nodes[0];
        if (checkNode) {
            const y = checkNode.pos.y;
            if (y > this.WORLD_CEILING || !Number.isFinite(y)) {
                organism.isAlive = false;
                organism.energy = 0;
                for(let i=0; i<len; i++) {
                    nodes[i].pos.x = 0; nodes[i].pos.y = 0; nodes[i].pos.z = 0;
                }
                break;
            }
        }
    }
  }

  private applyTippingForces(organism: Organism, dt: number): void {
      const nodes = organism.nodes;
      const len = nodes.length;
      if (len === 0) return;

      // 1. Calculate Center of Mass (CoM)
      let totalMass = 0;
      let comX = 0, comY = 0, comZ = 0;
      
      const grippingNodes: Node[] = [];
      for (let i=0; i<len; i++) {
          const n = nodes[i];
          comX += n.pos.x * n.mass;
          comY += n.pos.y * n.mass;
          comZ += n.pos.z * n.mass;
          totalMass += n.mass;
          if (n.isGripping) grippingNodes.push(n);
      }
      
      if (totalMass <= 0) return;
      comX /= totalMass;
      comY /= totalMass;
      comZ /= totalMass;

      // 2. Calculate Support Base (Average of gripping nodes)
      if (grippingNodes.length > 0) {
          let baseX = 0, baseZ = 0;
          for (const n of grippingNodes) {
              baseX += n.pos.x;
              baseZ += n.pos.z;
          }
          baseX /= grippingNodes.length;
          baseZ /= grippingNodes.length;

          // 3. Tipping Vector: Distance from CoM to Support Base
          const dx = comX - baseX;
          const dz = comZ - baseZ;
          const distSq = dx*dx + dz*dz;

          // If the CoM is far from the support base, apply a tipping force
          // This simulates the "Moment Arm" of gravity pulling the body over
          if (distSq > 0.01) {
              const dist = Math.sqrt(distSq);
              // INCREASED PENALTY: 1 leg is extremely unstable
              const stabilityPenalty = grippingNodes.length === 1 ? 8.0 : (4.0 / (grippingNodes.length + 1));
              const force = dist * this.TIPPING_FORCE_MAGNITUDE * stabilityPenalty;
              
              const fx = (dx / dist) * force * dt;
              const fz = (dz / dist) * force * dt;

              // Apply force to all non-gripping nodes (the body)
              for (let i=0; i<len; i++) {
                  const n = nodes[i];
                  if (!n.isGripping) {
                      n.pos.x += fx;
                      n.pos.z += fz;
                      // Also pull them DOWN slightly to simulate the fall
                      n.pos.y -= force * 0.5 * dt;
                  }
              }
          }
      }
  }

  private applyRotationalDrag(organism: Organism): void {
      const nodes = organism.nodes;
      const len = nodes.length;
      if (len === 0) return;

      let cx = 0, cz = 0;
      for (let i=0; i<len; i++) {
          cx += nodes[i].pos.x;
          cz += nodes[i].pos.z;
      }
      cx /= len;
      cz /= len;

      let angularMomentum = 0;
      let momentOfInertia = 0;

      for (let i=0; i<len; i++) {
          const n = nodes[i];
          const rx = n.pos.x - cx;
          const rz = n.pos.z - cz;
          
          const vx = n.pos.x - n.oldPos.x;
          const vz = n.pos.z - n.oldPos.z;

          const orbitalComponent = rx * vz - rz * vx;
          
          angularMomentum += orbitalComponent;
          momentOfInertia += rx * rx + rz * rz;
      }

      if (momentOfInertia < 0.001) return;

      const angularVel = angularMomentum / momentOfInertia;
      if (!Number.isFinite(angularVel)) return; 
      
      const drag = this.config.rotationalDrag ?? 0.05;

      for (let i=0; i<len; i++) {
          const n = nodes[i];
          const rx = n.pos.x - cx;
          const rz = n.pos.z - cz;
          
          // Apply configured drag
          const dampX = -angularVel * rz * drag;
          const dampZ =  angularVel * rx * drag;

          n.oldPos.x += dampX;
          n.oldPos.z += dampZ;
      }
  }

  private integrate(organism: Organism, dt: number, gravityY: number): void {
    const nodes = organism.nodes;
    const friction = this.config.friction;
    
    // Safety cap: Max distance a node can travel in one sub-step
    const MAX_STEP = this.MAX_VELOCITY * dt; 
    const MAX_STEP_SQ = MAX_STEP * MAX_STEP;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.isFixed) continue;
      
      if (node.isGripping) {
          node.oldPos.x = node.pos.x;
          node.oldPos.z = node.pos.z;
      }

      let velX = node.pos.x - node.oldPos.x;
      let velY = node.pos.y - node.oldPos.y;
      let velZ = node.pos.z - node.oldPos.z;
      
      // NaN Check
      if (isNaN(velX)) velX = 0;
      if (isNaN(velY)) velY = 0;
      if (isNaN(velZ)) velZ = 0;

      // Air Resistance
      const vSq = velX*velX + velY*velY + velZ*velZ;
      if (vSq > 0.000001) {
          const vLen = Math.sqrt(vSq);
          const dragFactor = 1.0 / (1.0 + this.DRAG_COEFFICIENT * vLen);
          velX *= dragFactor;
          velY *= dragFactor;
          velZ *= dragFactor;
      }
      
      // Dynamic Friction (Air Resistance + Damping)
      velX *= friction;
      velY *= friction;
      velZ *= friction;

      // HARD VELOCITY CLAMP
      const finalVSq = velX*velX + velY*velY + velZ*velZ;
      if (finalVSq > MAX_STEP_SQ) {
          const scale = MAX_STEP / Math.sqrt(finalVSq);
          velX *= scale;
          velY *= scale;
          velZ *= scale;
      }

      node.oldPos.x = node.pos.x;
      node.oldPos.y = node.pos.y;
      node.oldPos.z = node.pos.z;
      
      node.pos.x += velX;
      node.pos.y += velY + gravityY; // Gravity is only Y here
      node.pos.z += velZ;
    }
  }

  private resolveMuscles(organism: Organism): void {
    const muscles = organism.muscles;
    const len = muscles.length;

    const ANCHOR_MULTIPLIER = 0.001; 
    const MEMORY_STRENGTH = this.config.shapeMemoryStrength || 0.8;
    const GLOBAL_STIFFNESS = this.config.globalStiffness; 
    
    if (!muscles[0]?.nodeRefA) {
         const nodeMap = new Map<string, Node>();
         for (const n of organism.nodes) nodeMap.set(n.id, n);
         for (let i=0; i<len; i++) {
             muscles[i].nodeRefA = nodeMap.get(muscles[i].nodeA);
             muscles[i].nodeRefB = nodeMap.get(muscles[i].nodeB);
         }
    }

    for (let i=0; i<len; i++) {
        const muscle = muscles[i];
        const n1 = muscle.nodeRefA;
        const n2 = muscle.nodeRefB;

        if (!n1 || !n2) continue;

        const dx = n2.pos.x - n1.pos.x;
        const dy = n2.pos.y - n1.pos.y;
        const dz = n2.pos.z - n1.pos.z;
        
        const distSq = dx*dx + dy*dy + dz*dz;
        
        if (distSq < 0.00001) continue; 
        if (distSq > 2500) continue; 

        const dist = Math.sqrt(distSq);
        
        let activeTarget = muscle.targetLength ?? muscle.baseLength;
        if (activeTarget < this.HARD_CONTACT_LIMIT) activeTarget = this.HARD_CONTACT_LIMIT;

        // Estimate stress for buckling logic
        const preStress = Math.abs(dist - muscle.baseLength) * muscle.stiffness * GLOBAL_STIFFNESS;
        const stiffnessFactor = (preStress > this.BUCKLING_THRESHOLD) ? 0.2 : 1.0;
        const stiffness = muscle.stiffness * 0.8 * GLOBAL_STIFFNESS * stiffnessFactor; 
        const activeDiff = dist - activeTarget;
        const baseDiff = dist - muscle.baseLength;
        
        const strainBoost = 1.0 + ((Math.abs(baseDiff) / muscle.baseLength) * 4.0);
        const currentMemoryStrength = MEMORY_STRENGTH * strainBoost * GLOBAL_STIFFNESS;
        
        const activeCorrection = activeDiff * stiffness;
        const memoryCorrection = baseDiff * currentMemoryStrength;
        let totalCorrection = (activeCorrection + memoryCorrection) * this.RELAXATION_FACTOR;

        if (totalCorrection > this.MAX_CORRECTION) totalCorrection = this.MAX_CORRECTION;
        else if (totalCorrection < -this.MAX_CORRECTION) totalCorrection = -this.MAX_CORRECTION;

        const rvx = (n2.pos.x - n2.oldPos.x) - (n1.pos.x - n1.oldPos.x);
        const rvy = (n2.pos.y - n2.oldPos.y) - (n1.pos.y - n1.oldPos.y);
        const rvz = (n2.pos.z - n2.oldPos.z) - (n1.pos.z - n1.oldPos.z);
        
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;
        
        const vRelProj = rvx * nx + rvy * ny + rvz * nz;
        const dynamicDamping = this.BASE_MUSCLE_DAMPING + (Math.abs(vRelProj) * this.ADAPTIVE_DAMPING_FACTOR);
        
        totalCorrection += vRelProj * dynamicDamping;

        const stressValue = Math.abs(totalCorrection);
        n1.currentStress = (n1.currentStress || 0) + stressValue;
        n2.currentStress = (n2.currentStress || 0) + stressValue;

        let im1 = n1.isFixed ? 0 : 1 / n1.mass;
        let im2 = n2.isFixed ? 0 : 1 / n2.mass;
        
        if (n1.isGripping) im1 *= ANCHOR_MULTIPLIER;
        if (n2.isGripping) im2 *= ANCHOR_MULTIPLIER;

        const totalInvMass = im1 + im2;
        if (totalInvMass === 0) continue;

        const factor = totalCorrection / totalInvMass;
        const offsetX = nx * factor;
        const offsetY = ny * factor;
        const offsetZ = nz * factor;
        
        if (!n1.isFixed) {
            n1.pos.x += offsetX * im1;
            n1.pos.y += offsetY * im1;
            n1.pos.z += offsetZ * im1;
        }
        
        if (!n2.isFixed) {
            n2.pos.x -= offsetX * im2;
            n2.pos.y -= offsetY * im2;
            n2.pos.z -= offsetZ * im2;
        }
    }
  }

  private resolveSelfCollisions(organism: Organism): void {
      const nodes = organism.nodes;
      const count = nodes.length;
      const minDistance = this.HARD_CONTACT_LIMIT; 
      const minDistanceSq = minDistance * minDistance;

      for (let i = 0; i < count; i++) {
          const n1 = nodes[i];
          for (let j = i + 1; j < count; j++) {
              const n2 = nodes[j];
              const dx = n1.pos.x - n2.pos.x;
              const dy = n1.pos.y - n2.pos.y;
              const dz = n1.pos.z - n2.pos.z;
              
              if (Math.abs(dx) > minDistance || Math.abs(dy) > minDistance || Math.abs(dz) > minDistance) continue;

              const distSq = dx*dx + dy*dy + dz*dz;
              
              if (distSq < minDistanceSq && distSq > 0.000001) {
                  const dist = Math.sqrt(distSq);
                  const overlap = minDistance - dist;
                  const f = overlap * 0.5 / dist; 

                  const fx = dx * f;
                  const fy = dy * f;
                  const fz = dz * f;
                  
                  if (!n1.isFixed) { n1.pos.x += fx; n1.pos.y += fy; n1.pos.z += fz; }
                  if (!n2.isFixed) { n2.pos.x -= fx; n2.pos.y -= fy; n2.pos.z -= fz; }
              }
          }
      }
  }

  private resolveFloor(organism: Organism): void {
    const RADIUS = this.NODE_RADIUS;
    const KINETIC_FRICTION = 0.4; // Lowered: Slipping should be more dangerous
    
    const drainRate = this.config.gripDepletionRate ?? 2.0;
    const rechargeRate = this.config.gripRechargeRate ?? 0.02;

    const nodes = organism.nodes;
    const potentialGrippers: Node[] = [];

    // 1. First pass: Identify potential grippers and handle floor collision
    for (let i=0; i<nodes.length; i++) {
      const node = nodes[i];
      if (node.gripStamina === undefined) node.gripStamina = 1.0;
      if (node.gripCooldown === undefined) node.gripCooldown = 0; 
      if (node.gripCooldown > 0) node.gripCooldown--;

      if (node.pos.y < RADIUS) {
        // NEW RULE: Only FOOT parts can touch the ground.
        // If HEAD touches, instant death. If BODY touches, pain drain.
        if (node.cellType !== CellType.FOOT) {
            if (node.cellType === CellType.HEAD) {
                organism.isAlive = false;
                organism.energy = 0;
            } else {
                organism.isInPain = true;
            }
            // Do NOT return here, otherwise the rest of the nodes fall through the floor!
        }

        const dy = node.pos.y - node.oldPos.y;
        node.pos.y = RADIUS;
        if (dy < 0) {
             node.oldPos.y = node.pos.y + dy * this.config.groundDamping;
        }
        
        const isFoot = node.cellType === CellType.FOOT || (node.friction > 0.8 && !node.isHead);
        const brainWantsGrip = (node.gripSignal || 0) > 0.5;
        const canGrip = node.gripStamina > 0 && node.gripCooldown <= 0;
        
        if ((isFoot || brainWantsGrip) && canGrip) {
            potentialGrippers.push(node);
        } else {
            // SLIPPERY / COOLDOWN / NON-FOOT FRICTION
            node.isGripping = false;
            
            // If cooldown > 0, it's "broken" and slips more
            let slipValue = node.friction || 0.4;
            if (node.gripCooldown > 0) slipValue = this.config.brokenSlipFactor ?? 0.8;
            else slipValue = this.config.slipFactor ?? slipValue;

            node.oldPos.x = node.pos.x - (node.pos.x - node.oldPos.x) * slipValue;
            node.oldPos.z = node.pos.z - (node.pos.z - node.oldPos.z) * slipValue;
            
            // Recharge stamina if not gripping, even on floor
            node.gripStamina += rechargeRate;
            if (node.gripStamina > 1.0) node.gripStamina = 1.0;
        }
      } else {
          node.isGripping = false;
          node.gripStamina += rechargeRate;
          if (node.gripStamina > 1.0) node.gripStamina = 1.0;
      }
    }

    // 2. Second pass: Stability & Torque Logic
    const numGrips = potentialGrippers.length;
    
    for (const node of potentialGrippers) {
        const vx = node.pos.x - node.oldPos.x;
        const vz = node.pos.z - node.oldPos.z;
        const vSq = vx*vx + vz*vz;
        
        const slipValue = node.friction || 0.4;
        
        // STRESS CHECK: If the creature is leaning too hard on this one point, it breaks.
        // We penalize having fewer legs: 1 leg takes 100% stress, 4 legs share it.
        const stressValue = (node.currentStress || 0);
        // INCREASED PENALTY: 1 leg is extremely unstable and takes massive stress
        const stabilityPenalty = numGrips === 1 ? 10.0 : (numGrips < 3 ? (4 - numGrips) * 2.5 : 1.0);
        const effectiveStress = stressValue * stabilityPenalty;

        const brainWantsGrip = (node.gripSignal || 0) > 0.5;
        // REDUCED: Brain manual grip is no longer "Super Glue". 
        // It's now only 4x stronger than passive friction, not infinite.
        const thresholdSq = brainWantsGrip ? 0.16 : (this.STATIC_FRICTION_THRESHOLD * this.STATIC_FRICTION_THRESHOLD);
        
        // GRIP BREAKING: If stress is too high, the "nail" rips out.
        const gripBroken = effectiveStress > (this.config.maxGripStress ?? this.MAX_GRIP_STRESS);
        const wasGripping = node.isGripping;

        // STICKY GRIP: If we were already gripping, we bypass the velocity threshold check.
        // This ensures that once a foot is locked, it stays locked until the stress limit is exceeded.
        const gripCondition = wasGripping || (vSq < thresholdSq);

        if (gripCondition && !gripBroken) {
            // SUCCESSFUL GRIP
            node.isGripping = true;
            
            // Apply ROTATIONAL TORQUE resistance
            // Linked to the Stability (Gyro) setting
            const gyro = this.config.rotationalDrag ?? 0.5;
            const torqueResistance = Math.min(0.8, gyro * 0.4); 

            if (numGrips === 1) {
                // 1 leg can pivot, but it's hard to stay balanced
                node.oldPos.x = node.pos.x - vx * torqueResistance;
                node.oldPos.z = node.pos.z - vz * torqueResistance;
            } else {
                // Solid lock if we have multiple points of contact
                node.oldPos.x = node.pos.x;
                node.oldPos.z = node.pos.z;
            }

            // Stamina drain based on stress
            const drain = 0.002 + (effectiveStress * 0.005 * drainRate);
            node.gripStamina -= drain;
            
            if (node.gripStamina <= 0) {
                node.gripStamina = 0;
                node.gripCooldown = (this.config.gripCooldown ?? 60); 
                node.isGripping = false;
            }
        } else {
            // SLIP / BREAK
            node.isGripping = false;
            const slip = gripBroken ? (this.config.brokenSlipFactor ?? 0.8) : (this.config.slipFactor ?? slipValue);
            node.oldPos.x = node.pos.x - vx * slip;
            node.oldPos.z = node.pos.z - vz * slip;
            
            // If it broke due to stress, give a small stamina penalty
            if (gripBroken) node.gripStamina -= 0.1;
            else {
                // Otherwise recharge if we just couldn't find a grip
                node.gripStamina += rechargeRate;
            }
        }
        
        // Final clamp
        if (node.gripStamina > 1.0) node.gripStamina = 1.0;
        if (node.gripStamina < 0.0) node.gripStamina = 0.0;
    }
  }
}
