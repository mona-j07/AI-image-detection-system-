
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeImage = async (base64Image: string): Promise<AnalysisResult> => {
  // Using gemini-3-flash-preview for the best balance of speed and forensic capability
  const model = "gemini-3-flash-preview"; 
  
  const systemInstruction = `
    You are a Senior AI Forensic Engineer. Execute a High-Speed Diagnostic Audit.
    
    CRITICAL INSTRUCTIONS:
    - TARGET: Sub-10 second response.
    - SENSITIVITY: Be lenient with real-world text, signs, and complex architectural backgrounds. Do NOT flag them as edited unless there is clear noise floor discontinuity.
    - ANALYSIS: Simulate CLIP ViT (Semantic), Grad-CAM (Explainability), and Spectral Auditor (Frequency).
    
    OUTPUT FORMAT:
    - Provide a 16x16 heatmap grid (values 0.0 to 1.0).
    - Ensure probabilities sum to 100.
    - Provide clear technical reasons for the verdict.
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
          {
            text: "Execute forensic scan. Provide 16x16 grid. Detect synthetic signatures vs authentic noise."
          }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verdict: { type: Type.STRING, enum: ['REAL', 'AI_EDITED', 'AI_GENERATED'] },
            probabilities: {
              type: Type.OBJECT,
              properties: {
                ai_generated_probability: { type: Type.NUMBER },
                ai_edited_probability: { type: Type.NUMBER },
                real_probability: { type: Type.NUMBER }
              },
              required: ["ai_generated_probability", "ai_edited_probability", "real_probability"]
            },
            explanation: { type: Type.STRING },
            keyArtifacts: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            modelSpecificFindings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  verdict: { type: Type.STRING, enum: ['REAL', 'AI_EDITED', 'AI_GENERATED'] },
                  confidence: { type: Type.NUMBER },
                  description: { type: Type.STRING }
                },
                required: ["name", "verdict", "confidence", "description"]
              }
            },
            heatmapGrid: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER }
              }
            }
          },
          required: ["verdict", "probabilities", "explanation", "keyArtifacts", "modelSpecificFindings", "heatmapGrid"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("The forensic engine returned an empty response.");
    return JSON.parse(text);

  } catch (error: any) {
    console.error("Forensic Engine Error:", error);
    
    // Specifically handle the 429 / Quota error
    if (error.message?.includes("429") || error.message?.includes("quota") || error.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("API LIMIT REACHED: You have exceeded your Gemini API quota. Please wait a minute or check your billing details at ai.google.dev.");
    }
    
    if (error.message?.includes("fetch")) {
      throw new Error("NETWORK TIMEOUT: The audit took too long. Try a smaller image or check your connection.");
    }

    throw new Error(error.message || "An unexpected error occurred during the forensic sweep.");
  }
};
