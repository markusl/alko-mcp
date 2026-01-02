import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from 'http';
import { config, validateConfig } from './config.js';
import { logger } from './utils/logger.js';

// Tool imports
import {
  searchProducts,
  searchProductsSchema,
  getProduct,
  getProductSchema,
  getAvailability,
  getAvailabilitySchema,
  listStores,
  listStoresSchema,
  getStoreHours,
  getStoreHoursSchema,
  getRecommendations,
  getRecommendationsSchema,
  getVivinoRating,
  getVivinoRatingSchema,
} from './tools/index.js';

/**
 * Convert data to compact JSON for LLM consumption
 * Removes null values and Firestore timestamps to minimize token usage
 */
function toCompactJson(data: unknown): string {
  return JSON.stringify(data, (_key, value) => {
    // Skip null values
    if (value === null) return undefined;
    // Convert Firestore Timestamps to ISO strings
    if (value && typeof value === 'object' && '_seconds' in value) {
      return new Date(value._seconds * 1000).toISOString();
    }
    // Convert Date-like objects
    if (value && typeof value.toDate === 'function') {
      return value.toDate().toISOString();
    }
    return value;
  });
}

// Service imports
import { getDataSyncService } from './services/data-sync.js';
import { getAlkoScraper } from './services/scraper.js';
import { getVivinoScraper } from './services/vivino-scraper.js';

/**
 * Create and configure the MCP server
 */
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'alko-mcp',
    version: '1.0.0',
  });

  // ============== Register Tools ==============

  // Search Products
  server.registerTool(
    'search_products',
    {
      title: 'Search Alko Products',
      description:
        'Search Finnish Alko alcohol catalog (~12,000 products). Filter by name, type, country, price, alcohol%. Returns: id, name, price, type, country, alcohol%, producer.',
      inputSchema: searchProductsSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const result = await searchProducts(params as never);
      return {
        content: [{ type: 'text', text: toCompactJson(result) }],
      };
    }
  );

  // Get Product
  server.registerTool(
    'get_product',
    {
      title: 'Get Product by ID',
      description:
        'Retrieve detailed product info by Alko product ID. Optional: includeEnrichedData=true adds taste profile, food pairings, serving tips (slower, scrapes alko.fi).',
      inputSchema: getProductSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      const result = await getProduct(params as never);
      return {
        content: [{ type: 'text', text: toCompactJson(result) }],
      };
    }
  );

  // Get Availability
  server.registerTool(
    'get_availability',
    {
      title: 'Check Product Stock',
      description:
        'Check real-time product availability at Alko stores. Returns store names with stock quantities. Filter by city. Scrapes alko.fi for live data.',
      inputSchema: getAvailabilitySchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      const result = await getAvailability(params as never);
      return {
        content: [{ type: 'text', text: toCompactJson(result) }],
      };
    }
  );

  // List Stores
  server.registerTool(
    'list_stores',
    {
      title: 'List Alko Stores',
      description:
        'List all ~360 Alko stores in Finland. Filter by city name. Returns: store id, name, address, city, postal code.',
      inputSchema: listStoresSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const result = await listStores(params as never);
      return {
        content: [{ type: 'text', text: toCompactJson(result) }],
      };
    }
  );

  // Get Store Hours
  server.registerTool(
    'get_store_hours',
    {
      title: 'Get Store Opening Hours',
      description:
        'Get Alko store opening hours for today and tomorrow. Filter by store name, city, or openNow=true for currently open stores. Auto-refreshes stale data.',
      inputSchema: getStoreHoursSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      const result = await getStoreHours(params as never);
      return {
        content: [{ type: 'text', text: toCompactJson(result) }],
      };
    }
  );

  // Get Recommendations
  server.registerTool(
    'get_recommendations',
    {
      title: 'Get Wine/Drink Recommendations',
      description:
        'Get personalized product recommendations. Specify occasion, food pairing (uses Alko official pairing data), price range, or preferences (organic, vegan). Supports 33 food categories.',
      inputSchema: getRecommendationsSchema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      const result = await getRecommendations(params as never);
      return {
        content: [{ type: 'text', text: toCompactJson(result) }],
      };
    }
  );

  // Get Vivino Rating
  server.registerTool(
    'get_vivino_rating',
    {
      title: 'Get Vivino Wine Rating',
      description:
        'Look up wine ratings from Vivino.com. Search by wine name/winery or provide direct URL. Returns: average rating (1-5 stars), rating count, wine details. Results are cached.',
      inputSchema: getVivinoRatingSchema._def.schema.shape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      const result = await getVivinoRating(params as never);
      return {
        content: [{ type: 'text', text: toCompactJson(result) }],
      };
    }
  );

  // Sync Products (admin tool)
  server.registerTool(
    'sync_products',
    {
      title: 'Sync Product Database (Admin)',
      description:
        'Admin: Download latest Alko price list and update product database. Takes 2-5 minutes. Updates ~12,000 products. Use get_sync_status to check progress.',
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      const syncService = getDataSyncService();
      const result = await syncService.syncProducts();
      return {
        content: [{ type: 'text', text: toCompactJson(result) }],
      };
    }
  );

  // Get Sync Status
  server.registerTool(
    'get_sync_status',
    {
      title: 'Get Database Status',
      description:
        'Check database health: product count, last sync timestamp, sync status. Use to verify data freshness before searches.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const syncService = getDataSyncService();
      const status = await syncService.getSyncStatus();
      return {
        content: [{ type: 'text', text: toCompactJson(status) }],
      };
    }
  );

  return server;
}

/**
 * Start the server with STDIO transport
 */
async function startStdioServer(server: McpServer): Promise<void> {
  logger.info('Starting MCP server with STDIO transport');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('MCP server connected via STDIO');
}

/**
 * Validate API token from Authorization header
 * Returns true if valid, false if invalid
 * In local dev (no API_TOKEN set), always returns true
 */
function validateApiToken(req: import('http').IncomingMessage): boolean {
  // No token configured = no auth required (local dev)
  if (!config.apiToken) {
    return true;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return false;
  }

  // Support "Bearer <token>" format
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  return token === config.apiToken;
}

/**
 * Start the server with HTTP transport
 */
async function startHttpServer(server: McpServer): Promise<void> {
  logger.info(`Starting MCP server with HTTP transport on port ${config.port}`);
  logger.info(`API token authentication: ${config.apiToken ? 'enabled' : 'disabled (local dev)'}`);

  const httpServer = createServer(async (req, res) => {
    // Health check endpoint (no auth required)
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy' }));
      return;
    }

    // Validate API token for all other endpoints
    if (!validateApiToken(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized: Invalid or missing API token' }));
      return;
    }

    // MCP endpoint
    if (req.url === '/mcp' || req.url === '/') {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      // Handle the request
      await transport.handleRequest(req, res, await server.connect(transport));
      return;
    }

    // 404 for other routes
    res.writeHead(404);
    res.end('Not Found');
  });

  httpServer.listen(config.port, () => {
    logger.info(`MCP server listening on http://localhost:${config.port}/mcp`);
  });
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Validate configuration
    validateConfig();

    // Create server
    const server = createMcpServer();

    // Determine transport based on environment
    const useHttp = process.env.MCP_TRANSPORT === 'http' || process.env.PORT !== undefined;

    if (useHttp) {
      await startHttpServer(server);
    } else {
      await startStdioServer(server);
    }

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      const alkoScraper = getAlkoScraper();
      const vivinoScraper = getVivinoScraper();
      await Promise.all([alkoScraper.close(), vivinoScraper.close()]);
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down...');
      const alkoScraper = getAlkoScraper();
      const vivinoScraper = getVivinoScraper();
      await Promise.all([alkoScraper.close(), vivinoScraper.close()]);
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start the server
main();
