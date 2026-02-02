// test-client.ts
const socket = new WebSocket("wssbun://apitest.lendra.me");

socket.onopen = () => {
  console.log("✅ Terhubung ke Cloudflare Tunnel!");
  socket.send("Halo dari Bun Client!");
};

socket.onmessage = (event) => {
  console.log("📩 Balasan Server:", event.data);
};

socket.onerror = (error) => {
  console.error("❌ Error:", error);
};