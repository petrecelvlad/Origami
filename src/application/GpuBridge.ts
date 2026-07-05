/**
 * @propolis
 * {
 *   "role": "BRIDGE",
 *   "dependencies": ["@infrastructure/webgpu", "@domain/types"],
 *   "constraints": ["C-001", "C-005"],
 *   "agent_instructions": "This bridge coordinates the CPU-to-GPU data flow. Ensure uniform buffers are synced before every neural computation."
 * }
 */
import { WebGPUContext, showDiagnosticOverlay } from '../infrastructure/webgpu/WebGPUContext';
import { SimulationMemory } from '../infrastructure/webgpu/SimulationMemory';
import { WebGPUPhysicsPipeline } from '../infrastructure/webgpu/WebGPUPhysicsPipeline';
import { WebGPUNeuralPipeline } from '../infrastructure/webgpu/WebGPUNeuralPipeline';
import { Organism } from '../domain/types';

/**
 * DIAGNOSTIC: reports one organism's node Y-position range so a vertical stretch/collapse
 * is directly visible in the overlay. Remove alongside every other "DIAGNOSTIC" tag once
 * the laptop bug is confirmed/fixed.
 */
function describeYRange(org: Organism, label: string): string {
    let min = Infinity;
    let max = -Infinity;
    for (const n of org.nodes) {
        if (n.pos.y < min) min = n.pos.y;
        if (n.pos.y > max) max = n.pos.y;
    }
    const headY = org.headNode ? org.headNode.pos.y.toFixed(3) : 'n/a';
    return `${label}: org=${org.id} nodeCount=${org.nodes.length} yMin=${min.toFixed(3)} yMax=${max.toFixed(3)} headY=${headY}`;
}

export class GpuBridge {
  public context: WebGPUContext;
  public memory: SimulationMemory;
  public physics!: WebGPUPhysicsPipeline;
  public neural!: WebGPUNeuralPipeline;
  public isActive = false;

  // DIAGNOSTIC: guards the one-time first-frame node/muscle count log below.
  // Remove alongside every other "DIAGNOSTIC" tag once the laptop bug is confirmed/fixed.
  private hasLoggedFirstFrame = false;

  constructor() {
    this.context = new WebGPUContext();
    this.memory = new SimulationMemory(20000, 40000);
    this.physics = new WebGPUPhysicsPipeline(this.context, this.memory);
    this.neural = new WebGPUNeuralPipeline(this.context, this.memory);
  }

  public async initialize(): Promise<boolean> {
    try {
      await this.context.initialize();
      if (this.context.device) {
        await this.physics.initialize();
        await this.neural.initialize(this.physics.uniformBuffer, this.physics.muscOscBuffer, this.physics.posBuffer);
        this.isActive = true;
        (window as any).__WGPU_ACTIVE__ = true;
        // DIAGNOSTIC: confirms this machine actually takes the GPU path at all.
        // Remove once the laptop bug is confirmed/fixed.
        showDiagnosticOverlay('GpuBridge.isActive = true (GPU path engaged)');
        return true;
      }
    } catch (e) {
      this.isActive = false;
      (window as any).__WGPU_ACTIVE__ = false;
      console.warn("GPU Fallback: WebGPU not available.", e);
      // DIAGNOSTIC: remove once the laptop bug is confirmed/fixed.
      showDiagnosticOverlay(`GpuBridge.isActive = false (exception during init: ${e instanceof Error ? e.message : String(e)})`);
      return false;
    }
    // DIAGNOSTIC: remove once the laptop bug is confirmed/fixed.
    showDiagnosticOverlay('GpuBridge.isActive = false (context.device was null, no exception thrown)');
    return false;
  }

  public syncPopulation(population: Organism[], dt: number) {
    if (!this.isActive) return;
    this.memory.syncFromPopulation(population, dt);
    this.neural.refreshGenomes();
  }

  /**
   * @logic_seal
   * {
   *   "intent": "Orchestrate one simulation cycle across neural and physics GPU pipelines.",
   *   "agent_instructions": "Positions must be read back asynchronously to prevent CPU main thread blocking."
   * }
   */
  public async executeStep(
      population: Organism[], 
      dt: number, 
      gravity: number, 
      stiffness: number, 
      visionRadius: number,
      config: any
  ) {
    if (!this.isActive || !this.context.device) return;

    // DIAGNOSTIC: one-time log of the first real GPU frame's node/muscle/organism counts, and
    // the first organism's Y-position range before this frame's physics runs (i.e. the raw
    // spawn pose, untouched by GPU physics so far). Remove once the laptop bug is confirmed/fixed.
    const isFirstFrame = !this.hasLoggedFirstFrame;
    if (isFirstFrame) {
        this.hasLoggedFirstFrame = true;
        showDiagnosticOverlay(
            `First GPU frame: activeNodeCount=${this.memory.activeNodeCount} activeMuscleCount=${this.memory.activeMuscleCount} activeOrganismCount=${this.memory.activeOrganismCount}`
        );
        if (population[0]) {
            showDiagnosticOverlay(describeYRange(population[0], 'PRE-physics (raw spawn pose)'));
        }
    }

    // Fast sync dynamic elements (Head pos, Food pos)
    this.memory.syncDynamicSensors(population);
    this.neural.refreshDynamicSensors();

    // Run GPU pipelines
    this.neural.executeFrame();

    const substeps = config.substeps ?? 4;
    const subDt = dt / substeps;

    for (let i = 0; i < substeps; i++) {
        this.physics.executeFrame(
            subDt, 
            gravity, 
            stiffness, 
            visionRadius, 
            config.gripDepletionRate ?? 0.25, 
            config.gripRechargeRate ?? 0.05,
            config.maxGripStress ?? 10.0,
            config.gripCooldown ?? 60.0,
            config.staticFrictionThreshold ?? 0.2,
            config.muscleSignalLimit ?? 0.3,
            config.muscleSoftness ?? 0.05,
            config.maxVelocity ?? 30.0,
            config.slipFactor ?? 0.4,
            config.brokenSlipFactor ?? 0.8,
            config.waveFreq ?? 1.5,
            config.waveAmp ?? 0.15,
            config.maxYieldRatio ?? 1.5,
            config.globalDamping ?? 0.95,
            config.terminalVelocity ?? 100.0,
            config.baseMuscleDamping ?? 0.08,
            config.constraintIterations ?? 3,
            config.contractionSpeed ?? 5.0,
            config.antiSingularityRadius ?? 0.05,
            config.relaxationFactor ?? 0.8
        );
    }

    // Read back to CPU
    await this.physics.readPositionsFallbackAsync();
    this.memory.syncToPopulation(population);

    // DIAGNOSTIC: same organism's Y-range immediately after the first GPU-computed frame —
    // compare against the PRE-physics line above to see exactly what this frame did to it.
    // Remove once the laptop bug is confirmed/fixed.
    if (isFirstFrame && population[0]) {
        showDiagnosticOverlay(describeYRange(population[0], 'POST-physics (frame 1)'));
    }
  }
}
