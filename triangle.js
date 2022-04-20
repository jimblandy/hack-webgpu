main()

async function main() {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();

    device.pushErrorScope("validation");
    
    // Create a WebGPU context for the <canvas> element.
    let context = document.getElementById('c').getContext('webgpu');
    let format = context.getPreferredFormat(adapter);
    context.configure({ // GPUCanvasConfiguration
        device,
        format,
    });
    let texture = context.getCurrentTexture();
    let texture_view = texture.createView();
    
    // Create a shader module.
    let code = await fetch_shader('triangle.wgsl');
    let module = device.createShaderModule({ code });

    // Create a rendering pipeline that receives vertex positions from
    // JS, and draws using a vertex and fragment shader from `module`.
    let pipeline_layout = device.createPipelineLayout({ // GPUPipelineLayoutDescriptor
        bindGroupLayouts: []
    });
    let pipeline = device.createRenderPipeline({ // GPURenderPipelineDescriptor
        layout: pipeline_layout,
        vertex: { // GPUVertexState
            module,
            entryPoint: 'passthrough',
            buffers: [
                { // GPUVertexBufferLayout
                    arrayStride: 8,
                    attributes: [
                        { // GPUVertexAttribute
                            format: 'float32x2',
                            offset: 0,
                            shaderLocation: 0,
                        },
                    ]
                }
            ]
        },
        fragment: { // GPUFragmentState
            module,
            entryPoint: 'blue',
            targets: [{ // GPUColorTargetState
                format,
            }],
        }
    });
    
    // Create a buffer to hold the vertex coordinates.
    let buffer = device.createBuffer({
        size: 4 * 2 * 3 * 3, 
        usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.VERTEX
    });

    // Map the buffer, and fill in the coordinates.
    await buffer.mapAsync(GPUMapMode.WRITE);
    let array_buffer = buffer.getMappedRange();
    let floats = new Float32Array(array_buffer);
    for (let i = 0; i < 3; i++) {
        let angle_i = i * 2 / 3 * Math.PI;
        for (let j = 0; j < 3; j++) {
            let angle_j = j * 2 / 3 * Math.PI;
            let index = (i * 3 + j) * 2;
            floats[index + 0] = 250 + 125 * Math.cos(angle_i) + 62 * Math.cos(angle_j);
            floats[index + 1] = 250 + 125 * Math.sin(angle_i) + 62 * Math.sin(angle_j);
        }
    }
    buffer.unmap();

    // Record GPU commands to draw the triangles.
    let encoder = device.createCommandEncoder();
    let render_pass_encoder = encoder.beginRenderPass({ // GPURenderPassDescriptor
        colorAttachments: [
            { // GPURenderPassColorAttachment
                view: texture_view,
                loadValue: { r:0, g:0, b:0.5, a:1 }, // outdated
                storeOp: "store",
            }
        ]
    });
    render_pass_encoder.setPipeline(pipeline);
    render_pass_encoder.setVertexBuffer(0, buffer);
    render_pass_encoder.draw(9);
    render_pass_encoder.endPass();  // outdated
    let command_buffer = encoder.finish();

    device.queue.submit([command_buffer]);
    //await device.queue.onSubmittedWorkDone(); // unimplemented

    const error = await device.popErrorScope();
    if (error) {
        console.log(`error: ${error.message}`);
    } else {
        console.log("no errors");
    }
}

async function fetch_shader(url) {
    let response = await fetch(url);
    if (!response.ok) {
        throw new Error(`fetching shader failed: ${response.status}`);
    }
    return await response.text();
}
