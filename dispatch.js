const params = new URLSearchParams(window.location.search);
const entry_point = params.get('hack') || "triangle";
if (!/[a-zA-Z0-9_-]+/.test(entry_point)) {
    throw new Error(`Weird entry point name: ${entry_point}`);
}
import(`./${entry_point}.js`).then((main) => { main.default() });
