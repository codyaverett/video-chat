import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { WebSocketServer } from "https://deno.land/x/websocket@v0.1.4/mod.ts";

const sockets: Map<string, WebSocket> = new Map();
const wss = new WebSocketServer(5001);

wss.on("connection", (ws: WebSocket) => {
  const clientId = crypto.randomUUID();
  sockets.set(clientId, ws);
  
  // Send the client their ID
  ws.send(JSON.stringify({
    type: "client-id",
    id: clientId,
  }));
  
  broadcastUserList();

  ws.on("message", (data: string) => {
    const message = JSON.parse(data);
    switch (message.type) {
      case "call-user":
        const targetWs = sockets.get(message.to);
        if (targetWs) {
          targetWs.send(JSON.stringify({
            type: "call-made",
            offer: message.offer,
            socket: clientId,
          }));
        }
        break;
      case "make-answer":
        const answerWs = sockets.get(message.to);
        if (answerWs) {
          answerWs.send(JSON.stringify({
            type: "answer-made",
            answer: message.answer,
            socket: clientId,
          }));
        }
        break;
      case "ice-candidate":
        const candidateWs = sockets.get(message.to);
        if (candidateWs) {
          candidateWs.send(JSON.stringify({
            type: "ice-candidate",
            candidate: message.candidate,
            socket: clientId,
          }));
        }
        break;
    }
  });

  ws.on("close", () => {
    sockets.delete(clientId);
    broadcastUserList();
  });
});

function broadcastUserList() {
  const userList = Array.from(sockets.keys());
  sockets.forEach(client => {
    client.send(JSON.stringify({
      type: "update-user-list",
      sockets: userList,
    }));
  });
}

const handler = async (req: Request): Promise<Response> => {
  const { pathname } = new URL(req.url);
  if (pathname === "/") {
    const html = await Deno.readTextFile("./public/index.html");
    return new Response(html, { headers: { "content-type": "text/html" } });
  }
  if (pathname.startsWith("/scripts/")) {
    const filePath = `./public${pathname}`;
    try {
      const js = await Deno.readTextFile(filePath);
      return new Response(js, { headers: { "content-type": "application/javascript" } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }
  return new Response("Not found", { status: 404 });
};

console.log("HTTP server running on http://localhost:8001");
console.log("WebSocket server running on ws://localhost:5001");
await serve(handler, { port: 8001 });

