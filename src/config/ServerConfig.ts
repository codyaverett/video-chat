export interface ServerConfig {
  httpPort: number;
  hostname: string;
  externalDomain: string | null;
  useHTTPS: boolean;
  certFile: string;
  keyFile: string;
}

export class ServerConfigManager {
  private static config: ServerConfig;

  static initialize(): ServerConfig {
    if (!this.config) {
      this.config = {
        httpPort: parseInt(Deno.env.get("HTTP_PORT") || "8001"),
        hostname: Deno.env.get("HOSTNAME") || "0.0.0.0",
        externalDomain: Deno.env.get("EXTERNAL_DOMAIN") || null,
        useHTTPS: false, // Will be set by checkSSLCerts
        certFile: "./certs/server.crt",
        keyFile: "./certs/server.key"
      };
    }
    return this.config;
  }

  static getConfig(): ServerConfig {
    if (!this.config) {
      return this.initialize();
    }
    return this.config;
  }

  static updateHTTPSStatus(useHTTPS: boolean): void {
    this.config.useHTTPS = useHTTPS;
  }

  static async checkSSLCerts(): Promise<boolean> {
    try {
      await Deno.stat(this.getConfig().certFile);
      await Deno.stat(this.getConfig().keyFile);
      this.updateHTTPSStatus(true);
      return true;
    } catch {
      this.updateHTTTPS(false);
      return false;
    }
  }

  private static updateHTTTPS(useHTTPS: boolean): void {
    this.config.useHTTPS = useHTTPS;
  }
}