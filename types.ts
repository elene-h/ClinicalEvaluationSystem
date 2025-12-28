
export enum AppMode {
  BENCHMARK = 'BENCHMARK',
  USER = 'USER'
}

export interface ClinicalCase {
  id: string;
  title: string;
  note: string;
  task: string;
}

export interface AnalysisResult {
  decision: 'ASK' | 'ANSWER';
  rationale: string;
  questions?: string[];
  answer?: string;
  evidence?: string[];
  imageUrl?: string;
  selfAssessment: {
    plausibility: 'HIGH' | 'MEDIUM' | 'LOW';
    causalSensitivity: 'CAUSALLY SENSITIVE' | 'CAUSALLY INSENSITIVE';
    hallucinationCheck: 'YES' | 'NO';
    confidence: 'LOW' | 'MODERATE' | 'HIGH';
  };
}
