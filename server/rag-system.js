import { v4 as uuidv4 } from 'uuid';
import { generateResponse } from './genkit-setup.js';

// ---- Firebase Admin imports ----
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// ---------------- FIREBASE INIT ----------------

// We'll lazily init Firestore so this file can be imported safely in any environment.
let firestoreInstance = null;

function initFirestore() {
  if (firestoreInstance) return firestoreInstance;

  try {
    // Option A: explicit service account JSON via file path
    const saPath = process.env.SERVICE_ACCOUNT_KEY_PATH; 
    const saJson = process.env.SERVICE_ACCOUNT_JSON;     

    if (saPath && fs.existsSync(saPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
      initializeApp({ credential: cert(serviceAccount) });
      console.log('[RAGSystem] Firebase initialized using SERVICE_ACCOUNT_KEY_PATH');
    } else if (saJson) {
      const serviceAccount = JSON.parse(saJson);
      initializeApp({ credential: cert(serviceAccount) });
      console.log('[RAGSystem] Firebase initialized using SERVICE_ACCOUNT_JSON');
    } else {
      // Option B: use Application Default Credentials (Cloud Run with attached service account)
      initializeApp({ credential: applicationDefault() });
      console.log('[RAGSystem] Firebase initialized using applicationDefault()');
    }

    firestoreInstance = getFirestore();
    return firestoreInstance;
  } catch (err) {
    console.error('[RAGSystem] Failed to initialize Firebase Admin:', err);
    throw err;
  }
}

// Name of the Firestore collection we store vectors in
const VECTORS_COLLECTION = 'health_vectors';

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

// ---------------- RAG SYSTEM (FIRESTORE-BACKED) ----------------

export class RAGSystem {
  /**
   * Index a health record for a user: chunk -> store as plain text + token stats
   * NO calls to external embed APIs (works with 0 embedding quota).
   * Now stored in Firestore instead of vector-store.json.
   */
  static async processHealthRecord(userId, recordText) {
    if (!userId) throw new Error('UserId required for indexing');
    if (!recordText || !recordText.trim()) throw new Error('Empty record text');

    const db = initFirestore();
    const chunks = chunkText(recordText, 900);

    const batch = db.batch();
    const added = [];

    for (const chunk of chunks) {
      const tokens = tokenize(chunk);
      const tf = termFreq(tokens);

      const item = {
        id: uuidv4(),
        userId,
        text: chunk,
        tf,
        tokenCount: tokens.length,
        timestamp: new Date().toISOString(),
      };

      const docRef = db.collection(VECTORS_COLLECTION).doc(item.id);
      batch.set(docRef, item);
      added.push(item);
    }

    if (added.length > 0) {
      await batch.commit();
      console.log(`[RAGSystem] Indexed ${added.length} chunks for user ${userId} into Firestore`);
    }

    // Reward logic
    const rewards = {
      anc: /anc|antenatal|antenatal care|antenatal visit/i.test(recordText) ? 3 : 0,
      immunization: /immuni|vaccin|immunization|vaccine/i.test(recordText) ? 3 : 0,
      growth: /growth|weight|height|z-score|percentile/i.test(recordText) ? 3 : 0,
    };

    return rewards;
  }

  /**
   * Retrieve relevant chunks for this user & query using local keyword similarity.
   * Now reads from Firestore 
   */
  static async retrieveRelevant(userId, query, topK = 4) {
    const db = initFirestore();

    // Get all vectors for this user.
    const snap = await db
      .collection(VECTORS_COLLECTION)
      .where('userId', '==', userId)
      .get();

    if (snap.empty) return [];

    const candidates = [];
    snap.forEach((doc) => {
      candidates.push(doc.data());
    });

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

  /**
   * Summary for a user's stored records.
   * Now pulls from Firestore.
   */
  static async getUserHealthSummary(userId) {
    const db = initFirestore();
    const snap = await db
      .collection(VECTORS_COLLECTION)
      .where('userId', '==', userId)
      .orderBy('timestamp', 'asc')
      .get();

    const records = [];
    snap.forEach((doc) => {
      records.push(doc.data());
    });

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
   * Chat with RAG: retrieve contexts, build a system prompt, call Gemini.
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