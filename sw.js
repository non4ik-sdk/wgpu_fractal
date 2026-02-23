self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('webgpu-shaders').then((cache) => {
      return cache.addAll([
        'vertex.wgsl',
        'fragment.wgsl'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('.wgsl')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});