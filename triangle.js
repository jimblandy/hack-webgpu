const format = navigator.gpu.getPreferredCanvasFormat();
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
device.addEventListener("uncapturederror", (event) => {
    console.log(`Uncaptured WebGPU error: ${event.error.message}`);
});

// Create a WebGPU context for the <canvas> element.
let context = document.getElementById('c').getContext('webgpu');
context.configure({ // GPUCanvasConfiguration
    device,
    format,
});
let texture = context.getCurrentTexture();
let texture_view = texture.createView();

// Create a shader module.
let code = await fetch_shader('triangle.wgsl');
let module = device.createShaderModule({ code });

let pipeline = device.createRenderPipeline({ // GPURenderPipelineDescriptor
    layout: "auto",
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
// We will write these in each frame.
let big_xform_buffer = device.createBuffer({
    size: 4 * 2 * 2,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});

let small_xform_buffer = device.createBuffer({
    size: 4 * 2 * 2,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});

// Create a bind group pointing at the two buffers.
let bindgroup = device.createBindGroup({ // GPUBindGroupDescriptor
    layout: pipeline.getBindGroupLayout(0),
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
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
});
let corner_buffer = device.createBuffer({
    size: 4 * 2 * 3 * 3, 
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
});

// Map the center buffer, and fill in the coordinates.
{
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

// Return a Float32Array representing a rotation by `angle` degrees
// clockwise as a 2x2 column-major matrix.
function rotate(angle) {
    let a = new Float32Array(4);
    a[0] = Math.cos(angle);
    a[1] = Math.sin(angle);
    a[2] = -a[1];
    a[3] = a[0];

    return a;
}

function triangles(big_angle, small_angle) {
    // Initialize the transformation matrices.
    device.queue.writeBuffer(big_xform_buffer, 0, rotate(big_angle).buffer);
    device.queue.writeBuffer(small_xform_buffer, 0, rotate(small_angle).buffer);

    // Record GPU commands to draw the triangles.
    let encoder = device.createCommandEncoder();
    let render_pass_encoder = encoder.beginRenderPass({ // GPURenderPassDescriptor
        colorAttachments: [
            { // GPURenderPassColorAttachment
                view: texture_view,
                loadOp: "clear",
                storeOp: "store",
            }
        ]
    });
    render_pass_encoder.setPipeline(pipeline);
    render_pass_encoder.setBindGroup(0, bindgroup);
    render_pass_encoder.setVertexBuffer(0, center_buffer);
    render_pass_encoder.setVertexBuffer(1, corner_buffer);
    render_pass_encoder.draw(9);
    render_pass_encoder.end();
    let command_buffer = encoder.finish();

    device.queue.submit([command_buffer]);
    //await device.queue.onSubmittedWorkDone(); // unimplemented
}

function frame(timestamp) {
    device.pushErrorScope("validation");
    triangles(timestamp / 10000.0 * Math.PI / 4.0,
              timestamp / 10000.0 * Math.PI * 2.0);
    device.popErrorScope()
        .then((error) => {
            if (error) {
                console.log(`error: ${error.message}`);
            } else {
                window.requestAnimationFrame(frame);
            }
        });
}

window.requestAnimationFrame(frame);

async function fetch_shader(url) {
    let response = await fetch(url);
    if (!response.ok) {
        throw new Error(`fetching shader failed: ${response.status}`);
    }
    return await response.text();
}
