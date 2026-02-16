
const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware - Set limit higher for image uploads
app.use(cors());
app.use(express.json({ limit: '20mb' }));

/**
 * SECURITY NOTE:
 * The GEMINI_API_KEY is retrieved from the .env file.
 * This code runs ONLY on the server. The client browser NEVER sees this key.
 * This prevents "Initialization Failed" browser errors and protects your billing.
 */
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/analyze', async (req, res) => {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'No forensic specimen provided.' });
    }

    // Switch to Flash-Preview to resolve the "limit: 0" quota error seen with Pro
    const model = 'gemini-3-flash-preview';
    
    const systemInstruction = `
      You are the MirageX Forensic Intelligence Core. 
      Analyze the image for AI generation or editing artifacts.
      Return JSON with verdict, probabilities (integers), explanation, and 16x16 heatmap grid.
    `;

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

    res.json(JSON.parse(response.text));
  } catch (error) {
    console.error('Forensic Error:', error);
    // Handle 429 specifically for the backend log
    if (error.message?.includes('429')) {
      return res.status(429).json({ error: 'Upstream Quota Exhausted. Check Google Cloud Billing.' });
    }
    res.status(500).json({ error: 'MirageX Server encountered a neural exception.' });
  }
});

app.listen(port, () => {
  console.log(`MirageX Intelligence Hub active at http://localhost:${port}`);
});
