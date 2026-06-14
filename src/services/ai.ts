/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from "@google/genai";
import { IntelligenceProvider, Project, Character, PlotNode, ResearchNote, Chapter, Critique, ProjectType, PrizeAssessment, ExternalReview, SourceMaterial } from "../types";

let globalPrimaryProvider: IntelligenceProvider = 'grok';

function safeParseJSON(text: string, fallback: any = {}) {
  try {
    return JSON.parse(text);
  } catch (e) {
    try {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) return JSON.parse(match[1]);
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) return JSON.parse(text.slice(start, end + 1));
      const startArr = text.indexOf('[');
      const endArr = text.lastIndexOf(']');
      if (startArr !== -1 && endArr !== -1) return JSON.parse(text.slice(startArr, endArr + 1));
    } catch (inner) {
      console.error("Critical JSON Parse Failure:", inner);
    }
    return fallback;
  }
}

const LITERARY_ENGINE_RULES = `
LITERARY ENGINE — STANDING RULES (MASTER COMMAND):
1. Identify real dramatic engine: Find the hidden wound, desire, betrayal, fear, irony, or transformation underneath it.
2. Story first, style second: Prose must serve plot, character, tension, rhythm, or revelation. If a sentence is pretty but useless, cut it.
3. Every scene must TURN: Each scene must change something: power, knowledge, danger, intimacy, belief, status, or direction. If nothing turns, strike it.
4. Concrete before abstract: Prefer objects, gestures, rooms, weather, smells, clothes, silence, and behaviour over explanation. 
5. Subtext is superior: Characters should rarely say exactly what they mean. Let truth leak through behavior.
6. Cut the "Pretty Sludge": Eliminate decorative adjectives and fake profundity. Aim for 40% reduction in first-pass drafts. Be brutal.
7. Tone Dynamics: Use valleys of calm to make the peaks of intensity feel higher. Avoid tone saturation.
8. Imagery of Precision: Use strong imagery sparingly. One perfect "image that bites" beats five decorative ones.
9. Dialogue is Conflict: It must conceal, threaten, seduce, evade, expose, manipulate, wound, bargain, or confess accidentally.
10. Characters must want something immediately: Even in silence, apply pressure through a mask and a pressure point.
11. Endings must be inevitable but surprising. Land on an image that resonates with the character's core wound.
12. Prose Hierarchy: 1. Clarity, 2. Tension, 3. Character truth, 4. Rhythm, 5. Beauty, 6. Cleverness.
13. Default Structural Arc: Hook -> Character under pressure -> Specific setting -> Hidden wound -> Immediate desire -> Obstacle -> Escalation -> Reversal -> Cost -> Image-led ending.
14. Cut Repeated Motifs: A motif is powerful when it returns transformed. If it returns unchanged, reduce or eliminate it. No thematic static.
15. Ban Filler: Avoid vague menace, repeated adjectives, lore dumps, or exposition disguised as dialogue.
16. Characters are Heroes of their own stories: Villains don't think they are evil; they think they are misunderstood or necessary.
17. Make Place a Character: Settings must pressure the story and shape behavior.
18. First lines create tension: Opening image must contain disturbance, threat, or mystery.
19. WORD COUNT PRECISION: All generated drafts must hit the STRICT WORD TARGET stated above. Do NOT exceed it by more than 3%. Do NOT fall below 90% of it. Word count discipline is non-negotiable.
20. PLAN PRIORITIZATION: If a "Structural Plan" or "Instructional Archetype" is provided, those instructions MANDATORY override generic structural rules.
21. STAGED GROWTH SUPREMACY: The DRAFT STAGE and STRICT WORD TARGET stated above OVERRIDE rules 1-20 where they conflict. At Pass 1, lean skeletal prose overrides all calls for sensory depth, imagery, or immersion. The manuscript grows across passes — do not pre-empt later passes by writing at full depth now.
`;

/**
 * Robust AI Caller with prioritized routing
 */
async function callAI(options: { 
  prompt: string; 
  model?: string;
  json?: boolean; 
  schema?: any;
  maxTokens?: number;
  providerOverride?: IntelligenceProvider;
  useWebSearch?: boolean;
}) {
  try {
    const response = await fetch("/api/ai/call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...options,
        primaryProvider: globalPrimaryProvider
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data.result;
  } catch (error: any) {
    console.error("AI Proxy Call failed:", error);
    throw error;
  }
}

const AGENT_PERSONAS = {
  structural: "You are a Structural Architect focused on pacing, arc, narrative tension, and the 'turning' of scenes. Analyze whether every scene justifies its existence.",
  vocal: "You are a Vocal Stylist focused on character voice, distinct prosody, and the subtext of dialogue. Look for 'on-the-nose' speech that needs more shadow.",
  factual: "You are a Factual Critic focused on internal logic, world-building consistency, and anti-hallucination. Identify 'writer shortcuts' and logic gaps.",
  legal: "You are a Senior Legal Counsel. Focus on jurisdictional accuracy, evidence hierarchy, and the precision of claims.",
  academic: "You are a Distinguished Academic. Focus on thesis strength, citation integrity, and methodological rigour.",
  comedy: "You are a Comedy Script Doctor. Focus on setup/payoff, timing, and satirical edge.",
  agent: "You are a Top-Tier Literary Agent. Focus on hook strength, commercial viability, voice clarity, and eliminating 'pretty sludge'.",
  publisher: "You are an Acquisitions Editor. Focus on genre positioning, market fit, and the emotional 'wound' of the work.",
  market: "You are a Book Marketeer. Focus on target demographics and the 'image that bites' for the cover/messaging.",
  reader: "You are a Provocative Beta Reader. Focus on cognitive load, emotional resonance, and momentum. Flag where you get bored.",
  sentence: "You are a Sentence Stylist / Line Editor. Focus on rhythm, cadence, word choice, and the elimination of decorative adjectives.",
  thematic: "You are a Thematic Analyst. Focus on motifs, symbolism, and the underlying philosophical engine of the narrative.",
  writer: "You are a Seasoned Author with multiple bestsellers. Focus on craft, industry standards, and the 'engine' of readable prose.",
  medical: "You are a General Practitioner (GP). Focus on medical realism, clinical accuracy, and the physical reality of health/trauma.",
  historical: "You are a Historian. Focus on period-accuracy, cultural context, and ensuring temporal integrity.",
  sensitivity: "You are a Diversity & Sensitivity Consultant. Focus on accurate representation of LGBT+ identities, women's experiences, socioeconomic nuances, and age-specific realism. Flag tropes and harmful biases.",
  repetition: "You are a Repetition Detective. Your sole job is to identify redundant phrases, motifs that return unchanged, echoes of earlier chapters, and 'thematic static' where the story spins its wheels."
};

const getMaturityDirectives = (level: string) => {
  if (level === 'mature') {
    return "\nMATURITY OVERRIDE: Focus on adult themes, complex emotional subtext, and visceral descriptions. Do not sanitize human experience.";
  }
  if (level === 'transgressive') {
    return "\nTRANSGRESSIVE OVERRIDE: Zero-filter creative mode. Explicit descriptions, extreme emotional states, and transgressive themes are required. Avoid generic tropes in favor of raw, intense realism or heightened erotica and violence if contextually appropriate.";
  }
  return "";
};

export const AIService = {
  callAI,
  setPrimaryProvider(provider: IntelligenceProvider) {
    globalPrimaryProvider = provider;
  },

  async detectIngestionType(text: string): Promise<'manuscript' | 'plan'> {
    const prompt = `Analyze this text and determine if it is a "Manuscript" (raw narrative prose, partial book, draft) or a "Plan" (outline, chapter-by-chapter instructions, structural blueprint, beat sheet).
    
    TEXT SAMPLE:
    "${text.slice(0, 10000)}"
    
    Return ONLY the word "manuscript" or "plan".`;
    
    const response = await callAI({ prompt, model: "gemini-2.0-flash" });
    return response?.toLowerCase().includes('plan') ? 'plan' : 'manuscript';
  },

  async brainstorm(
    premise: string, 
    genre: string, 
    tone: string, 
    type: ProjectType, 
    research: ResearchNote[] = [], 
    sourceMaterials: SourceMaterial[] = [],
    maturity = 'standard', 
    externalReviews: ExternalReview[] = [],
    improvementGoal?: string
  ): Promise<string> {
    const researchContext = research.length > 0 
      ? `\nRESEARCH ATTACHED:\n${research.map(r => `- ${r.title}: ${r.content}`).join('\n')}`
      : "";

    const maxSourceContentLength = 100000;
    const sourceContext = sourceMaterials.length > 0 
      ? `\nSOURCE MATERIALS:\n${sourceMaterials.map(s => `- ${s.name}: ${s.content}`).join('\n\n').slice(0, maxSourceContentLength)}`
      : "";

    const reviewContext = externalReviews.filter(r => !r.isImplemented).length > 0 
      ? `\nEXTERNAL CRITICAL REVIEWS (ADDRESS THESE IN THE BRAINSTORM):\n${externalReviews.filter(r => !r.isImplemented).map(r => `- [FROM ${r.source}]: ${r.content}`).join('\n')}`
      : "";

    const projectSpecificDirectives = {
      cookbook: "Focus on flavor profiles, recipe architecture, ingredient sourcing, and cohesive culinary themes.",
      coursebook: "Focus on pedagogical structure, learning objectives, modular progression, and student engagement.",
      subject_bible: "Focus on exhaustive documentation, factual cross-referencing, systemic clarity, and reference accessibility.",
      illustrated: "Focus on visual-narrative synergy, page composition, kinetic imagery descriptions, and spatial storytelling.",
      novel: "Focus on emotional resonance, character wounds, thematic subtext, and narrative momentum.",
      screenplay: "Focus on visual shorthand, dialogue subtext, pacing for screen, and high-impact scene beats.",
      legal: "Focus on logical precedence, argumentative rigor, technical precision, and persuasive flow.",
      academic: "Focus on hypothesis testing, literature contextualization, methodological transparency, and intellectual contribution.",
      stageplay: "Focus on stagecraft, acoustic presence, spatial dynamics, and performative tension.",
      radioplay: "Focus on acoustic atmosphere, sound cues, vocal diversity, and narrative efficiency for audio.",
      experimental: "Focus on boundary-pushing structure and novel metaphors."
    };

    const improvementDirective = improvementGoal 
      ? `\nIMPROVEMENT FOCUS: The user specifically wants to improve the "${improvementGoal}" of this work. Prioritize suggestions that address this lens.`
      : "";

    const prompt = `You are a World-Class Story Architect and Intelligence Orchestrator. 
      Project Type: ${type}
      Genre: ${genre} (IMPORTANT: Anchor ALL suggestions strictly in this genre. Do NOT default to sci-fi unless explicit).
      Tone: ${tone}
      Context: "${premise}"
      
      CORE DIRECTIVE: ${projectSpecificDirectives[type] || projectSpecificDirectives.novel}
      ${improvementDirective}
      
      ${getMaturityDirectives(maturity)}
      ${researchContext}
      ${sourceContext}
      ${reviewContext}
      
      ${LITERARY_ENGINE_RULES}
      
      Provide a sophisticated narrative expansion. Include:
      1. Structural Pivot Points (specific scene ideas that "turn" the story).
      2. Character/Subject Deepening (internal wounds or hidden motivations).
      3. Atmospheric/Thematic Resonance (symbols or sensory motifs unique to the ${genre} setting).
      
      Output should be professional, insightful, and strictly relevant to the provided genre and goal.`;

    return await callAI({ prompt, model: "gemini-2.0-flash" });
  },

  async generateCharacter(concept: string, type: ProjectType, research: ResearchNote[] = [], maturity = 'standard'): Promise<Character> {
    const researchContext = research.length > 0 
      ? `\nRESEARCH CONTEXT FOR CHARACTERS:\n${research.map(r => `- ${r.title}: ${r.content}`).join('\n')}`
      : "";

    const prompt = `Create a character for a ${type}. Concept: "${concept}". ${getMaturityDirectives(maturity)} ${researchContext}
    IMPORTANT: Always provide a real, appropriate name for this character — a name that fits the genre, setting, and maturity level of the work. Never return a placeholder like "Unknown" or "Character 1".
    Include a detailed 'physicalDescription' that can be used for biometric portrait synthesis. Return as JSON.`;
    const schema = {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        role: { type: Type.STRING },
        backstory: { type: Type.STRING },
        traits: { type: Type.ARRAY, items: { type: Type.STRING } },
        goals: { type: Type.ARRAY, items: { type: Type.STRING } },
        fears: { type: Type.ARRAY, items: { type: Type.STRING } },
        motivations: { type: Type.ARRAY, items: { type: Type.STRING } },
        quirks: { type: Type.ARRAY, items: { type: Type.STRING } },
        archetype: { type: Type.STRING },
        physicalDescription: { type: Type.STRING }
      },
      required: ["name", "role", "backstory", "traits", "goals", "fears", "motivations", "quirks", "archetype", "physicalDescription"]
    };

    const text = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    const data = safeParseJSON(text || "{}")
    return {
      name: (data.name && data.name !== 'Unknown' && data.name !== 'Unknown Character') ? data.name : `${concept.split(' ')[0] || 'Character'}_${Date.now().toString(36)}`,
      role: data.role || 'Supporting',
      backstory: data.backstory || '',
      traits: Array.isArray(data.traits) ? data.traits : [],
      goals: Array.isArray(data.goals) ? data.goals : [],
      fears: Array.isArray(data.fears) ? data.fears : [],
      motivations: Array.isArray(data.motivations) ? data.motivations : [],
      quirks: Array.isArray(data.quirks) ? data.quirks : [],
      archetype: data.archetype || 'Unknown',
      id: crypto.randomUUID(),
      updatedAt: Date.now()
    };
  },

  async outlinePlotNodes(project: Project, chapters: Chapter[] = [], research: ResearchNote[] = []): Promise<PlotNode[]> {
    const maxContentLength = 150000;
    const chaptersContext = chapters.map((c: any) => `### Chapter: ${c.title}\n${c.content}`).join('\n\n').slice(0, maxContentLength);
    const sourceContext = (project.sourceMaterials || []).map((s: any) => `### Source [${s.name}]\n${s.content}`).join('\n\n').slice(0, maxContentLength);
    const researchContext = research.length > 0 
      ? `\n=== RESEARCH CONTEXT ===\n${research.map(r => `[${r.title}] (Category: ${r.category || 'General'}): ${r.content}`).join('\n\n')}`
      : "";
    const reviewContext = (project.externalReviews || []).filter(r => !r.isImplemented).length > 0
      ? `\n=== EXTERNAL CRITICAL REVIEWS ===\n${(project.externalReviews || []).filter(r => !r.isImplemented).map(r => `[FROM ${r.source}]: ${r.content}`).join('\n')}`
      : "";
    
    let prompt = `You are a Master Plot Architect outlining a ${project.type} structure for "${project.title}". Create between 8 and 18 major narrative beats. ${getMaturityDirectives(project.maturity)}\n\n`;
    prompt += LITERARY_ENGINE_RULES;
    
    if (chaptersContext || sourceContext || researchContext || reviewContext) {
      prompt += `Analyze ALL of the following materials. 

CRITICAL DIRECTIVE: If there are "AI Brainstorm" or "Structural Plan" notes in the RESEARCH CONTEXT, you MUST base your narrative beats and architecture directly on those specific ideas, structures, and character arcs. The Brainstorm/Research notes override standard defaults. Reconcile them with the existing chapters and source materials.

=== EXISTING MANUSCRIPT/CHAPTERS ===
${chaptersContext}

=== SOURCE MATERIALS ===
${sourceContext}

${researchContext}

=== EXTERNAL FEEDBACK ===
${reviewContext}

Based ONLY on the provided text and strictly following any structural plans found in the RESEARCH CONTEXT, outline the major narrative beats. Return a JSON array of objects.`;
    } else {
      prompt += `Return a JSON array of objects.`;
    }

    const schema = {
      type: Type.OBJECT,
      properties: {
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { type: Type.STRING }
            },
            required: ["title", "description", "type"]
          }
        }
      },
      required: ["nodes"]
    };

    const text = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    let data = safeParseJSON(text || "[]", []);
    
    if (!Array.isArray(data)) {
      data = Array.isArray(data.nodes) ? data.nodes 
           : Array.isArray(data.items) ? data.items 
           : Object.values(data).find(Array.isArray) || [];
    }

    const nodes = (data as any[]).map((d: any, index: number) => ({ 
      id: crypto.randomUUID(),
      title: d.title || 'Untitled Beat',
      description: d.description || '',
      status: 'active' as const,
      type: (['main', 'sub', 'theme'].includes(d.type?.toLowerCase()) ? d.type.toLowerCase() : 'main') as any,
      order: index, 
      updatedAt: Date.now() 
    }));

    return nodes;
  },

  async getSwarmCritique(text: string, type: ProjectType, maturity = 'standard', sourceMaterials: { name: string, content: string }[] = [], customRoles?: string[]): Promise<Critique[]> {
    const defaultRoles: (keyof typeof AGENT_PERSONAS)[] = ['vocal', 'structural', 'factual', 'agent', 'sentence', 'thematic', 'writer', 'repetition'];
    if (type === 'legal') defaultRoles.push('legal');
    if (type === 'academic') defaultRoles.push('academic');
    if (type === 'experimental' || type === 'screenplay') defaultRoles.push('comedy');

    const roles = customRoles || defaultRoles;

    const sourceContext = sourceMaterials.length > 0
      ? `\nSOURCE MATERIALS FOR REFERENCE:\n${sourceMaterials.map(s => `[SOURCE: ${s.name}]\n${s.content.slice(0, 3000)}`).join('\n\n')}`
      : "";

    const schema = {
      type: Type.OBJECT,
      properties: {
        content: { type: Type.STRING },
        severity: { type: Type.STRING, enum: ["low", "medium", "high", "critical"] },
        suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["content", "severity", "suggestions"]
    };

    const critiquePromises = roles.map(async (role) => {
      const personaNames: Record<string, string> = {
        agent: "Literary Agent",
        publisher: "Acquisitions Editor",
        market: "Book Marketeer",
        buyer: "Retail Buyer",
        reader: "Critical Beta Reader",
        vocal: "Vocal Architect",
        structural: "Structural Architect",
        factual: "Fact Checker",
        legal: "Legal Specialist",
        academic: "Peer Reviewer",
        comedy: "Comedy Doctor",
        sentence: "Sentence Stylist",
        thematic: "Thematic Analyst",
        writer: "Seasoned Author",
        medical: "General Practitioner",
        historical: "Historian",
        sensitivity: "Sensitivity Panel"
      };

      const prompt = `
        ${AGENT_PERSONAS[role as keyof typeof AGENT_PERSONAS]} 
        
        TASK: Perform a high-fidelity, brutal critique of this ${type} draft.
        ${getMaturityDirectives(maturity)} 
        ${sourceContext} 
        
        TEXT TO ANALYZE:
        "${text.slice(0, 10000)}"
        
        CRITERIA:
        1. Identify exactly where the prose loses momentum or character voice falters.
        2. Rank severity objectively (low, medium, high, critical).
        3. Provide 3-5 specific, actionable suggestions for improvement.
        
        Return ONLY valid JSON according to the requested schema.
      `;

      const responseText = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
      const data = safeParseJSON(responseText || "{}");
      
      const suggestions = Array.isArray(data.suggestions) 
        ? data.suggestions.map((s: any) => typeof s === 'string' ? { text: s } : s)
        : [];

      return {
        id: crypto.randomUUID(),
        agentName: personaNames[role] || `${role.charAt(0).toUpperCase() + role.slice(1)} Engine`,
        role: role as any,
        content: data.content || "No major issues identified.",
        severity: data.severity || "low",
        suggestions,
        timestamp: Date.now() // Add timestamp for versioning
      } as Critique;
    });

    return Promise.all(critiquePromises);
  },

  async writeDraft(title: string, summary: string, context: string, type: ProjectType, activeNodes: PlotNode[], research: ResearchNote[] = [], maturity = 'standard', sourceMaterials: { name: string, content: string }[] = [], directives: string[] = [], projectTargetWords?: number, externalReviews: ExternalReview[] = [], draftStage?: 1 | 2 | 3 | 4, chapterCount?: number, cutMode?: boolean): Promise<string> {
    const isPlanDriven = directives.length > 0;
    const cutModeDirective = cutMode ? `
      CRITICAL CUT & COMPRESS DIRECTIVE:
      - This is a "KILL YOUR DARLINGS" operation.
      - Actively cut content by 20-40%.
      - DELETE decorative adjectives and redundant descriptions.
      - COMPRESS dialogue for maximum impact and minimum word count.
      - MERGE redundant scenes or character beats.
      - Strike any scene that does not turn the story or reveal essential character wounds.
      - Your output MUST be significantly SHORTER than a standard draft.
    ` : "";

    // ── Staged drafting: Pass percentages 1=10%, 2=25%, 3=75%, 4=100% ──────────
    // If no draftStage is set, default to Pass 1 (lean skeleton) to prevent bloat.

    const PASS_PERCENTAGES = { 1: 0.10, 2: 0.25, 3: 0.75, 4: 1.0 };
    const PASS_LABELS: Record<number, string> = {
      1: 'Pass 1: Lean Skeleton (Architecture)',
      2: 'Pass 2: Staged Expansion (Interiority)',
      3: 'Pass 3: Full Narrative (Immersion)',
      4: 'Pass 4: Final Polish (Voice)'
    };
    const PASS_INSTRUCTIONS: Record<number, string> = {
      1: 'Focus on scene architecture and skeletal prose. Do not over-expand.',
      2: 'Expand skeletal structure with subtext and character interiority. Add grounding sensory details.',
      3: 'Full scene depth. Pacing refined. Every scene must turn.',
      4: 'Every sentence must earn its place. Cut all sludge. Perfect rhythm.'
    };
    const PASS_TASK: Record<number, string> = {
      1: 'Write a SKELETAL FIRST DRAFT of Chapter: "' + title + '". STRICT RULES: Hit every scene beat. Essential dialogue only. No descriptive padding, no sensory flourishes, no internal monologue beyond one line per character. LEAN FUNCTIONAL PROSE only. DO NOT write purple prose. DO NOT write beautifully. Write clearly and structurally. Output must be approximately the STRICT WORD TARGET above.',
      2: 'Write a SECOND PASS EXPANSION of Chapter: "' + title + '". RULES: Expand skeletal structure with subtext and character interiority. Add ONE grounding sensory detail per scene maximum. Strengthen dialogue. Still lean. No decorative adjectives. No lush description. Output must be approximately the STRICT WORD TARGET above.',
      3: 'Write a THIRD PASS NEAR-FINAL DRAFT of Chapter: "' + title + '". RULES: Full scene depth. Pacing refined. Every scene must turn. Sensory grounding appropriate but must serve the story. Cut anything that does not advance plot, character, or tension. Output must be approximately the STRICT WORD TARGET above.',
      4: 'Write the FINAL POLISHED DRAFT of Chapter: "' + title + '". RULES: Every sentence must earn its place. Cut all sludge. Perfect rhythm, voice, and subtext. This is the version that goes to the publisher. Output must be approximately the STRICT WORD TARGET above.'
    };

    const effectiveDraftStage: 1 | 2 | 3 | 4 = draftStage || 1;
    const passPercent = PASS_PERCENTAGES[effectiveDraftStage];
    const passLabel   = PASS_LABELS[effectiveDraftStage];
    const passInstr   = PASS_INSTRUCTIONS[effectiveDraftStage];
    const passTask = PASS_TASK[effectiveDraftStage];

    const effectiveChapterCount = chapterCount && chapterCount > 0 ? chapterCount : 25;
    // Always compute a per-chapter target — never fall back to full depth
    const perChapterTarget = projectTargetWords
      ? Math.round((projectTargetWords * passPercent) / effectiveChapterCount)
      : Math.round((50000 * passPercent) / effectiveChapterCount);

    // Word target block is always included — plan-driven drafts still need a hard target
    const wordTargetBlock = `PROJECT SCALE: ${(projectTargetWords || 50000).toLocaleString()} words total across ${effectiveChapterCount} chapters.
STRICT WORD TARGET FOR THIS CHAPTER: ${perChapterTarget!.toLocaleString()} words.
HARD WORD LIMIT: Do NOT exceed ${Math.round(perChapterTarget! * 1.03).toLocaleString()} words (3% tolerance).
Do NOT write below ${Math.round(perChapterTarget! * 0.90).toLocaleString()} words (90% floor).
${passInstr}
STAGED GROWTH ENFORCEMENT: You are writing at ${Math.round(passPercent * 100)}% manuscript depth. Writing beyond this depth is a failure. The manuscript will be expanded in later passes.`;

    const targetContext = isPlanDriven
      ? `DRAFT STAGE: ${passLabel}
PLAN-DRIVEN DRAFTING: Follow the CRITICAL AUTHOR DIRECTIVES below. Still respect the pass stage — do not write beyond ${passLabel} depth.
${wordTargetBlock}`
      : `DRAFT STAGE: ${passLabel}
${wordTargetBlock}`;

    const researchContext = research.length > 0 
      ? `\nRESEARCH ARCHIVE (INTEGRATE THESE SENSORY DETAILS):\n${research.map(r => `- ${r.title}: ${r.content} [Sensory: ${JSON.stringify(r.sensoryDetails)}]`).join('\n')}`
      : "";

    const maturityDirective = getMaturityDirectives(maturity);
    const sourceContext = sourceMaterials.map(s => `[SOURCE: ${s.name}]: ${s.content.slice(0, 5000)}`).join('\n\n');
    const authorDirectives = directives.length > 0 ? `\nCRITICAL AUTHOR DIRECTIVES (IMPLEMENT THESE FIXES):\n${directives.map(d => `- ${d}`).join('\n')}` : "";
    
    const reviewContext = externalReviews.filter(r => !r.isImplemented).length > 0 
      ? `\nEXTERNAL CRITICAL REVIEWS (IMPLEMENT THESE SPECIFIC SUGGESTIONS/FIXES):\n${externalReviews.filter(r => !r.isImplemented).map(r => `- [FROM ${r.source}]: ${r.content}`).join('\n')}`
      : "";

    const prompt = `You are an elite ${type} writer. 
      ${maturityDirective}
      ${targetContext}
      
      ${LITERARY_ENGINE_RULES}
      ${cutModeDirective}
      
      TASK: ${cutMode ? `Redraft and COMPRESS the chapter "${title}" — cut bloat, delete what does not serve the story, and return a tighter, leaner version.` : passTask}
      SCENE OBJECTIVES: ${summary}
      ${authorDirectives}
      ${reviewContext}
      ${researchContext}
      
      STRICT CONTINUITY CONTEXT:
      ${context}

      PLOT BEATS TO INTEGRATE:
      ${activeNodes.map(n => `- ${n.title}: ${n.description}`).join('\n')}

      RESEARCH & SOURCE METERIALS:
      ${sourceContext}

      AUTHORIAL DIRECTIVE:
      - Use standard Markdown formatting.
      - Write only the prose. No notes, no meta-commentary.
      - AVOID ECHOES: Do not repeat motifs, imagery, or sentence rhythms present in the continuity text context unless they return transformed.
      - STAGED GROWTH: You are at ${passLabel}. Do NOT write beyond this depth. The manuscript grows across passes.
      - CUT the sludge. If a scene doesn't turn, strike it.
      - NO PURPLE PROSE: Do not write ornate, decorative, or flowery language. Clarity and function over beauty at all pass stages.
      - Find the "winding" of the scene — where the power shifts or the secret leaks — but express it in plain, direct prose.
      - WORD COUNT IS LAW: Output must land within 3% of the STRICT WORD TARGET. Too long = failure. Too short = failure.
      - CHARACTER NAMES IN PROSE: Character names are stored in the library for reference only. In prose, use a character's name only when the narrative naturally calls for it. Characters may be referred to by role, pronoun, relationship, or description throughout. Never force a name into prose as a rule.
    `;

    // Compute a generous maxTokens budget: ~1.4 tokens per word, plus 20% headroom
    const maxTokensBudget = Math.ceil(perChapterTarget * 1.4 * 1.2);
    return await callAI({ prompt, model: "gemini-2.5-pro-preview-05-06", maxTokens: maxTokensBudget });
  },

  async compileResearch(topic: string, context: string, type: ProjectType, deep = false): Promise<ResearchNote> {
    const prompt = deep ? 
      `You are a high-fidelity Deep Research Agent for a ${type}. 
       Your goal is to provide granular, visceral research details for the topic: "${topic}".
       Context of the work: ${context}
       
       STRICT REQUIREMENT: Provide detailed sensory information (sounds, smells, textures, visuals) and niche technical/historical facts.
       Use your search tool to find real-world high-fidelity references.
       
       Return JSON.` :
      `You are a research assistant for a ${type}.\nTopic: "${topic}"\nContext: ${context}\n\nGather current, verifiable sources and synthesize findings.\nReturn JSON with keys: title, content, category, tags, sources.\nFor sources, include concrete citations (publication or site names with URLs when available).`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        content: { type: Type.STRING },
        category: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        sources: { type: Type.ARRAY, items: { type: Type.STRING } },
        sensoryDetails: {
          type: Type.OBJECT,
          properties: {
            sounds: { type: Type.ARRAY, items: { type: Type.STRING } },
            smells: { type: Type.ARRAY, items: { type: Type.STRING } },
            textures: { type: Type.ARRAY, items: { type: Type.STRING } },
            visuals: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      },
      required: ["title", "content", "category", "tags", "sources"]
    };

    const text = await callAI({ 
      prompt, 
      json: true, 
      schema, 
      model: deep ? "gemini-2.5-pro-preview-05-06" : "gemini-2.0-flash"
    });

    const data = safeParseJSON(text || "{}");
    return { 
      title: data.title || 'Untitled Research',
      content: data.content || 'No content generated.',
      category: data.category || 'general',
      tags: Array.isArray(data.tags) ? data.tags : [],
      sources: Array.isArray(data.sources) ? data.sources : [],
      sensoryDetails: data.sensoryDetails,
      isDeepResearch: deep,
      id: crypto.randomUUID(), 
      updatedAt: Date.now() 
    };
  },

  async extractResearchNeeds(text: string, type: ProjectType): Promise<string[]> {
    const prompt = `Analyze this ${type} manuscript segment. 
      Identify 5-8 specific knowledge vectors that require deep research to ensure absolute authority and sensory immersion. 
      Focus on:
      - Technical mechanisms or processes mentioned.
      - Sensory artifacts (sounds, smells, textures of the setting).
      - Historical or cultural context relevant to the scene.
      - Factual assertions that need verification.
      
      PROSE:
      "${text.slice(0, 10000)}"
      
      Return a JSON array of strings (the research topics).`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        topics: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["topics"]
    };

    const response = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    const data = safeParseJSON(response || "{}");
    return Array.isArray(data.topics) ? data.topics : [];
  },

  async generateNarrativeGraph(
    title: string, 
    genre: string, 
    premise: string, 
    type: ProjectType,
    research: ResearchNote[] = [],
    sourceMaterials: SourceMaterial[] = []
  ): Promise<any> {
    const isNonFiction = ['academic', 'cookbook', 'coursebook', 'essays', 'biography', 'memoir'].includes(type);
    
    const researchContext = research.length > 0 
      ? `\nRESEARCH ATTACHED:\n${research.map(r => `- ${r.title}: ${r.content}`).join('\n')}`
      : "";

    const maxSourceContentLength = 100000;
    const sourceContext = sourceMaterials.length > 0 
      ? `\nSOURCE MATERIALS:\n${sourceMaterials.map(s => `- ${s.name}: ${s.content}`).join('\n\n').slice(0, maxSourceContentLength)}`
      : "";

    const prompt = `You are a World-Class ${isNonFiction ? 'Knowledge' : 'Narrative'} Architect. 
      Project: "${title}"
      Genre/Field: ${genre}
      Type: ${type}
      Premise: ${premise}

      ${researchContext}
      ${sourceContext}
      
      TASK: Generate a comprehensive ${isNonFiction ? 'Structural Roadmap' : 'World Intelligence Graph'} for this work.
      ${isNonFiction 
        ? 'Include a highly granular Table of Contents and Research Roadmap for definitive authority.' 
        : 'Include a set of "Foundation Nodes" (Setting/World Bible, Character Motifs, etc.) and specific "Narrative Tracks" (historical textures, cultural artifacts, technical jargon) to ground the fiction.'
      }
      
      Return JSON with "nodes" (title, focus) and "researchTracks" (topic, priority).`;
    
    const schema = {
      type: Type.OBJECT,
      properties: {
        nodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              focus: { type: Type.STRING }
            },
            required: ["title", "focus"]
          }
        },
        researchTracks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              topic: { type: Type.STRING },
              priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] }
            },
            required: ["topic", "priority"]
          }
        }
      },
      required: ["nodes", "researchTracks"]
    };

    const response = await callAI({ prompt, json: true, schema, model: "gemini-2.5-pro-preview-05-06" });
    return safeParseJSON(response || "{}");
  },

  async extractCharacters(chapters: Chapter[], project: Project): Promise<Character[]> {
    const fullText = chapters.map(c => c.content).join('\n\n').slice(0, 50000); // 50k chars is enough for a deep scan
    const currentChars = (project.characters || []).map(c => c.name).join(', ');

    const prompt = `You are a Character Specialist for a ${project.type}. Analyze the provided manuscript text and identify all significant characters. 
      EXCLUDE characters already in the Forge: [${currentChars}].
      
      IMPORTANT: Every character you return MUST have a real, appropriate name from the text. If a character has no name in the text, invent an appropriate one that fits the genre and setting. Never return 'Unknown' or placeholder names.

      For each NEW character found, provide a full profile according to the requested JSON schema.
      Include a 'physicalDescription' based on any textual evidence in the draft.
      Focus on their dramatic engine, role in the story, and sensory details mentioned in the text.

      MANUSCRIPT SAMPLE:
      ${fullText}

      Return as a JSON array within an object: { "characters": [...] }`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        characters: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              role: { type: Type.STRING },
              backstory: { type: Type.STRING },
              traits: { type: Type.ARRAY, items: { type: Type.STRING } },
              goals: { type: Type.ARRAY, items: { type: Type.STRING } },
              fears: { type: Type.ARRAY, items: { type: Type.STRING } },
              motivations: { type: Type.ARRAY, items: { type: Type.STRING } },
              quirks: { type: Type.ARRAY, items: { type: Type.STRING } },
              archetype: { type: Type.STRING },
              physicalDescription: { type: Type.STRING }
            },
            required: ["name", "role", "backstory", "traits", "goals", "fears", "motivations", "quirks", "archetype", "physicalDescription"]
          }
        }
      },
      required: ["characters"]
    };

    const text = await callAI({ prompt, json: true, schema, model: "gemini-2.5-pro-preview-05-06" });
    const data = safeParseJSON(text || '{"characters":[]}', { characters: [] });
    
    return (data.characters || []).map((char: any) => ({
      ...char,
      id: crypto.randomUUID(),
      updatedAt: Date.now()
    }));
  },

  async analyzeContinuity(nodes: PlotNode[], chapters: Chapter[], research: ResearchNote[] = [], externalReviews: ExternalReview[] = []): Promise<string> {
    const researchContext = research.length > 0 
      ? `\nRESEARCH ATTACHED:\n${research.map(r => `[${r.title}]: ${r.content}`).join('\n')}`
      : "";

    const reviewContext = externalReviews.filter(r => !r.isImplemented).length > 0
      ? `\nEXTERNAL CRITICAL REVIEWS:\n${externalReviews.filter(r => !r.isImplemented).map(r => `- [FROM ${r.source}]: ${r.content}`).join('\n')}`
      : "";

    const prompt = `Analyze narrative continuity and structural redundancy between the Plot Nodes, the current Chapter sequence, and critical external feedback.
      ${researchContext}
      ${reviewContext}
      
      Plot Nodes: ${JSON.stringify(nodes.map(n => ({ title: n.title, status: n.status })))}
      Chapters: ${JSON.stringify(chapters.map(c => ({ title: c.title, summary: c.summary, nodes: c.plotNodeIds || [] })))}
      
      TASK:
      1. Identify orphaned nodes and logic gaps.
      2. Identify REPETITION AND REDUNDANCY: Flag chapters that cover the same plot ground or repeat character realizations.
      3. Identify NARRATIVE LOOPING: Where the story spins its wheels without a significant turn.
      
      Format as a professional literary report in Markdown.`;

    return await callAI({ prompt, model: "gemini-2.5-pro-preview-05-06" });
  },

  async splitManuscript(fullText: string, type: ProjectType, isPlan = false): Promise<{ title: string; summary: string; marker: string; directives?: string[] }[]> {
    const prompt = isPlan ? 
    `PLAN ARCHITECT: Analyze this structural blueprint/plan for a ${type}.
     Identify the logical chapter divisions described in the plan.
     For each chapter identified in the plan:
     - Generate a Title.
     - Provide a "Directive": The EXACT instructions or beats from the plan that belong to this chapter.
     - Create a Summary of the chapter's intent.
     - Identify a "Marker": the unique phrase starting this section in the plan.
     
     PLAN TEXT:
     ${fullText}
     
     Return as a JSON array of objects: { "chapters": [{ "title": string, "summary": string, "marker": string, "directives": string[] }] }`
    : `STRUCTURAL ARCHITECT: Analyze this raw manuscript of a ${type}. 
  
  Your task is to identify logical chapter boundaries WITHOUT returning the full text.
  1. Detect natural breakpoints (aim for 15-25 chapters if the text is long enough).
  2. For each chapter:
     - Generate a concise, evocative Title.
     - Create a ONE-SENTENCE structural Summary.
     - Identify a "Marker": the PRECISE FIRST 25-30 WORDS that start this chapter. This must be an EXACT substring of the provided manuscript.
  
  RAW MANUSCRIPT:
  ${fullText.slice(0, 800000)}
  
  Return ONLY a JSON array of objects: { "chapters": [{ "title": string, "summary": string, "marker": string }] }`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        chapters: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              marker: { type: Type.STRING },
              directives: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "summary", "marker"]
          }
        }
      },
      required: ["chapters"]
    };

    const text = await callAI({ prompt, json: true, schema, maxTokens: 8192, model: "gemini-2.5-pro-preview-05-06" });
    const data = safeParseJSON(text || '{"chapters":[]}', { chapters: [] });
    return data.chapters || [];
  },

  async finishAndFix(chapters: Chapter[], type: ProjectType, sourceMaterials: { name: string, content: string }[] = []): Promise<string> {
    const fullText = chapters.map(c => `[CHAPTER ${c.order + 1}: ${c.title}]\n${c.content}`).join('\n\n');
    const sourceContext = sourceMaterials.length > 0
      ? `\nSOURCE MATERIALS FOR REFERENCE:\n${sourceMaterials.map(s => `[SOURCE: ${s.name}]\n${s.content.slice(0, 5000)}`).join('\n\n')}`
      : "";

    const prompt = `You are the Master Editor. Analyze this full ${type} manuscript. 
      Identify every plot hole, character inconsistency, and pacing slump. 
      Then, provide a "Final Fix List" and a proposed "Climactic Resolution" to finish the book.
      
      MANUSCRIPT:\n${fullText.slice(0, 100000)}
      ${sourceContext}`;

    return await callAI({ prompt, model: "gemini-2.5-pro-preview-05-06" });
  },

  async automateNextSteps(project: Project, chapters: Chapter[], analysis?: string): Promise<{ title: string; summary: string; directives: string[] }[]> {
    const context = chapters.map(c => `${c.title}: ${c.summary}`).join('\n');
    const sourceContext = project.sourceMaterials?.length 
      ? `\nSOURCE CONTEXT:\n${project.sourceMaterials.map(s => `- ${s.name}: ${s.content.slice(0, 2000)}`).join('\n')}`
      : "";
    const analysisContext = analysis ? `\n\nANALYSIS CONTEXT:\n${analysis}` : "";

    const prompt = `Narrative Architect: Generate the next 3 logical chapter beats to bring "${project.title}" (${project.type}) to a satisfying conclusion. 
      
      EXISTING BEATS:
      ${context}
      ${sourceContext}
      ${analysisContext}
      
      Return as a JSON array of objects with "title", "summary", and an array of 3-5 "directives" (specific prose instructions) for the author.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        beats: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              directives: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "summary", "directives"]
          }
        }
      },
      required: ["beats"]
    };

    const text = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    const data = safeParseJSON(text || '[]', []);
    return Array.isArray(data) ? data : (data.beats || data.items || []);
  },

  async transmuteToRadioPlay(project: Project, chapters: Chapter[]): Promise<string> {
    const fullText = chapters.map(c => c.content).join('\n\n').slice(0, 50000);
    const prompt = `You are a BBC Radio 4 Drama Producer specializing in prestige audio drama.
      TASK: Convert the manuscript into a professional Radio Play script adhering to BBC Standard Scripting formats.
      
      CRITICAL FOCUS:
      1. ACOUSTIC WORLD-BUILDING: Every scene MUST begin with a "GRAMS" or "FX" cue that defines the physical space.
      2. ECONOMY OF SPEECH: Dialogue must be rhythmic, subtext-heavy, and stripped of clinical "he said/she said" patterns.
      3. CHARACTER DIFFERENTIATION: Give each voice a distinct acoustic profile (pitch, tempo, cadence).
      4. PACING: Ensure scene transitions are sharp and auditory "cross-fades" are used for narrative momentum.
      
      MANUSCRIPT SAMPLE:
      ${fullText}
      
      OUTPUT FORMAT:
      [SCENE NUMBER]
      [INT/EXT LOCATION - ACOUSTIC DESCRIPTION]
      [GRAMS/FX: Sound cues]
      [CHARACTER NAME]: [Dialogue with performance directions in brackets]`;

    return await callAI({ prompt, model: "gemini-2.0-flash" });
  },

  async generateCoverPrompt(project: Project, author: string, subtitle: string, basePrompt: string): Promise<string> {
    const prompt = `You are a World-Class Book Cover Designer and Master Prompt Architect. 
      Generate a HIGH-FIDELITY, PRODUCTION-READY prompt for an image generator (DALL-E 3) for "${project.title}".
      
      CONTEXT:
      AUTHOR: ${author}
      SUBTITLE: ${subtitle}
      USER CONCEPT: ${basePrompt}
      GENRE: ${project.genre}
      
      PROMPT ARCHITECTURE:
      - VIBE: Cinematic, moody, hyper-detailed.
      - TEXT ENFORCEMENT: Instruction: "The text on the cover must be perfectly legible. The title '${project.title}' is the hero element. The author name '${author}' should be present at the base. No spelling errors."
      - STYLE: Avoid 'stock photo' looks. Prefer stylized digital painting, conceptual photography, or brutalist graphic design based on the genre.
      - COMPOSITION: Law of thirds, strong focal points, atmospheric lighting.
      
      OUTPUT ONLY THE FINAL CONCATENATED PROMPT.`;
    
    return await callAI({ prompt, model: "gemini-2.0-flash" });
  },

  async generateAudiobookScript(project: Project, chapters: Chapter[]): Promise<string> {
    const fullText = chapters.map(c => c.content).join('\n\n').slice(0, 50000);
    const prompt = `You are a Narrative Director for high-end Audiobook productions (Audible/Penguin Random House).
      TASK: Create an "Economy Mode" Performance Archive for narrators.
      
      ARCHIVE REQUIREMENTS:
      1. EXECUTIVE SUMMARY: A high-fidelity, spoiler-rich summary for the primary narrator to understand the core internal arc.
      2. VOICE MAP: Provide a breakdown of main characters including:
         - Archetype: (e.g., The Wounded Idealist)
         - Vocal Texture: (e.g., Gravelly, sibilant, breathy)
         - Accent/Region: (Specific geographic or class markers)
         - Emotional Baseline: (How they sound when resting)
      3. NARRATIVE BEATS: A condensed version of the story optimized for an "Abridged Classics" style reading.
      
      MANUSCRIPT SAMPLE:
      ${fullText}`;

    return await callAI({ prompt, model: "gemini-2.0-flash" });
  },

  async reconcileChapters(project: Project, plotNodes: PlotNode[], chapters: Chapter[], research: ResearchNote[] = []): Promise<{ title: string; summary: string; plotNodeIds: string[] }[]> {
    const researchContext = research.length > 0 
      ? `\nRESEARCH ATTACHED:\n${research.map(r => `[${r.title}]: ${r.content}`).join('\n')}`
      : "";

    const reviewContext = (project.externalReviews || []).filter(r => !r.isImplemented).length > 0
      ? `\nEXTERNAL CRITICAL REVIEWS TO RECONCILE:\n${(project.externalReviews || []).filter(r => !r.isImplemented).map(r => `- [FROM ${r.source}]: ${r.content}`).join('\n')}`
      : "";

    const prompt = `Narrative Architect: Reconcile the following Plot Nodes with the current Chapter structure for "${project.title}" (${project.type}).
    ${researchContext}
    ${reviewContext}
    
    PLOT NODES:
    ${plotNodes.map(n => `- [${n.id}] ${n.title}: ${n.description}`).join('\n')}
    
    CURRENT CHAPTERS:
    ${chapters.map(c => `- ${c.title}: ${c.summary} (Current Plot Node links: ${(c.plotNodeIds || []).join(', ')})`).join('\n')}
    
    TASK: Harmonize these beats into a tight, non-repetitive manuscript structure. 
    - AVOID DUPLICATION: If two chapters cover the same plot ground or repeat information, merge them immediately.
    - Ensure every chapter has a unique "turn" and contributes new information to the narrative engine.
    - Map each chapter to the most relevant Plot Nodes.

    Return as a JSON object: { "chapters": [{ "title": string, "summary": string, "plotNodeIds": string[] }] }`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        chapters: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              plotNodeIds: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "summary", "plotNodeIds"]
          }
        }
      },
      required: ["chapters"]
    };

    const text = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    const data = safeParseJSON(text || '{"chapters":[]}', { chapters: [] });
    return (data.chapters || []).map((c: any) => ({
      ...c,
      plotNodeIds: Array.isArray(c.plotNodeIds) ? c.plotNodeIds : []
    }));
  },

  async deepSimmer(chapter: Chapter, context: string, type: ProjectType, plotNodes: PlotNode[], research: ResearchNote[] = [], maturity = 'standard', sourceMaterials: { name: string, content: string }[] = [], projectTargetWords?: number, externalReviews: ExternalReview[] = [], draftStage?: 1 | 2 | 3 | 4, chapterCount?: number, cutMode?: boolean): Promise<string> {
    const personaMap = {
      novel: "Literary Genius / Prize-Winning Novelist",
      screenplay: "A-List Script Doctor",
      legal: "Senior Partner at a Magic Circle Law Firm",
      academic: "Highly-Cited Research Fellow",
      stageplay: "Tony Award Winning Playwright",
      radioplay: "BBC Audio Drama Lead",
      experimental: "Post-Modernist Maverick",
      subject_bible: "World-Class Narrative Architect",
      cookbook: "Master Gastronome",
      illustrated: "Visual Narrative Specialist",
      coursebook: "Pedagogical Master"
    };

    const PASS_PERCENTAGES = { 1: 0.10, 2: 0.25, 3: 0.75, 4: 1.0 };
    const currentPass = draftStage || 1;
    const passPercent = PASS_PERCENTAGES[currentPass as keyof typeof PASS_PERCENTAGES];
    const totalChapters = Math.max(1, chapterCount || 25);
    const perChapterTarget = projectTargetWords 
      ? Math.round((projectTargetWords * passPercent) / totalChapters)
      : currentPass === 1 ? 300 : currentPass === 2 ? 800 : currentPass === 3 ? 2000 : 3000;

    const draftStageInfo = draftStage ? `
    DRAFT STAGE: Pass ${currentPass} of 4 (${Math.round(passPercent * 100)}% target depth).
    ` : "";

    const targetContext = `
PROJECT TARGET SCALE: ${(projectTargetWords || 50000).toLocaleString()} words total across ${totalChapters} chapters.
STRICT WORD TARGET FOR THIS CHAPTER: ${perChapterTarget.toLocaleString()} words.
HARD WORD LIMIT: Do NOT exceed ${Math.round(perChapterTarget * 1.03).toLocaleString()} words (3% tolerance).
Do NOT write below ${Math.round(perChapterTarget * 0.90).toLocaleString()} words (90% floor).
WORD COUNT IS LAW: Output must land within 3% of the STRICT WORD TARGET. Too long = failure. Too short = failure.
${draftStageInfo}`;

    const cutModeDirective = cutMode ? `
      CRITICAL CUT & COMPRESS DIRECTIVE:
      - This is a "KILL YOUR DARLINGS" operation.
      - Actively cut content by 20-40%.
      - DELETE decorative adjectives and redundant descriptions.
      - COMPRESS dialogue for maximum impact and minimum word count.
      - MERGE redundant scenes or character beats.
      - Strike any scene that does not turn the story or reveal essential character wounds.
      - Your output MUST be significantly SHORTER than a standard draft.
    ` : "";

    const stageSpecificDirective = (currentPass === 1 || currentPass === 2)
      ? "\nSTAGED DRAFTING DIRECTIVE: You are in an early PASS. DO NOT over-expand scenes yet. Focus on architecture, skeletal sensory details, and core narrative turns. Keep the prose tight and architectural."
      : "";

    const researchContext = research.length > 0 
      ? `\nIMPACTFUL RESEARCH TO INTEGRATE:\n${research.map(r => `- ${r.title}: ${r.content} [Sensory: ${JSON.stringify(r.sensoryDetails)}]`).join('\n')}`
      : "";

    const nodeContext = plotNodes.length > 0 
      ? `\nINTEGRATE THESE PLOT BEATS WITH MASTERFUL SUBSERVIENCE TO THEME:\n${plotNodes.map(n => `- ${n.title}: ${n.description}`).join('\n')}`
      : "";

    const sourceContext = sourceMaterials.length > 0
      ? `\nANCHOR TO THESE SOURCE TRUTHS:\n${sourceMaterials.map(s => `[SOURCE: ${s.name}]\n${s.content.slice(0, 3000)}`).join('\n\n')}`
      : "";

    const reviewContext = externalReviews.filter(r => !r.isImplemented).length > 0 
      ? `\nEXTERNAL CRITICAL REVIEWS (RESOLVE THESE CONCERNS AND INTEGRATE SUGGESTIONS):\n${externalReviews.filter(r => !r.isImplemented).map(r => `- [FROM ${r.source}]: ${r.content}`).join('\n')}`
      : "";

    const prompt = `You are a ${personaMap[type || 'novel']}. 
      TASK: ${cutMode ? 'Redraft and COMPRESS' : 'Elevate the following scene to "Prize-Winning" caliber'}.
      
      ${LITERARY_ENGINE_RULES}
      ${cutModeDirective}
      ${getMaturityDirectives(maturity)}
      ${targetContext}
      ${stageSpecificDirective}
      
      TITLE: "${chapter.title}"
      BRIEF: ${chapter.summary}
      EXISTING CONTENT: ${chapter.content}
      NARRATIVE CONTINUITY: ${context}
      ${researchContext}
      ${nodeContext}
      ${sourceContext}
      ${reviewContext}
      
      AUTHORIAL STANCE:
      - Refine the prose for maximum emotional resonance, clarity, and subtext.
      - Prioritize sharpening and tightening the manuscript.
      - AVOID ECHOES: Do not repeat motifs, imagery, or sentence rhythms present in the continuity text unless they return transformed.
      - Maintain depth appropriate for the project scale without artificial padding.
      - Ensure sensory immersion is absolute.
      - Find the "winding" of the scene—where the power shifts or the secret leaks.
      - Return ONLY the enhanced text. No preamble.`;

    // Compute a generous maxTokens budget: ~1.4 tokens per word, plus 20% headroom
    const deepSimmerMaxTokens = Math.ceil(perChapterTarget * 1.4 * 1.2);
    return await callAI({ prompt, model: "gemini-2.5-pro-preview-05-06", maxTokens: deepSimmerMaxTokens });
  },

  async assessPrizeWorthiness(project: Project, chapters: Chapter[]): Promise<PrizeAssessment[]> {
    const prizesByProject: Record<string, string[]> = {
      novel: ["The Booker Prize", "The Pulitzer Prize for Fiction", "National Book Award", "Hugo Award", "Women's Prize for Fiction"],
      screenplay: ["Academy Award (Best Original Screenplay)", "Golden Globe for Best Screenplay", "BAFTA Award for Best Original Screenplay", "Sundance Grand Jury Prize"],
      stageplay: ["Tony Award for Best Play", "Pulitzer Prize for Drama", "Laurence Olivier Award"],
      academic: ["Nobel Prize in Literature", "MacArthur Fellowship Concept", "National Book Award for Nonfiction"],
      experimental: ["The Turner Prize (Conceptual)", "Goncourt Prize", "James Tait Black Memorial Prize"],
      legal: ["Grawemeyer Award", "Stockholm Prize in Criminology"],
      radioplay: ["Sony Radio Academy Award", "BBC Audio Drama Award"]
    };

    const relevantPrizes = prizesByProject[project.type] || prizesByProject.novel;
    const contentSample = chapters.map(c => `[${c.title}]\n${c.content.slice(0, 800)}`).join('\n\n').slice(0, 6000);

    const prompt = `You are a prestigious literary and cinematic judge. Analyze the following work and assess its potential for the following awards: ${relevantPrizes.join(', ')}.
    Also specify a "targetWordCount" based on industry standards for each prize and project type.

    PROJECT TITLE: ${project.title}
    TYPE: ${project.type}
    PREMISE: ${project.premise}
    TONE/GENRE: ${project.tone} / ${project.genre}

    CONTENT STRATA:
    ${contentSample}

    TASK: For EACH prize, evaluate the project's current trajectory.
    
    Format as JSON: { "assessments": [{ "prizeName": string, "eligibilityScore": number, "pros": string[], "cons": string[], "recommendation": string, "targetWordCount": number }] }
    `;

    const schema = {
      type: Type.OBJECT,
      properties: {
        assessments: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              prizeName: { type: Type.STRING },
              eligibilityScore: { type: Type.NUMBER },
              pros: { type: Type.ARRAY, items: { type: Type.STRING } },
              cons: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendation: { type: Type.STRING },
              targetWordCount: { type: Type.NUMBER }
            },
            required: ["prizeName", "eligibilityScore", "pros", "cons", "recommendation", "targetWordCount"]
          }
        }
      },
      required: ["assessments"]
    };

    const response = await callAI({ prompt, json: true, schema, model: "gemini-2.5-pro-preview-05-06" });
    const data = safeParseJSON(response || "{}");
    return data.assessments || [];
  },
  
  async critique(text: string): Promise<string> {
    const prompt = `Critique the following writing sample. Focus on: Show, Don't Tell, Pacing, and Character Voice.
      Writing Sample: "${text}"`;
    return await callAI({ prompt, model: "gemini-2.0-flash" });
  },

  async analyzeProse(text: string, type: ProjectType, previousContext: string = "", externalReviews: ExternalReview[] = []): Promise<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }[]> {
    const reviewContext = externalReviews.filter(r => !r.isImplemented).length > 0 
      ? `\nUNRESOLVED EXTERNAL REVIEWS (CHECK IF PROSE STILL VIOLATES THESE):\n${externalReviews.filter(r => !r.isImplemented).map(r => `- [FROM ${r.source}]: ${r.content}`).join('\n')}`
      : "";

    const prompt = `
      You are a brutal Sentence Stylist and Literary Agent. Analyze the following ${type} segment based on these STRICT STANDING RULES:
      
      ${LITERARY_ENGINE_RULES}
      
      TASK: Identify exactly where these rules are violated. 
      ${reviewContext}
      
      CRITICAL FOCUS ON REPETITION:
      - Look for "Echoes": Words or sentence structures repeated close together.
      - Narrative Static: Ideas and motifs that have been said before in the provided context but add no new energy.
      - "Pretty Sludge": Recursive adjectives, fake profundity, decorative filler.
      - Abstract over Concrete: Vague descriptions of emotions instead of specific gestures/images.
      
      PREVIOUS CONTEXT (SUMMARY OF PRIOR BEATS):
      ${previousContext.slice(-2000)}
      
      TEXT TO ANALYZE:
      "${text.slice(0, 10000)}"
      
      Return a JSON object with a "violations" array. Each violation needs:
      - "type": (e.g. "Echo", "Static", "Sludge", "Abstract", "Subtext")
      - "message": A specific, bitey explanation of the failure.
      - "severity": low, medium, or high.
    `;

    const schema = {
      type: Type.OBJECT,
      properties: {
        violations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING },
              message: { type: Type.STRING },
              severity: { type: Type.STRING, enum: ["low", "medium", "high"] }
            },
            required: ["type", "message", "severity"]
          }
        }
      },
      required: ["violations"]
    };

    const response = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    const data = safeParseJSON(response || "{}");
    return Array.isArray(data.violations) ? data.violations : [];
  },

  async synthesizePortrait(description: string, archetype: string): Promise<string> {
    const prompt = `A highly detailed cinematic character portrait. 
      Subject: ${description}
      Vibe: ${archetype || 'Dramatic, noir lighting, elite literature quality'}
      Style: Professional character photography, shallow depth of field, realistic textures.`;
    
    //@ts-ignore
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Visual DNA synthesis failed: No image data returned.");
  },

  async checkSceneTurn(text: string, externalReviews: ExternalReview[] = []): Promise<{ turned: boolean; score: number; reasoning: string; missing: string }> {
    const reviewContext = externalReviews.filter(r => !r.isImplemented).length > 0 
      ? `\nEXTERNAL REVIEW CONTEXT:\n${externalReviews.filter(r => !r.isImplemented).map(r => `- [FROM ${r.source}]: ${r.content}`).join('\n')}`
      : "";

    const prompt = `
      Rule 6: EVERY SCENE MUST TURN.
      Analyze this narrative segment. A scene "turns" when something fundamental changes: power, knowledge, danger, intimacy, belief, status, or direction.
      ${reviewContext}
      
      TEXT:
      "${text.slice(0, 5000)}"
      
      TASK: Determine if the scene turns. Provide a scoring (1-100), detailed reasoning, and what is missing if it doesn't turn.
      Return JSON: { "turned": boolean, "score": number, "reasoning": string, "missing": string }
    `;

    const schema = {
      type: Type.OBJECT,
      properties: {
        turned: { type: Type.BOOLEAN },
        score: { type: Type.NUMBER },
        reasoning: { type: Type.STRING },
        missing: { type: Type.STRING }
      },
      required: ["turned", "score", "reasoning", "missing"]
    };

    const response = await callAI({ prompt, json: true, schema, model: "gemini-2.0-flash" });
    const data = safeParseJSON(response || "{}");
    return safeParseJSON(response || "{}");
  },


  // ─────────────────────────────────────────────────────────────────────────────
  // SEED INGESTION: Any raw input → collaborative story proposal
  // ─────────────────────────────────────────────────────────────────────────────
  async seedToStory(rawSeed: string, seedType: 'text' | 'image_ocr' | 'voice_transcript' | 'url' = 'text'): Promise<{
    title: string;
    premise: string;
    genre: string;
    tone: string;
    type: ProjectType;
    targetWordCount: number;
    logline: string;
    centralWound: string;
    suggestedChapters: { title: string; summary: string }[];
    suggestedCharacters: { name: string; role: string; backstory: string }[];
    authorQuestions: string[];
    prizeTarget: string;
  }> {
    const prompt = `
YOU ARE A WORLD-CLASS LITERARY EDITOR AND STORY ARCHITECT.

A raw seed has been provided. Your job is to find the STORY INSIDE IT — the hidden wound, the dramatic engine, the human truth — and propose a full literary project from it.

SEED TYPE: ${seedType}
RAW SEED:
${rawSeed.slice(0, 8000)}

CRITICAL PHILOSOPHY:
- Every seed contains a story. A receipt on the floor contains a life. A voice note contains a confession. Find it.
- The ambition is ALWAYS literary prize quality. Think Booker, Pulitzer, Costa.
- Do NOT produce a generic plot. Find the SPECIFIC, STRANGE, HUMAN truth in this seed.
- The story should feel inevitable once you see it — but surprising when proposed.
- Suggest 5 AUTHOR QUESTIONS that will unlock the story further. These pull the author INTO the process.

Return JSON with:
- title: A working title (evocative, not generic)
- premise: 2-3 sentences. The dramatic engine. What is at stake and why it matters.
- genre: The primary genre
- tone: The tonal register (e.g. "Dry wit, melancholic undertow, Carver-esque restraint")
- type: One of: novel|screenplay|stageplay|radioplay|legal|academic|experimental|coursebook|subject_bible|cookbook|illustrated
- targetWordCount: Appropriate word count for the type and ambition
- logline: One sentence. The hook.
- centralWound: The hidden wound at the heart of the story.
- suggestedChapters: Array of 10-20 chapters with title and summary
- suggestedCharacters: Array of 3-6 characters with name, role, backstory
- authorQuestions: Array of 5 questions to ask the author to deepen the story
- prizeTarget: Which literary prize this could realistically target and why
`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        premise: { type: Type.STRING },
        genre: { type: Type.STRING },
        tone: { type: Type.STRING },
        type: { type: Type.STRING },
        targetWordCount: { type: Type.NUMBER },
        logline: { type: Type.STRING },
        centralWound: { type: Type.STRING },
        suggestedChapters: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, summary: { type: Type.STRING } }, required: ['title', 'summary'] } },
        suggestedCharacters: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, role: { type: Type.STRING }, backstory: { type: Type.STRING } }, required: ['name', 'role', 'backstory'] } },
        authorQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        prizeTarget: { type: Type.STRING }
      },
      required: ['title', 'premise', 'genre', 'tone', 'type', 'targetWordCount', 'logline', 'centralWound', 'suggestedChapters', 'suggestedCharacters', 'authorQuestions', 'prizeTarget']
    };

    const response = await callAI({ prompt, json: true, schema, model: 'gemini-2.5-pro-preview-05-06' });
    const data = safeParseJSON(response || '{}');
    return {
      title: data.title || 'Untitled',
      premise: data.premise || '',
      genre: data.genre || 'Literary Fiction',
      tone: data.tone || 'Measured, precise',
      type: (data.type as ProjectType) || 'novel',
      targetWordCount: data.targetWordCount || 80000,
      logline: data.logline || '',
      centralWound: data.centralWound || '',
      suggestedChapters: Array.isArray(data.suggestedChapters) ? data.suggestedChapters : [],
      suggestedCharacters: Array.isArray(data.suggestedCharacters) ? data.suggestedCharacters : [],
      authorQuestions: Array.isArray(data.authorQuestions) ? data.authorQuestions : [],
      prizeTarget: data.prizeTarget || ''
    };
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // BOOK COMPLETION CHECK: Detect when the manuscript is genuinely finished
  // ─────────────────────────────────────────────────────────────────────────────
  async checkBookCompletion(project: Project, chapters: Chapter[]): Promise<{
    isComplete: boolean;
    completionScore: number;
    verdict: string;
    missingElements: string[];
    nextAction: string;
    readyForScalpel: boolean;
  }> {
    const totalWords = chapters.reduce((acc, c) => acc + (c.content?.split(/\s+/).filter((t: string) => t.length > 0).length || 0), 0);
    const targetWords = project.targetWordCount || 80000;
    const wordProgress = totalWords / targetWords;
    const draftStage = project.draftStage || 1;
    const emptyChapters = chapters.filter(c => !c.content || c.content.trim().length < 100).length;

    const prompt = `
YOU ARE A SENIOR LITERARY EDITOR assessing whether a manuscript is genuinely complete.

PROJECT: "${project.title}" (${project.type}, ${project.genre})
DRAFT STAGE: Pass ${draftStage} of 4
WORD COUNT: ${totalWords.toLocaleString()} of ${targetWords.toLocaleString()} target (${Math.round(wordProgress * 100)}%)
EMPTY/STUB CHAPTERS: ${emptyChapters} of ${chapters.length}
CHAPTER SUMMARIES:
${chapters.slice(0, 30).map((c: Chapter, i: number) => `${i + 1}. ${c.title}: ${(c.summary || c.content?.slice(0, 100) || 'EMPTY').slice(0, 120)}`).join('\n')}

ASSESS:
1. Is the narrative arc complete? (Beginning, middle, end — all present?)
2. Is the word count within 10% of target?
3. Are there stub/empty chapters?
4. Is the draft stage at 4 (final polish)?
5. Does the story feel resolved?

Return JSON:
- isComplete: boolean (true only if genuinely ready for scalpel/publish)
- completionScore: 0-100
- verdict: One sentence. Honest. Direct.
- missingElements: Array of what is still missing
- nextAction: What the author should do next
- readyForScalpel: boolean (true if complete enough for Mrs. Parry's cut)
`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        isComplete: { type: Type.BOOLEAN },
        completionScore: { type: Type.NUMBER },
        verdict: { type: Type.STRING },
        missingElements: { type: Type.ARRAY, items: { type: Type.STRING } },
        nextAction: { type: Type.STRING },
        readyForScalpel: { type: Type.BOOLEAN }
      },
      required: ['isComplete', 'completionScore', 'verdict', 'missingElements', 'nextAction', 'readyForScalpel']
    };

    const response = await callAI({ prompt, json: true, schema, model: 'gemini-2.0-flash' });
    const data = safeParseJSON(response || '{}');
    return {
      isComplete: data.isComplete || false,
      completionScore: data.completionScore || 0,
      verdict: data.verdict || 'Assessment incomplete.',
      missingElements: Array.isArray(data.missingElements) ? data.missingElements : [],
      nextAction: data.nextAction || 'Continue drafting.',
      readyForScalpel: data.readyForScalpel || false
    };
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // NON-FICTION LAYOUT INTELLIGENCE: Auto-design coursebook/cookbook/academic layouts
  // ─────────────────────────────────────────────────────────────────────────────
  async generateNonFictionLayout(project: Project, chapters: Chapter[]): Promise<{
    layoutType: string;
    interiorElements: { type: string; label: string; placement: string; description: string }[];
    chapterTemplate: string;
    suggestedImageSlots: { chapterIndex: number; description: string; aspectRatio: string }[];
    suggestedDiagramSlots: { chapterIndex: number; description: string; type: string }[];
    notesConfig: { hasMarginNotes: boolean; hasEndNotes: boolean; hasExercises: boolean; hasKeyTerms: boolean; hasSummaryBoxes: boolean };
    kdpInteriorType: 'black_white' | 'color';
  }> {
    const typeLayoutMap: Record<string, string> = {
      coursebook: 'Academic Coursebook (exercises, key terms, summary boxes, notes pages)',
      cookbook: 'Illustrated Cookbook (full-bleed images, ingredient lists, method steps, tips sidebars)',
      academic: 'Academic Monograph (footnotes, bibliography, figures, tables)',
      illustrated: 'Illustrated Book (image-led, captions, minimal text blocks)',
      subject_bible: 'Reference Bible (index, cross-references, definition boxes, diagrams)'
    };

    const layoutType = typeLayoutMap[project.type] || 'Standard Non-Fiction (chapter-led, clean typography)';

    const prompt = `
YOU ARE A PROFESSIONAL BOOK INTERIOR DESIGNER specialising in non-fiction.

PROJECT: "${project.title}" (${project.type})
LAYOUT TYPE: ${layoutType}
CHAPTERS:
${chapters.slice(0, 20).map((c: Chapter, i: number) => `${i + 1}. ${c.title}: ${(c.summary || '').slice(0, 150)}`).join('\n')}

DESIGN THIS BOOK'S INTERIOR. For each chapter, identify:
1. What interior elements are needed (exercises, notes pages, key terms, summary boxes, image slots, diagram slots)
2. Where images and diagrams should be placed
3. Whether the book needs color or B&W interior for KDP
4. A chapter template in Markdown that shows the layout structure

Return JSON:
- layoutType: string describing the layout
- interiorElements: array of { type, label, placement, description }
- chapterTemplate: A Markdown template showing the chapter structure with [IMAGE], [DIAGRAM], [NOTES_PAGE], [EXERCISE], [KEY_TERMS], [SUMMARY_BOX] placeholders
- suggestedImageSlots: array of { chapterIndex, description, aspectRatio }
- suggestedDiagramSlots: array of { chapterIndex, description, type }
- notesConfig: { hasMarginNotes, hasEndNotes, hasExercises, hasKeyTerms, hasSummaryBoxes }
- kdpInteriorType: 'black_white' or 'color'
`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        layoutType: { type: Type.STRING },
        interiorElements: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, label: { type: Type.STRING }, placement: { type: Type.STRING }, description: { type: Type.STRING } }, required: ['type', 'label', 'placement', 'description'] } },
        chapterTemplate: { type: Type.STRING },
        suggestedImageSlots: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { chapterIndex: { type: Type.NUMBER }, description: { type: Type.STRING }, aspectRatio: { type: Type.STRING } }, required: ['chapterIndex', 'description', 'aspectRatio'] } },
        suggestedDiagramSlots: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { chapterIndex: { type: Type.NUMBER }, description: { type: Type.STRING }, type: { type: Type.STRING } }, required: ['chapterIndex', 'description', 'type'] } },
        notesConfig: { type: Type.OBJECT, properties: { hasMarginNotes: { type: Type.BOOLEAN }, hasEndNotes: { type: Type.BOOLEAN }, hasExercises: { type: Type.BOOLEAN }, hasKeyTerms: { type: Type.BOOLEAN }, hasSummaryBoxes: { type: Type.BOOLEAN } }, required: ['hasMarginNotes', 'hasEndNotes', 'hasExercises', 'hasKeyTerms', 'hasSummaryBoxes'] },
        kdpInteriorType: { type: Type.STRING }
      },
      required: ['layoutType', 'interiorElements', 'chapterTemplate', 'suggestedImageSlots', 'suggestedDiagramSlots', 'notesConfig', 'kdpInteriorType']
    };

    const response = await callAI({ prompt, json: true, schema, model: 'gemini-2.5-pro-preview-05-06' });
    const data = safeParseJSON(response || '{}');
    return {
      layoutType: data.layoutType || layoutType,
      interiorElements: Array.isArray(data.interiorElements) ? data.interiorElements : [],
      chapterTemplate: data.chapterTemplate || '',
      suggestedImageSlots: Array.isArray(data.suggestedImageSlots) ? data.suggestedImageSlots : [],
      suggestedDiagramSlots: Array.isArray(data.suggestedDiagramSlots) ? data.suggestedDiagramSlots : [],
      notesConfig: data.notesConfig || { hasMarginNotes: false, hasEndNotes: false, hasExercises: false, hasKeyTerms: false, hasSummaryBoxes: false },
      kdpInteriorType: data.kdpInteriorType || 'black_white'
    };
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // COVER GENERATION: Best-in-class AI cover using secure backend proxy
  // ─────────────────────────────────────────────────────────────────────────────
  async generateBookCover(project: Project): Promise<string> {
    // First, craft a world-class cover prompt using narrative intelligence
    const promptCraftPrompt = `
YOU ARE A WORLD-CLASS BOOK COVER ART DIRECTOR. Your covers win awards. They sell books.

PROJECT: "${project.title}"
TYPE: ${project.type}
GENRE: ${project.genre}
PREMISE: ${(project.premise || '').slice(0, 500)}
TONE: ${project.tone || ''}
STYLE DNA: ${JSON.stringify(project.styleDNA || {})}

Craft a BOOK COVER IMAGE GENERATION PROMPT that:
1. Captures the EMOTIONAL CORE of the book — not a literal scene, but the feeling
2. Uses a SPECIFIC, EVOCATIVE visual metaphor
3. Specifies: composition, lighting, colour palette, mood, photographic/illustrative style
4. Is suitable for a ${project.type} cover that could win a design award
5. Does NOT include text, titles, or author names (those are overlaid separately)
6. Is 150-200 words maximum

Return ONLY the image generation prompt. No preamble. No explanation.`;

    const coverPrompt = await callAI({ prompt: promptCraftPrompt, model: 'gemini-2.5-pro-preview-05-06' });

    // Generate the cover image using Express server proxy (Flux pro / Venice / Grok)
    try {
      const response = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: (coverPrompt || "").trim().slice(0, 1000) })
      });

      if (!response.ok) {
        throw new Error(`Cover generation proxy failed: ${response.status}`);
      }

      const imageData = await response.json();
      if (imageData.result) return imageData.result;
    } catch (err) {
      console.warn("Venice image proxy failed, falling back to Grok image proxy:", err);
    }

    // Fallback to Grok Image generation
    const responseGrok = await fetch("/api/ai/image-grok", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: (coverPrompt || "").trim().slice(0, 1000) })
    });

    if (!responseGrok.ok) {
      throw new Error("Grok cover generation proxy failed");
    }

    const grokData = await responseGrok.json();
    if (grokData.result) return grokData.result;

    throw new Error('No image data returned from cover generation.');
  },

  async generateCoverImage(prompt: string): Promise<string> {
    try {
      const response = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: (prompt || "").trim().slice(0, 1000) })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) return data.result;
      }
    } catch (err) {
      console.warn("Cover image general proxy failed, trying Grok proxy...", err);
    }

    try {
      const responseGrok = await fetch("/api/ai/image-grok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: (prompt || "").trim().slice(0, 1000) })
      });

      if (responseGrok.ok) {
        const data = await responseGrok.json();
        if (data.result) return data.result;
      }
    } catch (err) {
      console.warn("Cover image Grok proxy failed, using high-quality abstract fallback.", err);
    }

    // Fallback to beautiful seeded abstract illustration from picsum
    return `https://picsum.photos/seed/${encodeURIComponent(prompt.slice(0, 20))}/600/900`;
  },

  async generateProductionIllustration(prompt: string, style: string): Promise<string> {
    const fullPrompt = `An award-winning chapter illustration. Style: ${style}. Subject: ${prompt}. Cinematic, detailed, high resolution, no text.`;
    try {
      const response = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt.slice(0, 1000) })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) return data.result;
      }
    } catch (err) {
      console.warn("Production illustration proxy failed, using Grok proxy...", err);
    }

    try {
      const responseGrok = await fetch("/api/ai/image-grok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt.slice(0, 1000) })
      });

      if (responseGrok.ok) {
        const data = await responseGrok.json();
        if (data.result) return data.result;
      }
    } catch (err) {
      console.warn("Production illustration Grok proxy failed, using abstract fallback.", err);
    }

    return `https://picsum.photos/seed/${encodeURIComponent(prompt.slice(0, 20))}/800/600`;
  },

  async synthesizeManuscript(chapters: Chapter[], project: Project): Promise<{ id: string, content: string, illustrationPrompt: string }[]> {
    const list = chapters.map(c => `Chapter [ID: ${c.id}, Title: ${c.title}, Summary: ${c.summary}]:\n${c.content?.slice(0, 3000)}`);
    const prompt = `You are a World-Class Acquisitions Chief and Editor. 
    Synthesize and refine these chapter contents for publication quality.
    Enhance flow, remove structural repetitive phrases (such as ending consecutive chapters with similar thoughts), and align prose style with Genre: "${project.genre}", Tone: "${project.tone}". For each chapter, also write a highly specific, wordless visual art description for chapter-front illustrations.
    
    CHAPTERS:
    ${list.join('\n\n')}
    
    Return a JSON array of objects structured as:
    { "refined": [{ "id": string, "content": string, "illustrationPrompt": string }] }`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        refined: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              content: { type: Type.STRING },
              illustrationPrompt: { type: Type.STRING }
            },
            required: ["id", "content", "illustrationPrompt"]
          }
        }
      },
      required: ["refined"]
    };

    const response = await callAI({ prompt, json: true, schema, model: 'gemini-2.5-pro-preview-05-06' });
    const data = safeParseJSON(response || "{}");
    return data.refined || chapters.map(c => ({ id: c.id, content: c.content, illustrationPrompt: `Evocative book illustration of ${c.title}` }));
  },

  async brainstormSequel(project: Project, chapters: Chapter[]): Promise<string> {
    const prompt = `You are an elite Literary Critic and Publisher. 
    Analyze this completed narrative:
    - Title: "${project.title}"
    - Genre: "${project.genre}"
    - Tone: "${project.tone}"
    - Brief chapters summary: ${chapters.map(c => `- ${c.title}: ${c.summary}`).join('\n')}
    
    Brainstorm a high-concept, transgressive, and commercially explosive sequel blueprint.
    Describe the core conflict, the new central wound of the characters, the dramatic stakes, and two major plot twists.
    Include a stunning, image-led transition ending.
    
    Write with beauty and restraint.`;

    return await callAI({ prompt, model: 'gemini-2.5-pro-preview-05-06' });
  },

  async ripUpAndRestart(project: Project, chapters: Chapter[], research: ResearchNote[]): Promise<{ plotNodes: PlotNode[], chapters: Chapter[], research: ResearchNote[] }> {
    const prompt = `
      EXECUTE PROTOCOL: RIP UP AND RESTART.
      
      The current manuscript for "${project.title}" is being liquidated. We are performing a full restructure.
      
      CORE ENGINE: ${project.type} / ${project.genre} / ${project.tone}
      TARGET SCALE: ${project.targetWordCount || 50000} words total.
      
      CURRENT ELEMENTS:
      ${chapters.map(c => `- ${c.title}: ${c.summary}`).join('\n')}
      
      TASK:
      1. Salvage the core dramatic wound and potential.
      2. Construct a high-momentum PLOT LATTICE (15-25 nodes).
      3. Propose a new CHAPTER STRUCTURE (exactly 20-30 chapters) designed to support the ${project.targetWordCount || 50000} word target.
      4. Generate 5 "CREATIVE SOURCES" (Research Notes) that provide deep technical, atmospheric, or philosophical grounding for this specific restructure.
      
      Return JSON: { 
        "plotNodes": [{ "id": string, "title": string, "description": string, "type": "beat"|"reversal"|"climax"|"pinch"|"hook", "order": number }],
        "chapters": [{ "title": string, "summary": string, "plotNodeIds": string[] }],
        "newResearch": [{ "title": string, "content": string, "tags": string[] }]
      }
    `;

    const schema = {
      type: Type.OBJECT,
      properties: {
        plotNodes: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { type: Type.STRING },
              order: { type: Type.NUMBER }
            },
            required: ["id", "title", "description", "type", "order"]
          }
        },
        chapters: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              plotNodeIds: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "summary", "plotNodeIds"]
          }
        },
        newResearch: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "content", "tags"]
          }
        }
      },
      required: ["plotNodes", "chapters", "newResearch"]
    };

    const data = await callAI({ prompt, json: true, schema, model: "gemini-2.5-pro-preview-05-06" });
    const result = safeParseJSON(data || "{}");

    return {
      plotNodes: (result.plotNodes || []).map((n: any) => ({ ...n, x: Math.random() * 800, y: Math.random() * 600 })),
      chapters: (result.chapters || []).map((c: any, i: number) => ({
        id: crypto.randomUUID(),
        title: c.title,
        summary: c.summary,
        content: "",
        order: i,
        plotNodeIds: c.plotNodeIds,
        updatedAt: Date.now()
      })),
      research: (result.newResearch || []).map((r: any) => ({
        id: crypto.randomUUID(),
        title: r.title,
        content: r.content,
        tags: r.tags,
        source: 'AI Restructure',
        createdAt: Date.now()
      }))
    };
  }
};

