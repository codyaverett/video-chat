import { serve, serveTls } from "https://deno.land/std@0.224.0/http/server.ts";

// Configuration
const HTTP_PORT = parseInt(Deno.env.get("HTTP_PORT") || "8001");
const HOSTNAME = Deno.env.get("HOSTNAME") || "0.0.0.0";

interface User {
  id: string;
  socket: WebSocket;
  name?: string;
}

const users: Map<string, User> = new Map();

function handleWebSocket(ws: WebSocket) {
  const clientId = crypto.randomUUID();
  console.log(`✅ New WebSocket client connected: ${clientId}`);
  const user: User = {
    id: clientId,
    socket: ws
  };
  users.set(clientId, user);
  
  // Use setTimeout to ensure WebSocket is ready
  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      console.log(`🔗 Sending initial data to client: ${clientId}`);
      // Send the client their ID
      ws.send(JSON.stringify({
        type: "client-id",
        id: clientId,
      }));
      broadcastUserList();
    } else {
      console.log(`⚠️ WebSocket not ready for client: ${clientId}, state: ${ws.readyState}`);
    }
  }, 100);

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    switch (message.type) {
      case "set-displayname":
        const user = users.get(clientId);
        if (user) {
          user.name = message.name;
          console.log(`👤 User ${clientId} set name: ${message.name}`);
          broadcastUserList();
        }
        break;
      case "call-user":
        const targetUser = users.get(message.to);
        if (targetUser && targetUser.socket.readyState === WebSocket.OPEN) {
          targetUser.socket.send(JSON.stringify({
            type: "call-made",
            offer: message.offer,
            socket: clientId,
          }));
        }
        break;
      case "make-answer":
        const answerUser = users.get(message.to);
        if (answerUser && answerUser.socket.readyState === WebSocket.OPEN) {
          answerUser.socket.send(JSON.stringify({
            type: "answer-made",
            answer: message.answer,
            socket: clientId,
          }));
        }
        break;
      case "ice-candidate":
        const candidateUser = users.get(message.to);
        if (candidateUser && candidateUser.socket.readyState === WebSocket.OPEN) {
          candidateUser.socket.send(JSON.stringify({
            type: "ice-candidate",
            candidate: message.candidate,
            socket: clientId,
          }));
        }
        break;
    }
  };

  ws.onclose = () => {
    users.delete(clientId);
    console.log(`❌ User disconnected: ${clientId}`);
    broadcastUserList();
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    users.delete(clientId);
    broadcastUserList();
  };
}

function broadcastUserList() {
  const userList = Array.from(users.values()).map(user => ({
    id: user.id,
    name: user.name
  }));
  
  users.forEach(user => {
    if (user.socket.readyState === WebSocket.OPEN) {
      user.socket.send(JSON.stringify({
        type: "update-user-list",
        users: userList,
      }));
    }
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const handler = async (req: Request): Promise<Response> => {
  const { pathname } = new URL(req.url);
  
  // Handle WebSocket upgrade requests
  if (pathname === "/ws" && req.headers.get("upgrade") === "websocket") {
    console.log("🔌 WebSocket connection attempt");
    const { socket, response } = Deno.upgradeWebSocket(req);
    handleWebSocket(socket);
    return response;
  }
  
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 200, 
      headers: corsHeaders 
    });
  }
  
  if (pathname === "/") {
    const html = await Deno.readTextFile("./public/index.html");
    return new Response(html, { 
      headers: { 
        "content-type": "text/html",
        ...corsHeaders
      } 
    });
  }
  if (pathname === "/debug") {
    const html = await Deno.readTextFile("./debug-client.html");
    return new Response(html, { 
      headers: { 
        "content-type": "text/html",
        ...corsHeaders
      } 
    });
  }
  if (pathname === "/config") {
    const config = {
      wsPort: HTTP_PORT,
      useHTTPS: await checkSSLCerts()
    };
    return new Response(JSON.stringify(config), {
      headers: {
        "content-type": "application/json",
        ...corsHeaders
      }
    });
  }
  if (pathname.startsWith("/scripts/")) {
    const filePath = `./public${pathname}`;
    try {
      const js = await Deno.readTextFile(filePath);
      return new Response(js, { 
        headers: { 
          "content-type": "application/javascript",
          ...corsHeaders
        } 
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }
  return new Response("Not found", { status: 404 });
};

// Get local network IP address
async function getLocalIpAddress() {
  try {
    // Use ifconfig to get local network interfaces (macOS/Linux)
    const process = new Deno.Command("ifconfig", {
      stdout: "piped",
      stderr: "piped"
    });
    
    const { stdout } = await process.output();
    const output = new TextDecoder().decode(stdout);
    
    // Look for en0 or similar network interface with inet address
    const lines = output.split('\n');
    for (const line of lines) {
      // Match inet 192.168.x.x or 10.x.x.x (common local network ranges)
      const match = line.match(/inet (\d+\.\d+\.\d+\.\d+)/);
      if (match && match[1] !== '127.0.0.1' && 
          (match[1].startsWith('192.168.') || 
           match[1].startsWith('10.') || 
           match[1].startsWith('172.'))) {
        return match[1];
      }
    }
    return "localhost";
  } catch {
    return "localhost";
  }
}

async function checkSSLCerts() {
  try {
    await Deno.stat("./certs/server.crt");
    await Deno.stat("./certs/server.key");
    return true;
  } catch {
    return false;
  }
}

const localIP = await getLocalIpAddress();

// Check if SSL certificates exist
const useHTTPS = await checkSSLCerts();

console.log("🚀 Video Chat Server Started");
console.log("═".repeat(50));
if (useHTTPS) {
  console.log(`📱 Local access:      https://localhost:${HTTP_PORT}`);
  console.log(`🌐 Network access:    https://${localIP}:${HTTP_PORT}`);
  console.log(`🔌 WebSocket:         wss://${localIP}:${HTTP_PORT} (integrated)`);
  console.log(`🔒 HTTPS enabled (self-signed certificate)`);
} else {
  console.log(`📱 Local access:      http://localhost:${HTTP_PORT}`);
  console.log(`🌐 Network access:    http://${localIP}:${HTTP_PORT}`);
  console.log(`🔌 WebSocket:         ws://${localIP}:${HTTP_PORT} (integrated)`);
  console.log(`⚠️  HTTP only - run ./generate-cert.sh for HTTPS`);
}
console.log("═".repeat(50));

if (useHTTPS) {
  await serveTls(handler, {
    port: HTTP_PORT,
    hostname: HOSTNAME,
    certFile: "./certs/server.crt",
    keyFile: "./certs/server.key",
  });
} else {
  await serve(handler, { 
    port: HTTP_PORT, 
    hostname: HOSTNAME
  });
}

