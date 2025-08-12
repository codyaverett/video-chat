import { serve, serveTls } from "https://deno.land/std@0.224.0/http/server.ts";

// Configuration
const HTTP_PORT = parseInt(Deno.env.get("HTTP_PORT") || "8001");
const HOSTNAME = Deno.env.get("HOSTNAME") || "0.0.0.0";
const EXTERNAL_DOMAIN = Deno.env.get("EXTERNAL_DOMAIN") || null;

interface User {
  id: string;
  socket: WebSocket;
  name?: string;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
  videoFilter?: string;
  currentRoom?: string;
}

interface Room {
  id: string;
  name: string;
  participants: Set<string>;
  createdAt: Date;
  createdBy: string;
}

const users: Map<string, User> = new Map();
const rooms: Map<string, Room> = new Map();

function handleWebSocket(ws: WebSocket) {
  const clientId = crypto.randomUUID();
  console.log(`✅ New WebSocket client connected: ${clientId}`);
  const user: User = {
    id: clientId,
    socket: ws,
    audioEnabled: true,
    videoEnabled: true,
    videoFilter: 'none'
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
      case "media-state-change":
        const mediaUser = users.get(clientId);
        if (mediaUser) {
          if (message.audioEnabled !== undefined) {
            mediaUser.audioEnabled = message.audioEnabled;
          }
          if (message.videoEnabled !== undefined) {
            mediaUser.videoEnabled = message.videoEnabled;
          }
          if (message.videoFilter !== undefined) {
            mediaUser.videoFilter = message.videoFilter;
          }
          console.log(`🎛️ User ${clientId} media state: audio=${mediaUser.audioEnabled}, video=${mediaUser.videoEnabled}, filter=${mediaUser.videoFilter}`);
          broadcastMediaStates();
        }
        break;
      case "create-room":
        const creatingUser = users.get(clientId);
        
        // Leave current room if in one
        if (creatingUser?.currentRoom) {
          leaveRoom(clientId, creatingUser.currentRoom);
        }
        
        const roomId = crypto.randomUUID();
        const room: Room = {
          id: roomId,
          name: message.roomName || `Room ${roomId.substring(0, 8)}`,
          participants: new Set([clientId]),
          createdAt: new Date(),
          createdBy: clientId
        };
        rooms.set(roomId, room);
        
        if (creatingUser) {
          creatingUser.currentRoom = roomId;
        }
        
        console.log(`🏠 User ${clientId} created room: ${room.name} (${roomId})`);
        ws.send(JSON.stringify({
          type: "room-created",
          room: {
            id: room.id,
            name: room.name,
            participants: Array.from(room.participants),
            participantDetails: Array.from(room.participants).map(id => {
              const user = users.get(id);
              return { id: id, name: user?.name || 'Unknown' };
            })
          }
        }));
        broadcastRoomList();
        break;
      case "join-room":
        const targetRoom = rooms.get(message.roomId);
        const joiningUser = users.get(clientId);
        
        if (targetRoom && joiningUser) {
          // Leave current room if in one
          if (joiningUser.currentRoom) {
            leaveRoom(clientId, joiningUser.currentRoom);
          }
          
          targetRoom.participants.add(clientId);
          joiningUser.currentRoom = message.roomId;
          
          console.log(`🚪 User ${clientId} joined room: ${targetRoom.name}`);
          
          // Notify user they joined
          ws.send(JSON.stringify({
            type: "room-joined",
            room: {
              id: targetRoom.id,
              name: targetRoom.name,
              participants: Array.from(targetRoom.participants),
              participantDetails: Array.from(targetRoom.participants).map(id => {
                const user = users.get(id);
                return { id: id, name: user?.name || 'Unknown' };
              })
            }
          }));
          
          // Notify all participants about new user
          broadcastToRoom(message.roomId, {
            type: "user-joined-room",
            userId: clientId,
            userName: joiningUser.name,
            room: {
              id: targetRoom.id,
              name: targetRoom.name,
              participants: Array.from(targetRoom.participants),
              participantDetails: Array.from(targetRoom.participants).map(id => {
                const user = users.get(id);
                return { id: id, name: user?.name || 'Unknown' };
              })
            }
          });
          
          broadcastRoomList();
        }
        break;
      case "leave-room":
        if (users.get(clientId)?.currentRoom) {
          leaveRoom(clientId, users.get(clientId)!.currentRoom!);
        }
        break;
      case "webrtc-offer":
        // Handle WebRTC offers - can be for rooms or direct calls
        if (message.roomId) {
          // Broadcast to all other participants in the room
          broadcastToRoom(message.roomId, {
            type: "webrtc-offer",
            offer: message.offer,
            from: clientId,
            fromName: users.get(clientId)?.name || 'Unknown User',
            to: message.to
          }, [clientId]); // Exclude sender
        } else {
          // Direct call (legacy support)
          const targetUser = users.get(message.to);
          if (targetUser && targetUser.socket.readyState === WebSocket.OPEN) {
            targetUser.socket.send(JSON.stringify({
              type: "webrtc-offer",
              offer: message.offer,
              from: clientId,
              fromName: users.get(clientId)?.name || 'Unknown User'
            }));
          }
        }
        break;
      case "webrtc-answer":
        const answerUser = users.get(message.to);
        if (answerUser && answerUser.socket.readyState === WebSocket.OPEN) {
          answerUser.socket.send(JSON.stringify({
            type: "webrtc-answer",
            answer: message.answer,
            from: clientId,
          }));
        }
        break;
      case "webrtc-ice-candidate":
        const candidateUser = users.get(message.to);
        if (candidateUser && candidateUser.socket.readyState === WebSocket.OPEN) {
          candidateUser.socket.send(JSON.stringify({
            type: "webrtc-ice-candidate",
            candidate: message.candidate,
            from: clientId,
          }));
        }
        break;
      case "call-user":
        // Legacy 1-to-1 call support
        const targetUser = users.get(message.to);
        const callingUser = users.get(clientId);
        if (targetUser && targetUser.socket.readyState === WebSocket.OPEN) {
          targetUser.socket.send(JSON.stringify({
            type: "call-made",
            offer: message.offer,
            socket: clientId,
            callerName: callingUser?.name || 'Unknown User'
          }));
        }
        break;
      case "make-answer":
        // Legacy 1-to-1 call support
        const legacyAnswerUser = users.get(message.to);
        if (legacyAnswerUser && legacyAnswerUser.socket.readyState === WebSocket.OPEN) {
          legacyAnswerUser.socket.send(JSON.stringify({
            type: "answer-made",
            answer: message.answer,
            socket: clientId,
          }));
        }
        break;
      case "ice-candidate":
        // Legacy 1-to-1 call support
        const legacyCandidateUser = users.get(message.to);
        if (legacyCandidateUser && legacyCandidateUser.socket.readyState === WebSocket.OPEN) {
          legacyCandidateUser.socket.send(JSON.stringify({
            type: "ice-candidate",
            candidate: message.candidate,
            socket: clientId,
          }));
        }
        break;
    }
  };

  ws.onclose = () => {
    // Leave current room if in one
    const disconnectingUser = users.get(clientId);
    if (disconnectingUser?.currentRoom) {
      leaveRoom(clientId, disconnectingUser.currentRoom);
    }
    
    users.delete(clientId);
    console.log(`❌ User disconnected: ${clientId}`);
    broadcastUserList();
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    
    // Leave current room if in one
    const errorUser = users.get(clientId);
    if (errorUser?.currentRoom) {
      leaveRoom(clientId, errorUser.currentRoom);
    }
    
    users.delete(clientId);
    broadcastUserList();
  };
}

function broadcastUserList() {
  const userList = Array.from(users.values()).map(user => ({
    id: user.id,
    name: user.name,
    audioEnabled: user.audioEnabled,
    videoEnabled: user.videoEnabled,
    videoFilter: user.videoFilter
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

function broadcastMediaStates() {
  const mediaStates = Array.from(users.values()).map(user => ({
    id: user.id,
    audioEnabled: user.audioEnabled,
    videoEnabled: user.videoEnabled,
    videoFilter: user.videoFilter
  }));
  
  users.forEach(user => {
    if (user.socket.readyState === WebSocket.OPEN) {
      user.socket.send(JSON.stringify({
        type: "media-states-update",
        states: mediaStates,
      }));
    }
  });
}

function leaveRoom(userId: string, roomId: string) {
  const room = rooms.get(roomId);
  const user = users.get(userId);
  
  if (room && user) {
    room.participants.delete(userId);
    user.currentRoom = undefined;
    
    console.log(`🚪 User ${userId} left room: ${room.name}`);
    
    // If room is empty, delete it
    if (room.participants.size === 0) {
      rooms.delete(roomId);
      console.log(`🗑️ Deleted empty room: ${room.name}`);
    } else {
      // Notify remaining participants
      broadcastToRoom(roomId, {
        type: "user-left-room",
        userId: userId,
        userName: user.name,
        room: {
          id: room.id,
          name: room.name,
          participants: Array.from(room.participants)
        }
      });
    }
    
    broadcastRoomList();
  }
}

function broadcastToRoom(roomId: string, message: any, excludeUsers: string[] = []) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  room.participants.forEach(participantId => {
    if (excludeUsers.includes(participantId)) return;
    
    const user = users.get(participantId);
    if (user && user.socket.readyState === WebSocket.OPEN) {
      user.socket.send(JSON.stringify(message));
    }
  });
}

function broadcastRoomList() {
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    participantCount: room.participants.size,
    participants: Array.from(room.participants).map(id => {
      const user = users.get(id);
      return {
        id: id,
        name: user?.name || 'Unknown'
      };
    }),
    createdAt: room.createdAt,
    createdBy: room.createdBy
  }));
  
  users.forEach(user => {
    if (user.socket.readyState === WebSocket.OPEN) {
      user.socket.send(JSON.stringify({
        type: "room-list-update",
        rooms: roomList,
      }));
    }
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
  "Access-Control-Allow-Credentials": "true",
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
  if (EXTERNAL_DOMAIN) {
    console.log(`🌍 External domain:   https://${EXTERNAL_DOMAIN}:${HTTP_PORT}`);
  }
  console.log(`🔌 WebSocket:         wss://${localIP}:${HTTP_PORT} (integrated)`);
  console.log(`🔒 HTTPS enabled (self-signed certificate)`);
} else {
  console.log(`📱 Local access:      http://localhost:${HTTP_PORT}`);
  console.log(`🌐 Network access:    http://${localIP}:${HTTP_PORT}`);
  if (EXTERNAL_DOMAIN) {
    console.log(`🌍 External domain:   http://${EXTERNAL_DOMAIN}:${HTTP_PORT}`);
  }
  console.log(`🔌 WebSocket:         ws://${localIP}:${HTTP_PORT} (integrated)`);
  console.log(`⚠️  HTTP only - run ./generate-cert.sh for HTTPS`);
}
if (EXTERNAL_DOMAIN) {
  console.log(`ℹ️  To use external domain, ensure DNS points to this server`);
  console.log(`ℹ️  Set EXTERNAL_DOMAIN env var and regenerate certificates if needed`);
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

