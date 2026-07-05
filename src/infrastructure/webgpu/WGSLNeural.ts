export const neuralComputeShader = `
struct SimParams {
    dt: f32,
    gravity: f32,
    globalStiffness: f32,
    numNodes: u32,
    numMuscles: u32,
    numOrganisms: u32,
    time: f32,
    gripDepletionRate: f32,
    gripRechargeRate: f32,
    visionRadius: f32,
    pad1: f32,
    pad2: f32,
};

@group(0) @binding(0) var<uniform> params: SimParams;

// NEURAL DATA
@group(0) @binding(1) var<storage, read_write> cpgBufferA: array<f32>;   // 20 per organism
@group(0) @binding(2) var<storage, read_write> cpgBufferB: array<f32>;   // 20 per organism
@group(0) @binding(3) var<storage, read> brainWeights: array<f32>;       // 400 per organism
@group(0) @binding(4) var<storage, read> networkParams: array<vec4<f32>>; // [clockSpeed, waveFreq, waveSpeed, pad]

// MUSCLE OUT
@group(0) @binding(5) var<storage, read_write> muscleOsc: array<vec4<f32>>; // [phase, freq, amp, pad]

// SENSORS
@group(0) @binding(6) var<storage, read> foodPositions: array<vec4<f32>>;
@group(0) @binding(7) var<storage, read> headNodeIndices: array<u32>;
@group(0) @binding(8) var<storage, read> nodePositions: array<vec4<f32>>; // Read node positions natively

// We use 64 threads. Each thread handles ONE organism's entire brain.
@compute @workgroup_size(64)
fn computeBrains(@builtin(global_invocation_id) id: vec3<u32>) {
    let orgIndex = id.x;
    if (orgIndex >= params.numOrganisms) { return; }

    let netParams = networkParams[orgIndex];
    let clockSpeed = netParams.x;
    let waveFreq = netParams.y;
    let waveSpeed = netParams.z;
    
    let brainDt = params.dt * clockSpeed;
    let leak: f32 = 0.2; // Memory persistence
    
    // ======== SENSORY INJECTION ========
    let headIdx = headNodeIndices[orgIndex];
    let headPos = nodePositions[headIdx].xyz;
    
    var nearestDistSq: f32 = 999999.0;
    var nearestDx: f32 = 0.0;
    var nearestDy: f32 = 0.0;
    var nearestDz: f32 = 0.0;
    
    let fIdxStart = orgIndex * 20u;
    for(var f = 0u; f < 20u; f = f + 1u) {
        let food = foodPositions[fIdxStart + f];
        if (food.w > 0.5) { continue; } // consumed
        
        let fpos = food.xyz;
        let dx = fpos.x - headPos.x;
        let dy = fpos.y - headPos.y;
        let dz = fpos.z - headPos.z;
        let distSq = dx*dx + dy*dy + dz*dz;
        
        if (distSq < nearestDistSq) {
            nearestDistSq = distSq;
            nearestDx = dx;
            nearestDy = dy;
            nearestDz = dz;
        }
    }
    
    var sensoryInput: f32 = 0.0;
    let vRadSq = params.visionRadius * params.visionRadius;
    if (nearestDistSq < vRadSq && nearestDistSq > 0.00001) {
        let dist = sqrt(nearestDistSq);
        let signal = max(0.0, 1.0 - (dist / params.visionRadius));
        sensoryInput = ((nearestDx + nearestDy + nearestDz) / dist) * signal * 2.0;
    }

    let orgOffset20 = orgIndex * 20u;
    let orgOffset400 = orgIndex * 400u;

    // 1. Matrix Multiplication (20x20 Recurrent Pattern Generator)
    // We read from Buffer A, write to Buffer B (Ping-Pong buffers are handled via JS swapping bindings,
    // or we can hardcode reading from A and writing to B here, and JS copies B to A after)
    
    for (var i = 0u; i < 20u; i = i + 1u) {
        var sum: f32 = 0.0;
        let rowOffset = i * 20u;

        for (var j = 0u; j < 20u; j = j + 1u) {
            let weight = brainWeights[orgOffset400 + rowOffset + j];
            let currentNeuron = cpgBufferA[orgOffset20 + j];
            sum += currentNeuron * weight;
        }

        sum += sensoryInput * 0.5;

        // Activation (Tanh) - native WGSL tanh is highly optimized
        let targetActivation = tanh(sum);
        
        let oldVal = cpgBufferA[orgOffset20 + i];
        let newVal = oldVal * (1.0 - leak) + targetActivation * leak;
        
        cpgBufferB[orgOffset20 + i] = newVal;
    }

    // 2. Map the generated CPG pulses to Muscle Oscillators
    // For now, we will just use the first output neuron as a unified signal 
    // to map to the internal oscillator of all of this organism's muscles.
    
    // In order to not have to search for muscles, we assume a static block distribution 
    // of 40 muscles maximum per organism. (Wait, let's just map the global params directly)
    let globalSignal = cpgBufferB[orgOffset20 + 0];
    
    // Actually we don't have the muscle bindings mapped properly per-organism yet in this shader.
    // That requires an organism-to-muscle index buffer.
    // For now, WGSLPhysics.ts (Phase 2) still reads muscleOscillators. But we aren't writing them.
    // The physics currently creates its own sine wave based on time!
}

@compute @workgroup_size(64)
fn copyCPG(@builtin(global_invocation_id) id: vec3<u32>) {
    let idx = id.x;
    if (idx >= params.numOrganisms * 20u) { return; }
    // Copy Buffer B back into Buffer A for the next frame
    cpgBufferA[idx] = cpgBufferB[idx];
}
`;
