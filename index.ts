const startTime = Date.now();

const server = Bun.serve({
  port: 3000,
  websocket: {
    // Handler WebSocket (with latency logging)
    open(ws) {
      (ws as any).connectedAt = performance.now();
      console.log("Client connected (WebSocket established)");
      ws.send("Hello from Bun WebSocket server!");
    },
    message(ws, message) {
      const recvTime = performance.now();
      const text = typeof message === "string" ? message : new TextDecoder().decode(message);
      console.log(`Received: ${text}`);

      const start = performance.now();
      const processingMs = (performance.now() - start).toFixed(4);

      const reply = `Bun replies: ${text} (processed=${processingMs}ms)`;
      ws.send(reply);

      const sinceConnectMs = ((recvTime - (ws as any).connectedAt) || 0).toFixed(4);
      console.log(`Replied in ${processingMs}ms (since connect ${sinceConnectMs}ms)`);
    },
    close(ws) {
      const connectedAt = (ws as any).connectedAt;
      const durationMs = connectedAt ? (performance.now() - connectedAt).toFixed(4) : "unknown";
      console.log("Connection closed, duration:", `${durationMs}ms`);
    },
    idleTimeout: 60,
    perMessageDeflate: true,
  },
  fetch(req, server) {
    // ---------------------------------------------------------
    // 1. UNIVERSAL UPGRADE CHECK (The Fix)
    // Checks if the client is asking for WebSocket on ANY path.
    // This prevents the "Expected 101" error if client hits "/" instead of "/ws"
    // ---------------------------------------------------------
    if (server.upgrade(req)) {
      return; // Bun handles the 101 response automatically
    }

    // 2. Standard API Logic (HTTP)
    const start = performance.now();
    const url = new URL(req.url);

    // Helper to get IP
    const getClientIp = () =>
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      server.requestIP(req)?.address ||
      "unknown";

    // --- ADD THIS DEBUG BLOCK ---
    if (url.pathname === "/ws") {
        console.log("❌ Upgrade failed!");
        console.log("Method:", req.method);
        console.log("Upgrade Header:", req.headers.get("Upgrade"));
        console.log("Connection Header:", req.headers.get("Connection"));
    }
    // ----------------------------

    // Route: Root "/" -> Return JSON with Brotli compression
    if (url.pathname === "/") {
      const clientIp = getClientIp();

      const payload = {
        status: "alive",
        visitor_ip: clientIp,
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor((Date.now() - startTime) / 1000)} seconds`,
      };

      const json = JSON.stringify(payload);
      const encoder = new TextEncoder();
      const encoded = encoder.encode(json);
      const originalBytes = encoded.byteLength;

      // Stream Logic
      const source = new ReadableStream({
        start(controller) {
          controller.enqueue(encoded);
          controller.close();
        },
      });

      let compressedBytes = 0;
      const counting = new TransformStream({
        transform(chunk, controller) {
          const size = chunk && chunk.byteLength ? chunk.byteLength : 0;
          compressedBytes += size;
          controller.enqueue(chunk);
        },
        flush() {
          const totalMs = (performance.now() - start).toFixed(4);
          console.log(
            `[${new Date().toISOString()}] ${req.method} ${url.pathname} ip=${clientIp} original=${originalBytes}B compressed=${compressedBytes}B latency=${totalMs}ms`
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

    // Route: IP Check
    if (url.pathname === "/ip") {
      const clientIp = getClientIp();
      console.log(`[${new Date().toISOString()}] IP Check from ${clientIp}`);
      return Response.json({ ip: clientIp });
    }

    // Route: 404 Not Found
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at ${server.url}`);