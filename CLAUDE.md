# Alko MCP Server

MCP (Model Context Protocol) server for querying the Alko.fi alcohol product catalog. Provides Claude Desktop with tools to search products, check store availability, and get recommendations.

**Note:** All tools return compact JSON (null values stripped) for efficient LLM processing. The LLM formats the response for human display.

## Requirements

- Node.js 24+
- Google Cloud Firestore (or emulator for local dev)
- Playwright (for web scraping)

## Project Structure

```
alko-mcp/
├── src/
│   ├── server.ts           # MCP server entry point (stdio transport)
│   ├── config.ts           # Configuration and environment variables
│   ├── tools/              # MCP tool implementations
│   │   ├── search-products.ts
│   │   ├── get-product.ts
│   │   ├── get-recommendations.ts
│   │   ├── list-stores.ts
│   │   ├── get-store-hours.ts
│   │   ├── get-availability.ts
│   │   └── get-sync-status.ts
│   ├── services/
│   │   ├── firestore.ts    # Firestore database operations
│   │   ├── scraper.ts      # Playwright-based web scraper
│   │   ├── cache.ts        # LRU cache for search results
│   │   └── data-sync.ts    # Product and store sync orchestration
│   ├── types/
│   │   └── index.ts        # TypeScript type definitions
│   └── utils/
│       ├── logger.ts       # Pino logger (writes to stderr + /tmp/alko-mcp.log)
│       ├── rate-limiter.ts # Rate limiting for scraping
│       └── excel-parser.ts # Alko price list Excel parser
├── scripts/
│   ├── sync-data.ts        # Sync products from Excel price list
│   ├── sync-stores.ts      # Scrape stores from Alko.fi
│   └── export-seed-data.ts # Export to seed file with diff
├── data/
│   └── seed-data.json      # Bundled seed data (auto-loaded if Firestore empty)
├── tests/
│   ├── unit/               # Unit tests (excel-parser, rate-limiter, search-products)
│   ├── integration/        # Integration tests (tools, store-hours)
│   └── fixtures/           # Test data (6000+ products)
└── dist/                   # Compiled JavaScript output
```

## Available MCP Tools

### 1. `search_products`
Search the Alko product catalog with filters.

**Parameters:**
- `query` (string, optional): Text search in product name/producer/country/description (supports multi-word queries)
- `type` (string, optional): Product type (e.g., "punaviinit", "valkoviinit", "oluet")
- `country` (string, optional): Country of origin
- `minPrice` / `maxPrice` (number, optional): Price range in EUR
- `minAlcohol` / `maxAlcohol` (number, optional): Alcohol percentage range
- `limit` (number, default 20): Max results to return

### 2. `get_product`
Get detailed information about a specific product.

**Parameters:**
- `productId` (string, required): Alko product ID (e.g., "004246")
- `includeEnrichedData` (boolean, default false): If true, scrapes additional data from product page:
  - `tasteProfile`: Detailed taste description
  - `usageTips`: Usage and pairing tips
  - `servingSuggestion`: Serving temperature and suggestions
  - `foodPairings`: Array of food pairing symbols (e.g., "seurustelujuoma", "tulinen ruoka")
  - `certificates`: Array of certification labels (e.g., "Luomu", "Vegaaneille soveltuva tuote", "Työolot", "Tuotanto", "Viljely")
  - `ingredients`: Producer declared ingredients (Tuottajan ilmoittamat ainesosat)
  - Enriched data is cached to Firestore after first scrape

### 3. `get_recommendations`
Get product recommendations based on criteria. Uses Alko's official food pairing data when `foodPairing` is specified.

**Parameters:**
- `occasion` (string, optional): e.g., "dinner party", "gift", "celebration", "nightcap"
- `foodPairing` (string, optional): Food to pair with. Supports Finnish or English:
  - Finnish: "äyriäiset", "kana", "nauta", "sushi", "pasta"
  - English: "seafood", "chicken", "steak", "salmon", "pizza"
  - Scrapes Alko search with food symbol filter to get products with official pairing data
- `preferredTypes` (array, optional): e.g., ["punaviinit", "viskit"]
- `priceRange` (object, optional): `{ min, max }`
- `preferOrganic` / `preferVegan` (boolean, optional)
- `country` (string, optional): Preferred country of origin
- `limit` (number, default 5)

**Returns:**
- `recommendations`: Array of matching products
- `reasoning`: Explanation of the recommendation criteria
- `foodSymbol`: The matched food category (if foodPairing was used)
- `availableFoodSymbols`: List of valid food categories (if no match found)

**Available Food Pairings (33 categories):**
Aperitiivi, Blinit, Grilliruoka, Itämainen ruoka, Kana/kalkkuna, Keitot, Lammas, Makea jälkiruoka, Maksa, Marjat ja hedelmät, Mausteiset makkarat, Miedot juustot, Miedot makkarat, Nauta, Nautiskelujuoma, Noutopöytä, Pasta ja pizza, Pataruoka, Pikkusuolaiset, Porsas, Rasvainen kala, Riista, Riistalinnut, Salaatit/kasvisruoka, Seurustelujuoma, Sienet, Simpukat ja osterit, Sushi, Tapas ja antipasti, Tulinen ruoka, Vähärasvainen kala, Voimakkaat juustot, Äyriäiset

### 4. `list_stores`
List Alko stores, optionally filtered by city. Includes today's opening hours.

**Parameters:**
- `city` (string, optional): Filter by city name (case-insensitive)
- `limit` (number, default 50): Maximum stores to return

### 5. `get_store_hours`
Get opening hours for Alko stores. Shows current status (open/closed) and hours for today/tomorrow.

**Parameters:**
- `storeId` (string, optional): Get hours for a specific store by ID
- `storeName` (string, optional): Search by store name (e.g., "Kamppi", "Kontula")
- `city` (string, optional): Filter by city name (case-insensitive)
- `openNow` (boolean, optional): Only show stores that are currently open
- `limit` (number, default 20): Maximum stores to return

**Returns:**
- `stores`: Array of store objects with hours
- `currentTime`: Current time in HH:MM format
- `dataAsOf`: Date when store data was last synced (YYYY-MM-DD)
- `refreshed`: True if data was refreshed during this call
- `refreshError`: Error message if refresh failed

**Note:** Opening hours are only valid for the day they were scraped. If store data is stale (from a previous day), it is automatically refreshed from Alko.fi (scrapes main store listing page). If refresh fails, `openingHoursToday` and `openingHoursTomorrow` will be null.

### 6. `get_availability`
Check product availability in stores. Uses Playwright to scrape real-time data.

**Parameters:**
- `productId` (string, required): Product ID to check
- `city` (string, optional): Filter results by city
- `forceRefresh` (boolean, default false): Force fresh scrape vs cached data

### 7. `sync_products`
Trigger a manual sync of product data from Excel price list.

### 8. `get_sync_status`
Get information about data freshness and sync status.

### 9. `get_vivino_rating`
Get Vivino wine rating for a product. Searches Vivino.com and scrapes rating data.

**Parameters:**
- `wineName` (string, optional): Wine name to search for on Vivino
- `winery` (string, optional): Winery/producer name to help narrow search
- `vivinoUrl` (string, optional): Direct Vivino URL if known

**Returns:**
- `found`: Whether a matching wine was found with ratings
- `rating`: Rating data (if found):
  - `wineName`: Wine name on Vivino
  - `winery`: Producer name
  - `averageRating`: Rating (1.0 - 5.0)
  - `ratingsCount`: Number of ratings
  - `vivinoUrl`: Direct link to wine page
- `error`: Error message if wine not found or has insufficient ratings
- `fromCache`: Whether result came from cache

**Caching:** Vivino ratings use two-tier caching:
- **L1 (memory):** 1 hour TTL for fast repeated lookups within a session
- **L2 (Firestore):** Persistent cache (no expiration)

**Notes:**
- This tool is separate from Alko data and scrapes Vivino.com directly
- Some wines exist on Vivino but don't have enough ratings yet - these return `found: false` with error "Wine found on Vivino but does not have enough ratings yet"

## Data Sources

### Product Catalog
- **Source:** Alko Excel price list (`alkon-hinnasto-tekstitiedostona.xlsx`)
- **URL:** `https://www.alko.fi/INTERSHOP/static/WFS/Alko-OnlineShop-Site/-/Alko-OnlineShop/fi_FI/Alkon%20Hinnasto%20Tekstitiedostona/alkon-hinnasto-tekstitiedostona.xlsx`
- **Sync command:** `npm run sync-data`
- **Contains:** ~12,000 products with price, alcohol %, origin, type, description

### Store List
- **Source:** Alko.fi store finder page (web scraped)
- **URL:** `https://www.alko.fi/myymalat-palvelut`
- **Sync command:** `npm run sync-stores`
- **Contains:** ~360 stores with:
  - Name, address, city, postal code
  - Opening hours (today and tomorrow)
  - Phone and email (when scraped from individual pages)

### Store Availability
- **Source:** Individual product pages (web scraped on-demand)
- **URL pattern:** `https://www.alko.fi/tuotteet/{productId}`
- **Scraped elements:** `li.store-item.stockInStore` in availability panel
- **Format:** Store name + quantity range (e.g., "6-10", "21-30")

## Web Scraping Implementation

The scraper (`src/services/scraper.ts`) uses Playwright to bypass Alko.fi's Incapsula bot protection:

1. **Stealth mode:** Removes `navigator.webdriver` flag, sets realistic user agent
2. **Session establishment:** Visits homepage first to get cookies
3. **Rate limiting:** 2-second delay between requests with jitter
4. **Exponential backoff:** On errors, waits progressively longer

### Availability Scraping Flow
1. Navigate to product page
2. Click "Katso myymäläsaatavuus" link
3. Click dropdown to reveal store list
4. Extract `li.store-item.stockInStore` elements
5. Parse store name and quantity from text content

## Database (Firestore)

Collections:
- `products` - Product catalog (keyed by product ID)
- `stores` - Store information (keyed by store ID)
- `availability` - Product availability per store
- `syncLogs` - Sync operation history

### Local Development
Use Firestore emulator. Seed data is automatically loaded on first query if empty.

```bash
# Step 1: Start emulator (keep running)
gcloud emulators firestore start --host-port=localhost:8081

# Step 2: Start Claude Desktop (uses config below)
# Seed data (~12,000 products, ~360 stores) is auto-loaded on first tool call
```

#### Optional: Manual Data Sync

```bash
export FIRESTORE_EMULATOR_HOST=localhost:8081
npm run sync-data    # Sync fresh products from Excel
npm run sync-stores  # Sync fresh stores from website
npm run export-seed  # Export to seed file (shows diff)
```

Note: `GOOGLE_CLOUD_PROJECT` defaults to `alko-mcp-dev` when `FIRESTORE_EMULATOR_HOST` is set.

## Configuration

Environment variables:
- `GOOGLE_CLOUD_PROJECT` - GCP project ID (defaults to `alko-mcp-dev` when emulator is used)
- `FIRESTORE_EMULATOR_HOST` - For local development (e.g., "localhost:8081")
- `LOG_LEVEL` - Pino log level (default: "info")
- `MCP_TRANSPORT` - "stdio" (default) or "http"
- `PORT` - HTTP server port (default: 8080)
- `API_TOKEN` - Bearer token for HTTP authentication. If set, all requests (except `/health`) require `Authorization: Bearer <token>` header. If not set, no authentication required (local dev mode).

**Auto-detected:**
- `K_SERVICE` - Set by Cloud Run. Used to detect production environment (`config.isCloudRun`).

## Claude Desktop Configuration

### Local Development (stdio transport)

Config file: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "alko": {
      "command": "node",
      "args": ["/path/to/alko-mcp/dist/server.js"],
      "env": {
        "FIRESTORE_EMULATOR_HOST": "localhost:8081"
      }
    }
  }
}
```

### Production (HTTP transport)

For remote Cloud Run deployment (no authentication required):

```json
{
  "mcpServers": {
    "alko": {
      "url": "https://YOUR-CLOUD-RUN-URL.run.app/mcp",
      "transport": "streamable-http"
    }
  }
}
```

**Note:** The production endpoint is public for compatibility with ChatGPT and other MCP clients that don't support custom authentication headers. See DEPLOYMENT.md for API token authentication if needed.

## Development Commands

```bash
npm run build        # Compile TypeScript
npm run dev          # Run with tsx watch mode
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once (232 tests)
npm run typecheck    # Type check without emitting
npm run sync-data    # Sync products from Excel
npm run sync-stores  # Scrape stores from website
```

## Logging

Logs are written to:
- **stderr** - For MCP stdio compatibility
- **/tmp/alko-mcp.log** - File log for debugging

View logs: `tail -f /tmp/alko-mcp.log`

## Key Implementation Notes

1. **MCP Transport:** Uses stdio transport for Claude Desktop integration. The `server.registerTool()` API is used (not the deprecated `server.tool()`).

2. **Logger writes to stderr + file:** Critical for MCP - stdout is reserved for JSON-RPC communication.

3. **Cache immutability:** When filtering cached results, always create copies to avoid mutating the LRU cache.

4. **Product search with relevance scoring:** For text queries, fetches up to 15,000 products and filters client-side (Firestore doesn't support full-text search). Multi-word queries match ALL words across name, producer, country, region, type, subtype, description, and grapes fields. Results are ranked by relevance:
   - Score 100: Exact phrase match in name (e.g., "Suomi Viina" finds product named "Suomi Viina" first)
   - Score 80: All words in name (not as phrase)
   - Score 60: Exact phrase in producer
   - Score 50: All words in producer
   - Score 40: Exact phrase in other field
   - Score 30: All words in other single field
   - Score 20: Words found across multiple fields

5. **Store availability elements:** Are `<li>` not `<div>`, with text format "Store Name\nQuantity Range".

6. **Store opening hours:** Extracted from store listing page with format "Auki tänään:9-20". Stored as `openingHoursToday` and `openingHoursTomorrow` fields.

7. **Bot protection bypass:** Uses Playwright with stealth mode - removes `navigator.webdriver`, sets realistic user agent, establishes session on homepage first.

8. **City matching is case-insensitive:** Store data has cities in uppercase (e.g., "HELSINKI"), but queries work with any case.

9. **Enriched data caching:** When `includeEnrichedData=true`, scraped data is persisted to Firestore to avoid re-scraping.

10. **Automatic seed data loading:** On first tool call, if Firestore is empty, bundled seed data from `data/seed-data.json` is automatically loaded. This eliminates the need for manual `npm run sync-data` after starting the emulator.

11. **Alko.fi backend:** Runs on **Intershop Commerce Suite** (ICM 7). Key URL parameters:
    - `SearchParameter`: URL-encoded query containing `@QueryTerm`, `foodSymbolId`, `OnlineFlag`
    - `foodSymbolId`: Food pairing filter (e.g., `foodSymbol_Ayriaiset` for seafood)
    - `ContextCategoryUUID`: Optional catalog category scope (not required for food symbol searches)
    - Intershop docs: https://support.intershop.com/kb/index.php/Display/23T257

12. **MCP Tool Annotations:** All tools include MCP spec annotations for better client behavior:
    - `title`: Human-readable name displayed in tool lists
    - `readOnlyHint`: True for read-only tools, false for `sync_products` which writes to Firestore
    - `idempotentHint`: True for all tools (safe to retry)
    - `openWorldHint`: True for tools that scrape external sites (alko.fi, vivino.com), false for local-only tools

## Testing

- **Unit tests:** `tests/unit/` - Excel parser, rate limiter, search products with relevance scoring, scraper regex parsing, Vivino scraper parsing (178 tests with 6000+ dummy products)
- **Integration tests:** `tests/integration/` - Tool handlers with mock Firestore, store hours stale data detection (26 tests)
- **Test fixtures:** `tests/fixtures/products.ts` - Real product data (36 products) + 6000 generated products

Run with: `npm run test:run` (232 tests total)
