/// <reference types="@webgpu/types" />

/**
 * PHASE 1: WebGPU Context & Adapter
 * Initializes the connection to the physical graphics card and provides
 * utility functions to push our SimulationMemory buffers into VRAM.
 */

/**
 * DIAGNOSTIC: renders diagnostic lines directly on-screen so they can be read off the
 * device without opening devtools. Remove this whole function once the laptop bug is
 * confirmed/fixed, along with every call site tagged "DIAGNOSTIC".
 *
 * Deliberately a single text node joined with " | " rather than one block/line per entry —
 * selecting and copying text that spans separate block elements or literal newlines pastes
 * as multiple Enter-separated lines, which truncates a paste into a terminal at the first line.
 */
function showDiagnosticOverlay(line: string): void {
    console.log(`[WebGPU Diagnostic] ${line}`);

    let overlay = document.getElementById('wgpu-diagnostic-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'wgpu-diagnostic-overlay';
        overlay.style.cssText = [
            'position:fixed', 'top:8px', 'left:8px', 'z-index:999999',
            'max-width:90vw', 'max-height:60vh', 'overflow:auto',
            'background:rgba(0,0,0,0.85)', 'color:#0f0',
            'font-family:monospace', 'font-size:12px', 'line-height:1.4',
            'padding:8px', 'border-radius:4px', 'white-space:normal', 'word-break:break-word',
        ].join(';');
        document.body.appendChild(overlay);
    }
    overlay.textContent = overlay.textContent ? `${overlay.textContent} | ${line}` : line;
}
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
        showDiagnosticOverlay(`adapter.maxStorageBuffersPerShaderStage = ${this.adapter.limits.maxStorageBuffersPerShaderStage}`);
        showDiagnosticOverlay(`adapter.maxStorageBufferBindingSize = ${this.adapter.limits.maxStorageBufferBindingSize}`);
        showDiagnosticOverlay(`adapter.maxBindGroups = ${this.adapter.limits.maxBindGroups}`);
        showDiagnosticOverlay(`adapter.maxComputeInvocationsPerWorkgroup = ${this.adapter.limits.maxComputeInvocationsPerWorkgroup}`);

        // Request the logical device to interact with the API
        this.device = await this.adapter.requestDevice();

        // DIAGNOSTIC: the limits actually granted to this device (may be lower than adapter.limits
        // above if not explicitly requested via requiredLimits). This is the one that matters —
        // if maxStorageBuffersPerShaderStage shows 8, that confirms the physics pipeline's 10
        // storage buffer bindings exceed what this device was granted. Remove once confirmed/fixed.
        showDiagnosticOverlay(`device.maxStorageBuffersPerShaderStage = ${this.device.limits.maxStorageBuffersPerShaderStage}`);
        showDiagnosticOverlay(`device.maxStorageBufferBindingSize = ${this.device.limits.maxStorageBufferBindingSize}`);
        showDiagnosticOverlay(`device.maxBindGroups = ${this.device.limits.maxBindGroups}`);
        showDiagnosticOverlay(`device.maxComputeInvocationsPerWorkgroup = ${this.device.limits.maxComputeInvocationsPerWorkgroup}`);

        // DIAGNOSTIC: surfaces validation errors (e.g. exceeding a limit) that WebGPU reports
        // asynchronously instead of throwing. Without this, a rejected bind group or pipeline
        // fails silently and the simulation just runs broken. Remove once confirmed/fixed.
        this.device.addEventListener('uncapturederror', (event) => {
            showDiagnosticOverlay(`UNCAPTURED GPU ERROR: ${(event as GPUUncapturedErrorEvent).error.message}`);
        });

        this.device.lost.then((info) => {
            showDiagnosticOverlay(`DEVICE LOST: ${info.reason} — ${info.message}`);
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
