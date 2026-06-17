export async function fetch_shader(url) {
    let response = await fetch(url);
    if (!response.ok) {
        throw new Error(`fetching shader failed: ${response.status}`);
    }
    return await response.text();
}

export async function simple_device() {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    device.lost.then(() => {
        console.log("device lost");
    });

    device.addEventListener("uncapturederror", (event) => {
        console.log(`Uncaptured WebGPU error: ${event.error.message}`);
    });

    return { adapter, device };
}
