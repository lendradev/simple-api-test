const startTime = Date.now();

const server = Bun.serve({
  port: 3000,
  fetch(req, server) {
    const start = performance.now(); // High-resolution timestamp
    const url = new URL(req.url);

    // Health, Time, and Uptime check
    if (url.pathname === "/") {
      const clientIp = req.headers.get("cf-connecting-ip") || 
                       req.headers.get("x-forwarded-for")?.split(',')[0] || 
                       server.requestIP(req)?.address;

      const end = performance.now();
      const responseTime = `${(end - start).toFixed(4)}ms`;

      return Response.json({
        status: "alive",
        visitor_ip: clientIp,
        timestamp: new Date().toISOString(),
        latency: responseTime // Internal processing time
      });
    }

    // IP detection logic
    if (url.pathname === "/ip") {
      const clientIp = req.headers.get("cf-connecting-ip") || 
                       req.headers.get("x-forwarded-for")?.split(',')[0] || 
                       server.requestIP(req)?.address;

      return Response.json({ ip: clientIp });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running at ${server.url}`);