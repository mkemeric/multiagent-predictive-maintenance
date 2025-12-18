/**
 * MLIS Chat Integration - HPE Private Cloud AI
 * 
 * OpenAI-compatible chat client for NVIDIA NIM endpoints hosted on MLIS.
 * Drop-in replacement for AWS Bedrock chat integration.
 * 
 * Model: meta/llama-3.1-70b-instruct (or configured COMPLETION_MODEL)
 */

import { ChatOpenAI } from "@langchain/openai";

const MLIS_BASE_URL = process.env.MLIS_BASE_URL;
const MLIS_API_KEY = process.env.MLIS_API_KEY;
const COMPLETION_MODEL = process.env.COMPLETION_MODEL || "meta/llama-3.1-70b-instruct";

/**
 * Initialize an MLIS chat client with configured model and credentials
 * @returns {ChatOpenAI} Initialized MLIS chat client
 */
let mlisClient = null;

export function createBedrockClient() {
  // Function name preserved for minimal code changes in agent files
  if (!mlisClient) {
    if (!MLIS_BASE_URL) {
      throw new Error("MLIS_BASE_URL environment variable is required but not set");
    }
    
    mlisClient = new ChatOpenAI({
      model: COMPLETION_MODEL,
      temperature: 0,
      maxTokens: 4096,
      configuration: {
        baseURL: MLIS_BASE_URL,
        apiKey: MLIS_API_KEY || "not-required", // Some NIM deployments don't require API key
      },
      // Timeout for long-running agent workflows
      timeout: 120000, // 2 minutes
    });
  }
  return mlisClient;
}

/**
 * Send messages to MLIS and get a response
 * @param {Array} messages - Array of messages in LangChain format
 * @returns {Promise<Object>} - Response from the model
 */
export async function invokeBedrock(messages) {
  // Function name preserved for compatibility
  try {
    const model = createBedrockClient();
    return await model.invoke(messages);
  } catch (error) {
    console.error("Error invoking MLIS:", error);
    throw new Error(`MLIS conversation failed: ${error.message}`);
  }
}

/**
 * Stream responses from MLIS
 * @param {Array} messages - Array of messages in LangChain format
 * @returns {Promise<AsyncIterable>} - Stream of responses
 */
export async function streamFromBedrock(messages) {
  // Function name preserved for compatibility
  try {
    const model = createBedrockClient();
    return await model.stream(messages);
  } catch (error) {
    console.error("Error streaming from MLIS:", error);
    throw new Error(`MLIS streaming failed: ${error.message}`);
  }
}

// Re-export with MLIS naming for new code
export const createMLISClient = createBedrockClient;
export const invokeMLIS = invokeBedrock;
export const streamFromMLIS = streamFromBedrock;
