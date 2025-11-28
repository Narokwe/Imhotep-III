import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pdf from 'pdf-parse';
import path from 'path';
import { RAGSystem } from './rag-system.js';
import { TokenSystem } from './token-system.js';
import { generateResponse } from './genkit-setup.js';
import { config } from 'dotenv';
import { submitRecordHash, computeSha256Hex } from './xrpl.js';

config();

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// -------------------------
// Upload file
// -------------------------
app.post('/api/upload-record', upload.single('record'), async (req, res) => {
  try {
    const { userId } = req.body;
    const file = req.file;

    console.log('[API/upload-record] Body:', req.body);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    let text = '';

    if (file.mimetype === 'application/pdf') {
      const pdfData = await pdf(file.buffer);
      text = pdfData.text || '';
    } else if (file.mimetype === 'text/plain') {
      text = file.buffer.toString('utf8');
    } else if (
      file.mimetype.includes('word') ||
      file.originalname.endsWith('.docx') ||
      file.originalname.endsWith('.doc')
    ) {
      // basic fallback for Word files
      text = file.buffer.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    } else {
      return res
        .status(400)
        .json({ success: false, error: 'Unsupported file type: ' + file.mimetype });
    }

    if (!text.trim()) {
      text = `Document ${file.originalname} uploaded but no text could be extracted. Please paste text directly.`;
    }

    // Process through RAG + token system
    TokenSystem.initializeUser(userId);
    const rewards = await RAGSystem.processHealthRecord(userId, text);
    const totalAwarded = TokenSystem.awardTokens(userId, rewards);

    // -------- XRPL ANCHORING --------
    const sha = computeSha256Hex(text);
    let xrplResult = null;
    try {
      xrplResult = await submitRecordHash(sha);
      // Treat temREDUNDANT as success
      if (xrplResult?.engine_result?.toLowerCase() === 'temredundant') {
        xrplResult.success = true;
      }
    } catch (e) {
      console.error('XRPL submit error (upload-record)', e);
      xrplResult = { success: false, error: e?.message || String(e) };
    }

    res.json({
      success: true,
      rewards,
      totalAwarded,
      message: `Health record processed successfully! Earned ${totalAwarded} IMT tokens!`,
      extractedText: text.substring(0, 400),
      anchored: xrplResult?.success === true,
      xrpl: xrplResult,
      recordHash: sha
    });
  } catch (err) {
    console.error('Upload error', err);
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// -------------------------
// Add text record
// -------------------------
app.post('/api/add-record', async (req, res) => {
  try {
    const { userId, recordText } = req.body;
    console.log('[API/add-record] Body:', req.body);

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    if (!recordText || !recordText.trim()) {
      return res.status(400).json({ success: false, error: 'No recordText provided' });
    }

    // Process through RAG + token system
    TokenSystem.initializeUser(userId);
    const rewards = await RAGSystem.processHealthRecord(userId, recordText);
    const totalAwarded = TokenSystem.awardTokens(userId, rewards);

    // -------- XRPL ANCHORING --------
    const sha = computeSha256Hex(recordText);
    let xrplResult = null;
    try {
      xrplResult = await submitRecordHash(sha);
      if (xrplResult?.engine_result?.toLowerCase() === 'temredundant') {
        xrplResult.success = true;
      }
    } catch (e) {
      console.error('XRPL submit error (add-record)', e);
      xrplResult = { success: false, error: e?.message || String(e) };
    }

    res.json({
      success: true,
      rewards,
      totalAwarded,
      message: `Health record added. Earned ${totalAwarded} IMT tokens.`,
      anchored: xrplResult?.success === true,
      xrpl: xrplResult,
      recordHash: sha
    });
  } catch (err) {
    console.error('add-record error', err);
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// -------------------------
// Chat endpoint
// Uses Firestore RAG retrieval directly
// -------------------------
app.post('/api/chat', async (req, res) => {
  try {
    const { userId, message } = req.body;
    console.log('[API/chat] Body:', req.body);

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message required' });
    }

    let retrieved = [];
    try {
      retrieved = await RAGSystem.retrieveRelevant(userId, message, 5);
      console.log(
        `[RAGSystem] Retrieved ${retrieved.length} chunks from Firestore for user ${userId}`
      );
    } catch (e) {
      console.error('Error retrieving RAG context, proceeding without it:', e);
      retrieved = [];
    }

    const hasRecords = Array.isArray(retrieved) && retrieved.length > 0;

    const contextHeader =
      'You are Imhotep-III, an AI assistant for maternal and child health in Africa.\n' +
      (hasRecords
        ? 'You have access to some stored health record excerpts for this user. Use them to personalize your answer, but do NOT reveal or quote them verbatim. Summarize key points instead.\n'
        : 'You DO NOT have any stored health records for this user. You must clearly say you are answering without access to their personal records.\n') +
      'Always encourage users to follow local medical advice and seek urgent care when needed.\n\n';

    const contextText = hasRecords
      ? retrieved
          .map(
            (c, i) =>
              `---\nContext ${i + 1} (score=${c.score?.toFixed?.(3) ?? 'n/a'}):\n${c.text}`
          )
          .join('\n\n')
      : '[No stored health records found for this user in the database.]';

    const systemPrompt =
      `${contextHeader}${contextText}\n\n` +
      `User question:\n${message}\n\n` +
      'Answer concisely and clearly. If urgent care is warranted, say so directly.';

    console.log('🔄 [CHAT] Calling Genkit generate() with constructed prompt...');
    const raw = await generateResponse(systemPrompt, {
      temperature: 0.4,
      maxOutputTokens: 600
    });
    console.log(
      '✅ [CHAT] Raw AI response from Genkit:',
      JSON.stringify(raw).slice(0, 400)
    );

    let aiText;
    if (typeof raw === 'string') {
      aiText = raw;
    } else if (raw && typeof raw.text === 'string') {
      aiText = raw.text;
    } else if (raw && typeof raw.output === 'string') {
      aiText = raw.output;
    } else if (
      raw &&
      raw.candidates &&
      raw.candidates[0]?.content?.parts?.[0]?.text
    ) {
      aiText = raw.candidates[0].content.parts[0].text;
    } else {
      aiText = '';
    }

    if (!aiText || !aiText.trim()) {
      console.warn('[CHAT] AI returned empty text, sending error to client.');
      return res.status(200).json({
        success: false,
        error: 'AI returned empty response'
      });
    }

    res.json({ success: true, response: aiText.trim() });
  } catch (err) {
    console.error('chat error', err);
    res.status(200).json({
      success: false,
      error: err?.message || String(err)
    });
  }
});

// -------------------------
// Staking endpoints
// -------------------------
app.post('/api/stake', (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId || !amount) {
      return res
        .status(400)
        .json({ success: false, error: 'userId and amount required' });
    }

    const result = TokenSystem.stakeTokens(userId, amount);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/claim-staked', (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }

    const total = TokenSystem.claimStakedTokens(userId);
    res.json({ success: true, totalClaimed: total });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/wallet/:userId', (req, res) => {
  try {
    const wallet = TokenSystem.getUserWallet(req.params.userId);
    res.json(wallet);
  } catch (err) {
    console.error('wallet error', err);
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

app.get('/api/health-records/:userId', (req, res) => {
  try {
    const summary = RAGSystem.getUserHealthSummary(req.params.userId);
    res.json(summary);
  } catch (err) {
    console.error('health records error', err);
    res.status(500).json({ error: 'Failed to fetch health records' });
  }
});

// -------------------------
// Test AI connectivity
// -------------------------
app.get('/api/test-ai', async (req, res) => {
  try {
    const raw = await generateResponse(
      'Hello! Please respond with a short greeting to confirm you are working.'
    );

    let aiText;
    if (typeof raw === 'string') {
      aiText = raw;
    } else if (raw && typeof raw.text === 'string') {
      aiText = raw.text;
    } else if (raw && typeof raw.output === 'string') {
      aiText = raw.output;
    } else if (
      raw &&
      raw.candidates &&
      raw.candidates[0]?.content?.parts?.[0]?.text
    ) {
      aiText = raw.candidates[0].content.parts[0].text;
    } else {
      aiText = `AI returned unexpected shape: ${JSON.stringify(raw).slice(0, 400)}...`;
    }

    res.json({ success: true, response: aiText });
  } catch (err) {
    console.error('test-ai error', err);
    res.json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log('Use /api/test-ai to check the LLM connection');
});