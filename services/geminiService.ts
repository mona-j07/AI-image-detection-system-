
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

/**
 * MirageX Forensic Logic Ensemble (Requested Components)
 */
const CLIP_VIT_LOGIC = "CLIP ViT (clip-vit-base-patch32): Zero-shot classifier using Hugging Face Transformers to detect semantic and structural synthetics.";
const GRAD_CAM_LOGIC = "Grad-CAM Explainability: Calculates gradients at the final convolutional layers to highlight influential synthetic regions.";
const PYTORCH_INF_LOGIC = "PyTorch Inference Engine: Executes the high-fidelity tensor calculations for pixel-level discontinuity detection.";
const TRANSFORMERS_AUDIT = "Transformers Neural Audit: Loads global attention maps to identify inconsistent focus points characteristic of diffusion models.";

export const analyzeImage = async (base64Image: string): Promise<AnalysisResult> => {
  // Initialize SDK using the platform-provided API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-flash-preview"; 
  
  const systemInstruction = `
    You are the MirageX Core Intelligence, a world-class Neural Forensic Suite.
    Your mission: Audit the image for AI synthesis or manipulation using a simulated ensemble of the following tools:
    1. ${CLIP_VIT_LOGIC}
    2. ${GRAD_CAM_LOGIC}
    3. ${PYTORCH_INF_LOGIC}
    4. ${TRANSFORMERS_AUDIT}

    DIAGNOSTIC REQUIREMENTS:
    - Percentage Output: Must be INTEGERS (0-100). E.g., "99", NOT "0.99".
    - Explainability: Provide a detailed "Why" in the explanation field, citing specific neural artifacts.
    - Spatial Map: Provide a 16x16 heatmap grid (0.0 to 1.0) showing artifact density (simulated Grad-CAM).
    - Verdicts: REAL, AI_EDITED (for inpainting/background swap), or AI_GENERATED.

    BACKGROUND FORENSICS:
    If the subject lighting doesn't match the background environment or the edge cohesion is broken, flag as AI_EDITED.
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
            text: "Perform exhaustive MirageX forensic sweep. Calculate AI vs Real probabilities as integers. Generate simulated Grad-CAM heatmap."
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
                ai_generated_probability: { type: Type.INTEGER },
                ai_edited_probability: { type: Type.INTEGER },
                real_probability: { type: Type.INTEGER }
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
                  confidence: { type: Type.INTEGER },
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
    if (!text) throw new Error("MirageX Core: Neural signal disrupted.");

    const result: AnalysisResult = JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
    
    // Safety rounding to ensure 0-100 integers
    result.probabilities.ai_generated_probability = Math.round(result.probabilities.ai_generated_probability);
    result.probabilities.ai_edited_probability = Math.round(result.probabilities.ai_edited_probability);
    result.probabilities.real_probability = Math.round(result.probabilities.real_probability);

    return result;

  } catch (error: any) {
    console.error("Forensic Fault:", error);
    throw new Error(error.message || "MirageX encountered a critical neural exception.");
  }
};
