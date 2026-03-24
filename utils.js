export async function fetch_shader(url) {
    let response = await fetch(url);
    if (!response.ok) {
        throw new Error(`fetching shader failed: ${response.status}`);
    }
    return await response.text();
}
