/**
 * MLIS Connection Test Script
 * 
 * Tests connectivity to HPE PC AI MLIS endpoints for both
 * chat completion and embeddings before running the full application.
 * 
 * Run: npm run test:connection
 */

import "dotenv/config";
import { createBedrockClient } from "../src/integrations/mlis/chat.js";
import { generateEmbedding } from "../src/integrations/mlis/embeddings.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const DIVIDER = "═".repeat(60);
const SECTION = "─".repeat(60);

async function testLLMConnection() {
  console.log("\n📝 Test 1: LLM Chat Completion");
  console.log(SECTION);
  
  console.log(`  Endpoint: ${process.env.MLIS_BASE_URL}`);
  console.log(`  Model: ${process.env.COMPLETION_MODEL}`);
  
  try {
    const llm = createBedrockClient();
    
    console.log("\n  Sending test prompt...");
    const response = await llm.invoke([
      ["system", "You are a helpful assistant. Respond in exactly one short sentence."],
      ["human", "Say hello and confirm you are working."]
    ]);
    
    console.log(`\n  ✅ Response: "${response.content}"`);
    return true;
  } catch (error) {
    console.error(`\n  ❌ Error: ${error.message}`);
    return false;
  }
}

async function testToolCalling() {
  console.log("\n📝 Test 2: Tool Calling (Required for Agents)");
  console.log(SECTION);
  
  try {
    const llm = createBedrockClient();
    
    // Define a simple test tool
    const testTool = tool(
      async ({ query }) => `Result for: ${query}`,
      {
        name: "test_search",
        description: "Search for information",
        schema: z.object({
          query: z.string().describe("The search query"),
        }),
      }
    );
    
    const boundLLM = llm.bindTools([testTool]);
    
    console.log("  Testing tool binding...");
    const response = await boundLLM.invoke([
      ["human", "Search for information about predictive maintenance"]
    ]);
    
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`\n  ✅ Tool call detected!`);
      console.log(`     Tool: ${response.tool_calls[0].name}`);
      console.log(`     Args: ${JSON.stringify(response.tool_calls[0].args)}`);
      return true;
    } else {
      console.log(`\n  ⚠️  No tool call in response`);
      console.log(`     Model responded with text: "${response.content?.substring(0, 100)}..."`);
      console.log(`\n     This model may not support tool calling properly.`);
      console.log(`     Agent functionality will be limited.`);
      return false;
    }
  } catch (error) {
    console.error(`\n  ❌ Error: ${error.message}`);
    return false;
  }
}

async function testEmbeddings() {
  console.log("\n📝 Test 3: Embeddings Generation");
  console.log(SECTION);
  
  console.log(`  Endpoint: ${process.env.MLIS_BASE_URL}`);
  console.log(`  Model: ${process.env.EMBEDDING_MODEL}`);
  
  try {
    const testText = "Predictive maintenance for manufacturing equipment";
    console.log(`\n  Test text: "${testText}"`);
    console.log("  Generating embedding...");
    
    const embedding = await generateEmbedding(testText);
    
    console.log(`\n  ✅ Embedding generated!`);
    console.log(`     Dimensions: ${embedding.length}`);
    console.log(`     First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(", ")}...]`);
    
    // Check if dimensions match expected (1024 for existing config)
    if (embedding.length === 1024) {
      console.log(`     ✓ Dimensions match existing vector index config (1024)`);
    } else {
      console.log(`\n  ⚠️  Dimensions (${embedding.length}) differ from existing config (1024)`);
      console.log(`     You may need to re-embed data and recreate vector indexes.`);
    }
    
    return { success: true, dimensions: embedding.length };
  } catch (error) {
    console.error(`\n  ❌ Error: ${error.message}`);
    return { success: false, dimensions: 0 };
  }
}

async function testSemanticSimilarity() {
  console.log("\n📝 Test 4: Semantic Similarity Validation");
  console.log(SECTION);
  
  try {
    const texts = [
      "Equipment failure prediction using vibration analysis",
      "Machine breakdown forecasting with sensor data",
      "The weather today is sunny and warm",
    ];
    
    console.log("  Computing embeddings for similarity test...");
    
    const embeddings = await Promise.all(texts.map(t => generateEmbedding(t)));
    
    // Cosine similarity
    const cosineSim = (a, b) => {
      const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
      const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
      const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
      return dot / (normA * normB);
    };
    
    const sim12 = cosineSim(embeddings[0], embeddings[1]);
    const sim13 = cosineSim(embeddings[0], embeddings[2]);
    
    console.log(`\n  Text 1: "${texts[0].substring(0, 40)}..."`);
    console.log(`  Text 2: "${texts[1].substring(0, 40)}..." (should be similar)`);
    console.log(`  Text 3: "${texts[2].substring(0, 40)}..." (should be different)`);
    
    console.log(`\n  Similarity (1↔2): ${(sim12 * 100).toFixed(1)}%`);
    console.log(`  Similarity (1↔3): ${(sim13 * 100).toFixed(1)}%`);
    
    if (sim12 > sim13) {
      console.log(`\n  ✅ Semantic similarity working correctly!`);
      return true;
    } else {
      console.log(`\n  ⚠️  Unexpected similarity results`);
      return false;
    }
  } catch (error) {
    console.error(`\n  ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log(DIVIDER);
  console.log("  HPE PC AI MLIS - Connection Test Suite");
  console.log(DIVIDER);
  
  // Validate environment
  const missingVars = [];
  if (!process.env.MLIS_BASE_URL) missingVars.push("MLIS_BASE_URL");
  if (!process.env.COMPLETION_MODEL) missingVars.push("COMPLETION_MODEL");
  if (!process.env.EMBEDDING_MODEL) missingVars.push("EMBEDDING_MODEL");
  
  if (missingVars.length > 0) {
    console.error(`\n❌ Missing required environment variables:`);
    missingVars.forEach(v => console.error(`   - ${v}`));
    console.error(`\nPlease copy .env.example to .env and configure your MLIS endpoint.`);
    process.exit(1);
  }
  
  // Run tests
  const llmResult = await testLLMConnection();
  const toolResult = await testToolCalling();
  const embeddingResult = await testEmbeddings();
  const similarityResult = await testSemanticSimilarity();
  
  // Summary
  console.log(`\n${DIVIDER}`);
  console.log("  Summary");
  console.log(SECTION);
  console.log(`  LLM Connection:      ${llmResult ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Tool Calling:        ${toolResult ? "✅ PASS" : "⚠️  LIMITED"}`);
  console.log(`  Embeddings:          ${embeddingResult.success ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Semantic Similarity: ${similarityResult ? "✅ PASS" : "⚠️  CHECK"}`);
  console.log(DIVIDER);
  
  // Recommendations
  if (!llmResult) {
    console.log("\n⚠️  LLM connection failed. Check:");
    console.log("   - MLIS_BASE_URL is correct and accessible");
    console.log("   - MLIS_API_KEY is set (if required)");
    console.log("   - COMPLETION_MODEL is deployed on your MLIS instance");
    process.exit(1);
  }
  
  if (!toolResult) {
    console.log("\n⚠️  Tool calling not working. The multi-agent workflow");
    console.log("   requires tool calling for proper operation.");
    console.log("   Recommended models with tool calling support:");
    console.log("   - meta/llama-3.1-70b-instruct");
    console.log("   - meta/llama-3.1-8b-instruct");
  }
  
  if (!embeddingResult.success) {
    console.log("\n⚠️  Embeddings failed. Check:");
    console.log("   - EMBEDDING_MODEL is deployed on your MLIS instance");
    console.log("   - The embeddings endpoint is at ${MLIS_BASE_URL}/embeddings");
    process.exit(1);
  }
  
  if (embeddingResult.dimensions !== 1024) {
    console.log(`\n⚠️  Embedding dimensions (${embeddingResult.dimensions}) differ from`);
    console.log("   the existing MongoDB vector index configuration (1024).");
    console.log("   Options:");
    console.log("   1. Use nvidia/nv-embedqa-e5-v5 (1024 dimensions)");
    console.log("   2. Re-embed all data with: npm run embed");
    console.log("   3. Recreate MongoDB Atlas vector search indexes");
  }
  
  console.log("\n✅ Connection tests complete!");
}

main().catch(console.error);
