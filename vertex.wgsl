@vertex
fn vs(@builtin(vertex_index) i : u32) -> @builtin(position) vec4<f32> {
  let p = array<vec2<f32>,6>(
    vec2(-1,-1), vec2(1,-1), vec2(-1,1),
    vec2(-1,1), vec2(1,-1), vec2(1,1)
  );
  return vec4(p[i], 0.0, 1.0);
}