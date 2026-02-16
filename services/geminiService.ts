
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

/**
 * MirageX Forensic Module Logic Definitions
 */
const EFFICIENT_NET_LOGIC = "EfficientNet (Pixel-Level): Analyzes the high-frequency spectral noise floor to detect GAN-based upscaling and diffusion-layer artifacts.";
const VIT_FORENSIC_BASE = "ViT-Forensic (Structural): Audits global semantic coherence. Identifies perspective warping, shadow-subject mismatches, and geometric impossibilities.";
const XCEPTION_BOUNDARY_LOGIC = "XceptionNet (Edge-Audit): Specialized in subject-background boundary forensics. Detects masking residue, aliasing, and inconsistent depth-of-field (DoF) gradients.";
const HPF_PREPROCESSING_LOGIC = "HPF Auditor: Simulates a High-Pass Filter to expose hidden noise signatures. Essential for revealing localized background inpainting and replacement.";

export const analyzeImage = async (base64Image: string): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-flash-preview"; 
  
  const systemInstruction = `
    You are the MirageX Core Intelligence, a world-class Neural Forensic Engineer.
    Task: Execute a deep-level forensic audit on the provided specimen to detect AI synthesis or manipulation.

    CORE AUDIT PROTOCOLS:
    1. ${HPF_PREPROCESSING_LOGIC}
    2. ${VIT_FORENSIC_BASE}
    3. ${XCEPTION_BOUNDARY_LOGIC}
    4. ${EFFICIENT_NET_LOGIC}
    
    SPECIALIZED ENHANCEMENT - BACKGROUND AUDIT:
    - Interface Check: Inspect the 'seam' between subject and background. Look for halos or unnatural sharpness.
    - Lighting Consistency: Check if the light source, shadows, and reflections on the subject correlate with the background environment.
    - Chrominance Sync: Audit if the background noise floor (ISO/Grain) matches the subject.
    - Focus Paradox: Identify 'sharp' background elements in regions where natural optics (bokeh) would dictate blur.

    STRICT DATA REQUIREMENTS:
    - PROBABILITIES MUST BE INTEGERS FROM 0 TO 100 (e.g., 99). They must NOT be decimals (e.g., NOT 0.99).
    - The sum of probabilities MUST equal exactly 100.
    - Heatmap Grid: A 16x16 numeric grid (Values 0.0 to 1.0) indicating where artifacts are most dense.
    - If the background is swapped or edited, verdict is 'AI_EDITED'. If the whole image is synthetic, verdict is 'AI_GENERATED'.
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
            text: "Execute exhaustive MirageX audit. Focus heavily on background cohesion and neural boundaries. Provide integer percentages (0-100) and 16x16 grid."
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
    if (!text) throw new Error("MirageX Core: Null response from neural backend.");

    // Clean potential markdown artifacts
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed: AnalysisResult = JSON.parse(cleanJson);
    
    // Safety check for integers (sometimes LLMs skip strict constraints)
    parsed.probabilities.ai_generated_probability = Math.round(parsed.probabilities.ai_generated_probability);
    parsed.probabilities.ai_edited_probability = Math.round(parsed.probabilities.ai_edited_probability);
    parsed.probabilities.real_probability = Math.round(parsed.probabilities.real_probability);

    return parsed;

  } catch (error: any) {
    console.error("MirageX Audit Failure:", error);
    
    if (error.message?.includes("429") || error.message?.toLowerCase().includes("quota")) {
      throw new Error("SYSTEM QUOTA EXCEEDED: MirageX core is cooling down. Retry in 60s.");
    }
    
    throw new Error(error.message || "MirageX encountered a critical neural fault during background analysis.");
  }
};
