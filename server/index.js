// server/index.js
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pdf from 'pdf-parse';
import path from 'path';
import { RAGSystem } from './rag-system.js';
import { TokenSystem } from './token-system.js';
import { generateResponse } from './genkit-setup.js';
import { config } from 'dotenv';

config();

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Upload file
app.post('/api/upload-record', upload.single('record'), async (req, res) => {
  try {
    const { userId } = req.body;
    const file = req.file;

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
      // VERY basic fallback for Word files (may not extract properly)
      text = file.buffer.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    } else {
      return res
        .status(400)
        .json({ success: false, error: 'Unsupported file type: ' + file.mimetype });
    }

    if (!text.trim()) {
      text = `Document ${file.originalname} uploaded but no text could be extracted. Please paste text directly.`;
    }

    TokenSystem.initializeUser(userId);
    const rewards = await RAGSystem.processHealthRecord(userId, text);
    const totalAwarded = TokenSystem.awardTokens(userId, rewards);

    res.json({
      success: true,
      rewards,
      totalAwarded,
      message: `Health record processed successfully! Earned ${totalAwarded} IMT tokens!`,
      extractedText: text.substring(0, 400)
    });
  } catch (err) {
    console.error('Upload error', err);
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// Add text record
app.post('/api/add-record', async (req, res) => {
  try {
    const { userId, recordText } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId required' });
    }
    if (!recordText || !recordText.trim()) {
      return res.status(400).json({ success: false, error: 'No recordText provided' });
    }

    TokenSystem.initializeUser(userId);
    const rewards = await RAGSystem.processHealthRecord(userId, recordText);
    const totalAwarded = TokenSystem.awardTokens(userId, rewards);

    res.json({
      success: true,
      rewards,
      totalAwarded,
      message: `Health record added. Earned ${totalAwarded} IMT tokens.`
    });
  } catch (err) {
    console.error('add-record error', err);
    res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

// Chat endpoint (NO human-written fallback – only real AI or explicit error)
app.post('/api/chat', async (req, res) => {
  try {
    const { userId, message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message required' });
    }

    // 1) Get user health summary (for context)
    let summary;
    try {
      summary = RAGSystem.getUserHealthSummary(userId);
    } catch (e) {
      console.warn('Warning: could not fetch health summary', e?.message || e);
      summary = { userId, totalChunks: 0, latestChunks: [] };
    }

    const contextHeader =
      'You are Imhotep-III, an AI assistant for maternal and child health in Africa.\n' +
      "Use the user's health records below to ground your answer when available. " +
      'If insufficient info, say so clearly. Always encourage local medical advice and urgent care when needed.\n\n';

    let contextText = '[No stored health records found for this user.]';
    if (summary && summary.totalChunks > 0 && Array.isArray(summary.latestChunks)) {
      contextText = summary.latestChunks
        .map((c, i) => `---\nChunk ${i + 1} (id=${c.id}):\n${c.text}`)
        .join('\n\n');
    }

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

    // 2) NORMALIZE AI RESPONSE TO PLAIN TEXT
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

    // 3) If AI text is empty, return explicit error (no server-generated content)
    if (!aiText || !aiText.trim()) {
      console.warn('[CHAT] AI returned empty text, sending error to client.');
      return res.status(200).json({
        success: false,
        error: 'AI returned empty response'
      });
    }

    // Normal case: non-empty AI text
    res.json({ success: true, response: aiText.trim() });
  } catch (err) {
    console.error('chat error', err);
    res.status(200).json({
      success: false,
      error: err?.message || String(err)
    });
  }
});

// Staking endpoints
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

// Test AI connectivity (already normalized)
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