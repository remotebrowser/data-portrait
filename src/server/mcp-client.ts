import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  type CallToolResult,
  type CompatibilityCallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ServerLogger } from './utils/logger/index.js';
import { settings } from './config.js';
import { geolocationService } from './services/geolocation-service.js';

// Currently just define the MCP url path for each brand here for simplicity
const MCP_URL_PATHS: Record<string, string> = {
  goodreads: 'mcp-books',
  amazon: 'mcp-shopping',
  wayfair: 'mcp-shopping',
};
class MCPClient {
  private client: Client;
  private lastAccessed: Date;
  private sessionId: string;
  private clientIp: string;
  private brandId: string;

  constructor({
    sessionId,
    clientIp,
    brandId,
  }: {
    sessionId: string;
    clientIp: string;
    brandId: string;
  }) {
    this.client = this.createClient();
    this.lastAccessed = new Date();
    this.sessionId = sessionId;
    this.clientIp = clientIp;
    this.brandId = brandId;
  }

  private createClient(): Client {
    return new Client({ name: 'data-portrait', version: '1.0.0' });
  }

  private createTransport(): StreamableHTTPClientTransport {
    const locationData = geolocationService.getClientLocationFromCache(
      this.clientIp
    );

    const mcpUrlPath = MCP_URL_PATHS[this.brandId] ?? 'mcp';
    return new StreamableHTTPClientTransport(
      new URL(`${settings.GETGATHER_URL}/${mcpUrlPath}`),
      {
        requestInit: {
          headers: {
            'x-getgather-custom-app': 'data-portrait',
            'x-location': locationData ? JSON.stringify(locationData) : '',
            'x-incognito': '1',
          },
        },
      }
    );
  }

  async connect(): Promise<void> {
    await this.client.connect(this.createTransport());
  }

  async callTool(
    params: {
      name: string;
      arguments?: Record<string, unknown>;
    },
    maxRetries: number = 3
  ): Promise<CallToolResult | CompatibilityCallToolResult> {
    this.lastAccessed = new Date();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        ServerLogger.info('Calling MCP tool', {
          component: 'mcp-client',
          operation: 'call-tool',
          toolName: params.name,
          sessionId: this.sessionId,
          brandId: this.brandId,
        });
        return await this.client.callTool(params, undefined, {
          timeout: 6000000,
          maxTotalTimeout: 6000000,
        });
      } catch (err) {
        if (attempt === maxRetries) {
          throw err;
        }
        ServerLogger.warn(
          `callTool failed (attempt ${attempt + 1}/${maxRetries + 1}), attempting MCP client reconnect...`,
          {
            component: 'mcp-client',
            operation: 'call-tool-retry',
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            sessionId: this.sessionId,
            brandId: this.brandId,
            error: (err as Error).message,
          }
        );
        await this.reconnect();
      }
    }

    throw new Error('callTool failed after maximum retries');
  }

  async reconnect(): Promise<void> {
    this.lastAccessed = new Date();

    try {
      if (this.client) {
        await this.client.close?.().catch(() => {});
      }
    } finally {
      this.client = this.createClient();
      await this.connect();
    }
  }

  close(): void {
    this.client.close?.();
  }

  get isExpired(): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.lastAccessed < oneHourAgo;
  }
}

class MCPClientManager {
  private clients = new Map<string, MCPClient>();

  constructor() {
    setInterval(() => this.cleanupExpiredClients(), 10 * 60 * 1000);
  }

  private cleanupExpiredClients(): void {
    for (const [sessionId, mcpClient] of Array.from(this.clients.entries())) {
      if (mcpClient.isExpired) {
        mcpClient.close();
        this.clients.delete(sessionId);
      }
    }
  }

  async get({
    sessionId,
    clientIp,
    brandId,
  }: {
    sessionId: string;
    clientIp: string;
    brandId: string;
  }): Promise<MCPClient> {
    const key = `${sessionId}-${brandId}`;
    if (!this.clients.has(key)) {
      const mcpClient = new MCPClient({ sessionId, clientIp, brandId });
      await mcpClient.connect();
      this.clients.set(key, mcpClient);
    }

    return this.clients.get(key)!;
  }
}

export const mcpClientManager = new MCPClientManager();
