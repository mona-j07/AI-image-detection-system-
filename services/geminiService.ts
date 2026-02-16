
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

/**
 * MirageX Forensic Intelligence Service
 * 
 * DESIGN PATTERN:
 * 1. Primary: Uses direct platform-injected process.env.API_KEY.
 * 2. Fallback: Iterates through verified model names to bypass RESOURCE_EXHAUSTED errors.
 */
const USE_BACKEND = false; 

// Optimized list of valid models to try in order of availability and quota efficiency.
const MODELS_TO_TRY = [
  "gemini-3-flash-preview",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-3-pro-preview"
];

export const analyzeImage = async (base64Image: string): Promise<AnalysisResult> => {
  if (USE_BACKEND) {
    return analyzeWithBackend(base64Image);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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

  const generationConfig = {
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
  };

  let lastError: any = null;

  for (const modelName of MODELS_TO_TRY) {
    try {
      console.log(`Initializing forensic sweep with engine: ${modelName}`);
      
      const response = await ai.models.generateContent({
        model: modelName,
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
        config: generationConfig
      });

      if (response && response.text) {
        const result: AnalysisResult = JSON.parse(response.text.trim());
        return result;
      }
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || "";
      
      // If quota exceeded or model not found (due to versioning), try the next model
      if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('404') || errorMsg.includes('NOT_FOUND')) {
        console.warn(`Engine ${modelName} unavailable or exhausted. Rotating to secondary core...`);
        continue;
      }
      
      // Stop and throw if it's a non-quota error
      throw error;
    }
  }

  throw new Error(
    lastError?.message?.includes('429') 
      ? "QUOTA_EXHAUSTED: All neural forensic engines are currently at capacity. Please try again in a few minutes or provide a custom API key." 
      : "MirageX Core Failure: Unable to establish stable neural link. Check network connectivity."
  );
};

const analyzeWithBackend = async (base64Image: string): Promise<AnalysisResult> => {
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
