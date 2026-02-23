const PI = 3.14159265359;

struct U {
  time : f32,
  w : f32,
  h : f32,
  camDist : f32,
  yaw : f32,
  pitch : f32,
  pad0 : f32,
  pad1 : f32
};
@group(0) @binding(0) var<uniform> u : U;

fn rotY(v: vec3<f32>, a: f32) -> vec3<f32> {
  let c = cos(a);
  let s = sin(a);
  return vec3(c*v.x + s*v.z, v.y, -s*v.x + c*v.z);
}

fn rotX(v: vec3<f32>, a: f32) -> vec3<f32> {
  let c = cos(a);
  let s = sin(a);
  return vec3(v.x, c*v.y - s*v.z, s*v.y + c*v.z);
}

fn kaleido(p: vec3<f32>) -> vec3<f32> {
  var v = abs(p);
  let slices = 8.0;
  let a = atan2(v.y, v.x);
  let r = length(v.xy);
  let sector = 2.0 * PI / slices;
  let ang = abs(fract(a / sector) * sector - sector * 0.5);
  v.x = cos(ang) * r;
  v.y = sin(ang) * r;
  return v;
}

fn mandelbulb(p0: vec3<f32>) -> vec2<f32> {
  var z = p0;
  var dr = 1.0;
  var r = 0.0;
  var it = 0.0;

  for (var i = 0; i < 14; i++) {
    r = length(z);
    if (r > 8.0) { break; }
    r = max(r, 1e-6);

    let theta = acos(clamp(z.z / r, -1.0, 1.0));
    let phi = atan2(z.y, z.x);

    dr = pow(r, 7.0) * 8.0 * dr + 1.0;

    let zr = pow(r, 8.0);
    z = zr * vec3(
      sin(theta*8.0)*cos(phi*8.0),
      sin(theta*8.0)*sin(phi*8.0),
      cos(theta*8.0)
    ) + p0;

    it += 1.0;
  }

  let d = 0.5 * log(r) * r / dr;
  return vec2(max(d, 0.00002), it);
}

fn calcNormal(p: vec3<f32>) -> vec3<f32> {
  let e = 0.0006;
  let dx = mandelbulb(p + vec3(e,0,0)).x - mandelbulb(p - vec3(e,0,0)).x;
  let dy = mandelbulb(p + vec3(0,e,0)).x - mandelbulb(p - vec3(0,e,0)).x;
  let dz = mandelbulb(p + vec3(0,0,e)).x - mandelbulb(p - vec3(0,0,e)).x;
  return normalize(vec3(dx, dy, dz));
}

fn palette(t: f32) -> vec3<f32> {
  return 0.5 + 0.5 * cos(2.0*PI*(vec3(0.2,0.45,0.8)+t));
}

@fragment
fn fs(@builtin(position) p: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = (p.xy / vec2(u.w, u.h)) * 2.0 - 1.0;
  let uvn = vec2(uv.x * (u.w/u.h), uv.y);

  let scale = max(u.camDist * 0.15, 1.0);

  let roBase = vec3(0.0, 0.0, -u.camDist);
  let ro = rotY(rotX(roBase, u.pitch), u.yaw) / scale;
  let rd = normalize(rotY(rotX(vec3(uvn, 1.8), u.pitch), u.yaw));

  var t = 0.0;
  var it = 0.0;
  var hit = false;

  for (var i = 0; i < 200; i++) {
    let pos = kaleido(ro + rd * t);
    let d = mandelbulb(pos);
    t += d.x * 0.85;
    it = d.y;
    if (d.x < 0.00012) { hit = true; break; }
    if (t > 320.0) { break; }
  }

  var col = vec3(0.0);

  if (hit) {
    let pos = kaleido(ro + rd * t);
    let n = calcNormal(pos);
    let lightDir = normalize(vec3(0.6, 0.7, -0.4));

    let diff = max(dot(n, lightDir), 0.0);
    let spec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 32.0);

    let base = palette(it * 0.05 + u.time * 0.08);
    col = base * diff + spec * 0.8;
  }

  let fog = exp(-t * 0.045);
  col *= fog;

  col = pow(col, vec3(1.0/2.2)); 

  return vec4(col, 1.0);
}
