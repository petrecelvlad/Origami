/**
 * @propolis
 * {
 *   "role": "DIAGNOSTIC",
 *   "dependencies": ["@domain/BioPhysicsEngine", "@domain/ShapeFactory", "@application/GpuBridge"],
 *   "constraints": ["C-005"],
 *   "agent_instructions": "Runs the CPU and GPU physics engines against an identical starting organism and reports whether their gross behavior agrees. Triggered via the ?parityCheck=1 URL param. See cone/agent/skills/gpu-cpu-parity-check/SKILL.md before extending this."
 * }
 */
import { Organism, ShapeType } from '../domain/types';
import { ShapeFactory } from '../domain/ShapeFactory';
import { BioPhysicsEngine } from '../domain/BioPhysicsEngine';
import { ENGINE_CONFIG } from '../domain/EngineConfig';
import { GpuBridge, describeYRange, describeMuscleAnomalies } from './GpuBridge';
import { showDiagnosticOverlay } from '../infrastructure/webgpu/WebGPUContext';

const FRAMES = 300; // ~5 simulated seconds -- long enough to reveal slow, cumulative drift
const CHECKPOINTS = [30, 90, 180, 300]; // ~0.5s, 1.5s, 3s, 5s -- shows the trend, not just the endpoint
const DT = ENGINE_CONFIG.physics.timeStep;

function isFinitePosition(org: Organism): boolean {
    return org.nodes.every(
        (n) => Number.isFinite(n.pos.x) && Number.isFinite(n.pos.y) && Number.isFinite(n.pos.z)
    );
}

/**
 * Runs the CPU (BioPhysicsEngine) and GPU (GpuBridge) physics engines against two identical
 * clones of the same freshly-constructed organism, for the same number of frames with the same
 * physics parameters, then reports gross stability invariants for each — NOT a bit-for-bit
 * position diff. The two engines are intentionally different physics models (see
 * cone/agent/skills/gpu-cpu-parity-check/SKILL.md for the current, maintained list of known
 * gaps). Expecting numeric agreement would produce constant false positives; what actually
 * matters is whether both engines keep a properly-spawned creature standing, or whether one
 * silently collapses it.
 */
export async function runParityHarness(): Promise<void> {
    showDiagnosticOverlay('=== PARITY HARNESS START ===');
    showDiagnosticOverlay(
        'Known gaps (expected divergence, not bugs) -- see cone/agent/skills/gpu-cpu-parity-check/SKILL.md ' +
        'for the current list: GPU still has no tipping-force/rotational-drag stabilization, no ' +
        'self-collision, no head-death-on-ground rule. Shape-memory pull was ported -- no longer a gap.'
    );

    const template = ShapeFactory.create(ShapeType.CUBE, 'parity-template');
    const cpuOrg = structuredClone(template);
    const gpuOrg = structuredClone(template);

    // --- CPU RUN ---
    const cpuEngine = new BioPhysicsEngine();
    let cpuTime = 0;
    for (let i = 0; i < FRAMES; i++) {
        cpuTime += DT;
        cpuEngine.updateOrganism(cpuOrg, cpuTime, false);
        if (CHECKPOINTS.includes(i + 1)) {
            showDiagnosticOverlay(describeYRange(cpuOrg, `CPU @frame${i + 1}`));
        }
    }
    const cpuFinite = isFinitePosition(cpuOrg);
    showDiagnosticOverlay(`CPU after ${FRAMES} frames: alive=${cpuOrg.isAlive} finite=${cpuFinite} ${describeYRange(cpuOrg, 'yRange')}`);
    showDiagnosticOverlay(describeMuscleAnomalies(cpuOrg, 'CPU muscles'));

    // --- GPU RUN ---
    // Deliberately a throwaway GpuBridge (its own device/context/buffers), never shared with
    // the live simulation's GpuBridge, so this check can run at any time without disturbing it.
    const gpu = new GpuBridge();
    const gpuReady = await gpu.initialize();
    if (!gpuReady) {
        showDiagnosticOverlay('GPU not available on this device — skipping GPU side of the parity check.');
        showDiagnosticOverlay('=== PARITY HARNESS END ===');
        return;
    }

    gpu.syncPopulation([gpuOrg], DT);
    const cfg = ENGINE_CONFIG.physics;
    for (let i = 0; i < FRAMES; i++) {
        await gpu.executeStep([gpuOrg], DT, cfg.gravity, cfg.globalStiffness, ENGINE_CONFIG.neural.visionRadius, {
            substeps: 4,
            gripDepletionRate: cfg.gripDepletionRate,
            gripRechargeRate: cfg.gripRechargeRate,
            maxGripStress: cfg.maxGripStress,
            gripCooldown: cfg.gripCooldown,
            staticFrictionThreshold: cfg.staticFrictionThreshold,
            muscleSignalLimit: cfg.muscleSignalLimit,
            muscleSoftness: cfg.muscleSoftness,
            maxVelocity: cfg.maxVelocity,
            slipFactor: cfg.slipFactor,
            brokenSlipFactor: cfg.brokenSlipFactor,
            waveFreq: cfg.waveFreq,
            waveAmp: cfg.waveAmp,
            maxYieldRatio: cfg.maxYieldRatio,
            globalDamping: cfg.globalDamping,
            terminalVelocity: cfg.terminalVelocity,
            baseMuscleDamping: cfg.baseMuscleDamping,
            constraintIterations: cfg.iterations,
            contractionSpeed: cfg.contractionSpeed,
            antiSingularityRadius: cfg.antiSingularityRadius,
            relaxationFactor: cfg.relaxationFactor,
            shapeMemoryStrength: cfg.shapeMemoryStrength,
        });
        if (CHECKPOINTS.includes(i + 1)) {
            showDiagnosticOverlay(describeYRange(gpuOrg, `GPU @frame${i + 1}`));
        }
    }
    const gpuFinite = isFinitePosition(gpuOrg);
    showDiagnosticOverlay(`GPU after ${FRAMES} frames: finite=${gpuFinite} ${describeYRange(gpuOrg, 'yRange')}`);
    showDiagnosticOverlay(describeMuscleAnomalies(gpuOrg, 'GPU muscles'));

    // --- VERDICT ---
    // "Standing" is a coarse, deliberately generous invariant: the head is still well above the
    // floor. It's a sanity check, not a precision check — see the skill doc for tighter checks
    // to add once the current collapse-family of bugs is fully resolved.
    const cpuStanding = cpuFinite && (cpuOrg.headNode?.pos.y ?? 0) > 0.3;
    const gpuStanding = gpuFinite && (gpuOrg.headNode?.pos.y ?? 0) > 0.3;
    showDiagnosticOverlay(
        `VERDICT: cpuStanding=${cpuStanding} gpuStanding=${gpuStanding} — ${cpuStanding === gpuStanding ? 'AGREE' : 'DIVERGE'}`
    );
    showDiagnosticOverlay('=== PARITY HARNESS END ===');
}
