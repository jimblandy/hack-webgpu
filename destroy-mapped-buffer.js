import { simple_device } from './utils.js';

async function main() {
    const { device } = await simple_device();

    // Create a buffer, map it, and then destroy it twice.
    const buffer = device.createBuffer({ size: 4, usage: GPUBufferUsage.MAP_WRITE });
    const map_promise = buffer.mapAsync(GPUMapMode.WRITE);
    buffer.destroy();
    buffer.destroy();
    await map_promise;
}

export default main;
