import { ServerConfigManager } from '../config/ServerConfig.ts';

export class HTTPHandler {
  private corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
  };

  async handleRequest(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    
    // Handle preflight requests
    if (req.method === "OPTIONS") {
      return this.handleOptionsRequest();
    }
    
    switch (pathname) {
      case "/":
        return this.handleIndexPage();
      case "/debug":
        return this.handleDebugPage();
      case "/config":
        return this.handleConfigEndpoint();
      default:
        // Handle static files from public directory
        return this.handleStaticFile(pathname);
    }
  }

  private handleOptionsRequest(): Response {
    return new Response(null, { 
      status: 200, 
      headers: this.corsHeaders 
    });
  }

  private async handleIndexPage(): Promise<Response> {
    try {
      const html = await Deno.readTextFile("./public/index.html");
      return new Response(html, { 
        headers: { 
          "content-type": "text/html",
          ...this.corsHeaders
        } 
      });
    } catch (error) {
      console.error("Error reading index.html:", error);
      return this.handleNotFound();
    }
  }

  private async handleDebugPage(): Promise<Response> {
    try {
      const html = await Deno.readTextFile("./debug-client.html");
      return new Response(html, { 
        headers: { 
          "content-type": "text/html",
          ...this.corsHeaders
        } 
      });
    } catch (error) {
      console.error("Error reading debug-client.html:", error);
      return this.handleNotFound();
    }
  }

  private handleConfigEndpoint(): Response {
    const config = ServerConfigManager.getConfig();
    const clientConfig = {
      wsPort: config.httpPort,
      useHTTPS: config.useHTTPS
    };
    
    return new Response(JSON.stringify(clientConfig), {
      headers: {
        "content-type": "application/json",
        ...this.corsHeaders
      }
    });
  }

  private async handleStaticFile(pathname: string): Promise<Response> {
    const filePath = `./public${pathname}`;
    
    try {
      const fileInfo = await Deno.stat(filePath);
      if (!fileInfo.isFile) {
        return this.handleNotFound();
      }
      
      const content = await Deno.readFile(filePath);
      const contentType = this.getContentType(pathname);
      
      return new Response(content, { 
        headers: { 
          "content-type": contentType,
          ...this.corsHeaders
        } 
      });
    } catch (error) {
      console.error(`Error reading static file ${filePath}:`, error);
      return this.handleNotFound();
    }
  }

  private getContentType(pathname: string): string {
    const ext = pathname.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'html':
        return 'text/html';
      case 'js':
        return 'application/javascript';
      case 'css':
        return 'text/css';
      case 'json':
        return 'application/json';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'svg':
        return 'image/svg+xml';
      case 'ico':
        return 'image/x-icon';
      case 'txt':
        return 'text/plain';
      default:
        return 'application/octet-stream';
    }
  }

  private handleNotFound(): Response {
    return new Response("Not found", { 
      status: 404,
      headers: this.corsHeaders
    });
  }

  async getLocalIpAddress(): Promise<string> {
    try {
      const process = new Deno.Command("ifconfig", {
        stdout: "piped",
        stderr: "piped"
      });
      
      const { stdout } = await process.output();
      const output = new TextDecoder().decode(stdout);
      
      const lines = output.split('\n');
      for (const line of lines) {
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

  logServerInfo(localIP: string): void {
    const config = ServerConfigManager.getConfig();
    
    console.log("🚀 Video Chat Server Started");
    console.log("═".repeat(50));
    
    if (config.useHTTPS) {
      console.log(`📱 Local access:      https://localhost:${config.httpPort}`);
      console.log(`🌐 Network access:    https://${localIP}:${config.httpPort}`);
      if (config.externalDomain) {
        console.log(`🌍 External domain:   https://${config.externalDomain}:${config.httpPort}`);
      }
      console.log(`🔌 WebSocket:         wss://${localIP}:${config.httpPort} (integrated)`);
      console.log(`🔒 HTTPS enabled (self-signed certificate)`);
    } else {
      console.log(`📱 Local access:      http://localhost:${config.httpPort}`);
      console.log(`🌐 Network access:    http://${localIP}:${config.httpPort}`);
      if (config.externalDomain) {
        console.log(`🌍 External domain:   http://${config.externalDomain}:${config.httpPort}`);
      }
      console.log(`🔌 WebSocket:         ws://${localIP}:${config.httpPort} (integrated)`);
      console.log(`⚠️  HTTP only - run ./generate-cert.sh for HTTPS`);
    }
    
    if (config.externalDomain) {
      console.log(`ℹ️  To use external domain, ensure DNS points to this server`);
      console.log(`ℹ️  Set EXTERNAL_DOMAIN env var and regenerate certificates if needed`);
    }
    
    console.log("═".repeat(50));
  }
}