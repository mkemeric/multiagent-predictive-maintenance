/**
 * MLIS Embeddings Integration - HPE Private Cloud AI
 * 
 * OpenAI-compatible embeddings client for NVIDIA NIM endpoints hosted on MLIS.
 * Drop-in replacement for AWS Bedrock embeddings integration.
 * 
 * Model: nvidia/nv-embedqa-e5-v5 (1024 dimensions, matches existing config)
 */

const MLIS_BASE_URL = process.env.MLIS_BASE_URL;
const MLIS_API_KEY = process.env.MLIS_API_KEY;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "nvidia/nv-embedqa-e5-v5";

/**
 * Generate an embedding for a given text using MLIS OpenAI-compatible API.
 * @param {string} text - The text to embed.
 * @param {object} [options] - Optional configuration (unused, kept for API compatibility).
 * @returns {Promise<Array<number>>} The embedding vector.
 */
export async function generateEmbedding(text, options = {}) {
  if (!MLIS_BASE_URL) {
    throw new Error("MLIS_BASE_URL environment variable is required but not set");
  }

  const url = `${MLIS_BASE_URL}/embeddings`;
  
  const payload = {
    model: EMBEDDING_MODEL,
    input: text,
    encoding_format: "float",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(MLIS_API_KEY && { "Authorization": `Bearer ${MLIS_API_KEY}` }),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MLIS embeddings request failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // OpenAI-compatible response format
    if (result.data && result.data[0] && result.data[0].embedding) {
      return result.data[0].embedding;
    }
    
    throw new Error("Unexpected response format from MLIS embeddings endpoint");
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts (batch operation).
 * @param {string[]} texts - Array of texts to embed.
 * @param {object} [options] - Optional configuration.
 * @returns {Promise<Array<Array<number>>>} Array of embedding vectors.
 */
export async function generateEmbeddings(texts, options = {}) {
  if (!MLIS_BASE_URL) {
    throw new Error("MLIS_BASE_URL environment variable is required but not set");
  }

  const url = `${MLIS_BASE_URL}/embeddings`;
  
  const payload = {
    model: EMBEDDING_MODEL,
    input: texts,
    encoding_format: "float",
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(MLIS_API_KEY && { "Authorization": `Bearer ${MLIS_API_KEY}` }),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MLIS embeddings request failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // OpenAI-compatible response format - sort by index to maintain order
    if (result.data && Array.isArray(result.data)) {
      return result.data
        .sort((a, b) => a.index - b.index)
        .map(item => item.embedding);
    }
    
    throw new Error("Unexpected response format from MLIS embeddings endpoint");
  } catch (error) {
    console.error("Error generating embeddings:", error);
    throw error;
  }
}
