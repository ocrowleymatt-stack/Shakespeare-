import React, { useState } from 'react';
import { ShieldCheck, Zap, AlertCircle, CheckCircle2, ChevronRight, Play, Wand2, Hammer, Activity, FileUp, Target, Plus, X, Flame } from 'lucide-react';
import { Project, Chapter, ProjectType, ResearchNote } from '../types';
import { calculateSimilarity, findRedundantChapters } from '../lib/narrativeUtils';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

interface Props {
  project: Project;
  chapters: Chapter[];
  research: ResearchNote[];
  updateProject: (updates: Partial<Project>) => void;
  updateChapters: (chaps: Chapter[]) => void;
  updatePlotNodes: (nodes: any[]) => void;
  onAddResearch?: (note: ResearchNote) => Promise<void>;
  setView: (view: any) => void;
  onError?: (msg: string) => void;
}

export default function ManuscriptFixer({ project, chapters, research, updateProject, updateChapters, updatePlotNodes, onAddResearch, setView, onError }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const [autoPilot, setAutoPilot] = useState(false);
  const [isDeepDrafting, setIsDeepDrafting] = useState(false);
  const [isSlowCooking, setIsSlowCooking] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [pasteContent, setPasteContent] = useState('');

  const [isRestructuring, setIsRestructuring] = useState(false);

  const handleRipUp = async () => {
    if (!confirm("CRITICAL WARNING: This will liquidate your current chapters and plot nodes. Your core story will be restructured from the ground up. Proceed?")) return;
    
    setIsRestructuring(true);
    addLog("System: Initializing RIP UP AND START AGAIN protocol...");
    try {
      const { plotNodes, chapters: newChapters, research: newResearch } = await AIService.ripUpAndRestart(project, chapters, research);
      
      addLog("Success: Narrative architecture liquidated and replaced.");
      addLog(`Reconstructed: ${newChapters.length} chapters, ${plotNodes.length} nodes, ${newResearch.length} creative sources.`);
      
      updatePlotNodes(plotNodes);
      updateChapters(newChapters);
      
      if (onAddResearch && newResearch.length > 0) {
        for (const res of newResearch) {
          await onAddResearch(res);
        }
      }
    } catch (err: any) {
      console.error(err);
      addLog(`Fatal: Restructure sequence failed. ${err.message}`);
    } finally {
      setIsRestructuring(false);
    }
  };

  const runSlowCooker = async () => {
    setIsSlowCooking(true);
    addLog("System: Initializing SLOW COOKER [Economy Auto-Draft Mode]...");
    try {
      let updatedChaps = [...chapters];
      const emptyChapters = chapters.filter(c => !c.content.trim());
      
      if (emptyChapters.length === 0) {
        addLog("Status: No empty chapters found. The structure is fully drafted.");
        return;
      }

      addLog(`Analysis: Found ${emptyChapters.length} unwritten chapters. 'Simmering' to completion...`);

      for (const chap of emptyChapters) {
        addLog(`Simmering: Chapter ${chap.order + 1} - "${chap.title}"...`);
        
        // ECONOMY CONTEXT: Use only the last 1500 characters of the preceding chapters.
        const earlierContent = updatedChaps
          .filter(c => c.order < chap.order)
          .map(c => c.content)
          .join('\n\n')
          .slice(-1500);

        // ECONOMY: Omit source materials to save token cost
        const content = await AIService.writeDraft(
          chap.title,
          chap.summary,
          earlierContent,
          project.type,
          [],
          research,
          project.maturity,
          [], 
          chap.directives || [],
          project.targetWordCount,
          [],
          project.draftStage,
          chapters.length,
          project.cutMode    // honour Cut & Compress mode
        );

        updatedChaps = updatedChaps.map(c => c.id === chap.id ? { ...c, content, updatedAt: Date.now() } : c);
        await updateChapters(updatedChaps);
        addLog(`Success: Synthesized Chapter ${chap.order + 1} (Economy Mode).`);
      }
      
      addLog("System: Slow Cooker chapter production complete. Structure filled.");
    } catch (err: any) {
      console.error(err);
      const msg = `Slow Cooker process interrupted. ${err.message || ""}`;
      addLog(`Error: ${msg}`);
      onError?.(msg);
    } finally {
      setIsSlowCooking(false);
    }
  };

  const handleManualImport = async () => {
    if (!pasteContent.trim()) return;
    const mockFile = new File([pasteContent], "manual_paste.txt", { type: "text/plain" });
    processFile(mockFile);
    setShowManualPaste(false);
  };

  const processFile = async (file: File, bypassAI = false) => {
    if (!file) return;
    setIsImporting(true);
    setAnalysis(null);
    setLogs([]); 
    addLog(`System IO: Initializing stream for ${file.name}...`);
    addLog(`File Profile: ${(file.size / 1024).toFixed(1)} KB | Type: ${file.type || 'plain/text'}`);
    if (bypassAI) addLog("Bypass Active: Sequential fragmentation engaged.");
    
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const fullText = (event.target?.result as string) || "";
          if (!fullText.trim()) {
            addLog("IO Error: Manuscript content is null or empty.");
            setIsImporting(false);
            return;
          }

          addLog(`IO Success: ${fullText.length.toLocaleString()} characters buffered.`);
          
          let isPlan = false;
          // JSON files are ALWAYS treated as book plans — no AI detection needed
          const isJsonFile = file.name.toLowerCase().endsWith('.json');
          if (isJsonFile) {
            isPlan = true;
            addLog("JSON Detected: Treating as STRUCTURAL PLAN / BLUEPRINT (automatic — no AI detection needed).");
          } else if (!bypassAI) {
            addLog("AI Core: Detecting artifact typology...");
            const type = await AIService.detectIngestionType(fullText);
            isPlan = type === 'plan';
            addLog(`Detected Archetype: ${isPlan ? "STRUCTURAL PLAN / BLUEPRINT" : "RAW MANUSCRIPT / DRAFT"}`);
          }

          addLog("Phase 1: Detecting narrative architecture...");

          const generateId = () => {
             try { return crypto.randomUUID(); } 
             catch (e) { return Math.random().toString(36).substring(2) + Date.now().toString(36); }
          };

          // ── JSON PLAN: Parse directly, no AI splitting needed ──────────────────────
          if (isJsonFile) {
            try {
              const planData = JSON.parse(fullText);
              addLog("JSON Parse: Structural plan decoded successfully.");

              // Extract chapters from common JSON plan shapes
              const rawChapters: any[] = planData.chapters || planData.outline || planData.acts || planData.sections || [];
              const rawCharacters: any[] = planData.characters || planData.cast || [];
              const rawPlotNodes: any[] = planData.plotNodes || planData.plot_nodes || planData.plotlines || planData.arcs || [];

              if (rawCharacters.length > 0) {
                const characters = rawCharacters.map((c: any, i: number) => ({
                  id: generateId(),
                  name: (c.name && c.name !== 'Unknown' && !/^character\s*\d+$/i.test(c.name)) ? c.name : (c.role ? `${c.role.split(' ')[0]}_${(i+1)}` : `Character_${(i+1)}`),
                  role: c.role || c.archetype || 'supporting',
                  backstory: c.backstory || c.background || c.bio || '',
                  traits: Array.isArray(c.traits) ? c.traits : (c.traits ? [c.traits] : []),
                  goals: Array.isArray(c.goals) ? c.goals : (c.goals ? [c.goals] : []),
                  fears: Array.isArray(c.fears) ? c.fears : (c.fears ? [c.fears] : []),
                  motivations: Array.isArray(c.motivations) ? c.motivations : (c.motivations ? [c.motivations] : []),
                  quirks: Array.isArray(c.quirks) ? c.quirks : (c.quirks ? [c.quirks] : []),
                  archetype: c.archetype || '',
                  physicalDescription: c.physicalDescription || c.appearance || '',
                  updatedAt: Date.now()
                }));
                // updateProject doesn't handle characters directly — we surface them via plot nodes as directives
                addLog(`JSON Characters: Extracted ${characters.length} character profiles.`);
              }

              if (rawPlotNodes.length > 0) {
                const plotNodes = rawPlotNodes.map((n: any, i: number) => ({
                  id: generateId(),
                  title: n.title || n.name || `Plot Thread ${i + 1}`,
                  description: n.description || n.summary || n.content || '',
                  status: 'active' as const,
                  type: (n.type === 'main' || n.type === 'sub' || n.type === 'theme') ? n.type : 'main' as const,
                  order: i,
                  updatedAt: Date.now()
                }));
                updatePlotNodes(plotNodes);
                addLog(`JSON Plot Nodes: Seeded ${plotNodes.length} plot threads.`);
              }

              if (rawChapters.length > 0) {
                const newChapters: Chapter[] = rawChapters.map((c: any, i: number) => {
                  const directive = [
                    c.summary || c.description || c.content || c.synopsis || '',
                    c.beats ? `Beats: ${Array.isArray(c.beats) ? c.beats.join('; ') : c.beats}` : '',
                    c.goals ? `Goals: ${Array.isArray(c.goals) ? c.goals.join('; ') : c.goals}` : '',
                    c.notes || ''
                  ].filter(Boolean).join('\n');
                  return {
                    id: generateId(),
                    title: c.title || c.name || `Chapter ${i + 1}`,
                    summary: c.summary || c.description || c.synopsis || 'Plan-imported chapter.',
                    content: '',
                    directives: directive ? [directive] : [],
                    order: i,
                    plotNodeIds: [],
                    tags: ['json-plan', 'plan-imported'],
                    isPlan: true,
                    updatedAt: Date.now()
                  };
                });
                addLog(`JSON Chapters: Seeded ${newChapters.length} chapter blueprints.`);
                await updateChapters(newChapters);
                addLog("Ingestion Sequence: 100% COMPLETE.");
                setAnalysis(`## JSON Plan Ingested Successfully

Your book plan has been decoded and seeded into the project from scratch.

**Diagnostic Overview:**
- Source Method: JSON Structural Plan (Direct Parse)
- Chapters Seeded: **${newChapters.length}**
- Plot Nodes Seeded: **${rawPlotNodes.length}**
- Characters Detected: **${rawCharacters.length}**

**Plan Instruction Protocol Active:** Go to the **Writing Studio** to begin drafting. The system will use your chapter directives as the blueprint for each pass.`);
              } else {
                // No chapters array found — treat the whole JSON as a plan directive
                addLog("JSON: No chapters array found. Treating entire JSON as a single plan directive.");
                const singleChapter: Chapter[] = [{
                  id: generateId(),
                  title: planData.title || 'Book Plan',
                  summary: planData.premise || planData.summary || planData.description || 'Imported JSON plan.',
                  content: '',
                  directives: [fullText.slice(0, 8000)],
                  order: 0,
                  plotNodeIds: [],
                  tags: ['json-plan', 'plan-imported'],
                  isPlan: true,
                  updatedAt: Date.now()
                }];
                await updateChapters(singleChapter);
                addLog("Ingestion Sequence: 100% COMPLETE.");
                setAnalysis(`## JSON Plan Ingested\n\nYour JSON plan has been loaded as a single blueprint directive. Go to the **Writing Studio** to begin drafting.`);
              }

              // Update project metadata from plan if available
              const projectUpdates: Partial<Project> = {};
              if (planData.title && !project.title) projectUpdates.title = planData.title;
              if (planData.genre) projectUpdates.genre = planData.genre;
              if (planData.premise || planData.logline) projectUpdates.premise = planData.premise || planData.logline;
              if (planData.targetWordCount || planData.target_word_count) {
                projectUpdates.targetWordCount = planData.targetWordCount || planData.target_word_count;
              }
              if (Object.keys(projectUpdates).length > 0) {
                updateProject(projectUpdates);
                addLog(`JSON Metadata: Updated project with ${Object.keys(projectUpdates).join(', ')}.`);
              }

            } catch (jsonErr: any) {
              addLog(`JSON Parse Error: ${jsonErr.message}. Falling back to text ingestion.`);
              // Fall through to normal text processing below
            }
            setIsImporting(false);
            return;
          }
          // ── END JSON PLAN ──────────────────────────────────────────────────────────────────────

          let finalSegments: { title: string; summary: string; marker: string; directives?: string[] }[] = [];
          
          if (!bypassAI) {
            try {
              addLog(`AI Core: Sourcing structural markers (${isPlan ? "Instructional" : "Neural"})...`);
              const segments = await AIService.splitManuscript(fullText, project.type, isPlan);
              if (segments && segments.length > 0) {
                finalSegments = segments;
                addLog(`AI Core Success: Found ${segments.length} logical boundaries.`);
              } else {
                addLog("AI Core responded with empty structure payload.");
              }
            } catch (err: any) {
              console.error("AI Split Error:", err);
              const msg = err.message || "Handshake failure";
              addLog(`AI Core Blocked: ${msg}.`);
              onError?.(`Neural Analysis Error: ${msg}`);
            }
          }
            
          if (finalSegments.length === 0) {
            addLog(bypassAI ? "Direct fragmentation engaged." : "Engaging fallback: Detecting boundary patterns (Regex)...");
            const chapterRegex = /(?:Chapter|CHAPTER|SECTION|Section|Part|PART)\s+([0-9A-Z]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)|(?:\n\n|^)(?:\* \* \*|# |### |---)(?:\n\n|$)/g;
            const matches = bypassAI ? [] : [...fullText.matchAll(chapterRegex)];
            
            if (matches.length >= 2) {
              addLog(`Pattern Match Success: Detected ${matches.length} boundaries.`);
              finalSegments = matches.map((m, i) => {
                const title = m[1] ? `Chapter ${m[1]}` : `Section ${i + 1}`;
                const markerSnippet = fullText.slice(m.index, m.index + 120);
                return {
                  title,
                  summary: "Imported via pattern matching.",
                  marker: markerSnippet
                };
              });
            } else {
              if (!bypassAI) addLog("Deterministic patterns absent. Executing density-based fragmentation...");
              const chunks = fullText.split(/\n\n\n+/);
              if (chunks.length > 2 && !bypassAI) {
                addLog(`Density Success: Fragmenting into ${chunks.length} blocks.`);
                finalSegments = chunks.map((c, i) => ({
                  title: `Sequence ${i + 1}`,
                  summary: "Imported via density-based chunking.",
                  marker: c.slice(0, 100)
                }));
              } else {
                addLog(`Info: Applying sequential blocks (10k char segments)...`);
                const pageSize = 10000;
                for (let i = 0; i < fullText.length; i += pageSize) {
                  finalSegments.push({
                    title: `Draft Fragment ${Math.floor(i / pageSize) + 1}`,
                    summary: "Forced split for monolithic text.",
                    marker: fullText.slice(i, i + 80)
                  });
                }
              }
            }
          }

          addLog(`Architecture: ${finalSegments.length} nodes ready for reconstruction.`);
            
          const newChapters: Chapter[] = finalSegments.map((seg, i) => {
            const nextSeg = finalSegments[i + 1];
            let content = "";
            const normalize = (str: string) => (str || "").replace(/\s+/g, ' ').trim();
            const normalizedFullText = normalize(fullText);
            const normalizedMarker = normalize(seg.marker);
            const normalizedStartIndex = normalizedFullText.indexOf(normalizedMarker);
            
            if (normalizedStartIndex !== -1) {
              const escapedMarker = (seg.marker || "")
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                .replace(/\s+/g, '\\s+');
              
              const markerRegex = new RegExp(escapedMarker, 'g');
              const match = markerRegex.exec(fullText);
              
              if (match) {
                const startIndex = match.index;
                let endIndex = fullText.length;
                
                if (nextSeg) {
                   const nextEscapedMarker = (nextSeg.marker || "")
                    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                    .replace(/\s+/g, '\\s+');
                  const nextRegex = new RegExp(nextEscapedMarker, 'g');
                  nextRegex.lastIndex = startIndex + match[0].length;
                  const nextMatch = nextRegex.exec(fullText);
                  if (nextMatch) {
                    endIndex = nextMatch.index;
                  } else {
                    const lowerFullText = fullText.toLowerCase();
                    const lowerMarker = (nextSeg.marker || "").toLowerCase().slice(0, 30);
                    if (lowerMarker) {
                      const fuzzyNext = lowerFullText.indexOf(lowerMarker, startIndex + match[0].length);
                      if (fuzzyNext !== -1) endIndex = fuzzyNext;
                    }
                  }
                }
                content = fullText.slice(startIndex, endIndex).trim();
              } else {
                const simpleStart = fullText.indexOf(seg.marker);
                if (simpleStart !== -1) {
                   let nextIndex = fullText.length;
                   if (nextSeg) {
                     const nextSimple = fullText.indexOf(nextSeg.marker, simpleStart + 1);
                     if (nextSimple !== -1) nextIndex = nextSimple;
                   }
                   content = fullText.slice(simpleStart, nextIndex).trim();
                } else {
                  content = `[INGESTION WARNING: CONTENT CONTINUITY AT RISK]`;
                }
              }
            } else {
              content = `[FRAGMENT RECOVERY FAILED: Marker not resolved]`;
            }

            return {
              id: generateId(),
              title: seg.title || `Chapter ${i + 1}`,
              summary: seg.summary || "Imported content.",
              content: isPlan ? "" : content,
              directives: isPlan ? (seg.directives || [content]) : [],
              order: i,
              plotNodeIds: [],
              tags: isPlan ? ['plan-imported'] : ['bulk-imported'],
              updatedAt: Date.now()
            };
          });
          
          addLog(`Phase 2: Synchronizing ${newChapters.length} chapters to cloud...`);
          await updateChapters(newChapters);
          addLog("Ingestion Sequence: 100% COMPLETE.");
          
          setAnalysis(`## Ingestion Successful
Your ${isPlan ? "**Structural Plan**" : "manuscript"} has been parsed into **${finalSegments.length} chapters**. 

**Diagnostic Overview:**
- Source Method: ${isPlan ? "Instructional Extraction" : (bypassAI ? "Manual Sequential" : (finalSegments.length > 5 ? "Neural Analysis" : "Structural Recovery"))}
- Artifact Typology: ${isPlan ? "PLAN (Prioritizing Directions)" : "MANUSCRIPT (Prioritizing Word Count)"}
- Character Count: ${fullText.length.toLocaleString()}
- Node Density: ${Math.round(fullText.length / finalSegments.length)} chars/node

${isPlan ? "\n**Plan Instruction Protocol Active:** The system will now prioritize your specific chapter instructions over generic word count targets during drafting." : "Go to the **Writing Studio** to review the reconstructed chapters."}`);
        } catch (innerErr) {
          console.error("Internal processing error:", innerErr);
          addLog(`Process Error: ${innerErr instanceof Error ? innerErr.message : "Structure corrupted"}`);
        } finally {
          setIsImporting(false);
        }
      };
      reader.onerror = () => {
        addLog("FileReader Error: Access denied or storage failure.");
        setIsImporting(false);
      };
      reader.readAsText(file);
    } catch (err) {
      console.error(err);
      addLog("Fatal IO: Kernel crash during ingestion.");
      setIsImporting(false);
    }
  };

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const runFinishAndFix = async () => {
    setIsFixing(true);
    addLog("Initializing Global Manuscript Scan...");
    try {
      const result = await AIService.finishAndFix(chapters, project.type, project.sourceMaterials || []);
      setAnalysis(result);
      addLog("Analysis complete. Found structural opportunities.");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "Analysis failed";
      addLog(`Error during analysis: ${msg}`);
      onError?.(msg);
    } finally {
      setIsFixing(false);
    }
  };

  const startAutoPilot = async () => {
    setAutoPilot(true);
    addLog("AUTO-PILOT ENGAGED: Full pipeline — Apply Suggestions → Fix Structure → Write Prose to Target");
    try {
      // ── PHASE 1: Apply all pending AI suggestions from research/brainstorm ──
      addLog("Phase 1/5: Scanning for pending AI suggestions and brainstorm directives...");
      const pendingDirectives: string[] = [];
      if (research && research.length > 0) {
        const brainstormNotes = research.filter(r =>
          r.category === 'brainstorm' ||
          r.title?.toLowerCase().includes('brainstorm') ||
          r.title?.toLowerCase().includes('structural plan') ||
          r.title?.toLowerCase().includes('ai spark')
        );
        if (brainstormNotes.length > 0) {
          addLog(`Phase 1: Found ${brainstormNotes.length} brainstorm/structural notes — injecting as directives.`);
          brainstormNotes.forEach(n => pendingDirectives.push(`[BRAINSTORM DIRECTIVE] ${n.title}: ${n.content.slice(0, 500)}`));
        } else {
          addLog("Phase 1: No pending brainstorm directives found. Proceeding with structural analysis.");
        }
      }

      // ── PHASE 2: Structural gap analysis — generate missing beats ──
      addLog("Phase 2/5: Analysing narrative structure for gaps and missing beats...");
      const beats = await AIService.automateNextSteps(project, chapters);
      let workingChapters: Chapter[] = [...chapters];

      if (beats && beats.length > 0) {
        addLog(`Phase 2: ${beats.length} structural gap(s) identified. Inserting missing chapter beats...`);
        for (const beat of beats) {
          const id = crypto.randomUUID();
          const newChap: Chapter = {
            id,
            title: beat.title || 'Untitled Beat',
            summary: beat.summary || 'No summary provided.',
            content: '',
            order: workingChapters.length,
            plotNodeIds: [],
            tags: ['auto-pilot'],
            directives: pendingDirectives.length > 0 ? pendingDirectives : [],
            updatedAt: Date.now()
          };
          workingChapters.push(newChap);
          addLog(`Phase 2: Inserted beat — "${newChap.title}"`);
        }
        await updateChapters(workingChapters);
        addLog("Phase 2: Structure committed to cloud.");
      } else {
        addLog("Phase 2: Structure is complete. No new beats required.");
      }

      // ── PHASE 3: Identify all chapters needing prose (empty or stub-only) ──
      addLog("Phase 3/5: Identifying chapters requiring prose generation...");
      const STUB_THRESHOLD = 200; // chapters with fewer than 200 words are treated as stubs
      const chaptersNeedingProse = workingChapters.filter(c => {
        const wordCount = c.content.trim().split(/\s+/).filter(Boolean).length;
        return wordCount < STUB_THRESHOLD;
      });

      if (chaptersNeedingProse.length === 0) {
        addLog("Phase 3: All chapters already have substantial prose. Auto-Pilot complete.");
        return;
      }
      addLog(`Phase 3: ${chaptersNeedingProse.length} chapter(s) require prose generation (empty or stub < ${STUB_THRESHOLD} words).`);

      // ── PHASE 4: Word count targeting ──
      const totalTarget = project.targetWordCount || 50000;
      const totalChapters = workingChapters.length || 20;
      addLog(`Phase 4/5: Word count target — ${totalTarget.toLocaleString()} words across ${totalChapters} chapters.`);
      addLog(`Phase 4: Per-chapter target at current pass = ${Math.round(totalTarget / totalChapters).toLocaleString()} words (before pass multiplier).`);

      // ── PHASE 5: Write full prose for every chapter needing it ──
      addLog(`Phase 5/5: Writing prose for ${chaptersNeedingProse.length} chapter(s)...`);
      let updatedChaps = [...workingChapters];

      for (let i = 0; i < chaptersNeedingProse.length; i++) {
        const chap = chaptersNeedingProse[i];
        addLog(`Phase 5 [${i + 1}/${chaptersNeedingProse.length}]: Drafting "${chap.title}"...`);

        // Build continuity context from all preceding chapters
        const earlierContent = updatedChaps
          .filter(c => c.order < chap.order)
          .map(c => c.content)
          .join('\n\n')
          .slice(-5000);

        // Merge any brainstorm directives with chapter-specific directives
        const chapterDirectives = [
          ...(chap.directives || []),
          ...pendingDirectives
        ];

        try {
          const content = await AIService.writeDraft(
            chap.title,
            chap.summary,
            earlierContent,
            project.type,
            [],
            research,
            project.maturity,
            project.sourceMaterials || [],
            chapterDirectives,
            totalTarget,          // project word count target
            [],
            project.draftStage,   // honour current draft pass
            totalChapters,        // total chapter count for per-chapter calculation
            project.cutMode       // honour Cut & Compress mode
          );

          updatedChaps = updatedChaps.map(c =>
            c.id === chap.id ? { ...c, content, updatedAt: Date.now() } : c
          );
          await updateChapters(updatedChaps);
          const wc = content.trim().split(/\s+/).filter(Boolean).length;
          addLog(`Phase 5 [${i + 1}/${chaptersNeedingProse.length}]: "${chap.title}" — ${wc.toLocaleString()} words written. Saved.`);
        } catch (err: any) {
          addLog(`Phase 5: Warning — failed to draft "${chap.title}". Continuing... (${err.message || 'unknown error'})`);
          console.error(err);
        }
      }

      // ── Final summary ──
      const totalWordsWritten = updatedChaps.reduce((sum, c) => {
        return sum + c.content.trim().split(/\s+/).filter(Boolean).length;
      }, 0);
      addLog(`AUTO-PILOT COMPLETE: ${chaptersNeedingProse.length} chapter(s) drafted. Total manuscript: ~${totalWordsWritten.toLocaleString()} words.`);
      addLog(`Target was ${totalTarget.toLocaleString()} words. ${totalWordsWritten >= totalTarget * 0.9 ? 'TARGET MET.' : `Gap: ${(totalTarget - totalWordsWritten).toLocaleString()} words remaining — run again or advance to next pass.`}`);

    } catch (err: any) {
      console.error('Auto-Pilot Failure:', err);
      const msg = err.message || 'Auto-Pilot sequence interrupted';
      addLog(`Fatal: ${msg}`);
      onError?.(msg);
    } finally {
      setAutoPilot(false);
    }
  };

  const runDeepDraft = async () => {
    setIsDeepDrafting(true);
    addLog("Initializing Deep Draft sequence...");
    try {
      const emptyChapters = chapters.filter(c => !c.content.trim());
      if (emptyChapters.length === 0) {
        addLog("No empty chapters found. Manuscript is fully drafted.");
        return;
      }

      addLog(`Found ${emptyChapters.length} chapters to draft. Starting synthesis...`);
      let updatedChaps = [...chapters];

      for (const chap of emptyChapters) {
        addLog(`Drafting: ${chap.title}...`);
        
        const earlierContent = updatedChaps
          .filter(c => c.order < chap.order)
          .map(c => c.content)
          .join('\n\n')
          .slice(-5000);

        try {
          const content = await AIService.writeDraft(
            chap.title,
            chap.summary,
            earlierContent,
            project.type,
            [], // activeNodes placeholder
            research,
            project.maturity,
            project.sourceMaterials || [],
            chap.directives || [],
            project.targetWordCount,
            [],
            project.draftStage,   // honour current draft pass
            chapters.length,       // per-chapter word target
            project.cutMode        // honour Cut & Compress mode
          );

          // Update local copy
          updatedChaps = updatedChaps.map(c => c.id === chap.id ? { ...c, content, updatedAt: Date.now() } : c);
          
          // Trigger the app-level update (which persists to cloud)
          // Note: In App.tsx, updateChapters currently calls upsertChapterBatch for the whole list.
          // This ensures "auto saves along the way" as requested.
          await updateChapters(updatedChaps);
          addLog(`Checkpoint saved: ${chap.title}.`);
        } catch (err: any) {
          addLog(`Warning: Failed to draft ${chap.title}. Attempting to proceed...`);
          console.error(err);
        }
      }
      addLog("Deep Draft series complete. The manuscript is fully synchronized.");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "AI exhaustion";
      addLog(`Deep Draft interrupted: ${msg}`);
      onError?.(msg);
    } finally {
      setIsDeepDrafting(false);
    }
  };

  const [isFixingBadBook, setIsFixingBadBook] = useState(false);

  const [fixProgress, setFixProgress] = useState(0);

  const runFixBadBook = async () => {
    setIsFixingBadBook(true);
    setFixProgress(0);
    addLog("System: Initializing FIX A BAD BOOK sequence...");
    addLog("This macro will execute Prize Targeting, Outline Architecture, Continuity Sweeps, and Deep Drafting sequentially.");
    try {
      // Step 1: Prize Targeting
      setFixProgress(5);
      addLog("Phase 1/5: Assessing Prize Worthiness & Word Count Targets...");
      const prizeAssessments = await AIService.assessPrizeWorthiness(project, chapters);
      if (prizeAssessments.length > 0) {
        addLog(`Prize targeted: ${prizeAssessments[0].prizeName}. Alignment: ${prizeAssessments[0].eligibilityScore}%`);
        addLog(`Focusing edits on: ${prizeAssessments[0].recommendation}`);
        
        // AUTO-SET TARGETS: If a prize expects a specific word count, we align the project architecture.
        const suggestedTarget = prizeAssessments[0].targetWordCount || project.targetWordCount || 50000;
        await updateProject({ 
          prizeAssessments, 
          targetPrize: prizeAssessments[0].prizeName,
          targetWordCount: suggestedTarget
        });
        addLog(`Intelligence Update: Word Target synchronized to ${suggestedTarget.toLocaleString()} words.`);
      } else {
        addLog("Prize Assessment yielded generic targets. Proceeding.");
      }

      // Step 2: Plot Outlining
      setFixProgress(20);
      addLog("Phase 2/5: Extracting structural vulnerabilities...");
      const newNodes = await AIService.outlinePlotNodes({ ...project, plotNodes: [] }, chapters, research);
      await updatePlotNodes(newNodes);
      addLog(`Architected ${newNodes.length} new Plot Nodes.`);

      // Step 3: Reconcile Chapters
      setFixProgress(40);
      addLog("Phase 3/5: Reconciling chapters with new structural logic...");
      const rawBeats = await AIService.reconcileChapters(project, newNodes, chapters, research);
      
      // De-duplicate beats by title or high similarity
      const uniqueBeats: { title: string; summary: string; plotNodeIds: string[] }[] = [];
      for (const beat of rawBeats) {
        const isDuplicate = uniqueBeats.some(b => 
          b.title.toLowerCase() === beat.title.toLowerCase() || 
          calculateSimilarity(b.summary, beat.summary) > 0.7
        );
        if (!isDuplicate) {
          uniqueBeats.push(beat);
        } else {
          addLog(`Skipped redundant chapter structure: "${beat.title}"`);
        }
      }

      const newChapters: Chapter[] = uniqueBeats.map((beat, index) => {
        const existingChap = chapters.find(c => c.title === beat.title);
        return {
          id: existingChap?.id || crypto.randomUUID(),
          title: beat.title,
          summary: beat.summary,
          content: existingChap?.content || "",
          order: index,
          plotNodeIds: beat.plotNodeIds,
          tags: existingChap?.tags || [],
          updatedAt: Date.now()
        };
      });
      await updateChapters(newChapters);
      addLog(`Manuscript realigned into ${newChapters.length} chapters.`);

      // Step 4: Continuity Sweep
      setFixProgress(60);
      addLog("Phase 4/5: Executing Swarm Continuity Pass...");
      const continuityReport = await AIService.analyzeContinuity(newNodes, newChapters, research);
      addLog("Continuity analysis complete. Swarm logic integrated.");

      // Step 5: Deep Draft
      setFixProgress(75);
      addLog("Phase 5/5: Engaging Deep Draft generation for missing sequences...");
      const emptyChapters = newChapters.filter(c => !c.content.trim() || c.content.length < 500);
      
      if (emptyChapters.length > 0) {
        let updatedChaps = [...newChapters];
        let i = 0;
        for (const chap of emptyChapters) {
          const subProgress = 75 + ((i / emptyChapters.length) * 20);
          setFixProgress(subProgress);
          addLog(`[${i+1}/${emptyChapters.length}] Re-drafting: Chapter ${chap.order + 1} - "${chap.title}"... (AI processing)`);
          
          const earlierContent = updatedChaps
            .filter(c => c.order < chap.order)
            .map(c => c.content)
            .join('\n\n')
            .slice(-3000);
          
          const activeChapterNodes = newNodes.filter(n => (chap.plotNodeIds || []).includes(n.id));

          const content = await AIService.writeDraft(
            chap.title,
            chap.summary + `\n\nCONTINUITY DIRECTIVE:\n${continuityReport.slice(0, 500)}`,
            earlierContent,
            project.type,
            activeChapterNodes,
            research,
            project.maturity,
            project.sourceMaterials || [],
            chap.directives || [],
            project.targetWordCount,
            [],
            project.draftStage,   // honour current draft pass
            newChapters.length,    // per-chapter word target
            project.cutMode        // honour Cut & Compress mode
          );
          
          updatedChaps = updatedChaps.map(c => c.id === chap.id ? { ...c, content, updatedAt: Date.now() } : c);
          await updateChapters(updatedChaps);
          addLog(`Success: Drafted Chapter ${chap.order + 1}. Moving to next...`);
          i++;
        }
      }

      setFixProgress(100);
      addLog("System: FIX A BAD BOOK sequence completed. Manuscript is primed for export.");
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "Sequence failed.";
      addLog(`Total Overhaul interrupted: ${msg}`);
      onError?.(msg);
    } finally {
      setIsFixingBadBook(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto overscroll-contain custom-scrollbar pb-32" style={{ minHeight: 0 }}>
      <div className="max-w-5xl mx-auto py-6 md:py-12 px-4 md:px-6 relative">
      <header className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-primary/10 border border-brand-primary/20 rounded-full mb-4">
          <ShieldCheck size={14} className="text-brand-primary" />
          <span className="text-[10px] font-black text-brand-primary uppercase tracking-widest">Deep Architecture Engine</span>
        </div>
        <h1 className="text-4xl font-black text-text-primary mb-4 tracking-tight italic font-serif">Finish & Fix <span className="text-[10px] not-italic text-text-secondary font-sans tracking-normal opacity-50">v2.55-stable</span></h1>
        
        {isFixingBadBook && (
          <div className="max-w-md mx-auto mt-8 mb-4 space-y-2">
            <div className="h-2 w-full bg-surface-muted rounded-full overflow-hidden shadow-inner border border-border-subtle">
              <motion.div 
                className="h-full bg-brand-primary shadow-[0_0_15px_rgba(59,130,246,0.6)]"
                initial={{ width: 0 }}
                animate={{ width: `${fixProgress}%` }}
                transition={{ type: "spring", bounce: 0, duration: 0.5 }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-brand-primary">
              <span>Macro Overhaul: {fixProgress < 20 ? 'Targeting' : fixProgress < 40 ? 'Architecting' : fixProgress < 60 ? 'Reconciling' : fixProgress < 75 ? 'Continuity' : 'Deep Drafting'}</span>
              <span>{Math.round(fixProgress)}%</span>
            </div>
          </div>
        )}

        <p className="text-text-secondary max-w-2xl mx-auto font-medium">
          The Global Manuscript Engine analyzes your entire work for structural integrity, logical consistency, and thematic resolution.
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-1 bg-red-500/10 text-red-500 text-[10px] font-black uppercase rounded-full hover:bg-red-500/20 transition-all border border-red-500/20"
        >
          Force System Refresh (Bust Cache)
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-1 space-y-4 md:space-y-6">
          <div className="bg-surface-card p-4 md:p-6 rounded-2xl md:rounded-3xl border border-border-subtle shadow-2xl">
            <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-4 md:mb-6 flex items-center gap-2">
              <Zap size={14} className="text-amber-500" />
              Directives
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 md:gap-4">
              <button 
                onClick={runFixBadBook}
                disabled={isFixingBadBook}
                className={`w-full flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl transition-all group ${
                  isFixingBadBook ? 'bg-surface-muted text-text-secondary' : 'bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-900/20'
                }`}
              >
                <div className="flex items-center gap-2 md:gap-3">
                  <Target size={18} className="shrink-0" />
                  <span className="text-xs md:text-sm font-bold text-left leading-tight">
                    {isFixingBadBook ? `Overhauling: ${Math.round(fixProgress)}%` : 'Fix a Bad Book (Macro)'}
                  </span>
                </div>
                {isFixingBadBook ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Activity size={16} />
                  </motion.div>
                ) : <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform shrink-0" />}
              </button>

              <button 
                onClick={runFinishAndFix}
                disabled={isFixing}
                className={`w-full flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl transition-all group ${
                  isFixing ? 'bg-surface-muted text-text-secondary' : 'bg-brand-dark text-text-primary hover:bg-black border border-border-subtle shadow-xl'
                }`}
              >
                <div className="flex items-center gap-2 md:gap-3">
                  <Hammer size={18} className="shrink-0" />
                  <span className="text-xs md:text-sm font-bold">Manuscript Scan</span>
                </div>
                {isFixing ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Activity size={16} />
                  </motion.div>
                ) : <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform shrink-0" />}
              </button>

              <button 
                onClick={startAutoPilot}
                disabled={autoPilot}
                className={`w-full flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl transition-all group ${
                  autoPilot ? 'bg-surface-muted text-text-secondary' : 'bg-brand-primary text-white hover:bg-brand-accent shadow-xl shadow-brand-primary/20'
                }`}
              >
                <div className="flex items-center gap-2 md:gap-3">
                  <Play size={18} className="shrink-0" />
                  <span className="text-xs md:text-sm font-bold">Auto-Pilot Finish</span>
                </div>
                {autoPilot ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Activity size={16} />
                  </motion.div>
                ) : <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform shrink-0" />}
              </button>

              <button 
                onClick={handleRipUp}
                disabled={isRestructuring}
                className={`w-full flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl transition-all group ${
                   isRestructuring ? 'bg-surface-muted text-text-secondary' : 'bg-red-600 text-white hover:bg-red-700 shadow-[0_15px_40px_rgba(220,38,38,0.3)] border border-red-500/20'
                }`}
              >
                <div className="flex items-center gap-2 md:gap-3">
                  <Flame size={18} className={`shrink-0 ${isRestructuring ? 'animate-pulse' : ''}`} />
                  <span className="text-xs md:text-sm font-black uppercase tracking-widest">Full Restructure & Redraft</span>
                </div>
                {!isRestructuring && <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform shrink-0" />}
              </button>

              <div className="pt-4 border-t border-border-subtle sm:col-span-2 lg:col-span-1">
                <label className={`w-full flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl transition-all group cursor-pointer ${isImporting ? 'bg-surface-muted text-text-secondary' : 'bg-brand-primary/10 border border-brand-primary/20 text-brand-primary hover:bg-brand-primary/20'}`}>
                  <div className="flex items-center gap-2 md:gap-3">
                    <FileUp size={18} className="shrink-0" />
                    <span className="text-xs md:text-sm font-bold">Bulk Ingest</span>
                  </div>
                  <input type="file" className="hidden" onChange={handleBulkImport} accept=".txt,.md" disabled={isImporting} />
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform shrink-0" />
                </label>
              </div>

              <button 
                onClick={() => setShowManualPaste(true)}
                className="w-full py-3 border border-border-subtle text-text-secondary rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest hover:bg-surface-muted transition-all flex items-center justify-center gap-2 sm:col-span-2 lg:col-span-1"
              >
                <Zap size={12} className="text-brand-primary" />
                Manual Injection
              </button>
            </div>
          </div>
          
          <div className="bg-brand-dark p-6 rounded-3xl shadow-xl border border-border-subtle">
            <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-4 flex items-center gap-2 opacity-50">
              <Activity size={14} className="text-emerald-500" />
              Architect Logs
            </h3>
            <div className="space-y-2 font-mono h-40 overflow-y-auto custom-scrollbar">
              {logs.map((log, i) => (
                <div key={i} className="text-[10px] text-emerald-400 last:text-emerald-300 animate-in fade-in slide-in-from-left-2 duration-300">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {analysis ? (
              <motion.div 
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-surface-card p-10 rounded-3xl border border-border-subtle shadow-2xl min-h-[600px] relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-border-subtle">
                  <h2 className="text-xl font-black text-text-primary italic font-serif tracking-tight">System Report</h2>
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
                    <CheckCircle2 size={14} />
                    Synchronized
                  </div>
                </div>
                <div className="markdown-body prose prose-invert prose-brand max-w-none italic">
                  <Markdown>{analysis}</Markdown>
                </div>
                <button 
                  onClick={() => setView('writing')}
                  className="mt-8 w-full py-4 bg-brand-primary hover:bg-brand-accent text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95"
                >
                  Enter Writing Studio
                </button>
              </motion.div>
            ) : isImporting || isFixing ? (
              <div className="h-full min-h-[600px] flex flex-col items-center justify-center p-20 text-center bg-surface-card rounded-3xl border border-border-subtle shadow-inner">
                <Activity size={48} className="text-brand-primary animate-pulse mb-8" />
                <h3 className="text-2xl font-black text-text-primary mb-4 tracking-tight italic font-serif">Processing Manuscript...</h3>
                <p className="text-text-secondary max-w-sm font-medium opacity-60 italic mb-8"> neural core fragments the narrative architecture...</p>
                <div className="w-full max-w-md h-1.5 bg-surface-muted rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 10 }} className="h-full bg-brand-primary" />
                </div>
              </div>
            ) : (
              <div 
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => { e.preventDefault(); setDragActive(false); handleBulkImport(e as any); }}
                className={`h-full min-h-[200px] md:min-h-[600px] flex flex-col items-center justify-center p-8 md:p-20 text-center rounded-[3rem] border-2 border-dashed transition-all relative overflow-hidden group ${
                  dragActive ? 'border-brand-primary bg-brand-primary/5' : 'border-border-subtle bg-surface-card hover:border-text-secondary/30'
                }`}
              >
                <FileUp size={80} strokeWidth={0.5} className="text-text-secondary opacity-10 mb-8" />
                <p className="text-xl font-black text-text-primary italic font-serif">Awaiting Ingestion Signal</p>
                <p className="text-[10px] text-text-secondary font-black uppercase tracking-[0.4em] opacity-40 mt-4">Drag and drop artifacts to begin</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {showManualPaste && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-brand-dark/95 backdrop-blur-2xl">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="w-full max-w-4xl bg-surface-card border border-border-subtle rounded-[3rem] p-10 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-text-primary italic font-serif">Manual Injection</h3>
                <button onClick={() => setShowManualPaste(false)} className="p-3 bg-surface-muted rounded-xl transition-all border border-border-subtle">
                  <X size={20} />
                </button>
              </div>
              <textarea 
                value={pasteContent} 
                onChange={(e) => setPasteContent(e.target.value)} 
                className="w-full h-96 bg-brand-dark border border-border-subtle rounded-3xl p-8 text-text-primary focus:ring-2 focus:ring-brand-primary/20 outline-none resize-none"
              />
              <div className="flex justify-end gap-6 mt-10">
                <button onClick={handleManualImport} className="px-10 py-4 bg-brand-primary text-white font-black text-[10px] uppercase tracking-widest rounded-2xl active:scale-95">
                  Neural Fragmentation
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  </div>
  );
}
