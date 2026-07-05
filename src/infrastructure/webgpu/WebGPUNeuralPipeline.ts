import { WebGPUContext } from './WebGPUContext';
import { SimulationMemory } from './SimulationMemory';
import { neuralComputeShader } from './WGSLNeural';

/**
 * @propolis
 * {
 *   "role": "PIPELINE",
 *   "dependencies": ["./WebGPUContext", "./SimulationMemory", "./WGSLNeural"],
 *   "constraints": ["C-001", "C-002"],
 *   "agent_instructions": "Orchestrates thousands of parallel CPG/Brain computations. Genome weights must be copied to GPU storage buffers before execution."
 * }
 */
export class WebGPUNeuralPipeline {
    private context: WebGPUContext;
    private memory: SimulationMemory;

    private pipelineBrains!: GPUComputePipeline;
    private pipelineCopy!: GPUComputePipeline;
    private bindGroupLayout!: GPUBindGroupLayout;
    private bindGroup!: GPUBindGroup;

    public uniformBuffer!: GPUBuffer;
    public cpgBufferA!: GPUBuffer;
    public cpgBufferB!: GPUBuffer;
    public brainWeightsBuffer!: GPUBuffer;
    public networkParamsBuffer!: GPUBuffer;
    public muscOscBuffer!: GPUBuffer;
    
    // Vision buffers
    public foodBuffer!: GPUBuffer;
    public headNodeIdxBuffer!: GPUBuffer;
    public nodePositionsBuffer!: GPUBuffer;

    constructor(context: WebGPUContext, memory: SimulationMemory) {
        this.context = context;
        this.memory = memory;
    }

    public async initialize(uniformBuffer: GPUBuffer, oscBuffer: GPUBuffer, posBuffer: GPUBuffer): Promise<void> {
        if (!this.context.device) throw new Error("Initialize context first");
        const device = this.context.device;

        this.uniformBuffer = uniformBuffer;
        this.muscOscBuffer = oscBuffer;
        this.nodePositionsBuffer = posBuffer;

        const shaderModule = device.createShaderModule({
            label: 'Neural Compute Module',
            code: neuralComputeShader,
        });

        // Explicit shared bind group layout — see the equivalent comment in
        // WebGPUPhysicsPipeline.ts. `computeBrains` and `copyCPG` reference different subsets
        // of these bindings; `layout: 'auto'` on just one of them isn't a valid layout for both.
        this.bindGroupLayout = device.createBindGroupLayout({
            label: 'Neural Bind Group Layout',
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 7, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 8, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
            ],
        });

        const pipelineLayout = device.createPipelineLayout({
            label: 'Neural Pipeline Layout',
            bindGroupLayouts: [this.bindGroupLayout],
        });

        this.pipelineBrains = device.createComputePipeline({
            layout: pipelineLayout,
            compute: { module: shaderModule, entryPoint: 'computeBrains' },
        });

        this.pipelineCopy = device.createComputePipeline({
            layout: pipelineLayout,
            compute: { module: shaderModule, entryPoint: 'copyCPG' },
        });

        this.allocateGPUBuffers();
        this.createBindGroup();
    }

    private allocateGPUBuffers() {
        this.cpgBufferA = this.context.createStorageBuffer(this.memory.cpgBufferA, 'CPG Buffer A');
        this.cpgBufferB = this.context.createStorageBuffer(this.memory.cpgBufferB, 'CPG Buffer B');
        this.brainWeightsBuffer = this.context.createStorageBuffer(this.memory.brainWeights, 'Brain Weights');
        this.networkParamsBuffer = this.context.createStorageBuffer(this.memory.networkParams, 'Network Params');
        
        this.foodBuffer = this.context.createStorageBuffer(this.memory.foodPositions, 'Food Positions');
        this.headNodeIdxBuffer = this.context.createStorageBuffer(this.memory.headNodeIndices, 'Head Node Indices');
    }

    public refreshGenomes() {
        this.context.updateBuffer(this.brainWeightsBuffer, this.memory.brainWeights);
        this.context.updateBuffer(this.networkParamsBuffer, this.memory.networkParams);
    }
    
    public refreshDynamicSensors() {
        this.context.updateBuffer(this.foodBuffer, this.memory.foodPositions);
        this.context.updateBuffer(this.headNodeIdxBuffer, new Float32Array(this.memory.headNodeIndices.buffer));
    }

    private createBindGroup() {
        const device = this.context.device!;
        this.bindGroup = device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: { buffer: this.cpgBufferA } },
                { binding: 2, resource: { buffer: this.cpgBufferB } },
                { binding: 3, resource: { buffer: this.brainWeightsBuffer } },
                { binding: 4, resource: { buffer: this.networkParamsBuffer } },
                { binding: 5, resource: { buffer: this.muscOscBuffer } },
                { binding: 6, resource: { buffer: this.foodBuffer } },
                { binding: 7, resource: { buffer: this.headNodeIdxBuffer } },
                { binding: 8, resource: { buffer: this.nodePositionsBuffer } },
            ],
        });
    }

    /**
     * @logic_seal
     * {
     *   "intent": "Execute the neural compute shader and sync CPG double-buffers.",
     *   "agent_instructions": "Ensure workgroup size matches the population total divided by 64."
     * }
     */
    public executeFrame(): void {
        const device = this.context.device;
        if (!device || this.memory.activeOrganismCount === 0) return;

        const commandEncoder = device.createCommandEncoder();
        const pass = commandEncoder.beginComputePass();
        
        pass.setBindGroup(0, this.bindGroup);

        const orgGroups = Math.ceil(this.memory.activeOrganismCount / 64);
        pass.setPipeline(this.pipelineBrains);
        pass.dispatchWorkgroups(orgGroups);

        const copyGroups = Math.ceil((this.memory.activeOrganismCount * 20) / 64);
        pass.setPipeline(this.pipelineCopy);
        pass.dispatchWorkgroups(copyGroups);

        pass.end();
        device.queue.submit([commandEncoder.finish()]);
    }
}
