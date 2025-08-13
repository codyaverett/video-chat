import { serve, serveTls } from "https://deno.land/std@0.224.0/http/server.ts";
import { ServerConfigManager } from './config/ServerConfig.ts';
import { UserManager } from './services/UserManager.ts';
import { RoomManager } from './services/RoomManager.ts';
import { BroadcastService } from './services/BroadcastService.ts';
import { WebRTCSignalingService } from './services/WebRTCSignalingService.ts';
import { WebSocketHandler } from './handlers/WebSocketHandler.ts';
import { HTTPHandler } from './handlers/HTTPHandler.ts';

class VideoServer {
  private userManager: UserManager;
  private roomManager: RoomManager;
  private broadcastService: BroadcastService;
  private signalingService: WebRTCSignalingService;
  private webSocketHandler: WebSocketHandler;
  private httpHandler: HTTPHandler;

  constructor() {
    // Initialize services with dependency injection
    this.roomManager = new RoomManager();
    this.userManager = new UserManager(this.roomManager);
    this.broadcastService = new BroadcastService(this.userManager, this.roomManager);
    this.signalingService = new WebRTCSignalingService(
      this.userManager, 
      this.roomManager, 
      this.broadcastService
    );
    this.webSocketHandler = new WebSocketHandler(
      this.userManager,
      this.roomManager,
      this.broadcastService,
      this.signalingService
    );
    this.httpHandler = new HTTPHandler();
  }

  private async handleRequest(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    
    // Handle WebSocket upgrade requests
    if (pathname === "/ws" && req.headers.get("upgrade") === "websocket") {
      console.log("🔌 WebSocket connection attempt");
      const { socket, response } = Deno.upgradeWebSocket(req);
      this.webSocketHandler.handleWebSocket(socket);
      return response;
    }
    
    // Handle HTTP requests
    return await this.httpHandler.handleRequest(req);
  }

  async start(): Promise<void> {
    // Initialize configuration
    const config = ServerConfigManager.initialize();
    await ServerConfigManager.checkSSLCerts();
    
    // Get local IP for logging
    const localIP = await this.httpHandler.getLocalIpAddress();
    
    // Log server information
    this.httpHandler.logServerInfo(localIP);
    
    // Start server
    const handler = (req: Request) => this.handleRequest(req);
    
    if (config.useHTTPS) {
      await serveTls(handler, {
        port: config.httpPort,
        hostname: config.hostname,
        certFile: config.certFile,
        keyFile: config.keyFile,
      });
    } else {
      await serve(handler, { 
        port: config.httpPort, 
        hostname: config.hostname
      });
    }
  }
}

// Start the server
if (import.meta.main) {
  const server = new VideoServer();
  await server.start();
}