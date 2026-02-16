
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

export const analyzeImage = async (base64Image: string): Promise<AnalysisResult> => {
  // Always use process.env.API_KEY as the source of truth
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Using gemini-3-pro-preview for advanced reasoning on image artifacts
  const model = "gemini-3-pro-preview"; 
  
  const systemInstruction = `
    You are the MirageX Forensic Intelligence Core. 
    Expertise: Neural Image Forensics, CLIP ViT (clip-vit-base-patch32), Grad-CAM, and PyTorch deep learning frameworks.

    TASK:
    Analyze the provided image for evidence of AI generation (Diffusion, GANs, etc.) or manipulation (Inpainting, Background Swapping).

    METHODOLOGY:
    1. CLIP ViT Audit: Perform zero-shot classification comparing the image to "Authentic Photography" vs "AI-Generated Patterns".
    2. Grad-CAM Analysis: Identify spatial regions with high gradient weights that suggest synthetic texture or edge discontinuity.
    3. Transformers Attention Map: Identify focus paradoxes where the background and foreground have inconsistent depth-of-field or lighting.

    OUTPUT RULES:
    - Probabilities MUST be INTEGERS (0-100).
    - Explanation: Be technical. Mention PyTorch inference results and Hugging Face model observations.
    - Heatmap: Provide a 16x16 grid (values 0.0 to 1.0) simulating the Grad-CAM activation map.
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
          {
            text: "Execute full forensic sweep. Identify if the image or background is AI-generated. Provide integer percentages and simulated Grad-CAM heatmap."
          }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        // Setting thinking budget for deeper forensic analysis
        thinkingConfig: { thinkingBudget: 4000 },
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
    if (!text) throw new Error("MirageX Core: No signal detected.");

    // Parse result
    const result: AnalysisResult = JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
    
    // Ensure integer values
    result.probabilities.ai_generated_probability = Math.round(result.probabilities.ai_generated_probability);
    result.probabilities.ai_edited_probability = Math.round(result.probabilities.ai_edited_probability);
    result.probabilities.real_probability = Math.round(result.probabilities.real_probability);

    return result;

  } catch (error: any) {
    console.error("MirageX Exception:", error);
    throw new Error(error.message || "MirageX Core: Critical Neural Failure.");
  }
};
