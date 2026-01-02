# Alko MCP Server - GCP Cloud Run Deployment Guide

This guide covers deploying the Alko MCP server to Google Cloud Run with Firestore, including API protection and seed data bootstrapping.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Claude Desktop / Claude Code                     │
│                         (MCP Client)                                 │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTPS (Streamable HTTP)
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Google Cloud Platform                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                Cloud Run (alko-mcp)                          │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │              Alko MCP Server                         │    │   │
│  │  │   • Streamable HTTP Transport                        │    │   │
│  │  │   • Playwright (for scraping)                        │    │   │
│  │  │   • Auto-loads seed data if DB empty                 │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                 │                                    │
│                                 ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Firestore                                │   │
│  │   • products (~12,000 docs)                                  │   │
│  │   • stores (~360 docs)                                       │   │
│  │   • availability (scraped on-demand)                         │   │
│  │   • syncLogs                                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │           Cloud Scheduler (optional)                         │   │
│  │   • Daily product sync (2 AM)                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Google Cloud SDK** installed and configured
2. **GCP Project** with billing enabled
3. **APIs enabled**:
   - Cloud Run API
   - Firestore API
   - Artifact Registry API
   - Cloud Build API

```bash
# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

## Cloud Run Requirements for Playwright

This server uses Playwright for web scraping, which requires specific Cloud Run configuration:

| Requirement | Value | Reason |
|-------------|-------|--------|
| **Memory** | 2Gi | Chromium needs 500MB-1GB |
| **CPU** | 2 | Browser performance |
| **Execution Environment** | Gen2 | Real Linux kernel (not gVisor) |
| **Concurrency** | 10 | Limit browser instances per container |
| **Node.js** | 22+ | LTS version with ES modules support |

**Docker Image Contents:**
- Node.js 22 (slim)
- Chromium browser (~400MB)
- X11/display libraries for headless Chrome
- Seed data for Firestore bootstrap (~11MB)

**Estimated image size:** ~600MB

## Step 1: Create Firestore Database

```bash
# Create Firestore database in Native mode
gcloud firestore databases create \
  --location=europe-north1 \
  --type=firestore-native
```

## Step 2: Create Artifact Registry Repository

```bash
# Create repository for Docker images
gcloud artifacts repositories create alko-mcp \
  --repository-format=docker \
  --location=europe-north1 \
  --description="Alko MCP Server images"
```

## Step 3: Deploy to Cloud Run

### Option A: Using Cloud Build (Recommended for CI/CD)

The project includes a `cloudbuild.yaml` that automates the build and deploy process:

```bash
# Deploy using Cloud Build
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_REGION=europe-north1,_REPO_NAME=alko-mcp,_SERVICE_NAME=alko-mcp
```

### Option B: Manual Deployment

```bash
# 1. Build the Docker image
docker build -t europe-north1-docker.pkg.dev/YOUR_PROJECT_ID/alko-mcp/alko-mcp:latest .

# 2. Push to Artifact Registry
docker push europe-north1-docker.pkg.dev/YOUR_PROJECT_ID/alko-mcp/alko-mcp:latest

# 3. Deploy to Cloud Run
gcloud run deploy alko-mcp \
  --image=europe-north1-docker.pkg.dev/YOUR_PROJECT_ID/alko-mcp/alko-mcp:latest \
  --region=europe-north1 \
  --platform=managed \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300s \
  --min-instances=0 \
  --max-instances=10 \
  --set-env-vars="NODE_ENV=production,MCP_TRANSPORT=http" \
  --no-allow-unauthenticated
```

### Option C: Source-based Deploy (Simplest)

```bash
# Deploy directly from source (uses Cloud Build internally)
gcloud run deploy alko-mcp \
  --source=. \
  --region=europe-north1 \
  --memory=1Gi \
  --timeout=300s \
  --set-env-vars="MCP_TRANSPORT=http" \
  --no-allow-unauthenticated
```

### Option D: Automated GitHub Deployment (CI/CD)

For automatic deployments on every push to `main`, choose one of these approaches:

#### Approach 1: Cloud Build Trigger (Recommended)

Connect GitHub to Cloud Build for native GCP integration:

```bash
# 1. Connect GitHub repository to Cloud Build
# Visit: https://console.cloud.google.com/cloud-build/triggers/connect
# Or use gcloud:
gcloud builds triggers create github \
  --name="alko-mcp-deploy" \
  --repo-name="alko-mcp" \
  --repo-owner="YOUR_GITHUB_USERNAME" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --substitutions="_REGION=europe-north1,_REPO_NAME=alko-mcp,_SERVICE_NAME=alko-mcp"
```

**Setup steps:**
1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click "Connect Repository"
3. Select "GitHub" and authenticate
4. Select your repository
5. Create trigger with these settings:
   - **Event:** Push to branch
   - **Branch:** `^main$`
   - **Configuration:** Cloud Build configuration file
   - **Location:** `cloudbuild.yaml`

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloud Build Trigger Flow                      │
└─────────────────────────────────────────────────────────────────┘

  GitHub Push (main)
        │
        ▼
  ┌───────────────┐
  │ Cloud Build   │
  │ Trigger       │
  └───────┬───────┘
          │
          ▼
  ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
  │ Build Docker  │────▶│ Push to       │────▶│ Deploy to     │
  │ Image         │     │ Artifact Reg  │     │ Cloud Run     │
  └───────────────┘     └───────────────┘     └───────────────┘
```

#### Approach 2: GitHub Actions

The project includes ready-to-use workflows in `.github/workflows/`:
- `deploy.yml` - Deploy to Cloud Run on push to main
- `test.yml` - Run tests on push/PR

The deploy workflow (`.github/workflows/deploy.yml`):

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]
  workflow_dispatch:  # Manual trigger

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  REGION: europe-north1
  SERVICE_NAME: alko-mcp
  REPO_NAME: alko-mcp

jobs:
  deploy:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      id-token: write  # Required for Workload Identity Federation

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker
        run: gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev

      - name: Build and push Docker image
        run: |
          docker build -t ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO_NAME }}/${{ env.SERVICE_NAME }}:${{ github.sha }} .
          docker build -t ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO_NAME }}/${{ env.SERVICE_NAME }}:latest .
          docker push ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO_NAME }}/${{ env.SERVICE_NAME }}:${{ github.sha }}
          docker push ${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO_NAME }}/${{ env.SERVICE_NAME }}:latest

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.SERVICE_NAME }} \
            --image=${{ env.REGION }}-docker.pkg.dev/${{ env.PROJECT_ID }}/${{ env.REPO_NAME }}/${{ env.SERVICE_NAME }}:${{ github.sha }} \
            --region=${{ env.REGION }} \
            --platform=managed \
            --memory=1Gi \
            --cpu=1 \
            --timeout=300s \
            --min-instances=0 \
            --max-instances=10 \
            --set-env-vars="NODE_ENV=production,MCP_TRANSPORT=http" \
            --no-allow-unauthenticated

      - name: Show deployment URL
        run: |
          URL=$(gcloud run services describe ${{ env.SERVICE_NAME }} --region=${{ env.REGION }} --format='value(status.url)')
          echo "Deployed to: $URL"
```

**GitHub Actions Setup with Workload Identity Federation (Recommended):**

```bash
# 1. Create a Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# 2. Create a Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# 3. Create a service account for GitHub Actions
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions"

# 4. Grant required permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# 5. Allow GitHub Actions to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding \
  github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/YOUR_PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_GITHUB_USERNAME/alko-mcp"

# 6. Get the Workload Identity Provider resource name
gcloud iam workload-identity-pools providers describe github-provider \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)"
# Output: projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

**Add GitHub Secrets:**

| Secret | Value |
|--------|-------|
| `GCP_PROJECT_ID` | Your GCP project ID |
| `WIF_PROVIDER` | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `WIF_SERVICE_ACCOUNT` | `github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com` |

#### Comparison: Cloud Build vs GitHub Actions

| Feature | Cloud Build Trigger | GitHub Actions |
|---------|---------------------|----------------|
| Setup complexity | Lower | Higher (WIF setup) |
| Cost | Free tier: 120 min/day | Free tier: 2000 min/month |
| Native GCP integration | Excellent | Good |
| Visibility | GCP Console | GitHub UI |
| Secrets management | GCP Secret Manager | GitHub Secrets |
| Build caching | Kaniko cache | Docker layer cache |
| Custom workflows | Limited | Very flexible |

**Recommendation:** Use **Cloud Build Triggers** for simpler setup and better GCP integration. Use **GitHub Actions** if you need complex workflows or want all CI/CD in GitHub.

## Step 4: API Protection Options

The MCP server should be protected in production. Choose one of these options:

### Option A: API Token Authentication (Recommended)

The server has built-in API token authentication. When the `API_TOKEN` environment variable is set, all requests (except `/health`) require a valid `Authorization: Bearer <token>` header.

**How it works:**
- **Local development:** No `API_TOKEN` set = no authentication required
- **Cloud Run:** `API_TOKEN` set via Secret Manager = token required
- **Detection:** Server uses `K_SERVICE` environment variable (set by Cloud Run) to detect production environment

**Setup:**

```bash
# 1. Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# 2. Generate and store API token
API_TOKEN=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
echo -n "$API_TOKEN" | gcloud secrets create alko-mcp-api-token \
  --data-file=- --replication-policy=automatic
echo "Your API token: $API_TOKEN"

# 3. Grant Cloud Run service account access to the secret
gcloud secrets add-iam-policy-binding alko-mcp-api-token \
  --member="serviceAccount:$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# 4. Deploy with secret binding and allow unauthenticated (app handles auth)
gcloud run deploy alko-mcp \
  --region=europe-north1 \
  --set-secrets="API_TOKEN=alko-mcp-api-token:latest" \
  --allow-unauthenticated

# 5. Allow public access (API token handles authentication)
gcloud run services add-iam-policy-binding alko-mcp \
  --region=europe-north1 \
  --member="allUsers" \
  --role="roles/run.invoker"
```

**Client usage:**

```bash
# Get your token
gcloud secrets versions access latest --secret=alko-mcp-api-token

# Test the endpoint
curl -X POST https://alko-mcp-xxx.a.run.app/mcp \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

**Claude Desktop configuration with API token:**

```json
{
  "mcpServers": {
    "alko": {
      "url": "https://alko-mcp-xxx.a.run.app/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer YOUR_API_TOKEN"
      }
    }
  }
}
```

### Option B: IAM Authentication

The `--no-allow-unauthenticated` flag requires IAM authentication:

```bash
# Grant access to a specific user
gcloud run services add-iam-policy-binding alko-mcp \
  --region=europe-north1 \
  --member="user:your-email@example.com" \
  --role="roles/run.invoker"

# Grant access to a service account
gcloud run services add-iam-policy-binding alko-mcp \
  --region=europe-north1 \
  --member="serviceAccount:mcp-client@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"
```

**Client Configuration with IAM:**

```json
{
  "mcpServers": {
    "alko": {
      "url": "https://alko-mcp-xxxxx-xx.a.run.app/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer $(gcloud auth print-identity-token)"
      }
    }
  }
}
```

### Option B: Identity-Aware Proxy (IAP)

For browser-based access with Google login:

```bash
# 1. Enable IAP API
gcloud services enable iap.googleapis.com

# 2. Configure IAP for Cloud Run
gcloud iap web enable \
  --resource-type=cloud-run \
  --service=alko-mcp \
  --region=europe-north1

# 3. Add IAP users
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run \
  --service=alko-mcp \
  --region=europe-north1 \
  --member="user:your-email@example.com" \
  --role="roles/iap.httpsResourceAccessor"
```

### Option C: Legacy API Key Header (Deprecated)

The server previously supported `X-API-Key` header. This has been replaced by the standard `Authorization: Bearer <token>` header (Option A). The new implementation supports both formats:

```bash
# Preferred: Bearer token
curl -H "Authorization: Bearer YOUR_TOKEN" ...

# Also supported: Direct token (without "Bearer" prefix)
curl -H "Authorization: YOUR_TOKEN" ...
```

### Option D: VPC Service Controls (Enterprise)

For maximum security, use VPC Service Controls to restrict access to the Cloud Run service.

## Step 5: Seed Data Bootstrapping

The server automatically loads bundled seed data on first query if Firestore is empty. However, you have several options for data initialization:

### Strategy 1: Bundled Seed Data (Default)

The `data/seed-data.json` file is bundled with the Docker image and auto-loaded:

```
┌─────────────────────────────────────────────────────────────────┐
│                    First MCP Request                             │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │  ensureData() called    │
                    └─────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │  Check Firestore count  │
                    └─────────────────────────┘
                                  │
                     ┌────────────┴────────────┐
                     ▼                         ▼
            ┌─────────────┐           ┌─────────────┐
            │  count > 0  │           │  count = 0  │
            │  (skip)     │           │  (load)     │
            └─────────────┘           └──────┬──────┘
                                             │
                                             ▼
                                  ┌─────────────────────┐
                                  │ Load seed-data.json │
                                  │ (~12K products)     │
                                  │ (~360 stores)       │
                                  └─────────────────────┘
```

**Seed data file handling:**

| File | In .gitignore | In .gcloudignore | Reason |
|------|---------------|------------------|--------|
| `data/seed-data.json` | **Yes** | **No** | Cache file, not in git but deployed |

The seed data is a generated cache file (~12MB) that:
- Is NOT committed to git (derived from public Alko price list)
- IS uploaded to Cloud Build (for fast Firestore bootstrap)
- IS bundled in the Docker image

**To update seed data before deployment:**

```bash
# 1. Start local emulator
gcloud emulators firestore start --host-port=localhost:8081

# 2. Sync fresh data from Alko.fi
FIRESTORE_EMULATOR_HOST=localhost:8081 npm run sync-data
FIRESTORE_EMULATOR_HOST=localhost:8081 npm run sync-stores

# 3. Export to seed file (creates data/seed-data.json)
FIRESTORE_EMULATOR_HOST=localhost:8081 npm run export-seed

# 4. Deploy (seed file is uploaded despite being in .gitignore)
gcloud builds submit --config=cloudbuild.yaml
```

### Strategy 2: Cloud Run Job for Initial Sync

Create a one-time Cloud Run Job to sync data:

```bash
# Create a sync job
gcloud run jobs create alko-sync-data \
  --image=europe-north1-docker.pkg.dev/YOUR_PROJECT_ID/alko-mcp/alko-mcp:latest \
  --region=europe-north1 \
  --memory=2Gi \
  --task-timeout=30m \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID" \
  --command="node" \
  --args="dist/scripts/sync-data.js"

# Execute the job
gcloud run jobs execute alko-sync-data --region=europe-north1
```

### Strategy 3: MCP Tool Trigger

Use the built-in `sync_products` tool from Claude:

```
User: Please sync the product database with the latest data from Alko.
Claude: [Calls sync_products tool]
```

### Strategy 4: Cloud Scheduler (Daily Updates)

Set up automated daily sync:

```bash
# 1. Create a service account for the scheduler
gcloud iam service-accounts create alko-scheduler \
  --display-name="Alko MCP Scheduler"

# 2. Grant Cloud Run invoker role
gcloud run services add-iam-policy-binding alko-mcp \
  --region=europe-north1 \
  --member="serviceAccount:alko-scheduler@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

# 3. Create scheduler job (calls sync endpoint daily at 2 AM)
gcloud scheduler jobs create http alko-daily-sync \
  --location=europe-north1 \
  --schedule="0 2 * * *" \
  --time-zone="Europe/Helsinki" \
  --uri="https://alko-mcp-xxxxx-xx.a.run.app/mcp" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --body='{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"sync_products","arguments":{}}}' \
  --oidc-service-account-email="alko-scheduler@YOUR_PROJECT_ID.iam.gserviceaccount.com"
```

## Step 6: Configure Claude Desktop

After deployment, configure Claude Desktop to use the remote MCP server:

### With IAM Authentication

```json
{
  "mcpServers": {
    "alko": {
      "command": "gcloud",
      "args": [
        "run",
        "services",
        "proxy",
        "alko-mcp",
        "--port=3000",
        "--region=europe-north1"
      ]
    }
  }
}
```

Or use direct URL with token:

```json
{
  "mcpServers": {
    "alko": {
      "url": "https://alko-mcp-xxxxx-xx.a.run.app/mcp",
      "transport": "streamable-http"
    }
  }
}
```

### With API Key

```json
{
  "mcpServers": {
    "alko": {
      "url": "https://alko-mcp-xxxxx-xx.a.run.app/mcp",
      "transport": "streamable-http",
      "headers": {
        "X-API-Key": "your-secret-key"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_CLOUD_PROJECT` | Yes* | - | GCP project ID (*auto-detected on Cloud Run) |
| `MCP_TRANSPORT` | No | stdio | Set to `http` for Cloud Run |
| `PORT` | No | 8080 | HTTP server port (Cloud Run sets this) |
| `NODE_ENV` | No | development | Set to `production` for Cloud Run |
| `API_TOKEN` | No | - | API token for Bearer authentication. If set, all requests (except /health) require `Authorization: Bearer <token>` header |
| `SCRAPE_RATE_LIMIT_MS` | No | 2000 | Rate limit for web scraping (ms) |
| `SCRAPE_CACHE_TTL_MS` | No | 3600000 | Scrape cache TTL (1 hour) |

**Auto-detected variables (set by Cloud Run):**
| Variable | Description |
|----------|-------------|
| `K_SERVICE` | Cloud Run service name. Used to detect production environment |
| `K_REVISION` | Cloud Run revision name |
| `K_CONFIGURATION` | Cloud Run configuration name |

## Monitoring & Logging

### View Logs

```bash
# Stream logs
gcloud run services logs tail alko-mcp --region=europe-north1

# View in Cloud Console
open "https://console.cloud.google.com/run/detail/europe-north1/alko-mcp/logs"
```

### Health Check

The server exposes a `/health` endpoint:

```bash
# Check health (requires auth)
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  https://alko-mcp-xxxxx-xx.a.run.app/health
```

### Metrics

Cloud Run automatically provides metrics:
- Request count and latency
- CPU and memory utilization
- Instance count
- Error rates

## Cost Estimation

| Component | Pricing | Estimated Monthly Cost |
|-----------|---------|------------------------|
| Cloud Run (2 vCPU, 2Gi) | $0.00002400/vCPU-second + $0.00000250/GiB-second | ~$10-40 (depending on usage) |
| Firestore | $0.06/100K reads | ~$1-5 (12K products) |
| Artifact Registry | $0.10/GB/month | ~$1 (~500MB image with Chromium) |
| **Total** | | **~$15-50/month** |

*With min-instances=0, costs are near zero when idle. The larger resource allocation (2 vCPU, 2Gi) is required for Playwright/Chromium.*

**Cost optimization tips:**
- Use `--min-instances=0` to scale to zero when idle
- Set `--concurrency=10` to maximize requests per instance
- Consider disabling scraping features if not needed (reduces to 1 vCPU, 512Mi)

## Troubleshooting

### Container Fails to Start

```bash
# Check build logs
gcloud builds list --limit=5
gcloud builds log BUILD_ID

# Check container logs
gcloud run services logs read alko-mcp --region=europe-north1 --limit=50
```

### Playwright Issues

Playwright/Chromium requires specific Cloud Run configuration:

**Required Cloud Run Settings:**
```yaml
memory: 2Gi            # Chromium needs 500MB-1GB
cpu: 2                 # Browser performance suffers with 1 CPU
execution-environment: gen2  # Real Linux kernel (not gVisor)
concurrency: 10        # Limit concurrent requests per instance
```

**Why Gen2?**
- Gen1 uses gVisor sandbox which has syscall limitations
- Gen2 uses a real Linux kernel with full syscall support
- Chromium requires certain syscalls that gVisor doesn't support

**Dockerfile requirements:**
```dockerfile
# Dockerfile includes comprehensive Chromium dependencies:
RUN apt-get install -y \
    libnss3 libnspr4 libatk1.0-0 ... \
    libx11-6 libx11-xcb1 libxcb1 ...  # X11 deps
RUN npx playwright install chromium
```

**Chromium launch args for containers:**
```javascript
chromium.launch({
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',  // /dev/shm is limited in containers
    '--disable-gpu',
    '--single-process',
  ]
});
```

**Common errors and fixes:**
| Error | Cause | Fix |
|-------|-------|-----|
| `Failed to launch browser` | Missing dependencies | Check Dockerfile deps |
| `Protocol error` | Memory exhaustion | Increase to 2Gi |
| `Navigation timeout` | Slow startup | Increase timeout, add `--single-process` |
| `Syscall not allowed` | gVisor limitations | Use `--execution-environment gen2` |

### Cold Start Latency

To reduce cold starts:

```bash
# Set minimum instances (costs more)
gcloud run services update alko-mcp \
  --region=europe-north1 \
  --min-instances=1
```

### Firestore Connection Issues

Ensure the Cloud Run service account has Firestore access:

```bash
# Grant Firestore access
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```

## Complete Deployment Checklist

### Initial Setup
- [ ] GCP project created with billing enabled
- [ ] Required APIs enabled (Cloud Run, Firestore, Artifact Registry, Cloud Build)
- [ ] Firestore database created in `europe-north1`
- [ ] Artifact Registry repository created

### First Deployment
- [ ] Docker image built and pushed
- [ ] Cloud Run service deployed
- [ ] API protection configured (IAM/IAP/API Key)
- [ ] Seed data bootstrapped (automatic or manual sync)
- [ ] Claude Desktop configured with MCP server URL
- [ ] Health check verified

### CI/CD Setup (Choose One)
**Option A: Cloud Build Trigger**
- [ ] GitHub repository connected to Cloud Build
- [ ] Trigger created for `main` branch with `cloudbuild.yaml`

**Option B: GitHub Actions**
- [ ] Workload Identity Pool created (`github-pool`)
- [ ] Workload Identity Provider created (`github-provider`)
- [ ] Service account created (`github-actions@...`)
- [ ] IAM permissions granted (run.admin, artifactregistry.writer, iam.serviceAccountUser)
- [ ] GitHub repository allowed to impersonate service account
- [ ] GitHub Secrets configured (GCP_PROJECT_ID, WIF_PROVIDER, WIF_SERVICE_ACCOUNT)

### Optional Enhancements
- [ ] Cloud Scheduler configured for daily product sync
- [ ] Monitoring alerts configured
- [ ] Custom domain configured
