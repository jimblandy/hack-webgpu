import triangle from './triangle.js';
import compute from './compute.js';

const hacks = {
    triangle,
    compute,
};

const params = new URLSearchParams(window.location.search);
const entry_point = hacks[params.get('hack') || "triangle"];
entry_point();
