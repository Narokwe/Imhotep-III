// server/genkit-setup.js
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { config } from 'dotenv';

config();

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ No Google AI API key found. Please set GOOGLE_API_KEY or GEMINI_API_KEY.');
}

const ai = genkit({
  plugins: [
    googleAI({
      apiKey,
    })
  ]
});

function extractTextFromGenkitResult(raw) {
  if (typeof raw === 'string') return raw;

  if (raw && typeof raw.text === 'string') return raw.text;

  if (raw && typeof raw.output === 'string') return raw.output;

  if (
    raw &&
    Array.isArray(raw.candidates) &&
    raw.candidates.length > 0 &&
    raw.candidates[0]?.content?.parts?.length > 0
  ) {
    const parts = raw.candidates[0].content.parts;
    const textPart = parts.find(p => typeof p.text === 'string');
    if (textPart && textPart.text) return textPart.text;
  }

  return '';
}

export async function generateResponse(prompt, options = {}) {
  if (!apiKey) {
    throw new Error('No Google AI API key configured');
  }

  try {
    console.log('🔄 [GENKIT] Calling ai.generate with model googleai/gemini-2.5-flash');

    // ✅ Correct messages array with content as array of { type, text }
    const result = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt }
          ]
        }
      ],
      ...options
    });

    console.log(
      '✅ [GENKIT] Raw result:',
      JSON.stringify(result).slice(0, 400)
    );

    const text = extractTextFromGenkitResult(result);

    if (!text || !text.trim()) {
      throw new Error(
        'Genkit returned an empty or non-text response: ' +
        JSON.stringify(result).slice(0, 400)
      );
    }

    return text.trim();
  } catch (err) {
    console.error('❌ [GENKIT] Error in generateResponse:', err);
    throw err;
  }
}