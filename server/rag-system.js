// server/rag-system.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { generateResponse } from './genkit-setup.js';

// ---------------- PATH SETUP ----------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORE_PATH = path.join(__dirname, 'vector-store.json');

// Ensure store file exists
function ensureStore() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(
      STORE_PATH,
      JSON.stringify({ vectors: [] }, null, 2),
      'utf8'
    );
  }
}
ensureStore();

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
}

function writeStore(obj) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(obj, null, 2), 'utf8');
}

// ---------------- CHUNKING ----------------

function chunkText(text, charLimit = 1000) {
  const paragraphs = text
    .split(/\n{1,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];
  let current = '';

  for (const p of paragraphs) {
    if ((current + '\n' + p).length > charLimit) {
      if (current) {
        chunks.push(current.trim());
        current = p;
      } else {
        // paragraph itself larger than limit -> hard split
        for (let i = 0; i < p.length; i += charLimit) {
          chunks.push(p.slice(i, i + charLimit));
        }
        current = '';
      }
    } else {
      current = current ? current + '\n' + p : p;
    }
  }

  if (current) chunks.push(current.trim());
  return chunks;
}

// ---------------- SIMPLE LOCAL "EMBEDDING" ----------------
// We'll do bag-of-words / TF-IDF style scoring locally – no remote embeddings.

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// Compute term frequency map: { token: count }
function termFreq(tokens) {
  const freq = {};
  for (const t of tokens) {
    freq[t] = (freq[t] || 0) + 1;
  }
  return freq;
}

// Cosine similarity between two term-frequency vectors
function cosineTF(tf1, tf2) {
  let dot = 0;
  let norm1 = 0;
  let norm2 = 0;

  const allKeys = new Set([...Object.keys(tf1), ...Object.keys(tf2)]);
  for (const k of allKeys) {
    const v1 = tf1[k] || 0;
    const v2 = tf2[k] || 0;
    dot += v1 * v2;
    norm1 += v1 * v1;
    norm2 += v2 * v2;
  }

  if (norm1 === 0 || norm2 === 0) return 0;
  return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// ---------------- RAG SYSTEM (LOCAL) ----------------

export class RAGSystem {
  /**
   * Index a health record for a user: chunk -> store as plain text + token stats
   * NO calls to external embed APIs (works with 0 embedding quota).
   */
  static async processHealthRecord(userId, recordText) {
    if (!userId) throw new Error('UserId required for indexing');
    if (!recordText || !recordText.trim()) throw new Error('Empty record text');

    const chunks = chunkText(recordText, 900);
    const store = readStore();

    const added = [];
    for (const chunk of chunks) {
      const tokens = tokenize(chunk);
      const tf = termFreq(tokens);

      const item = {
        id: uuidv4(),
        userId,
        text: chunk,
        // "embedding" field repurposed to store term frequencies
        // so structure of vector-store.json remains similar
        tf,
        tokenCount: tokens.length,
        timestamp: new Date().toISOString(),
      };

      store.vectors.push(item);
      added.push(item);
    }

    if (added.length > 0) {
      writeStore(store);
    }

    // Reward logic (unchanged from your original)
    const rewards = {
      anc: /anc|antenatal|antenatal care|antenatal visit/i.test(recordText) ? 3 : 0,
      immunization: /immuni|vaccin|immunization|vaccine/i.test(recordText) ? 3 : 0,
      growth: /growth|weight|height|z-score|percentile/i.test(recordText) ? 3 : 0,
    };

    return rewards;
  }

  /**
   * Retrieve relevant chunks for this user & query using local keyword similarity.
   */
  static async retrieveRelevant(userId, query, topK = 4) {
    const store = readStore();
    const candidates = store.vectors.filter((v) => v.userId === userId);
    if (!candidates.length) return [];

    const qTokens = tokenize(query);
    const qTF = termFreq(qTokens);

    const scored = candidates.map((c) => {
      const score = cosineTF(qTF, c.tf || {});
      return { item: c, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((s) => ({
      text: s.item.text,
      score: s.score,
      id: s.item.id,
    }));
  }

  static getUserHealthSummary(userId) {
    const store = readStore();
    const records = store.vectors.filter((v) => v.userId === userId);
    return {
      userId,
      totalChunks: records.length,
      latestChunks: records.slice(-10).map((r) => ({
        id: r.id,
        text: r.text,
        timestamp: r.timestamp,
      })),
    };
  }

  /**
   * Chat with RAG: retrieve local contexts, build a system prompt, call Gemini.
   */
  static async chatWithHealthContext(userId, userMessage) {
    let retrieved = [];
    try {
      retrieved = await this.retrieveRelevant(userId, userMessage, 5);
    } catch (err) {
      console.error('Error retrieving RAG context, proceeding without it:', err);
      retrieved = [];
    }

    const contextHeader =
      'You are Imhotep-III, an AI assistant for maternal and child health in Africa.\n' +
      "Use the user's stored health records below to ground your answer when available.\n" +
      'If no records are available or you lack enough information, say so clearly.\n' +
      'Always encourage users to follow local medical advice and seek urgent care when needed.\n\n';

    const storedContext = retrieved.length
      ? retrieved
          .map(
            (r, i) =>
              `---\nContext ${i + 1} (score=${r.score.toFixed(3)}):\n${r.text}`
          )
          .join('\n\n')
      : '[No stored health records found for this user.]';

    const systemPrompt =
      `${contextHeader}${storedContext}\n\n` +
      `User question:\n${userMessage}\n\n` +
      `Answer concisely and clearly. If you recommend urgent care, say so directly.`;

    try {
      const aiText = await generateResponse(systemPrompt, {
        temperature: 0.4,
        maxOutputTokens: 600,
      });
      return aiText;
    } catch (err) {
      console.error('RAG chat error:', err);
      throw new Error('AI unavailable');
    }
  }
}