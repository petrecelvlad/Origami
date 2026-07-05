import { WebGPUContext } from './WebGPUContext';
import { SimulationMemory } from './SimulationMemory';
import { physicsComputeShader } from './WGSLShaders';

/**
 * Connects the Javascript arrays to the WGSL Physics Shaders.
 */
/**
 * @propolis
 * {
 *   "role": "PIPELINE",
 *   "dependencies": ["./WebGPUContext", "./SimulationMemory", "./WGSLShaders"],
 *   "constraints": ["C-001", "C-002"],
 *   "agent_instructions": "This pipeline executes Verlet integration on the GPU. Do not modify group sizes (64) without re-validating hardware occupancy."
 * }
 */
export class WebGPUPhysicsPipeline {
    private context: WebGPUContext;
    private memory: SimulationMemory;

    private pipelineClear!: GPUComputePipeline;
    private pipelineMuscles!: GPUComputePipeline;
    private pipelineIntegrate!: GPUComputePipeline;
    private pipelineCalcConstraints!: GPUComputePipeline;
    private pipelineApplyConstraints!: GPUComputePipeline;

    private bindGroup!: GPUBindGroup;

    // GPU Buffers
    public uniformBuffer!: GPUBuffer;
    public posBuffer!: GPUBuffer;
    public velBuffer!: GPUBuffer;
    public propBuffer!: GPUBuffer;
    public muscIdxBuffer!: GPUBuffer;
    public muscPropBuffer!: GPUBuffer;
    public muscOscBuffer!: GPUBuffer;
    public gripBuffer!: GPUBuffer;

    private forceXBuffer!: GPUBuffer;
    private forceYBuffer!: GPUBuffer;
    private forceZBuffer!: GPUBuffer;

    private posReadBuffer!: GPUBuffer;
    private gripReadBuffer!: GPUBuffer;

    constructor(context: WebGPUContext, memory: SimulationMemory) {
        this.context = context;
        this.memory = memory;
    }

    public async initialize(): Promise<void> {
        if (!this.context.device) throw new Error("Initialize context first");

        const device = this.context.device;

        // Compile Shader Module
        const shaderModule = device.createShaderModule({
            label: 'Physics Compute Module',
            code: physicsComputeShader,
        });

        // Create the 3 entry points (Passes)
        this.pipelineClear = device.createComputePipeline({
            layout: 'auto',
            compute: { module: shaderModule, entryPoint: 'clearForces' },
        });

        this.pipelineMuscles = device.createComputePipeline({
            layout: 'auto',
            compute: { module: shaderModule, entryPoint: 'calcMuscleForces' },
        });

        this.pipelineIntegrate = device.createComputePipeline({
            layout: 'auto',
            compute: { module: shaderModule, entryPoint: 'integrateNodes' },
        });

        this.pipelineCalcConstraints = device.createComputePipeline({
            layout: 'auto',
            compute: { module: shaderModule, entryPoint: 'calcConstraints' },
        });

        this.pipelineApplyConstraints = device.createComputePipeline({
            layout: 'auto',
            compute: { module: shaderModule, entryPoint: 'applyConstraints' },
        });

        this.allocateGPUBuffers();
        this.createBindGroup();
    }

    private allocateGPUBuffers() {
        const device = this.context.device!;
        
        // Uniforms (Size = 28 floats = 112 bytes)
        this.uniformBuffer = device.createBuffer({
            label: 'Params Uniform',
            size: 112,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Main Simulation Buffers
        this.posBuffer = this.context.createStorageBuffer(this.memory.nodePositions, 'Positions');
        this.velBuffer = this.context.createStorageBuffer(this.memory.nodeVelocities, 'Velocities');
        this.propBuffer = this.context.createStorageBuffer(this.memory.nodeProperties, 'Node Props');

        this.muscIdxBuffer = this.context.createStorageBuffer(this.memory.muscleIndices, 'Muscle Indices');
        this.muscPropBuffer = this.context.createStorageBuffer(this.memory.muscleProperties, 'Muscle Props');
        this.muscOscBuffer = this.context.createStorageBuffer(this.memory.muscleOscillators, 'Muscle Osc');
        this.gripBuffer = this.context.createStorageBuffer(this.memory.nodeGripState, 'Node Grip');

        // Atomic Force Buffers (Int32 matches Float32 size natively)
        const atomicSize = this.memory.maxNodes * 4; // 4 bytes per Int32
        const createAtomic = (label: string) => device.createBuffer({
            label, size: atomicSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        this.forceXBuffer = createAtomic('ForceX');
        this.forceYBuffer = createAtomic('ForceY');
        this.forceZBuffer = createAtomic('ForceZ');

        // Reading back node positions
        this.posReadBuffer = this.context.createReadbackBuffer(this.memory.nodePositions.byteLength, 'PosReadback');
        this.gripReadBuffer = this.context.createReadbackBuffer(this.memory.nodeGripState.byteLength, 'GripReadback');
    }

    private createBindGroup() {
        const device = this.context.device!;
        
        this.bindGroup = device.createBindGroup({
            layout: this.pipelineClear.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: { buffer: this.posBuffer } },
                { binding: 2, resource: { buffer: this.velBuffer } },
                { binding: 3, resource: { buffer: this.propBuffer } },
                { binding: 4, resource: { buffer: this.muscIdxBuffer } },
                { binding: 5, resource: { buffer: this.muscPropBuffer } },
                { binding: 6, resource: { buffer: this.muscOscBuffer } },
                { binding: 7, resource: { buffer: this.forceXBuffer } },
                { binding: 8, resource: { buffer: this.forceYBuffer } },
                { binding: 9, resource: { buffer: this.forceZBuffer } },
                { binding: 10, resource: { buffer: this.gripBuffer } },
            ],
        });
    }

    /**
     * Triggers the GPU to crunch the physics math for a single frame.
     */
    /**
     * @logic_seal
     * {
     *   "intent": "Dispatch the 3-pass physics kernel: Force Clear -> Muscle Calculation -> Integration.",
     *   "agent_instructions": "Atomic buffers must be mapped to Int32 for force accumulation to prevent race conditions."
     * }
     */
    public executeFrame(
        dt: number, 
        gravity: number, 
        stiffness: number, 
        visionRadius: number,
        gripDepletionRate: number,
        gripRechargeRate: number,
        maxGripStress: number = 10.0,
        gripCooldown: number = 60.0,
        staticFrictionThreshold: number = 0.2,
        muscleSignalLimit: number = 0.3,
        muscleSoftness: number = 0.05,
        maxVelocity: number = 30.0,
        slipFactor: number = 0.4,
        brokenSlipFactor: number = 0.8,
        waveFreq: number = 1.5,
        waveAmp: number = 0.15,
        maxYieldRatio: number = 1.5,
        globalDamping: number = 0.95,
        terminalVelocity: number = 100.0,
        localDamping: number = 0.08,
        constraintIterations: number = 3,
        contractionSpeed: number = 5.0,
        antiSingularityRadius: number = 0.05,
        relaxationFactor: number = 0.25
    ): void {
        const device = this.context.device;
        if (!device) return;

        const numNodes = this.memory.activeNodeCount;
        const numMuscles = this.memory.activeMuscleCount;

        if (numNodes === 0) return;

        // Keep a JS local copy of time for the shader
        if ((this as any).simTime === undefined) (this as any).simTime = 0;
        (this as any).simTime += dt;

        // 1. Write the uniform params to the GPU fast-memory cache
        // SimParams struct (112 bytes = 28 floats)
        const paramsArray = new Float32Array([
            dt, gravity, stiffness, 
            0, // Float placeholder for numNodes (offset 12)
            
            0, // numMuscles placeholder (offset 16)
            0, // numOrganisms placeholder (offset 20)
            (this as any).simTime, 
            gripDepletionRate,

            gripRechargeRate,
            visionRadius,
            maxGripStress,
            gripCooldown,

            staticFrictionThreshold,
            muscleSignalLimit,
            muscleSoftness,
            maxVelocity,

            slipFactor,
            brokenSlipFactor,
            waveFreq,
            waveAmp,

            maxYieldRatio,
            globalDamping,
            terminalVelocity,
            localDamping,

            contractionSpeed,
            antiSingularityRadius,
            relaxationFactor, // 104
            0  // padding
        ]);
        device.queue.writeBuffer(this.uniformBuffer, 0, paramsArray);
        
        const uintParams = new Uint32Array([numNodes, numMuscles, this.memory.activeOrganismCount]);
        device.queue.writeBuffer(this.uniformBuffer, 12, uintParams); // Offset 12 bytes

        // 2. Dispatch commands to the Graphic Card Scheduler
        const commandEncoder = device.createCommandEncoder();
        const pass = commandEncoder.beginComputePass();
        
        pass.setBindGroup(0, this.bindGroup);

        // Group Size: 64 threads per block. We divide total entities by 64.
        const workGroupsNodes = Math.ceil(numNodes / 64);
        const workGroupsMuscles = Math.ceil(numMuscles / 64);

        // A. Clear the accumulated atomic forces
        pass.setPipeline(this.pipelineClear);
        pass.dispatchWorkgroups(workGroupsNodes);

        // B. Calculate springs for every muscle simultaneously
        if (numMuscles > 0) {
            pass.setPipeline(this.pipelineMuscles);
            pass.dispatchWorkgroups(workGroupsMuscles);
        }

        // C. Integrate Velocities and Positions
        pass.setPipeline(this.pipelineIntegrate);
        pass.dispatchWorkgroups(workGroupsNodes);

        // PBD ITERATIONS
        for (let j = 0; j < constraintIterations; j++) {
            // D. Clear forces buffers again to reuse them for position constraint deltas!
            pass.setPipeline(this.pipelineClear);
            pass.dispatchWorkgroups(workGroupsNodes);

            // E. Calculate Position Based Dynamics Constraints
            if (numMuscles > 0) {
                pass.setPipeline(this.pipelineCalcConstraints);
                pass.dispatchWorkgroups(workGroupsMuscles);
            }

            // F. Apply constraints (correcting positions and velocities)
            pass.setPipeline(this.pipelineApplyConstraints);
            pass.dispatchWorkgroups(workGroupsNodes);
        }

        pass.end();

        // 3. Command the GPU to copy the calculated positions into the Staging Buffer
        commandEncoder.copyBufferToBuffer(
            this.posBuffer, 0,
            this.posReadBuffer, 0,
            this.memory.nodePositions.byteLength
        );
        commandEncoder.copyBufferToBuffer(
            this.gripBuffer, 0,
            this.gripReadBuffer, 0,
            this.memory.nodeGripState.byteLength
        );

        // 4. Fire the job off into the ether
        device.queue.submit([commandEncoder.finish()]);
    }

    /**
     * Halts Javascript execution until the GPU has finished writing memory,
     * then pulls the array back to Javascript.
     */
    public async readPositionsFallbackAsync(): Promise<void> {
        if (!this.context.device) return;

        // Map for reading
        await Promise.all([
            this.posReadBuffer.mapAsync(GPUMapMode.READ),
            this.gripReadBuffer.mapAsync(GPUMapMode.READ)
        ]);
        
        // Copy the raw bites back into Javascript context
        const arrayBuffer = this.posReadBuffer.getMappedRange();
        const gpuPositions = new Float32Array(arrayBuffer);
        this.memory.nodePositions.set(gpuPositions);

        const gripArrayBuffer = this.gripReadBuffer.getMappedRange();
        const gpuGrip = new Float32Array(gripArrayBuffer);
        this.memory.nodeGripState.set(gpuGrip);
        
        // Unmap the buffers so the GPU can use it again next frame
        this.posReadBuffer.unmap();
        this.gripReadBuffer.unmap();
    }
}
