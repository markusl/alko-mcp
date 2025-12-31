# Alko MCP Server

A production-grade [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that provides AI assistants with access to the [Alko.fi](https://www.alko.fi/) alcohol product catalog.

## Features

- **Product Search**: Search 11,900+ products by name, type, country, price range, alcohol %, and more
- **Product Details**: Get detailed information including enriched data (taste profile, food pairings, certificates, serving suggestions)
- **Vivino Ratings**: Get wine ratings from Vivino.com by name or URL
- **Store Hours**: Check store opening hours with "open now" filtering
- **Store Availability**: Check real-time stock availability at Alko stores (via web scraping)
- **Recommendations**: Get product recommendations based on food pairings, occasions, and preferences
- **Store Listing**: Browse 360+ Alko stores by city

All tools return **compact JSON** for efficient LLM token usage.

## Demo

<video src="https://github.com/user-attachments/assets/ca9535c2-b3e4-44da-b509-5f55793b9d4a" controls width="100%"></video>

*Claude Desktop using Alko MCP to search products, check availability, and get recommendations.*

## MCP Tools

| Tool | Description |
|------|-------------|
| `search_products` | Search products by name, type, country, price range, alcohol % |
| `get_product` | Get product details. Set `includeEnrichedData=true` for taste, food pairings, serving tips |
| `get_store_hours` | Get store opening hours. Filter by city, name, or `openNow=true`. Auto-refreshes if stale |
| `get_availability` | Check store stock for a product (scrapes alko.fi) |
| `list_stores` | List Alko stores by city |
| `get_recommendations` | Get personalized product recommendations |
| `get_vivino_rating` | Get Vivino wine rating by name or URL (scrapes vivino.com) |
| `sync_products` | Sync database with latest Alko price list |
| `get_sync_status` | Check sync status and product count |

## Quick Start

### Prerequisites

- Node.js 24+
- Google Cloud Firestore (or emulator for local dev)
- Playwright (auto-installed for web scraping)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/alko-mcp.git
cd alko-mcp

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Build
npm run build
```

### Local Development with Firestore Emulator

**Step 1: Start Firestore Emulator** (keep running in background)
```bash
gcloud emulators firestore start --host-port=localhost:8081
```

**Step 2: Start Claude Desktop** (or other AI assistant)

The MCP server will automatically load bundled seed data (~12,000 products, ~360 stores) on first query if the emulator is empty. No manual sync required!

> **Note**: The emulator doesn't persist data. After restarting the emulator, seed data will be auto-loaded again on first use.

#### Optional: Fresh Data Sync

If you need the latest product data from Alko.fi:

```bash
export FIRESTORE_EMULATOR_HOST=localhost:8081

# Sync fresh products from Excel (~30 seconds)
npm run sync-data

# Sync fresh stores from website (~2 minutes)
npm run sync-stores

# Export to seed file (for sharing with team)
npm run export-seed
```

## AI Assistant Configuration

### Claude Desktop

Config file: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

```json
{
  "mcpServers": {
    "alko": {
      "command": "node",
      "args": ["/absolute/path/to/alko-mcp/dist/server.js"],
      "env": {
        "FIRESTORE_EMULATOR_HOST": "localhost:8081"
      }
    }
  }
}
```

### ChatGPT Desktop

Config file: `~/.config/chatgpt/mcp.json` (macOS/Linux) or `%APPDATA%\chatgpt\mcp.json` (Windows)

```json
{
  "servers": {
    "alko": {
      "command": "node",
      "args": ["/absolute/path/to/alko-mcp/dist/server.js"],
      "env": {
        "FIRESTORE_EMULATOR_HOST": "localhost:8081"
      }
    }
  }
}
```

### Google Gemini (AI Studio)

For Gemini, use HTTP transport. Start the server with:

```bash
MCP_TRANSPORT=http PORT=3000 node dist/server.js
```

Then configure in AI Studio with the MCP endpoint URL:
```
http://localhost:3000/mcp
```

For production, deploy to Cloud Run and use the public URL.

### Claude Code CLI

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "alko": {
      "command": "node",
      "args": ["./dist/server.js"],
      "env": {
        "FIRESTORE_EMULATOR_HOST": "localhost:8081"
      }
    }
  }
}
```

## Example Prompts

### 🔍 Basic Search
> **Etsi minulle hyviä italialaisia punaviinejä alle 20 euroa**
>
> *Searches for Italian red wines under €20*

### 🍷 Wine Recommendations
> **Suosittele viiniä grillatulle lohelle. Budjetti noin 15-25 euroa.**
>
> *Recommends wine for grilled salmon within budget*

### 🥂 Champagne & Sparkling
> **Mitä samppanjoita Alkossa on saatavilla? Näytä 5 parasta vaihtoehtoa.**
>
> *Lists champagne options*

### 🍺 Craft Beer Search
> **Etsi IPA-oluita Suomesta tai muista Pohjoismaista**
>
> *Searches for Nordic IPA beers*

### 📊 Product Details
> **Kerro lisää tuotteesta numero 906458**
>
> *Gets detailed product information with taste profile*

### 🏪 Store Hours
> **Mitkä Alkon myymälät ovat auki nyt Helsingissä?**
>
> *Lists Helsinki stores that are open now*

### 📍 Store Availability
> **Onko Barolo-viiniä saatavilla Helsingin myymälöissä?**
>
> *Checks product availability in Helsinki stores*

### 🎁 Gift Recommendations
> **Etsi lahjaideoita viininystävälle. Budjetti 50-100 euroa.**
>
> *Premium gift ideas for wine lovers*

### 🧀 Food Pairing (uses Alko's official pairing data)
> **Suosittele viiniä äyriäisille** / **Recommend wine for seafood**
>
> *Uses Alko's food symbol search to find products officially tagged for seafood pairing*

> **Tarvitsen viinin juustolautaselle. Juustot: brie, manchego ja sinihomejuusto.**
>
> *Wine for cheese platter - matches "miedot juustot" and "voimakkaat juustot"*

### 🌍 Region-specific Search
> **Hae espanjalaisia punaviinejä Rioja-alueelta**
>
> *Spanish wines from Rioja region*

### 💰 Budget Shopping
> **Parhaat viinit alle 10 eurolla arki-iltoihin**
>
> *Best budget wines for weeknight dinners*

### 🍾 Special Occasions
> **Suosittele kuohuviiniä uudenvuoden juhliin 20 hengelle**
>
> *Sparkling wine for New Year's party*

### ⭐ Vivino Ratings
> **Etsi punaviinejä 15-25€ ja tarkista niiden Vivino-arvostelut**
>
> *Searches for red wines and checks their Vivino ratings*

### 🏆 Best Rated Wines
> **Mikä on Alkon parhaiten arvioitu Barolo Vivinossa?**
>
> *Finds Barolo wines and compares their Vivino ratings*

### 📈 Wine Comparison
> **Vertaile näiden viinien Vivino-arvosanoja: Amarone, Brunello di Montalcino**
>
> *Compares Vivino ratings for premium Italian wines*

## Data Sources

### Product Catalog
- **Source**: Alko's public Excel price list
- **URL**: `https://www.alko.fi/.../alkon-hinnasto-tekstitiedostona.xlsx`
- **Products**: ~11,900
- **Update**: Run `npm run sync-data`

### Store Data
- **Source**: Scraped from alko.fi store finder
- **Stores**: ~360
- **Includes**: Name, address, opening hours (today/tomorrow)
- **Update**: Run `npm run sync-stores`

### Enriched Product Data
- **Source**: Scraped from individual product pages
- **Includes**: Taste profile, usage tips, serving suggestions, food pairings, certificates, ingredients
- **Cached**: Persisted to Firestore after first scrape

## Product Fields

| Field | Description |
|-------|-------------|
| `id` | Product ID (e.g., "004246") |
| `name` | Product name |
| `producer` | Producer/manufacturer |
| `price` | Price in EUR |
| `pricePerLiter` | Price per liter |
| `bottleSize` | Volume (e.g., "0.75 l") |
| `type` | Category (punaviinit, valkoviinit, oluet, etc.) |
| `subtype` | Flavor profile (e.g., "Mehevä & Hilloinen") |
| `country` | Country of origin |
| `region` | Wine region |
| `alcoholPercentage` | Alcohol % |
| `description` | Taste description from Excel |
| `tasteProfile` | Detailed taste (enriched, scraped) |
| `usageTips` | Usage suggestions (enriched) |
| `servingSuggestion` | Serving temperature (enriched) |
| `foodPairings` | Food pairing symbols (enriched) |
| `certificates` | Certification labels: Luomu, Vegaani, etc. (enriched) |
| `ingredients` | Producer declared ingredients (enriched) |
| `assortment` | vakiovalikoima, tilausvalikoima, etc. |

## Development

```bash
npm run build        # Compile TypeScript
npm run dev          # Run with tsx watch mode
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once (232 tests)
npm run typecheck    # Type check
npm run sync-data    # Sync products from Excel
npm run sync-stores  # Scrape stores from website
npm run export-seed  # Export data to seed file (with diff)
```

### Logs

```bash
tail -f /tmp/alko-mcp.log
```

## Deployment to Google Cloud Run

```bash
# Enable APIs
gcloud services enable run.googleapis.com firestore.googleapis.com

# Create Firestore database
gcloud firestore databases create --location=europe-north1

# Deploy
gcloud run deploy alko-mcp \
  --source . \
  --region europe-north1 \
  --memory 1Gi \
  --set-env-vars="MCP_TRANSPORT=http"
```

## Legal Disclaimer

- The Alko price list is publicly available data
- Web scraping respects rate limits (2s between requests)
- This is an unofficial project not affiliated with Alko Oy
- Alcohol products can only be purchased by persons 18+ in Finland

## License

MIT License
