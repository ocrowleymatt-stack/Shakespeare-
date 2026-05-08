import { Chapter } from '../types';

export type StructuralGateVerdict = 'pass' | 'revise' | 'block';

export type StructuralGateReport = {
  verdict: StructuralGateVerdict;
  score: number;
  hasNewAction: boolean;
  hasNewInformation: boolean;
  hasCharacterShift: boolean;
  hasConcreteSpecifics: boolean;
  repeatsPrevious: boolean;
  headingChaos: boolean;
  motifLoopScore: number;
  warnings: string[];
  requiredFixes: string[];
};

const MOTIF_WORDS = [
  'abyss', 'geometry', 'flesh', 'serpent', 'ritual', 'bloodline', 'panopticon', 'architect', 'sanctuary',
  'copper', 'dread', 'shadow', 'altar', 'sacrifice', 'vessel', 'archive', 'exorcism', 'darkness'
];

const ACTION_VERBS = [
  'arrived', 'left', 'entered', 'opened', 'found', 'took', 'called', 'sent', 'hid', 'followed', 'recorded',
  'showed', 'gave', 'kept', 'broke', 'ran', 'returned', 'locked', 'unlocked', 'watched', 'met', 'refused',
  'confessed', 'revealed', 'threatened', 'escaped', 'destroyed', 'published', 'reported'
];

const INFORMATION_MARKERS = [
  'realised', 'discovered', 'learned', 'proved', 'revealed', 'evidence', 'recording', 'name', 'address',
  'key', 'message', 'photo', 'file', 'document', 'witness', 'secret', 'because', 'therefore'
];

const SHIFT_MARKERS = [
  'decided', 'refused', 'chose', 'stopped', 'started', 'could not', 'would not', 'instead', 'for the first time',
  'no longer', 'finally', 'then he', 'then she', 'then they'
];

function countMatches(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.reduce((acc, word) => acc + ((lower.match(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'g')) || []).length), 0);
}

function headingReport(text: string) {
  const headings: string[] = text.match(/^#{1,3}\s+.+$/gm) || [];
  const clean = headings.map(h => h.replace(/^#{1,3}\s+/, '').trim().toLowerCase());
  const unique = new Set(clean);
  const emptyish = headings.filter(h => h.trim().length < 8).length;
  return {
    count: headings.length,
    duplicateCount: clean.length - unique.size,
    emptyish,
    chaos: headings.length > 8 || clean.length - unique.size > 1 || emptyish > 0
  };
}

function concreteSpecifics(text: string) {
  const namedPeople = text.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\b/g) || [];
  const quotedDialogue = text.match(/[“"][^”"]{5,}[”"]/g) || [];
  const numbersOrObjects = text.match(/\b(key|phone|door|flat|club|estate|video|recording|letter|message|table|car|knife|glass|shirt|stairs|bathroom|window)\b/gi) || [];
  return namedPeople.length + quotedDialogue.length * 2 + numbersOrObjects.length;
}

export function evaluateStructuralProgression(args: {
  chapterTitle: string;
  draft: string;
  previousChapters?: Chapter[];
}): StructuralGateReport {
  const draft = args.draft || '';
  const previous = (args.previousChapters || []).slice(-5).map(ch => `${ch.title}\n${ch.summary}\n${ch.content || ''}`).join('\n\n').toLowerCase();
  const lower = draft.toLowerCase();

  const actionCount = countMatches(draft, ACTION_VERBS);
  const infoCount = countMatches(draft, INFORMATION_MARKERS);
  const shiftCount = countMatches(draft, SHIFT_MARKERS);
  const motifCount = countMatches(draft, MOTIF_WORDS);
  const specifics = concreteSpecifics(draft);
  const headings = headingReport(draft);

  const hasNewAction = actionCount >= 4;
  const hasNewInformation = infoCount >= 3;
  const hasCharacterShift = shiftCount >= 2;
  const hasConcreteSpecifics = specifics >= 8;

  const motifDensity = draft.length ? motifCount / Math.max(1, draft.split(/\s+/).length) : 0;
  const motifLoopScore = Math.min(100, Math.round(motifDensity * 1000));

  const firstMeaningful = lower.split('\n').map(l => l.trim()).find(Boolean) || '';
  const repeatsOpening = firstMeaningful.length > 20 && previous.includes(firstMeaningful.slice(0, 80));
  const repeatedTitle = args.chapterTitle && previous.includes(args.chapterTitle.toLowerCase());
  const repeatsPrevious = Boolean(repeatsOpening || repeatedTitle || motifLoopScore > 35);

  let score = 100;
  const warnings: string[] = [];
  const requiredFixes: string[] = [];

  if (!hasNewAction) {
    score -= 25;
    warnings.push('No clear new action detected.');
    requiredFixes.push('Add a concrete event that changes the situation.');
  }
  if (!hasNewInformation) {
    score -= 20;
    warnings.push('No clear new information/revelation detected.');
    requiredFixes.push('Add a discovery, proof, reversal, secret, evidence item, or decision-relevant fact.');
  }
  if (!hasCharacterShift) {
    score -= 20;
    warnings.push('No clear character shift detected.');
    requiredFixes.push('Make the protagonist or antagonist choose differently by the end of the chapter.');
  }
  if (!hasConcreteSpecifics) {
    score -= 15;
    warnings.push('Too abstract: insufficient concrete objects, locations, dialogue or named behaviour.');
    requiredFixes.push('Replace abstract motif language with specific behaviour, objects, dialogue and setting.');
  }
  if (repeatsPrevious) {
    score -= 25;
    warnings.push('Chapter appears to repeat prior material or motif logic.');
    requiredFixes.push('Do not darken the same vibe again; escalate plot, information, leverage or consequence.');
  }
  if (headings.chaos) {
    score -= 20;
    warnings.push(`Heading chaos detected: ${headings.count} headings, ${headings.duplicateCount} duplicate heading(s).`);
    requiredFixes.push('Reduce to one chapter title and remove duplicate/empty headings.');
  }

  score = Math.max(0, Math.min(100, score));

  const verdict: StructuralGateVerdict = score >= 82 ? 'pass' : score >= 65 ? 'revise' : 'block';

  return {
    verdict,
    score,
    hasNewAction,
    hasNewInformation,
    hasCharacterShift,
    hasConcreteSpecifics,
    repeatsPrevious,
    headingChaos: headings.chaos,
    motifLoopScore,
    warnings,
    requiredFixes
  };
}

export function buildStructuralRewriteDirective(report: StructuralGateReport) {
  return `
STRUCTURAL GATE REPORT:
Verdict: ${report.verdict}
Score: ${report.score}
Warnings:
${report.warnings.map(w => `- ${w}`).join('\n') || '- none'}
Required structural fixes:
${report.requiredFixes.map(f => `- ${f}`).join('\n') || '- none'}

Non-negotiable rewrite rule:
Every chapter must answer: WHAT CHANGES BECAUSE THIS CHAPTER HAPPENED?
A chapter may not pass merely because the atmosphere got darker. It must alter plot, leverage, evidence, relationship power, danger, knowledge, or character strategy.
`;
}
