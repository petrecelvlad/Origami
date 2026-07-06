export const physicsComputeShader = `
struct SimParams {
    dt: f32,                // 0
    gravity: f32,           // 4
    globalStiffness: f32,   // 8
    numNodes: u32,          // 12 (uint)

    numMuscles: u32,        // 16 (uint)
    numOrganisms: u32,      // 20 (uint)
    time: f32,              // 24
    gripDepletionRate: f32, // 28

    gripRechargeRate: f32,  // 32
    visionRadius: f32,      // 36
    maxGripStress: f32,     // 40
    gripCooldown: f32,      // 44
    
    staticFrictionThreshold: f32, // 48
    muscleSignalLimit: f32,       // 52
    muscleSoftness: f32,          // 56
    maxVelocity: f32,             // 60

    slipFactor: f32,              // 64
    brokenSlipFactor: f32,        // 68
    waveFreq: f32,                // 72
    waveAmp: f32,                 // 76

    maxYieldRatio: f32,           // 80
    globalDamping: f32,           // 84
    terminalVelocity: f32,        // 88
    localDamping: f32,            // 92

    contractionSpeed: f32,        // 96
    antiSingularityRadius: f32,   // 100
    relaxationFactor: f32,        // 104
    shapeMemoryStrength: f32,     // 108 (was unused padding)
};

@group(0) @binding(0) var<uniform> params: SimParams;

// NODE BUFFERS
@group(0) @binding(1) var<storage, read_write> positions: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> velocities: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> properties: array<vec4<f32>>; // [mass, friction, isFixed, cellType]

// MUSCLE BUFFERS
@group(0) @binding(4) var<storage, read> muscleIndices: array<vec4<f32>>; // [nodeA, nodeB, mirrorId, isMirrored]
@group(0) @binding(5) var<storage, read_write> muscleProps: array<vec4<f32>>; // [baseLen, targetLen, curLen, stiffness]
@group(0) @binding(6) var<storage, read> muscleOsc: array<vec4<f32>>; // [phase, freq, amp, pad]

// ATOMIC FORCE BUFFERS (1 Float32 = 1 Int32)
// Because multiple muscles pull on the same node simultaneously, we must use 
// atomic integer addition to prevent thread race conditions overwriting forces.
@group(0) @binding(7) var<storage, read_write> forceAccumX: array<atomic<i32>>;
@group(0) @binding(8) var<storage, read_write> forceAccumY: array<atomic<i32>>;
@group(0) @binding(9) var<storage, read_write> forceAccumZ: array<atomic<i32>>;

// GRIP BUFFER
@group(0) @binding(10) var<storage, read_write> nodeGrip: array<vec4<f32>>; // [stamina, cooldown, signal, isGripping]

const SCALE: f32 = 100000.0;
const RADIUS: f32 = 0.1;
// Matches BioPhysicsEngine.ts's BUCKLING_THRESHOLD (ENGINE_CONFIG.physics.bucklingThreshold).
// CPU treats this as an immutable constant too (not exposed via SimulationConfig), so it's
// hardcoded here rather than threaded through as a uniform.
const BUCKLING_THRESHOLD: f32 = 20.0;
// Matches BioPhysicsEngine.ts's ANCHOR_MULTIPLIER: a gripping node barely responds to muscle
// forces, mirroring CPU's near-infinite effective mass for a planted, anchored foot.
const GRIP_FORCE_DAMPENING: f32 = 0.001;

// ==========================================
// PASS 1: CLEAR FORCES
// ==========================================
@compute @workgroup_size(64)
fn clearForces(@builtin(global_invocation_id) id: vec3<u32>) {
    let index = id.x;
    if (index >= params.numNodes) { return; }
    
    atomicStore(&forceAccumX[index], 0i);
    atomicStore(&forceAccumY[index], 0i);
    atomicStore(&forceAccumZ[index], 0i);
}

// ==========================================
// PASS 2: CALCULATE MUSCLE SPRINGS (Hooke's Law) & CPG Ticks
// ==========================================
@compute @workgroup_size(64)
fn calcMuscleForces(@builtin(global_invocation_id) id: vec3<u32>) {
    let index = id.x;
    if (index >= params.numMuscles) { return; }

    let indices = muscleIndices[index];
    let idxA = u32(indices.x);
    let idxB = u32(indices.y);

    let posA = positions[idxA].xyz;
    let posB = positions[idxB].xyz;
    
    let props = muscleProps[index];
    
    let baseLen = props.x;
    var targetLen = props.y;
    let currentLen = props.z;
    let muscleStiffness = props.w;

    // ---- NEURAL SIGNAL INJECTION ----
    // This perfectly mimics the CPU "Spinal Wave"
    let osc = muscleOsc[index];
    let phase = osc.x;
    let freq = osc.y;
    let amp = osc.z;

    let PI2 = 6.28318530718;
    let brainSignal = sin(phase) * amp;
    let dist = baseLen; // approximation for rest distance cascade
    let spinalSignal = sin(params.time * params.waveFreq * PI2 - (dist * 1.0)) * params.waveAmp;

    // Combine and clamp using WGSL native max/min instead of branching
    var totalSignal = spinalSignal + brainSignal;
    totalSignal = clamp(totalSignal, -params.muscleSignalLimit, params.muscleSignalLimit);

    let desiredLength = baseLen * (1.0 + totalSignal);
    
    // Smooth target adjustment (Phase 5: Muscle Slew Rate)
    let maxChange = params.contractionSpeed * params.dt;
    let desiredDelta = desiredLength - targetLen;
    let softnessDelta = desiredDelta * params.muscleSoftness;
    let actualDelta = clamp(softnessDelta, -maxChange, maxChange);
    targetLen = targetLen + actualDelta;

    // ---- PHYSICS ----
    let diff = posB - posA;
    let distReal = length(diff);

    // Buckling: muscles under heavy stress go soft (safety valve against explosive forces),
    // and the CPU engine additionally bakes in a flat 0.8 multiplier on top of per-muscle
    // stiffness -- both were missing here, making GPU muscles ~25% stiffer than CPU's with no
    // stress relief, plausibly contributing to the reported "rigid body" feel.
    // Mirrors BioPhysicsEngine.resolveMuscles' preStress/stiffnessFactor (CPU).
    let preStress = abs(distReal - baseLen) * muscleStiffness * params.globalStiffness;
    let stiffnessFactor = select(1.0, 0.2, preStress > BUCKLING_THRESHOLD);
    let stiffness = muscleStiffness * 0.8 * params.globalStiffness * stiffnessFactor;

    // Phase 6: Topoloigcal Singularity Fallback
    var dir = vec3<f32>(0.0, 1.0, 0.0); // Arbitrary push-apart direction if perfectly overlapped
    if (distReal > 0.0001) {
        dir = diff / distReal;
    }

    // ----- LOCAL DAMPING -----
    let velA = velocities[idxA].xyz;
    let velB = velocities[idxB].xyz;
    let relVel = velB - velA;
    
    // velocity representing how fast the muscle is stretching or contracting
    let velAlongSpring = dot(relVel, dir);

    // Hooke's law: F = -k * (x - x0)
    var forceMag = (distReal - targetLen) * stiffness;

    // Shape memory: an anchor force back toward the muscle's ORIGINAL rest length (baseLen),
    // independent of the actively-tracked targetLen above. Without this, nothing resists slow,
    // cumulative drift away from the creature's built shape over many frames. strainBoost makes
    // the anchor self-correcting: the further a muscle has already drifted from baseLen, the
    // harder it pulls back -- a constant-strength anchor (tried first, confirmed via the parity
    // harness's 300-frame trend to only slow, not stop, cumulative sag) isn't enough on its own.
    // Mirrors BioPhysicsEngine.resolveMuscles' memoryCorrection/strainBoost (CPU).
    let baseDiff = distReal - baseLen;
    let strainBoost = 1.0 + (abs(baseDiff) / baseLen) * 4.0;
    let memoryStrength = params.shapeMemoryStrength * strainBoost * params.globalStiffness;
    forceMag += baseDiff * memoryStrength;

    // Phase 6: Anti-Singularity Repulsion
    if (distReal < params.antiSingularityRadius) {
        let penalty = 1.0 - (distReal / params.antiSingularityRadius);
        // Apply strong outward (negative) force to prevent topology inversion
        forceMag -= penalty * 5000.0;
    }

    
    // Apply local damping proportional to velocity along spring.
    // If it's stretching (velAlongSpring > 0), this adds a positive force (pulling together).
    let dampingForce = velAlongSpring * params.localDamping;
    forceMag += dampingForce;

    // Phase 1/3 stability: Prevent mathematical explosion and atomic integer overflow
    // i32 max is ~2.14 billion. With SCALE=100000.0, force limit is ~21000.0
    // We clamp to 5000.0 to be extremely safe against multiple overlapping forces mapping to the same node.
    let maxSafeForce = 5000.0;
    forceMag = clamp(forceMag, -maxSafeForce, maxSafeForce);

    let force = dir * forceMag;

    // Output target lengths back so JS can optionally render them
    muscleProps[index] = vec4<f32>(baseLen, targetLen, distReal, props.w);

    // Grip-aware force dampening: a gripping (planted, anchored) node should barely respond to
    // muscle forces, so corrections mostly move the OTHER, non-anchored node instead -- mirroring
    // BioPhysicsEngine.resolveMuscles' ANCHOR_MULTIPLIER (CPU reduces a gripping node's effective
    // inverse mass to near-zero for muscle correction specifically). Without this, GPU treats a
    // planted foot as an equally-movable mass like any other node, so muscle forces can drag
    // "anchored" feet around instead of using them as a stable base to stand/pivot on --
    // deliberately asymmetric (not equal-and-opposite): the missing reaction on a gripping node
    // is absorbed by the (unmodeled) ground/grip constraint, same as CPU's intent.
    let grippingA = nodeGrip[idxA].w > 0.5;
    let grippingB = nodeGrip[idxB].w > 0.5;
    let forceScaleA = select(1.0, GRIP_FORCE_DAMPENING, grippingA);
    let forceScaleB = select(1.0, GRIP_FORCE_DAMPENING, grippingB);

    // Convert float force to fixed-point integer for thread-safe atomics
    let forceA = force * forceScaleA;
    let forceB = force * forceScaleB;

    atomicAdd(&forceAccumX[idxA], i32(forceA.x * SCALE));
    atomicAdd(&forceAccumY[idxA], i32(forceA.y * SCALE));
    atomicAdd(&forceAccumZ[idxA], i32(forceA.z * SCALE));

    atomicAdd(&forceAccumX[idxB], i32(-forceB.x * SCALE));
    atomicAdd(&forceAccumY[idxB], i32(-forceB.y * SCALE));
    atomicAdd(&forceAccumZ[idxB], i32(-forceB.z * SCALE));
}

// ==========================================
// PASS 3: INTEGRATE NODES (Verlet Velocity + Gravity + Collisions + GRIP)
// ==========================================
@compute @workgroup_size(64)
fn integrateNodes(@builtin(global_invocation_id) id: vec3<u32>) {
    let index = id.x;
    if (index >= params.numNodes) { return; }

    let prop = properties[index];
    let isFixed = prop.z;
    let cellType = prop.w; // 1 = HEAD, 2 = BODY, 3 = FOOT
    if (isFixed > 0.5) { return; }

    let mass = max(prop.x, 0.1); // prevent divide by zero
    let friction = prop.y;
    
    var pos = positions[index].xyz;
    var vel = velocities[index].xyz;
    var grip = nodeGrip[index]; // [stamina, cooldown, signal, isGripping]
    
    // LOAD ACCUMULATED FORCES
    let forceX = f32(atomicLoad(&forceAccumX[index])) / SCALE;
    let forceY = f32(atomicLoad(&forceAccumY[index])) / SCALE;
    let forceZ = f32(atomicLoad(&forceAccumZ[index])) / SCALE;
    var force = vec3<f32>(forceX, forceY, forceZ);

    // 1. DAMPING & GRAVITY & ACCELERATION
    force.y += (params.gravity * mass);
    let acc = force / mass;
    vel += acc * params.dt;

    // 2. GRIP & COLLISION LOGIC
    var isGripping = false;
    let brainWantsGrip = grip.z > 0.5;
    let canGrip = grip.x > 0.0 && grip.y <= 0.5; // cooldown <= 0
    let stress = length(force) / mass;

    if (pos.y < RADIUS * 1.05) {
        let vSq = dot(vel.xz, vel.xz);
        let thresholdSq = select(params.staticFrictionThreshold * params.staticFrictionThreshold, 0.16, brainWantsGrip);
        let gripBroken = stress > params.maxGripStress;
        let wasGripping = grip.w > 0.5;
        
        // STICKY GRIP: If we were already gripping, we stay gripping unless broken by stress or manual release.
        // This stops the "gliding" where a node slips because muscle velocity exceeds static threshold.
        let gripCondition = select(vSq < thresholdSq, true, wasGripping);
        
        let isFoot = (cellType > 2.5) || (friction > 0.8 && cellType > 1.5); // FOOT or High friction non-head

        if (canGrip && (isFoot || brainWantsGrip) && gripCondition && !gripBroken) {
            isGripping = true;
            vel.x = 0.0;
            vel.z = 0.0;
            
            // Drain stamina
            grip.x -= 0.002 + (stress * 0.005 * params.gripDepletionRate);
            if (grip.x <= 0.0) {
                grip.x = 0.0;
                grip.y = params.gripCooldown; // Cooldown
                isGripping = false;
            }
        } else {
            // SLIP / FRICTION/ RECHARGE
            // Higher slip factor means MORE velocity kept.
            // If cooldown is active, we are "broken" and keep more velocity (slide more).
            var currentSlip = select(params.slipFactor, params.brokenSlipFactor, gripBroken || grip.y > 0.0);
            
            // Also factor in the node's specific friction if not broken
            if (!gripBroken && grip.y <= 0.0) {
                currentSlip = min(currentSlip, friction);
            }

            vel.x *= currentSlip;
            vel.z *= currentSlip;
            
            if (gripBroken) {
                grip.x -= 0.1;
            }

            // RECHARGE while on ground but not gripping
            grip.x += params.gripRechargeRate;
        }
        
        // Floor Collision
        pos.y = RADIUS;
        vel.y = max(vel.y, 0.0);
    } else {
        // Air behavior: Damping + Recharge
        vel *= friction; 
        grip.x += params.gripRechargeRate;
    }
    
    // Final Clamp
    grip.x = clamp(grip.x, 0.0, 1.0);
    if (grip.y > 0.0) { grip.y -= 1.0; }
    
    // 3. FINAL INTEGRATION
    // Apply Global Damping to bleed off excess energy
    vel *= params.globalDamping;

    // Hard Terminal Velocity Limit
    let speedSq = dot(vel, vel);
    let maxVSq = params.maxVelocity * params.maxVelocity;
    let termVSq = params.terminalVelocity * params.terminalVelocity;
    
    // Check against configured maxVelocity and terminalVelocity
    let actualMaxSq = min(maxVSq, termVSq); 
    
    if (speedSq > actualMaxSq) {
        vel = normalize(vel) * sqrt(actualMaxSq);
    }

    pos += vel * params.dt;

    // Sync back
    grip.w = select(0.0, 1.0, isGripping);
    nodeGrip[index] = grip;
    positions[index] = vec4<f32>(pos, 0.0);
    velocities[index] = vec4<f32>(vel, 0.0);
}

// ==========================================
// PASS 4: CALCULATE YIELD CONSTRAINTS (PBD)
// ==========================================
@compute @workgroup_size(64)
fn calcConstraints(@builtin(global_invocation_id) id: vec3<u32>) {
    let index = id.x;
    if (index >= params.numMuscles) { return; }

    let indices = muscleIndices[index];
    let idxA = u32(indices.x);
    let idxB = u32(indices.y);

    let posA = positions[idxA].xyz;
    let posB = positions[idxB].xyz;
    let props = muscleProps[index];
    let baseLen = props.x;
    
    let maxLen = baseLen * params.maxYieldRatio;
    let diff = posB - posA;
    let distReal = length(diff);

    if (distReal > maxLen && distReal > 0.001) {
        let overshoot = distReal - maxLen;
        let dir = diff / distReal;
        
        // Push both nodes towards each other by half the overshoot
        let correctionDir = dir * (overshoot * 0.5);
        
        // Accumulate corrections using SCALE trick
        let cx = i32(correctionDir.x * SCALE);
        let cy = i32(correctionDir.y * SCALE);
        let cz = i32(correctionDir.z * SCALE);

        atomicAdd(&forceAccumX[idxA], cx);
        atomicAdd(&forceAccumY[idxA], cy);
        atomicAdd(&forceAccumZ[idxA], cz);
        
        atomicAdd(&forceAccumX[idxB], -cx);
        atomicAdd(&forceAccumY[idxB], -cy);
        atomicAdd(&forceAccumZ[idxB], -cz);
    } else if (distReal < params.antiSingularityRadius) {
        let overlap = params.antiSingularityRadius - distReal;
        var dir = vec3<f32>(0.0, 1.0, 0.0);
        if (distReal > 0.0001) {
            dir = diff / distReal;
        }
        
        // Push apart (negative correction)
        let correctionDir = dir * (-overlap * 0.5);

        let cx = i32(correctionDir.x * SCALE);
        let cy = i32(correctionDir.y * SCALE);
        let cz = i32(correctionDir.z * SCALE);

        atomicAdd(&forceAccumX[idxA], cx);
        atomicAdd(&forceAccumY[idxA], cy);
        atomicAdd(&forceAccumZ[idxA], cz);
        
        atomicAdd(&forceAccumX[idxB], -cx);
        atomicAdd(&forceAccumY[idxB], -cy);
        atomicAdd(&forceAccumZ[idxB], -cz);
    }
}

// ==========================================
// PASS 5: APPLY YIELD CONSTRAINTS (PBD)
// ==========================================
@compute @workgroup_size(64)
fn applyConstraints(@builtin(global_invocation_id) id: vec3<u32>) {
    let index = id.x;
    if (index >= params.numNodes) { return; }

    let prop = properties[index];
    let isFixed = prop.z;
    if (isFixed > 0.5) { return; }

    let cx = f32(atomicLoad(&forceAccumX[index])) / SCALE;
    let cy = f32(atomicLoad(&forceAccumY[index])) / SCALE;
    let cz = f32(atomicLoad(&forceAccumZ[index])) / SCALE;

    // Apply Jacobi relaxation factor to prevent constraint overshoot explosions
    // when multiple muscles pull the same node simultaneously.
    let correction = vec3<f32>(cx, cy, cz) * params.relaxationFactor;
    
    // Only apply if there's actual correction, to avoid tiny float drift
    if (length(correction) > 0.0001) {
        let oldPos = positions[index].xyz;
        var newPos = oldPos + correction;
        
        let oldVel = velocities[index].xyz;
        
        // Floor constraint
        if (newPos.y < RADIUS) {
            newPos.y = RADIUS;
        }

        // PBD requirement: Add positional correction to velocity
        let dt = max(params.dt, 0.001); // Prevent div by zero
        let actualCorrection = newPos - oldPos;
        var newVel = oldVel + (actualCorrection / dt);
        
        // Check floor bounce on velocity
        if (newPos.y <= RADIUS + 0.0001) {
            newVel.y = max(0.0, newVel.y);
        }
        
        positions[index] = vec4<f32>(newPos, 0.0);
        velocities[index] = vec4<f32>(newVel, 0.0);
    }
}
`;
