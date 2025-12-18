# MongoDB Multi-Agent Predictive Maintenance
## HPE Private Cloud AI MLIS Refactoring Guide

---

## Overview

This document describes the minimal refactoring performed to migrate the MongoDB multi-agent predictive maintenance demo from AWS Bedrock to HPE Private Cloud AI MLIS endpoints.

**Key Principle:** Minimal code changes by leveraging MLIS's OpenAI-compatible API with LangChain's `@langchain/openai` package.

---

## Summary of Changes

### Files Modified

| File | Change |
|------|--------|
| `package.json` | Removed AWS SDK deps, added `@langchain/openai` |
| `.env.example` | Updated for MLIS configuration |
| `src/agents/supervisor/graph.js` | Import path change only |
| `src/agents/failure/graph.js` | Import path change only |
| `src/agents/workorder/graph.js` | Import path change only |
| `src/agents/planning/graph.js` | Import path change only |
| `src/agents/test/graph.js` | Import path change only |
| `src/agents/workorder/tools.js` | Import path change only |
| `src/integrations/mongodb/vectorSearch.js` | Import path change only |
| `scripts/embed_collections.mjs` | Import path change only |

### Files Created

| File | Purpose |
|------|---------|
| `src/integrations/mlis/chat.js` | MLIS chat client (OpenAI-compatible) |
| `src/integrations/mlis/embeddings.js` | MLIS embeddings client |
| `scripts/test_connection.mjs` | Connection and capability testing |

### Dependencies Changed

**Removed:**
- `@aws-sdk/client-bedrock-runtime`
- `@aws-sdk/credential-provider-node`
- `@langchain/aws`

**Added:**
- `@langchain/openai`

---

## Configuration

### Environment Variables

```bash
# MongoDB Atlas (unchanged)
MONGODB_URI="mongodb+srv://..."
DATABASE_NAME="agentic_predictive_maintenance"

# HPE PC AI MLIS Configuration
MLIS_BASE_URL="https://your-mlis-endpoint/v1"
MLIS_API_KEY=""  # If required by your deployment

# Model Configuration
COMPLETION_MODEL="meta/llama-3.1-70b-instruct"
EMBEDDING_MODEL="nvidia/nv-embedqa-e5-v5"
```

---

## Recommended Models

### Foundational Model (LLM)

**Primary:** `meta/llama-3.1-70b-instruct`
- ✅ Full tool calling support (required for agents)
- ✅ 128K context window
- ✅ Streaming support
- Requires: H100 (80GB) or equivalent

**Alternative:** `meta/llama-3.1-8b-instruct`
- ✅ Tool calling support
- Smaller footprint for resource-constrained environments

### Embedding Model

**Primary:** `nvidia/nv-embedqa-e5-v5`
- ✅ 1024 dimensions (matches existing MongoDB vector indexes)
- ✅ Optimized for QA retrieval
- No re-embedding required if using existing data

**Alternative:** `nvidia/llama-3.2-nv-embedqa-1b-v2`
- Configurable dimensions (384, 512, 768, 1024, 2048)
- Multilingual support
- 8192 token context

---

## Installation & Testing

### Step 1: Install Dependencies

```bash
cd demo_src/multiagent-predictive-maintenance
npm install
```

### Step 2: Configure Environment

```bash
cp .env.example .env
# Edit .env with your MLIS endpoint and MongoDB URI
```

### Step 3: Test Connection

```bash
npm run test:connection
```

Expected output:
```
═══════════════════════════════════════════════════════════
  HPE PC AI MLIS - Connection Test Suite
═══════════════════════════════════════════════════════════

📝 Test 1: LLM Chat Completion
──────────────────────────────────────────────────────────
  ✅ Response: "Hello! I'm working correctly..."

📝 Test 2: Tool Calling (Required for Agents)
──────────────────────────────────────────────────────────
  ✅ Tool call detected!
     Tool: test_search
     Args: {"query":"predictive maintenance"}

📝 Test 3: Embeddings Generation
──────────────────────────────────────────────────────────
  ✅ Embedding generated!
     Dimensions: 1024
     ✓ Dimensions match existing vector index config (1024)

📝 Test 4: Semantic Similarity Validation
──────────────────────────────────────────────────────────
  ✅ Semantic similarity working correctly!
```

### Step 4: Run Application

```bash
npm run dev
```

Access at: http://localhost:8080

---

## Architecture Notes

### What Changed

```
BEFORE (AWS Bedrock):
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Agents    │────▶│  @langchain/aws  │────▶│ AWS Bedrock │
└─────────────┘     └──────────────────┘     └─────────────┘

AFTER (MLIS):
┌─────────────┐     ┌───────────────────┐     ┌──────────────┐
│   Agents    │────▶│ @langchain/openai │────▶│ MLIS (NIM)   │
└─────────────┘     └───────────────────┘     └──────────────┘
```

### What Stayed the Same

- ✅ LangGraph state graphs and agent orchestration
- ✅ MongoDB Atlas integration (MongoDBSaver, vector search)
- ✅ All agent tools (RAG retrieval, report generation, scheduling)
- ✅ Next.js frontend
- ✅ NDJSON event streaming for UI progress
- ✅ Vector search indexes (1024 dimensions)

### Function Name Preservation

The MLIS chat client exports `createBedrockClient()` to minimize code changes:

```javascript
// src/integrations/mlis/chat.js
export function createBedrockClient() {
  // Actually creates MLIS client, name preserved for compatibility
  return new ChatOpenAI({
    model: process.env.COMPLETION_MODEL,
    configuration: {
      baseURL: process.env.MLIS_BASE_URL,
      apiKey: process.env.MLIS_API_KEY,
    },
  });
}
```

---

## Embedding Strategy Discussion

### Current Design (Preserved)

The codebase correctly separates:

**Vector Search (batch-embedded knowledge bases):**
- `manuals` - Machine documentation
- `interviews` - Post-incident technician notes  
- `workorders` - Historical work order patterns

**Direct MongoDB Queries (transactional data):**
- `alerts` - Real-time anomaly triggers
- `inventory` - Current parts availability
- `maintenance_staff` - Staff schedules/skills
- `production_calendar` - Production slots
- `telemetry` - Time-series sensor data

### The One Exception

The `generateWorkOrder` tool in `workorder/tools.js` embeds new work orders at creation time:

```javascript
// Generate embedding for new work order
const embedding = await generateEmbedding(embeddingText);
const doc = { ...rest, embedding };
await db.collection("workorders").insertOne(doc);
```

**This is acceptable because:**
1. Work orders are created infrequently (not high-volume transactions)
2. They need to be searchable for future similar incidents
3. The embedding adds long-term value for RAG retrieval

**What would be problematic:**
- Embedding every telemetry reading
- Embedding alerts in real-time
- Embedding inventory changes

---

## Troubleshooting

### Tool Calling Not Working

If `npm run test:connection` shows tool calling failures:

1. Verify model supports tool calling:
   - ✅ `meta/llama-3.1-70b-instruct`
   - ✅ `meta/llama-3.1-8b-instruct`
   - ❌ Many other models

2. Check MLIS NIM configuration:
   - Tool calling must be enabled in the NIM deployment
   - Some models require specific chat templates

### Embedding Dimension Mismatch

If embeddings have different dimensions than 1024:

```bash
# Re-embed all collections
npm run embed
```

Then recreate MongoDB Atlas vector search indexes in the Atlas UI.

### Connection Timeout

Increase timeout in `src/integrations/mlis/chat.js`:

```javascript
timeout: 180000, // 3 minutes for complex workflows
```

---

## Rollback

To revert to AWS Bedrock:

1. Restore original `package.json`
2. Run `npm install`
3. Change imports back to `../../integrations/bedrock/chat.js`
4. Restore original `.env` configuration

The original bedrock integration files are preserved in `src/integrations/bedrock/`.

---

## Version

- **Original:** AWS Bedrock with Claude 3.5 Haiku + Cohere Embeddings
- **Refactored:** HPE PC AI MLIS with Llama 3.1 70B + NVIDIA NV-EmbedQA
- **Refactor Date:** December 2024
- **Package Version:** 0.1.0-mlis
