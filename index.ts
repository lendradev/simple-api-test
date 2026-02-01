const startTime = Date.now();


const server = Bun.serve({
  port: 3000,
  websocket: {
    // Handler WebSocket
    open(ws) {
      console.log("Client terhubung via CF Tunnel");
      ws.send("Halo dari Bun WebSocket server!");
    },
    message(ws, message) {
      console.log(`Pesan: ${message}`);
      ws.send(`Bun membalas: ${message}`);
    },
    close(ws) {
      console.log("Koneksi ditutup");
    },
    // Fitur bawaan Bun untuk menjaga koneksi tetap hidup (Keep-alive)
    idleTimeout: 60, // Detik
    perMessageDeflate: true,
  },
  fetch(req, server) {
    const start = performance.now();
    const url = new URL(req.url);

    const getClientIp = () =>
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      server.requestIP(req)?.address ||
      "unknown";

    // Health, Time, and Uptime check
    if (url.pathname === "/") {
      const clientIp = getClientIp();

      const payload = {
        status: "alive",
        visitor_ip: clientIp,
        timestamp: new Date().toISOString(),
        latency: undefined, // we'll compute and log later
        uptime: `${Math.floor((Date.now() - startTime) / 1000)} seconds`,
      };

      const json = JSON.stringify(payload);
      const encoder = new TextEncoder();
      const encoded = encoder.encode(json);
      const originalBytes = encoded.byteLength;

      // Create a source stream containing the JSON
      const source = new ReadableStream({
        start(controller) {
          controller.enqueue(encoded);
          controller.close();
        },
      });

      // Counting transform to measure compressed bytes and log when done
      let compressedBytes = 0;
      const counting = new TransformStream({
        transform(chunk, controller) {
          // chunk will be a Uint8Array for gzip output
          const size =
            chunk && typeof (chunk as any).byteLength === "number"
              ? (chunk as Uint8Array).byteLength
              : 0;
          compressedBytes += size;
          controller.enqueue(chunk);
        },
        flush() {
          const totalMs = (performance.now() - start).toFixed(4);
          // Update payload latency for logs (not modifying the sent payload)
          console.log(
            `[${new Date().toISOString()}] ${req.method} ${url.pathname} ip=${clientIp} original=${originalBytes}B compressed=${compressedBytes}B latency=${totalMs}ms uptime=${Math.floor(
              (Date.now() - startTime) / 1000
            )}s`
          );
        },
      });

      const stream = source
        .pipeThrough(new CompressionStream("brotli"))
        .pipeThrough(counting);

      return new Response(stream, {
        headers: {
          "Content-Type": "application/json",
          "Content-Encoding": "br",
        },
      });
    }

    // IP detection logic
    if (url.pathname === "/ip") {
      const clientIp = getClientIp();
      console.log(
        `[${new Date().toISOString()}] ${req.method} ${url.pathname} ip=${clientIp}`
      );
      return Response.json({ ip: clientIp });
    }

    console.log(
      `[${new Date().toISOString()}] ${req.method} ${url.pathname} 404`
    );
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at ${server.url}`);