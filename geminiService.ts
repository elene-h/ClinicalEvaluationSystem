
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "./constants";
import { AnalysisResult } from "./types";

export const analyzeCase = async (note: string, task: string): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Clinical Note: ${note}\n\nTask: ${task}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.1,
      thinkingConfig: { thinkingBudget: 2000 }
    }
  });

  const text = response.text || "";
  const result = parseGeminiResponse(text);

  // If we have an answer or a specific condition is identified, attempt to generate a visual aid
  if (result.decision === 'ANSWER' || result.rationale.length > 50) {
    try {
      result.imageUrl = await generateClinicalImage(note, result.answer || result.rationale);
    } catch (e) {
      console.error("Image generation failed", e);
    }
  }

  return result;
};

const generateClinicalImage = async (note: string, summary: string): Promise<string | undefined> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const imagePrompt = `A clean, professional medical illustration or diagnostic diagram based on this clinical summary: ${summary.substring(0, 300)}. Textbook style, clear anatomical focus, white background, high resolution, clinical accuracy.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: imagePrompt }]
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return undefined;
};

const parseGeminiResponse = (text: string): AnalysisResult => {
  const decisionMatch = text.match(/Decision:\s*(ASK|ANSWER)/i);
  const decision = (decisionMatch?.[1]?.toUpperCase() === 'ANSWER' ? 'ANSWER' : 'ASK') as 'ASK' | 'ANSWER';

  const rationaleMatch = text.match(/Rationale:\s*([\s\S]*?)(?=(If Decision|Questions:|Answer:|Self-Assessment))/i);
  const rationale = rationaleMatch?.[1]?.trim() || "No rationale provided.";

  const questions: string[] = [];
  if (decision === 'ASK') {
    const questionsBlock = text.match(/Questions:\s*([\s\S]*?)(?=Self-Assessment)/i);
    if (questionsBlock) {
      questionsBlock[1].split('\n').forEach(line => {
        const cleaned = line.replace(/^- /, '').trim();
        if (cleaned) questions.push(cleaned);
      });
    }
  }

  let answer = "";
  const evidence: string[] = [];
  if (decision === 'ANSWER') {
    const answerBlock = text.match(/Answer:\s*([\s\S]*?)(?=Evidence:)/i);
    answer = answerBlock?.[1]?.trim() || "";

    const evidenceBlock = text.match(/Evidence:\s*([\s\S]*?)(?=Self-Assessment)/i);
    if (evidenceBlock) {
      evidenceBlock[1].split('\n').forEach(line => {
        const cleaned = line.replace(/^- /, '').trim();
        if (cleaned) evidence.push(cleaned);
      });
    }
  }

  const plausibilityMatch = text.match(/Plausibility:\s*(HIGH|MEDIUM|LOW)/i);
  const causalMatch = text.match(/Causal Sensitivity:\s*(CAUSALLY SENSITIVE|CAUSALLY INSENSITIVE)/i);
  const hallucinationMatch = text.match(/Hallucination Check:\s*(YES|NO)/i);
  const confidenceMatch = text.match(/Confidence Level:\s*(LOW|MODERATE|HIGH)/i);

  return {
    decision,
    rationale,
    questions: questions.length > 0 ? questions : undefined,
    answer: answer || undefined,
    evidence: evidence.length > 0 ? evidence : undefined,
    selfAssessment: {
      plausibility: (plausibilityMatch?.[1]?.toUpperCase() as any) || 'LOW',
      causalSensitivity: (causalMatch?.[1]?.toUpperCase() as any) || 'CAUSALLY SENSITIVE',
      hallucinationCheck: (hallucinationMatch?.[1]?.toUpperCase() as any) || 'YES',
      confidence: (confidenceMatch?.[1]?.toUpperCase() as any) || 'LOW',
    }
  };
};
