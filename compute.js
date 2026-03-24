import { fetch_shader } from './utils.js';

async function main() {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    device.lost.then(() => {
        console.log("device lost");
    });

    device.addEventListener("uncapturederror", (event) => {
        console.log(`Uncaptured WebGPU error: ${event.error.message}`);
    });

    // Get the DOM element we'll use to display the value.
    const display_element = document.getElementById('d');

    // Create a shader module.
    let code = await fetch_shader('compute.wgsl');
    let module = device.createShaderModule({ code });

    let pipeline = device.createComputePipeline({ // GPURenderPipelineDescriptor
        layout: "auto",
        compute: { // GPUProgrammableStage
            module,
        }
    });

    // Create a buffer for the compute shader to update.
    let value_buffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });

    // Create a readback buffer so we can see what the compute shader did.
    let readback_buffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    // Create a bind group pointing at the two buffers.
    let bindgroup = device.createBindGroup({ // GPUBindGroupDescriptor
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { // GPUBindGroupEntry
                binding: 0,
                resource: { // GPUBufferBinding
                    buffer: value_buffer,
                }
            },
        ]            
    });

    // Map the value buffer, and fill in the initial values.
    {
        let value_buffer_range = value_buffer.getMappedRange();
        let f = new Float32Array(value_buffer_range);
        f[0] = 0.125;
        value_buffer.unmap();
    }

    function increment() {
        let encoder = device.createCommandEncoder();

        // Increment the value in value_buffer.
        let compute_pass_encoder = encoder.beginComputePass();
        compute_pass_encoder.setPipeline(pipeline);
        compute_pass_encoder.setBindGroup(0, bindgroup);
        compute_pass_encoder.dispatchWorkgroups(1);
        compute_pass_encoder.end();

        // Copy the value buffer to the readback buffer.
        encoder.copyBufferToBuffer(value_buffer, readback_buffer, 4);
        let command_buffer = encoder.finish();

        device.queue.submit([command_buffer]);
    }

    function frame() {
        device.pushErrorScope("validation");
        increment();
        device.popErrorScope()
            .then((error) => {
                if (error) {
                    console.log(`error: ${error.message}`);
                }
            });
        device.queue.onSubmittedWorkDone()
            .then(() => {
                readback_buffer.mapAsync(GPUMapMode.READ)
                    .then(() => {
                        let value_range = readback_buffer.getMappedRange();
                        let f = new Float32Array(value_range);
                        display_element.textContent = `Compute: ${f[0].toFixed(3)}`;
                        if (f[0] >= 10) {
                            device.destroy();
                            return;
                        }
                        readback_buffer.unmap();
                        frame();
                    });
            });
    }

    frame();
}

export default main;
