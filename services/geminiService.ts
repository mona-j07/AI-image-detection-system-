
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

/**
 * MirageX Forensic Intelligence Service
 * 
 * DESIGN PATTERN:
 * 1. Primary: Tries to use the direct platform-injected process.env.API_KEY.
 * 2. Secondary: If you want to use your custom backend, change USE_BACKEND to true.
 */
const USE_BACKEND = false; // Set to true to route requests through server.js

export const analyzeImage = async (base64Image: string): Promise<AnalysisResult> => {
  if (USE_BACKEND) {
    return analyzeWithBackend(base64Image);
  }

  // --- DIRECT FRONTEND APPROACH (Uses injected platform key) ---
  // The SDK is initialized here using the process.env.API_KEY provided by the environment.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Using gemini-3-flash-preview for high quota and fast forensic scanning.
  const model = "gemini-3-flash-preview"; 

  const systemInstruction = `
    You are the MirageX Forensic Intelligence Core. 
    Expertise: Neural Image Forensics, CLIP ViT (clip-vit-base-patch32), Grad-CAM, and PyTorch.

    TASK:
    Audit the provided image for evidence of AI generation or manipulation.

    METHODOLOGY:
    1. CLIP ViT Audit: Zero-shot classification for synthetic pattern matching.
    2. Grad-CAM Analysis: Spatial activation mapping for pixel-level discontinuities.
    3. PyTorch Inference: Calculation of frequency artifacts.

    OUTPUT:
    - Probabilities: INTEGERS (0-100).
    - Explanation: Provide a technical "Why", citing specific neural artifacts.
    - Heatmap: 16x16 grid (0.0 to 1.0).
    - Verdict: REAL, AI_EDITED, or AI_GENERATED.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(',')[1] || base64Image
            }
          },
          { text: "Perform forensic scan. Identify AI vs Real probability. Generate 16x16 Grad-CAM heatmap." }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verdict: { type: Type.STRING, enum: ['REAL', 'AI_EDITED', 'AI_GENERATED'] },
            probabilities: {
              type: Type.OBJECT,
              properties: {
                ai_generated_probability: { type: Type.INTEGER },
                ai_edited_probability: { type: Type.INTEGER },
                real_probability: { type: Type.INTEGER }
              },
              required: ["ai_generated_probability", "ai_edited_probability", "real_probability"]
            },
            explanation: { type: Type.STRING },
            keyArtifacts: { type: Type.ARRAY, items: { type: Type.STRING } },
            modelSpecificFindings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  verdict: { type: Type.STRING, enum: ['REAL', 'AI_EDITED', 'AI_GENERATED'] },
                  confidence: { type: Type.INTEGER },
                  description: { type: Type.STRING }
                },
                required: ["name", "verdict", "confidence", "description"]
              }
            },
            heatmapGrid: {
              type: Type.ARRAY,
              items: { type: Type.ARRAY, items: { type: Type.NUMBER } }
            }
          },
          required: ["verdict", "probabilities", "explanation", "keyArtifacts", "modelSpecificFindings", "heatmapGrid"]
        }
      }
    });

    const result: AnalysisResult = JSON.parse(response.text.trim());
    return result;

  } catch (error: any) {
    console.error("Forensic Exception:", error);
    if (error.message?.includes('429')) {
      throw new Error("QUOTA_EXHAUSTED: The Free Tier limit has been reached. Please switch to a paid API key or wait for the cooldown.");
    }
    throw new Error(error.message || "MirageX Core: Critical Neural Failure.");
  }
};

const analyzeWithBackend = async (base64Image: string): Promise<AnalysisResult> => {
  // Calling our secure Node.js backend instead of the API directly.
  // This keeps the API key hidden from the user's browser completely.
  const response = await fetch('http://localhost:3000/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: base64Image }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Backend Audit Failure');
  }

  return response.json();
};
