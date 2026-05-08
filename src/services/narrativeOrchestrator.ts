import { AIService } from './ai';
import { updateNarrativeRuntimeMemory } from './installLiteraryRuntime';
import { Chapter, Character, PlotNode, Project, ResearchNote, SourceMaterial, ExternalReview } from '../types';
import { buildCleanContinuityContext, repetitionPenaltyReport, applyScorePenalties } from './contextHygiene';
import { evaluateStructuralProgression, buildStructuralRewriteDirective } from './structuralGate';

export type NarrativeScore = {
  overall: number;
  prose: number;
  structure: number;
  character: number;
  originality: number;
  continuity: number;
  marketPrizeFit: number;
  verdict: 'pass' | 'revise' | 'rewrite';
  reasons: string[];
  requiredFixes: string[];
};

export type NarrativeCycleResult = {
  draft: string;
  score: NarrativeScore;
  critique: string;
  rewriteApplied: boolean;
  attempts: number;
  blocked?: boolean;
  blockReason?: string;
};

function safeParseJSON(text: string, fallback: any) {
  try { return JSON.parse(text); } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) { try { return JSON.parse(match[1]); } catch {} }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) { try { return JSON.parse(text.slice(start, end + 1)); } catch {} }
    return fallback;
  }
}

function clampScore(value: any, fallback = 60): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normaliseScore(raw: any): NarrativeScore {
  const overall = clampScore(raw.overall ?? raw.score, 60);
  const score: NarrativeScore = {
    overall,
    prose: clampScore(raw.prose, overall),
    structure: clampScore(raw.structure, overall),
    character: clampScore(raw.character, overall),
    originality: clampScore(raw.originality, overall),
    continuity: clampScore(raw.continuity, overall),
    marketPrizeFit: clampScore(raw.marketPrizeFit ?? raw.prizeFit, overall),
    verdict: raw.verdict === 'pass' || raw.verdict === 'revise' || raw.verdict === 'rewrite'
      ? raw.verdict
      : overall >= 82 ? 'pass' : overall >= 68 ? 'revise' : 'rewrite',
    reasons: Array.isArray(raw.reasons) ? raw.reasons.map(String).slice(0, 8) : [],
    requiredFixes: Array.isArray(raw.requiredFixes) ? raw.requiredFixes.map(String).slice(0, 10) : []
  };

  if (score.overall < 68) score.verdict = 'rewrite';
  else if (score.overall < 82 && score.verdict === 'pass') score.verdict = 'revise';

  return score;
}

export async function scoreNarrativeChapter(args: {
  project: Project;
  chapterTitle: string;
  draft: string;
  previousChapters?: Chapter[];
  characters?: Character[];
  targetPrize?: string;
}): Promise<{ score: NarrativeScore; critique: string }> {
  const context = buildCleanContinuityContext(args.previousChapters || []);

  const prompt = `
Assess this chapter. Return JSON.
Project: ${args.project.title}
${context}
${args.draft.slice(0, 45000)}`;

  const raw = await AIService.callAI({ prompt, json: true, model: 'gemini-flash-latest' } as any);
  const parsed = safeParseJSON(raw || '{}', {});
  let score = normaliseScore(parsed);

  const penalties = repetitionPenaltyReport(args.draft, args.previousChapters || []);
  score = applyScorePenalties(score as any, penalties) as NarrativeScore;

  const critique = [...score.reasons, ...score.requiredFixes].join('\n');
  return { score, critique };
}

export async function runNarrativeQualityCycle(args: any): Promise<NarrativeCycleResult> {
  const chapters = args.chapters || [];
  updateNarrativeRuntimeMemory({ project: args.project, chapters, characters: args.characters || [] });

  let draft = await AIService.writeDraft(
    args.title,
    args.summary,
    args.context || '',
    args.project?.type || 'novel',
    args.activeNodes || [],
    args.research || [],
    args.project?.maturity || 'standard',
    args.project?.sourceMaterials || [],
    args.directives || [],
    args.project?.targetWords,
    args.project?.externalReviews || []
  );

  let structural = evaluateStructuralProgression({
    chapterTitle: args.title,
    draft,
    previousChapters: chapters
  });

  if (structural.verdict === 'block') {
    const directive = buildStructuralRewriteDirective(structural);
    draft = await AIService.callAI({ prompt: directive + '\n\n' + draft } as any);
  }

  let scored = await scoreNarrativeChapter({
    project: args.project,
    chapterTitle: args.title,
    draft,
    previousChapters: chapters
  });

  if (scored.score.overall < 82) {
    return { draft, score: scored.score, critique: scored.critique, rewriteApplied: true, attempts: 1, blocked: true };
  }

  return { draft, score: scored.score, critique: scored.critique, rewriteApplied: true, attempts: 1 };
}
