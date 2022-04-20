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

    // Create a rendering pipeline that receives transformation matrices and
    // vertex positions from JS, and draws using a vertex
    // and fragment shader from `module`.
    let bindgroup_layout = device.createBindGroupLayout({ // GPUBindGroupLayoutDescriptor
        entries: [
            { // GPUBindGroupLayoutEntry
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { // GPUBufferBindingLayout
                    type: "uniform",
                    minBindingSize: 64,
                }
            },
            { // GPUBindGroupLayoutEntry
                binding: 1,
                visibility: GPUShaderStage.VERTEX,
                buffer: { // GPUBufferBindingLayout
                    type: "uniform",
                    minBindingSize: 64,
                }
            }
        ]
    });
    
    let pipeline_layout = device.createPipelineLayout({ // GPUPipelineLayoutDescriptor
        bindGroupLayouts: [bindgroup_layout]
    });
    let pipeline = device.createRenderPipeline({ // GPURenderPipelineDescriptor
        layout: pipeline_layout,
        vertex: { // GPUVertexState
            module,
            entryPoint: 'vertex_shader',
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
                },
                { // GPUVertexBufferLayout
                    arrayStride: 8,
                    attributes: [
                        { // GPUVertexAttribute
                            format: 'float32x2',
                            offset: 0,
                            shaderLocation: 1,
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
    
    // Create buffers to hold the transformation matrices.
    let big_xform_buffer = device.createBuffer({
        size: 4 * 2 * 2,
        usage: GPUBufferUsage.UNIFORM,
        mappedAtCreation: true,
    });
    {
        let array_buffer = big_xform_buffer.getMappedRange();
        let floats = new Float32Array(array_buffer);
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                let index = i * 2 + j;
                floats[index] = i == j ? 1 : 0;
            }
        }
        big_xform_buffer.unmap();
    }

    let small_xform_buffer = device.createBuffer({
        size: 4 * 2 * 2,
        usage: GPUBufferUsage.UNIFORM,
        mappedAtCreation: true,
    });
    {
        let array_buffer = small_xform_buffer.getMappedRange();
        let floats = new Float32Array(array_buffer);
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                let index = i * 2 + j;
                floats[index] = i == j ? 1 : 0;
            }
        }
        small_xform_buffer.unmap();
    }

    // Create a bind group to hold the two buffers.
    let bindgroup = device.createBindGroup({ // GPUBindGroupDescriptor
        layout: bindgroup_layout,
        entries: [
            { // GPUBindGroupEntry
                binding: 0,
                resource: { // GPUBufferBinding
                    buffer: big_xform_buffer,
                }
            },
            { //GPUBindGroupEntry
                binding: 1,
                resource: { // GPUBufferBinding
                    buffer: small_xform_buffer,
                }
            },
        ]            
    });

    // Create two buffers to hold the `center` and `corner` vertex attributes.
    let center_buffer = device.createBuffer({
        size: 4 * 2 * 3 * 3, 
        usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.VERTEX
    });
    let corner_buffer = device.createBuffer({
        size: 4 * 2 * 3 * 3, 
        usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.VERTEX
    });

    // Map the center buffer, and fill in the coordinates.
    {
        await center_buffer.mapAsync(GPUMapMode.WRITE);
        let array_buffer = center_buffer.getMappedRange();
        let floats = new Float32Array(array_buffer);
        for (let i = 0; i < 3; i++) {
            let angle_i = i * 2 / 3 * Math.PI;
            for (let j = 0; j < 3; j++) {
                let index = (i * 3 + j) * 2;
                floats[index + 0] = 0.5 * Math.cos(angle_i);
                floats[index + 1] = 0.5 * Math.sin(angle_i);
            }
        }
        center_buffer.unmap();
    }

    // Map the corner buffer, and fill in the coordinates.
    {
        await corner_buffer.mapAsync(GPUMapMode.WRITE);
        let array_buffer = corner_buffer.getMappedRange();
        let floats = new Float32Array(array_buffer);
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                let index = (i * 3 + j) * 2;
                let angle_j = j * 2 / 3 * Math.PI;
                floats[index + 0] = 0.5 * Math.cos(angle_j);
                floats[index + 1] = 0.5 * Math.sin(angle_j);
            }
        }
        corner_buffer.unmap();
    }

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
    render_pass_encoder.setBindGroup(0, bindgroup);
    render_pass_encoder.setVertexBuffer(0, center_buffer);
    render_pass_encoder.setVertexBuffer(1, corner_buffer);
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
