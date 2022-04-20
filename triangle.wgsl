@group(0) @binding(0) var<uniform> big_xform: mat2x2<f32>;
@group(0) @binding(1) var<uniform> small_xform: mat2x2<f32>;

@vertex
fn vertex_shader(@location(0) center: vec2<f32>,
                 @location(1) corner: vec2<f32>)
                 -> @builtin(position) vec4<f32>
{
   let pos = big_xform * center + small_xform * corner;
   return vec4<f32>(pos.x, pos.y, 0.0, 1.0);
}

@fragment
fn blue() -> @location(0) vec4<f32> {
   return vec4<f32>(1.0, 0.0, 0.0, 1.0);
}
