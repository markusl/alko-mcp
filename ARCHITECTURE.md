# Alko MCP Server - Architecture Documentation

This document describes the architecture, design principles, and key components of the Alko MCP (Model Context Protocol) server.

## Overview

Alko MCP is a server that enables AI assistants (like Claude) to query the Finnish state alcohol retailer Alko's product catalog. It implements the Model Context Protocol (MCP) to expose tools for searching products, checking store availability, and getting recommendations.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Claude Desktop                                 │
│                    (or other MCP-compatible client)                      │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ MCP Protocol (stdio/HTTP)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Alko MCP Server                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         MCP Tools Layer                          │   │
│  │  search_products │ get_product │ get_availability │ list_stores │   │
│  │  get_store_hours │ get_recommendations │ sync_products          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        Services Layer                            │   │
│  │  FirestoreService │ AlkoScraper │ DataSyncService │ CacheService│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        Utilities Layer                           │   │
│  │    RateLimiter │ ExcelParser │ Logger │ Config                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Firestore   │     │    Alko.fi      │     │  Excel Price    │
│   Database    │     │   (Playwright)  │     │     List        │
└───────────────┘     └─────────────────┘     └─────────────────┘
```

## Design Principles

### 1. Singleton Pattern for Shared Resources
All services (Firestore, Scraper, Cache, DataSync) use the singleton pattern to ensure a single instance manages shared resources like database connections and browser instances.

```typescript
let firestoreService: FirestoreService | null = null;

export function getFirestoreService(): FirestoreService {
  if (!firestoreService) {
    firestoreService = new FirestoreService();
  }
  return firestoreService;
}
```

### 2. Separation of Concerns
- **Tools Layer**: Handles MCP protocol, input validation (via Zod schemas), and response formatting
- **Services Layer**: Contains business logic and data access
- **Utilities Layer**: Provides cross-cutting concerns (logging, rate limiting, parsing)

### 3. Graceful Bot Protection Bypass
The scraper uses Playwright with stealth techniques to ethically access public data:
- Session establishment via homepage visit
- Realistic user agent and viewport
- Rate limiting with random jitter
- Exponential backoff on errors

### 4. Multi-Layer Caching
```
┌──────────────────────────────────────────────────────────┐
│                     Request Flow                          │
└──────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐     ┌──────────┐
│  LRU Memory     │────▶│   Firestore     │────▶│  Alko.fi │
│  Cache (fast)   │ miss│   (persistent)  │ miss│  Scraper │
└─────────────────┘     └─────────────────┘     └──────────┘
    Products: 1hr           Products: ∞         On-demand
    Searches: 15min         Availability: ∞     Rate limited
    Availability: 1hr
```

### 5. Automatic Seed Data Loading
On first query, if Firestore is empty, the system automatically loads bundled seed data (~12,000 products, ~360 stores) to ensure immediate usability.

### 6. Compact JSON for LLM Efficiency
Tool responses strip null values and convert Firestore Timestamps to ISO strings to minimize token usage.

## Component Architecture

### Server Entry Point (`src/server.ts`)

The server supports two transport modes:
- **STDIO** (default): For Claude Desktop integration via JSON-RPC over stdin/stdout
- **HTTP**: For web-based clients via StreamableHTTPServerTransport

```
┌─────────────────────────────────────────────┐
│              MCP Server                      │
│  ┌────────────────┐  ┌────────────────┐    │
│  │ STDIO Transport│  │ HTTP Transport │    │
│  │   (default)    │  │   (optional)   │    │
│  └───────┬────────┘  └───────┬────────┘    │
│          └───────────┬───────┘              │
│                      ▼                      │
│          ┌────────────────────┐             │
│          │  Tool Registration │             │
│          │  (8 tools)         │             │
│          └────────────────────┘             │
└─────────────────────────────────────────────┘
```

### Tools Layer (`src/tools/`)

Each tool follows a consistent pattern:

```typescript
// 1. Define Zod schema for input validation
export const searchProductsSchema = z.object({
  query: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  // ...
});

// 2. Export typed handler function
export async function searchProducts(input: SearchProductsInput) {
  await ensureData();  // Auto-load seed data if needed
  // ... business logic
}
```

**Available Tools:**
| Tool | Purpose |
|------|---------|
| `search_products` | Full-text search with filters (type, country, price, alcohol) |
| `get_product` | Get single product by ID, optionally with scraped enriched data |
| `get_availability` | Check real-time store stock via web scraping |
| `list_stores` | List Alko stores, filterable by city |
| `get_store_hours` | Get opening hours, filter by open now |
| `get_recommendations` | AI-friendly recommendations based on criteria |
| `sync_products` | Trigger manual data sync from Excel |
| `get_sync_status` | Check data freshness |

### Services Layer (`src/services/`)

#### FirestoreService
Handles all database operations with Firestore:
- Product CRUD with batch upsert (500 per batch)
- Text search with relevance scoring (client-side filtering)
- Store management
- Availability tracking
- Sync log management

**Relevance Scoring Algorithm:**
```
Score 100: Exact phrase in name     → "Suomi Viina" matches product "Suomi Viina"
Score  80: All words in name        → "viina suomi" finds same product
Score  60: Exact phrase in producer
Score  50: All words in producer
Score  40: Exact phrase in other field (country, region, type, etc.)
Score  30: All words in other field
Score  20: Words across multiple fields
```

#### AlkoScraper
Playwright-based web scraper with stealth capabilities:

```
┌───────────────────────────────────────────────────────────────┐
│                     Scraping Flow                              │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ Check Memory  │────▶│ Establish     │────▶│ Rate Limit    │
│ Cache         │ miss│ Session       │     │ (2s + jitter) │
└───────────────┘     └───────────────┘     └───────────────┘
                                                    │
        ┌───────────────────────────────────────────┘
        ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ Navigate to   │────▶│ Extract Data  │────▶│ Save to       │
│ Product Page  │     │ (DOM parsing) │     │ Firestore     │
└───────────────┘     └───────────────┘     └───────────────┘
```

**Stealth Techniques:**
- Removes `navigator.webdriver` property
- Sets realistic Chrome user agent
- Uses Finnish locale and Helsinki timezone
- Handles OneTrust cookie consent
- Applies exponential backoff on errors

#### DataSyncService
Orchestrates data synchronization:

```
┌────────────────────────────────────────────────────────────────┐
│                    Product Sync Flow                            │
└────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ Download      │────▶│ Parse Excel   │────▶│ Validate      │
│ Price List    │     │ (xlsx lib)    │     │ Products      │
└───────────────┘     └───────────────┘     └───────────────┘
                                                    │
        ┌───────────────────────────────────────────┘
        ▼
┌───────────────┐     ┌───────────────┐
│ Batch Upsert  │────▶│ Log Sync      │
│ to Firestore  │     │ Status        │
└───────────────┘     └───────────────┘
```

#### CacheService
LRU (Least Recently Used) in-memory cache:

| Cache Type | Max Size | TTL | Purpose |
|------------|----------|-----|---------|
| Products | 5,000 | 1 hour | Individual product lookups |
| Searches | 500 | 15 min | Search result sets |
| Stats | 100 | 1 hour | Aggregated statistics |

### Utilities Layer (`src/utils/`)

#### Rate Limiter
```typescript
class RateLimiter {
  // Minimum interval: 2000ms
  // Jitter: 0-1000ms random
  throttleWithJitter(): Promise<void>
}

class ExponentialBackoff {
  // Base: 2000ms, Max: 60000ms, Factor: 2x
  // Delays: 2s → 4s → 8s → 16s → 32s → 60s
  wait(): Promise<void>
}
```

#### Excel Parser
Parses Alko's official price list (30 columns, ~12,000 rows):
```
Excel Row → AlkoExcelRow (validated) → Product Entity
```

## Data Model

### Product Entity
```typescript
interface Product {
  // Identifiers
  id: string;           // "906458"
  name: string;         // "Fair & Square Red 2024"
  ean: string;          // EAN barcode

  // Pricing
  price: number;        // 11.98 EUR
  pricePerLiter: number;

  // Classification
  type: string;         // "punaviinit"
  subtype: string;      // "Mehevä & Hilloinen"
  country: string;      // "Ranska"
  region: string;       // "Bordeaux"

  // Enriched (scraped)
  tasteProfile: string;
  foodPairings: string[];
  ingredients: string;

  // Technical
  alcoholPercentage: number;
  sugar: number;
  acids: number;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Store Entity
```typescript
interface Store {
  id: string;           // "2736"
  name: string;         // "Alko Helsinki Kamppi"
  city: string;         // "HELSINKI"
  address: string;      // "Urho Kekkosen katu 1"
  postalCode: string;   // "00100"
  openingHoursToday: string;    // "9-21" or "SULJETTU"
  openingHoursTomorrow: string;
}
```

### Availability Entity
```typescript
interface StoreAvailability {
  id: string;           // "{productId}_{storeId}"
  productId: string;
  storeId: string;
  storeName: string;
  quantity: number;     // Stock amount
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  checkedAt: Timestamp;
}
```

## Firestore Collections

```
firestore/
├── products/           # ~12,000 documents
│   └── {productId}/    # Product data + enriched fields
├── stores/             # ~360 documents
│   └── {storeId}/      # Store info + hours
├── availability/       # Dynamic, scraped on-demand
│   └── {productId}_{storeId}/
└── syncLogs/           # Sync operation history
    └── {logId}/
```

## Request Flow Examples

### Product Search
```
1. Client → search_products(query: "bordeaux red", maxPrice: 20)
2. Tool validates input with Zod schema
3. ensureData() checks if Firestore has data
4. CacheService checks for cached results
5. FirestoreService.searchProducts() executes:
   - Fetches up to 15,000 products
   - Filters client-side (Firestore lacks full-text search)
   - Scores and ranks by relevance
   - Returns paginated results
6. Results cached in LRU cache
7. Response converted to compact JSON
```

### Store Availability
```
1. Client → get_availability(productId: "906458")
2. Check memory cache → miss
3. Check Firestore cache → miss or stale
4. AlkoScraper.getProductAvailability():
   - Establish session (visit homepage)
   - Rate limit (2s + jitter)
   - Navigate to product page
   - Click availability panel
   - Extract store stock from DOM
5. Save to Firestore
6. Cache in memory
7. Return to client
```

## Error Handling

```
┌─────────────────────────────────────────────────────────────┐
│                    Error Handling Strategy                   │
└─────────────────────────────────────────────────────────────┘

Scraper Errors:
├── Network Error → Exponential backoff (2s → 4s → 8s → ...)
├── Bot Detection → Reset session, retry
├── Timeout → Log and return partial results
└── Parse Error → Log warning, skip element

Database Errors:
├── Connection Failed → Retry with backoff
├── Quota Exceeded → Log error, return cached data
└── Document Not Found → Return null (expected case)

Sync Errors:
├── Excel Download Failed → Log to syncLogs, return error
├── Parse Error → Skip invalid rows, log count
└── Batch Write Failed → Retry current batch
```

## Configuration

Environment variables loaded via `src/config.ts`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8080 | HTTP server port |
| `NODE_ENV` | development | Environment mode |
| `GOOGLE_CLOUD_PROJECT` | alko-mcp-dev (emulator) | GCP project ID |
| `FIRESTORE_EMULATOR_HOST` | - | Use Firestore emulator |
| `SCRAPE_RATE_LIMIT_MS` | 2000 | Min delay between scrapes |
| `SCRAPE_CACHE_TTL_MS` | 3600000 | Scrape cache TTL (1 hour) |

## Testing Strategy

```
tests/
├── unit/                    # Fast, isolated tests
│   ├── excel-parser.test.ts # Parse validation
│   ├── rate-limiter.test.ts # Timing logic
│   └── search-products.test.ts  # 6000+ product fixtures
└── integration/             # Tool handler tests
    ├── tools.test.ts        # Mock Firestore
    └── store-hours.test.ts  # Opening hours logic
```

Total: 97 tests covering parsing, search relevance, rate limiting, and tool handlers.

## Deployment Considerations

### Local Development
```bash
# Start Firestore emulator
gcloud emulators firestore start --host-port=localhost:8081

# Server auto-loads seed data on first query
FIRESTORE_EMULATOR_HOST=localhost:8081 npm run dev
```

### Production
- Deploy to Cloud Run or similar
- Use real Firestore database
- Set up scheduled sync (cron) for daily price list updates
- Configure appropriate rate limits for scraping
