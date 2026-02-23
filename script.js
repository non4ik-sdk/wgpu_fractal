async function main() {
  const canvas = document.getElementById("canvas");
  const fpsEl = document.getElementById("fps");

  function showWebGPUInstructions(extraMessage) {
    document.body.innerHTML = `
${extraMessage ? "<p style='color:red'>" + extraMessage + "</p>" : ""}

WebGPU is not available.

How to enable WebGPU:

Chrome / Chromium / Yandex Browser:
1. Open chrome://flags
2. Enable "Unsafe WebGPU" or "WebGPU Developer Features"
3. Make sure hardware acceleration is enabled in browser settings
4. Restart the browser

Edge:
1. Open edge://flags
2. Enable "Unsafe WebGPU"
3. Make sure hardware acceleration is enabled
4. Restart the browser

Firefox (Nightly):
1. Open about:config
2. Set gfx.webgpu.enabled = true
3. Set dom.webgpu.enabled = true
4. Ensure hardware acceleration is enabled

Also ensure:
- A compatible GPU is installed
- GPU drivers are up to date
- The browser is up to date
`;
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(innerWidth * dpr);
    const height = Math.floor(innerHeight * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = innerWidth + "px";
      canvas.style.height = innerHeight + "px";
    }
  }

  resizeCanvas();
  window.addEventListener("resize", function () {
    resizeCanvas();
  });

  if (!navigator.gpu) {
    showWebGPUInstructions("navigator.gpu is not available in this browser.");
    return;
  }

  async function loadShader(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to load shader: " + url);
    }
    return await response.text();
  }

  let vertexShaderCode;
  let fragmentShaderCode;

  try {
    const shaders = await Promise.all([
      loadShader("vertex.wgsl"),
      loadShader("fragment.wgsl")
    ]);
    vertexShaderCode = shaders[0];
    fragmentShaderCode = shaders[1];
  } catch (error) {
    document.body.innerHTML = `
<div style="color:red;padding:20px;">
  <p>Shader loading error: ${error.message}</p>
</div>
`;
    return;
  }

  console.log("Requesting GPU adapter...");
  const adapter = await navigator.gpu.requestAdapter();

  if (!adapter) {
    showWebGPUInstructions("No available GPU adapters were found.");
    return;
  }

  console.log("Requesting GPU device...");
  const device = await adapter.requestDevice();

  let context = canvas.getContext("webgpu");
  if (!context) {
    showWebGPUInstructions("Failed to acquire WebGPU context.");
    return;
  }

  const contextType = "webgpu";

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device: device,
    format: format,
    alphaMode: "opaque"
  });

  let yaw = 0.0;
  let pitch = 0.0;
  let distance = 5.0;

  const MIN_DIST = 1.1;
  const MAX_DIST = 6.0;

  let dragging = false;
  let lx = 0;
  let ly = 0;

  canvas.addEventListener("mousedown", function (e) {
    dragging = true;
    lx = e.clientX;
    ly = e.clientY;
  });

  window.addEventListener("mouseup", function () {
    dragging = false;
  });

  window.addEventListener("mousemove", function (e) {
    if (!dragging) return;

    const dx = e.clientX - lx;
    const dy = e.clientY - ly;
    lx = e.clientX;
    ly = e.clientY;

    yaw += dx * 0.005;
    pitch -= dy * 0.005;

    const lim = Math.PI * 0.49;
    if (pitch > lim) pitch = lim;
    if (pitch < -lim) pitch = -lim;
  });

  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    distance *= Math.exp(e.deltaY * 0.001);
    if (distance < MIN_DIST) distance = MIN_DIST;
    if (distance > MAX_DIST) distance = MAX_DIST;
  }, { passive: false });

  const uniformBuffer = device.createBuffer({
    size: 4 * 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  console.log("Creating shader modules...");

  const vertexShaderModule = device.createShaderModule({
    code: vertexShaderCode
  });

  const fragmentShaderModule = device.createShaderModule({
    code: fragmentShaderCode
  });

  console.log("Creating render pipeline...");

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: vertexShaderModule,
      entryPoint: "vs"
    },
    fragment: {
      module: fragmentShaderModule,
      entryPoint: "fs",
      targets: [{ format: format }]
    },
    primitive: { topology: "triangle-list" }
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
  });

  const vertexData = new Float32Array([
    -1, -1,
     1, -1,
     1,  1,
    -1, -1,
     1,  1,
    -1,  1
  ]);

  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  });

  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

  let lastFps = performance.now();
  let frames = 0;

  function frame() {
    frames++;
    const now = performance.now();

    if (now - lastFps > 1000) {
      fpsEl.textContent = "FPS: " + frames + " | Context: " + contextType;
      frames = 0;
      lastFps = now;
    }

    device.queue.writeBuffer(
      uniformBuffer,
      0,
      new Float32Array([
        now * 0.001,
        canvas.width,
        canvas.height,
        distance,
        yaw,
        pitch,
        0,
        0
      ])
    );

    const encoder = device.createCommandEncoder();

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0, g: 0, b: 0, a: 1 }
      }]
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(6);
    pass.end();

    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
  }

  frame();
}

main().catch(function (error) {
  console.error("Application error:", error);
});