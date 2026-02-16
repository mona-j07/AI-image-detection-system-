
export enum DetectionStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface ModelFinding {
  name: string;
  verdict: 'REAL' | 'AI_EDITED' | 'AI_GENERATED';
  confidence: number;
  description: string;
}

export interface AnalysisResult {
  verdict: 'REAL' | 'AI_EDITED' | 'AI_GENERATED';
  probabilities: {
    ai_generated_probability: number;
    ai_edited_probability: number;
    real_probability: number;
  };
  explanation: string;
  keyArtifacts: string[];
  modelSpecificFindings: ModelFinding[];
  /**
   * Optimized 16x16 grid for ultra-fast inference (reduced token count).
   * Values 0.0 to 1.0.
   */
  heatmapGrid: number[][];
}

export interface ImageData {
  base64: string;
  name: string;
  size: number;
  type: string;
  previewUrl: string;
}
