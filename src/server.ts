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
      description:
        'Search the Alko product catalog. Returns JSON array of products with id, name, price, type, country, alcohol%, etc.',
      inputSchema: searchProductsSchema.shape,
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
      description:
        'Get product details by ID. Set includeEnrichedData=true for taste profile, usage tips, serving suggestions, and food pairings (slower, scrapes web).',
      inputSchema: getProductSchema.shape,
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
      description: 'Check which Alko stores have a product in stock. Returns store names and quantities.',
      inputSchema: getAvailabilitySchema.shape,
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
      description: 'List Alko stores. Filter by city. Returns store id, name, address, city.',
      inputSchema: listStoresSchema.shape,
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
      description:
        'Get store opening hours. Filter by storeName, city, or openNow=true. Returns hours for today/tomorrow and isOpenNow status.',
      inputSchema: getStoreHoursSchema.shape,
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
      description: 'Get product recommendations based on occasion, food pairing, flavor profile, or price range.',
      inputSchema: getRecommendationsSchema.shape,
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
      description:
        'Get Vivino wine rating by searching for wine name or using direct Vivino URL. Returns star rating (1-5), number of ratings, and wine info.',
      inputSchema: getVivinoRatingSchema._def.schema.shape,
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
      description: 'Sync product database with latest Alko price list. Takes a few minutes.',
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
      description: 'Get sync status and product count.',
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
 * Start the server with HTTP transport
 */
async function startHttpServer(server: McpServer): Promise<void> {
  logger.info(`Starting MCP server with HTTP transport on port ${config.port}`);

  const httpServer = createServer(async (req, res) => {
    // Health check endpoint
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy' }));
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
