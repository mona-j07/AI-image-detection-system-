
const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Fallback chain for the backend
const MODELS_TO_TRY = [
  "gemini-3-flash-preview",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-3-pro-preview"
];

app.post('/api/analyze', async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No forensic specimen provided.' });
    }

    const systemInstruction = `
      You are the MirageX Forensic Intelligence Core. 
      Analyze the image for AI generation or editing artifacts.
      Return JSON with verdict, probabilities (integers), explanation, and 16x16 heatmap grid.
    `;

    let lastError = null;

    for (const model of MODELS_TO_TRY) {
      try {
        const response = await ai.models.generateContent({
          model: model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: imageBase64.split(',')[1] || imageBase64
                }
              },
              { text: "Execute full neural audit." }
            ]
          },
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json"
          }
        });

        if (response && response.text) {
          return res.json(JSON.parse(response.text));
        }
      } catch (err) {
        lastError = err;
        if (err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
          console.log(`Model ${model} exhausted on server. Trying next...`);
          continue;
        }
        throw err; // For non-quota errors
      }
    }

    res.status(429).json({ error: 'All server-side models exhausted. Quota limit reached.' });
  } catch (error) {
    console.error('Forensic Error:', error);
    res.status(500).json({ error: 'MirageX Server encountered a neural exception.' });
  }
});

app.listen(port, () => {
  console.log(`MirageX Intelligence Hub active at http://localhost:${port}`);
});
