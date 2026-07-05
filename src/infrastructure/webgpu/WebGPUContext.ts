/// <reference types="@webgpu/types" />

/**
 * PHASE 1: WebGPU Context & Adapter
 * Initializes the connection to the physical graphics card and provides 
 * utility functions to push our SimulationMemory buffers into VRAM.
 */
/**
 * @propolis
 * {
 *   "role": "PIPELINE",
 *   "dependencies": [],
 *   "constraints": ["C-001"],
 *   "agent_instructions": "The WebGPU Context is the root of hardware acceleration. Ensure the high-performance adapter is requested to leverage dedicated GPUs."
 * }
 */
export class WebGPUContext {
    public device: GPUDevice | null = null;
    public adapter: GPUAdapter | null = null;

    /**
     * @logic_seal
     * {
     *   "intent": "Initialize the connection to the physical graphics card and verify browser support.",
     *   "agent_instructions": "Must return false gracefully to allow CPU fallback if navigator.gpu is missing."
     * }
     */
    public async initialize(): Promise<boolean> {
        if (!navigator.gpu) {
            console.warn("WebGPU is not supported by this browser. Defaulting to CPU Simulation.");
            return false;
        }

        // Request a high-performance adapter if available (Dedicated GPU)
        this.adapter = await navigator.gpu.requestAdapter({
            powerPreference: 'high-performance',
        });

        if (!this.adapter) {
            console.warn("Found navigator.gpu but failed to request an adapter.");
            return false;
        }

        // DIAGNOSTIC: adapter's actual supported limits vs. the defaults we're about to request.
        // The physics pipeline binds 10 storage buffers to one compute stage; the spec's
        // default maxStorageBuffersPerShaderStage is 8. Remove once the laptop bug is confirmed/fixed.
        console.log('[WebGPU Diagnostic] adapter.limits:', {
            maxStorageBuffersPerShaderStage: this.adapter.limits.maxStorageBuffersPerShaderStage,
            maxStorageBufferBindingSize: this.adapter.limits.maxStorageBufferBindingSize,
            maxBindGroups: this.adapter.limits.maxBindGroups,
            maxComputeInvocationsPerWorkgroup: this.adapter.limits.maxComputeInvocationsPerWorkgroup,
        });

        // Request the logical device to interact with the API
        this.device = await this.adapter.requestDevice();

        // DIAGNOSTIC: the limits actually granted to this device (may be lower than adapter.limits
        // above if not explicitly requested via requiredLimits). Remove once confirmed/fixed.
        console.log('[WebGPU Diagnostic] device.limits:', {
            maxStorageBuffersPerShaderStage: this.device.limits.maxStorageBuffersPerShaderStage,
            maxStorageBufferBindingSize: this.device.limits.maxStorageBufferBindingSize,
            maxBindGroups: this.device.limits.maxBindGroups,
            maxComputeInvocationsPerWorkgroup: this.device.limits.maxComputeInvocationsPerWorkgroup,
        });

        // DIAGNOSTIC: surfaces validation errors (e.g. exceeding a limit) that WebGPU reports
        // asynchronously instead of throwing. Without this, a rejected bind group or pipeline
        // fails silently and the simulation just runs broken. Remove once confirmed/fixed.
        this.device.addEventListener('uncapturederror', (event) => {
            console.error('[WebGPU Diagnostic] Uncaptured GPU error:', (event as GPUUncapturedErrorEvent).error);
        });

        this.device.lost.then((info) => {
            console.error('[WebGPU Diagnostic] Device lost:', info.reason, info.message);
        });

        console.log(`[WebGPU] Context Initialized. Running on Hardware Accelerated Device.`);

        return true;
    }

    /**
     * Allocates a memory buffer directly on the Graphic Card's VRAM.
     */
    public createStorageBuffer(data: Float32Array | Uint32Array, label: string = 'SimBuffer'): GPUBuffer {
        if (!this.device) throw new Error("WebGPU device not initialized.");

        const buffer = this.device.createBuffer({
            label,
            size: data.byteLength,
            // STORAGE: Can be read/written by Compute Shaders
            // COPY_DST: We can copy data from CPU to this buffer
            // COPY_SRC: We can pull data back to the CPU
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        // Instantiate with the first frame's data
        this.device.queue.writeBuffer(buffer, 0, data);
        
        return buffer;
    }

    /**
     * Allocates a staging buffer used specifically for downloading memory
     * back from VRAM to Javascript RAM.
     */
    public createReadbackBuffer(size: number, label: string = 'ReadbackBuffer'): GPUBuffer {
        if (!this.device) throw new Error("WebGPU device not initialized.");
        return this.device.createBuffer({
            label,
            size,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });
    }

    /**
     * Rapidly pushes a CPU array update to the GPU VRAM.
     */
    public updateBuffer(buffer: GPUBuffer, data: Float32Array | Uint32Array): void {
        if (!this.device) return;
        this.device.queue.writeBuffer(buffer, 0, data);
    }
}
