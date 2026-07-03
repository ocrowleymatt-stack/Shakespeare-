/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { PenTool, Plus, Zap, MessageSquare, BookOpen, Trash2, ChevronRight, ChevronLeft, FileText, Tag, Users, Upload, X, ArrowRight, Search, Filter, Activity, Maximize2, Minimize2, Type, Flame, Save, Library, AlertTriangle, CircleSlash, Sparkles, RefreshCcw, AlertCircle, ChevronUp, ChevronDown, Fingerprint } from 'lucide-react';
import { SourceMaterial, Project, Chapter, PlotNode, Presence, Critique, ViewType, ExternalReview, Character } from '../types';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';
import * as pdfjsLib from 'pdfjs-dist';
import Markdown from 'react-markdown';
import Fuse from 'fuse.js';
import { calculateSimilarity, detectEchoes, findRedundantChapters } from '../lib/narrativeUtils';
import { Repeat } from 'lucide-react';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface Props {
  project: Project;
  plotNodes: PlotNode[];
  presence: Presence[];
  updateProject: (updates: Partial<Project>) => void;
  updateChapters: (chapters: Chapter[]) => void;
  setView: (view: ViewType) => void;
  upsertChapter?: (chapter: Chapter) => void;
  onDeleteChapter?: (id: string) => void;
  onUpsertSource: (source: SourceMaterial) => void | Promise<void>;
  onDeleteSource: (id: string) => void;
  onUpsertCharacters?: (chars: Character[]) => Promise<void>;
  onError?: (message: string) => void;
}

export default function WritingStudio({ 
  project, 
  plotNodes, 
  presence, 
  updateProject, 
  updateChapters, 
  setView,
  upsertChapter, 
  onDeleteChapter, 
  onUpsertSource, 
  onDeleteSource,
  onUpsertCharacters,
  onError
}: Props) {
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(() => {
    return localStorage.getItem(`ls_selected_chapter_${project.id}`) || null;
  });
  const [showCritique, setShowCritique] = useState(false);
  const [critiqueText, setCritiqueText] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isCritiquing, setIsCritiquing] = useState(false);
  const [isAnalyzingProse, setIsAnalyzingProse] = useState(false);
  const [isCheckingTurn, setIsCheckingTurn] = useState(false);
  const [sceneTurnResult, setSceneTurnResult] = useState<{ turned: boolean; score: number; reasoning: string; missing: string } | null>(null);
  const [proseViolations, setProseViolations] = useState<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }[]>([]);
  const [showProsePanel, setShowProsePanel] = useState(false);
  const [showNodePicker, setShowNodePicker] = useState(false);
  const [viewingSourceId, setViewingSourceId] = useState<string | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [archiveSearchTerm, setArchiveSearchTerm] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<'All' | 'Manuscript' | 'Research' | 'AI Compilation'>('All');
  const [isSaving, setIsSaving] = useState(false);
  const [isLeftRailOpen, setIsLeftRailOpen] = useState(true);
  const [isRightRailOpen, setIsRightRailOpen] = useState(true);

  // Close both rails by default on mobile so the editor gets full width
  useEffect(() => {
    if (isMobile) {
      setIsLeftRailOpen(false);
      setIsRightRailOpen(false);
    } else {
      setIsLeftRailOpen(true);
      setIsRightRailOpen(true);
    }
  }, [isMobile]);
  const [lastSaved, setLastSaved] = useState<number>(Date.now());
  const [isScanningChars, setIsScanningChars] = useState(false);
  const dirtyRef = useRef<boolean>(false);

  const chapters = (project as any).chapters || [];

  const typeMap: Record<string, string> = {
    'Manuscript': 'ARCHIVE',
    'AI Compilation': 'SYNTHESIS',
    'Research': 'INTEL'
  };

  // Background Character Extraction (Auto-Absorb)
  useEffect(() => {
    const lastScanWordCount = parseInt(localStorage.getItem(`ls_last_char_scan_${project.id}`) || '0');
    const currentWordCount = chapters.reduce((acc: number, c: Chapter) => acc + (c.content?.split(/\s+/).length || 0), 0);

    if (currentWordCount > lastScanWordCount + 1000 && !isScanningChars) {
      const scan = async () => {
        setIsScanningChars(true);
        try {
          const extracted = await AIService.extractCharacters(chapters, project);
          if (extracted.length > 0 && onUpsertCharacters) {
            await onUpsertCharacters(extracted);
            localStorage.setItem(`ls_last_char_scan_${project.id}`, currentWordCount.toString());
          }
        } catch (e) {
          console.warn("Background character absorption failed silently.");
        } finally {
          setIsScanningChars(false);
        }
      };
      // Delay to avoid interference with editing
      const timer = setTimeout(scan, 10000);
      return () => clearTimeout(timer);
    }
  }, [chapters, project, isScanningChars]);
  
  // Auto-select logic
  useEffect(() => {
    if (selectedChapterId) {
      localStorage.setItem(`ls_selected_chapter_${project.id}`, selectedChapterId);
    } else if (chapters.length > 0) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [chapters, selectedChapterId, project.id]);

  const selectedChapter = chapters.find((c: Chapter) => c.id === selectedChapterId);
  
  // Support both sourceMaterials and researchNotes in the viewer
  const allSources = useMemo(() => {
    const raw = [
      ...(project.sourceMaterials || []).map(s => ({
        ...s,
        displayType: (s.name || "").startsWith('[MANUSCRIPT]') ? 'Manuscript' : ((s.name || "").startsWith('[RESEARCH]') ? 'Research' : 'Research')
      })),
      ...(project.research || []).map((r: any) => ({
        id: r.id,
        name: `[RESEARCH] ${r.title || "Untitled Intelligence"}`,
        content: r.content || "",
        type: 'AI Compilation',
        displayType: 'AI Compilation'
      }))
    ];

    let filtered = raw;
    if (archiveFilter !== 'All') {
      filtered = filtered.filter(s => s.displayType === archiveFilter);
    }

    if (archiveSearchTerm.trim()) {
      const fuse = new Fuse(filtered, {
        keys: ['name', 'content'],
        threshold: 0.4
      });
      return fuse.search(archiveSearchTerm).map(result => result.item);
    }

    return filtered;
  }, [project.sourceMaterials, project.research, archiveSearchTerm, archiveFilter]);
  const viewingSource = allSources.find(s => s.id === viewingSourceId);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1180);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (isMobile) setIsSidebarVisible(false);
    else setIsSidebarVisible(true);
  }, [isMobile]);

  const addChapter = () => {
    const newChapter: Chapter = {
      id: crypto.randomUUID(),
      title: `Chapter ${chapters.length + 1}`,
      summary: '',
      content: '',
      order: chapters.length,
      plotNodeIds: [],
      tags: [],
      updatedAt: Date.now()
    };
    updateChapters([...chapters, newChapter]);
    if (upsertChapter) upsertChapter(newChapter);
    setSelectedChapterId(newChapter.id);
  };

  const [localTitle, setLocalTitle] = useState(selectedChapter?.title || '');
  const [localSummary, setLocalSummary] = useState(selectedChapter?.summary || '');
  const [localContent, setLocalContent] = useState(selectedChapter?.content || '');
  const [isPendingAiSync, setIsPendingAiSync] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      // Use requestAnimationFrame to ensure the DOM is ready for measurement
      const resize = () => {
        editor.style.height = 'auto';
        editor.style.height = `${editor.scrollHeight}px`;
      };
      resize();
      
      // Also resize on window resize
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }
  }, [localContent]);

  // Synchronize local state when chapter selection changes
  useEffect(() => {
    if (selectedChapter) {
      const draft = localStorage.getItem(`ls_draft_${selectedChapter.id}`);
      
      // If we have a local draft that is different from cloud, flag it
      // BUT only if we just switched to this chapter or were forced by AI sync
      if (draft && draft !== selectedChapter.content && draft.trim().length > 0) {
        setHasDraft(true);
        // We do NOT setLocalContent yet, we let the user decide to restore it
      } else {
        setHasDraft(false);
        setLocalContent(selectedChapter.content);
      }

      setLocalTitle(selectedChapter.title);
      setLocalSummary(selectedChapter.summary);
    }
  }, [selectedChapterId, isPendingAiSync]); // Avoid dependency on selectedChapter.content to prevent loops

  // Handle external updates (e.g. from collaborators or AI)
  useEffect(() => {
    if (selectedChapter && !dirtyRef.current && !hasDraft) {
      setLocalContent(selectedChapter.content);
      setLocalTitle(selectedChapter.title);
      setLocalSummary(selectedChapter.summary);
    }
  }, [selectedChapter?.content, selectedChapter?.title, selectedChapter?.summary]);

  const restoreDraft = () => {
    if (!selectedChapterId) return;
    const draft = localStorage.getItem(`ls_draft_${selectedChapterId}`);
    if (draft) {
      setLocalContent(draft);
      setHasDraft(false);
      dirtyRef.current = true;
    }
  };

  const discardDraft = () => {
    if (!selectedChapterId) return;
    localStorage.removeItem(`ls_draft_${selectedChapterId}`);
    setHasDraft(false);
    if (selectedChapter) {
      setLocalContent(selectedChapter.content);
    }
  };

  // Debug source materials loading
  useEffect(() => {
    if (project.sourceMaterials && project.sourceMaterials.length > 0) {
      console.log(`Writing Studio loaded ${project.sourceMaterials.length} source materials.`);
    }
  }, [project.sourceMaterials]);

  const updateChapter = (id: string, updates: Partial<Chapter>) => {
    const existing = chapters.find((c: Chapter) => c.id === id);
    if (!existing) return;
    const newChapter = { ...existing, ...updates };
    updateChapters(chapters.map((c: Chapter) => c.id === id ? newChapter : c));
  };

  const updateChapterRef = useRef(updateChapter);
  useEffect(() => {
    updateChapterRef.current = updateChapter;
  }, [updateChapter]);

  const flushSave = async () => {
    if (!dirtyRef.current || !selectedChapterId) return;
    
    setIsSaving(true);
    try {
      await updateChapterRef.current(selectedChapterId, { 
        title: localTitle, 
        summary: localSummary, 
        content: localContent 
      });
      setLastSaved(Date.now());
      // On successful save, the cloud matches our local state
      localStorage.setItem(`ls_hardsave_${selectedChapterId}`, localContent);
      localStorage.removeItem(`ls_draft_${selectedChapterId}`);
      dirtyRef.current = false;
    } catch (err) {
      console.warn("Manual flush save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Track dirty state
  useEffect(() => {
    if (selectedChapter) {
      const isDirty = (
        localTitle !== selectedChapter.title ||
        localSummary !== selectedChapter.summary ||
        localContent !== selectedChapter.content
      );
      dirtyRef.current = isDirty;
    }
  }, [localTitle, localSummary, localContent, selectedChapter]);

  // Debounce updates to parent + Local Draft fallback
  useEffect(() => {
    if (!selectedChapterId) return;
    
    // Recovery: Save to localStorage as draft in case of catastrophic failure
    localStorage.setItem(`ls_draft_${selectedChapterId}`, localContent);

    const timer = setTimeout(async () => {
       if (dirtyRef.current) {
         await flushSave();
       }
    }, 1500); // 1.5s debounce for heavier DB writes

    return () => {
      clearTimeout(timer);
    };
  }, [localTitle, localSummary, localContent, selectedChapterId]);

  // Final flush on unmount
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        flushSave();
      }
    };
  }, []);

  const handleManualSave = async () => {
    await flushSave();
    // Force a project-level save to cloud as well
    await saveToCloud(); 
  };

  const saveToCloud = async () => {
    setIsSaving(true);
    try {
      // Small delay to simulate heavy sync
      await new Promise(resolve => setTimeout(resolve, 800));
      updateProject({ lastModified: Date.now() });
      setLastSaved(Date.now());
    } catch (e) {
      onError?.("Cloud synchronization interrupted.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle chapter selection change - Flush current before switching
  const handleChapterSelect = async (id: string) => {
    if (id === selectedChapterId) return;
    await flushSave();
    setSelectedChapterId(id);
    if (isMobile) setIsSidebarVisible(false);
  };

  const deleteChapter = (id: string) => {
    updateChapters(chapters.filter((c: Chapter) => c.id !== id));
    if (onDeleteChapter) onDeleteChapter(id);
    if (selectedChapterId === id) setSelectedChapterId(chapters[0]?.id || null);
  };

  const moveChapterToSource = (chapter: Chapter) => {
    const newSource: SourceMaterial = {
      id: crypto.randomUUID(),
      name: `[MANUSCRIPT] ${chapter.title}`,
      content: chapter.content,
      type: 'text/markdown'
    };
    onUpsertSource(newSource);
  };

  const toggleNode = (nodeId: string) => {
    if (!selectedChapter) return;
    const currentNodes = selectedChapter.plotNodeIds || [];
    const newNodes = currentNodes.includes(nodeId)
      ? currentNodes.filter(id => id !== nodeId)
      : [...currentNodes, nodeId];
    updateChapter(selectedChapter.id, { plotNodeIds: newNodes });
  };

  const handleRefine = async () => {
    if (!selectedChapter || !localContent.trim()) return;
    setIsRefining(true);
    setIsPendingAiSync(true);
    try {
      const earlierContent = (chapters || [])
        .filter((c: Chapter) => c.order < selectedChapter.order)
        .map((c: Chapter) => c.content)
        .join('\n\n')
        .slice(-15000);

      const activeNodes = plotNodes.filter(n => selectedChapter.plotNodeIds?.includes(n.id));

      const refined = await AIService.deepSimmer(
        { ...selectedChapter, content: localContent },
        earlierContent,
        project.type,
        activeNodes,
        project.research || [],
        project.maturity,
        project.sourceMaterials || [],
        project.targetWordCount,
        project.externalReviews || [],
        project.draftStage,
        chapters.length,
        project.cutMode       // honour Cut & Compress mode
      );
      setLocalContent(refined);
      updateChapter(selectedChapter.id, { content: refined });
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Deep Simmer failed.');
    } finally {
      setIsRefining(false);
      setTimeout(() => setIsPendingAiSync(false), 2000);
    }
  };

  const handleSmartWrite = async () => {
    if (!selectedChapter) return;
    setIsWriting(true);
    setIsPendingAiSync(true);
    try {
      const earlierContent = chapters
        .filter((c: Chapter) => c.order < selectedChapter.order)
        .map((c: Chapter) => c.content)
        .join('\n\n')
        .slice(-15000);

      const activeNodes = plotNodes.filter(n => selectedChapter.plotNodeIds?.includes(n.id));

      const content = await AIService.writeDraft(
        selectedChapter.title, 
        selectedChapter.summary, 
        earlierContent, 
        project.type,
        activeNodes,
        project.research || [],
        project.maturity,
        project.sourceMaterials || [],
        selectedChapter.directives || [], // chapter directives from plan
        project.targetWordCount,
        project.externalReviews || [],
        project.draftStage,       // staged pass number (1-4)
        chapters.length,           // total chapter count for per-chapter target
        project.cutMode            // honour Cut & Compress mode
      );
      
      const newContent = (localContent + '\n\n' + content).trim();
      setLocalContent(newContent);
      updateChapter(selectedChapter.id, { content: newContent });
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Composition Core failed to initialize.');
    } finally {
      setIsWriting(false);
      setTimeout(() => setIsPendingAiSync(false), 2000);
    }
  };

  const handleAnalyzeProse = async () => {
    if (!localContent.trim() || !selectedChapter) return;
    setIsAnalyzingProse(true);
    setShowProsePanel(true);
    try {
      // ── STAGE 1: Fast local heuristic pre-filters (run first, no API cost) ──
      const localEchoes = detectEchoes(localContent);
      const echoViolations: { type: string, message: string, severity: 'low' | 'medium' | 'high' }[] = localEchoes.slice(0, 5).map(echo => ({
        type: 'Echo',
        message: `Word "${echo.word.toUpperCase()}" is echoing close together. Rule 14: Cut thematic static.`,
        severity: 'low'
      }));

      const redundant = findRedundantChapters(chapters);
      const isRedundant = redundant.some(r => r.chapterId === selectedChapter.id);
      if (isRedundant) {
        echoViolations.unshift({
          type: 'Static',
          message: `NARRATIVE LOOP WARNING: This chapter overlaps significantly with existing beats. Ensure a unique "turn".`,
          severity: 'medium' as const
        });
      }

      // Surface local violations immediately so user sees fast feedback
      setProseViolations([...echoViolations]);

      // ── STAGE 2: AI deep prose analysis (runs after local pre-filters) ──
      const precedingContext = chapters
        .filter(c => c.order < selectedChapter.order)
        .slice(-3)
        .map(c => `[CHAPTER: ${c.title}]\n${c.summary}`)
        .join('\n\n');

      const violations = await AIService.analyzeProse(
        localContent,
        project.type,
        precedingContext,
        project.externalReviews || []
      );

      // Merge: local pre-filter violations first, then AI violations
      setProseViolations([...echoViolations, ...violations]);

      // ── STAGE 3: Auto-trigger scene-turn check after prose analysis ──
      if (localContent.trim().length >= 200) {
        setIsCheckingTurn(true);
        setSceneTurnResult(null);
        try {
          const turnResult = await AIService.checkSceneTurn(localContent, project.externalReviews || []);
          setSceneTurnResult(turnResult);
        } catch (turnErr) {
          console.warn('Scene turn auto-check failed silently:', turnErr);
        } finally {
          setIsCheckingTurn(false);
        }
      }
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Prose Analysis failed.');
    } finally {
      setIsAnalyzingProse(false);
    }
  };

  const handleCheckTurn = async () => {
    if (!localContent || localContent.trim().length < 200) {
      onError?.("Scene insufficient in length for reversal analysis.");
      return;
    }
    setIsCheckingTurn(true);
    setShowProsePanel(true);
    setSceneTurnResult(null);
    try {
      const result = await AIService.checkSceneTurn(localContent);
      setSceneTurnResult(result);
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Reversal analysis failed.');
    } finally {
      setIsCheckingTurn(false);
    }
  };

  const handleCritique = async () => {
    if (!selectedChapter?.content) return;
    setIsCritiquing(true);
    setShowCritique(true);
    try {
      const results = await AIService.getSwarmCritique(
        selectedChapter.content, 
        project.type, 
        project.maturity, 
        project.sourceMaterials || [],
        ['vocal', 'structural', 'factual', 'agent', 'sentence', 'thematic', 'writer', 'repetition']
      );
      
      setCritiqueText(results[0]?.content || "Analysis complete.");

      // Persist to project state - Accumulate and ensure we don't duplicate by ID if possible
      const currentMap = project.critiques || {};
      const chapterCritiques = currentMap[selectedChapter.id] || [];
      
      updateProject({
        critiques: {
          ...currentMap,
          [selectedChapter.id]: [...results, ...chapterCritiques].slice(0, 30)
        }
      });
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Narrative Sync Analysis failed.');
    } finally {
      setIsCritiquing(false);
    }
  };

  const applySuggestionsToChapter = () => {
    if (!selectedChapter) return;
    const currentCritiques = (project.critiques || {})[selectedChapter.id] || [];
    const latestCritique = currentCritiques[0];
    if (!latestCritique) return;

    const acceptedSuggestions = latestCritique.suggestions
      .filter(s => s.accepted !== false) // Default to accepted if not explicitly rejected for this simple "apply all"
      .map(s => s.text);
    
    if (acceptedSuggestions.length === 0) return;

    const updatedChapters = chapters.map(chap => {
      if (chap.id === selectedChapter.id) {
        const currentDirectives = chap.directives || [];
        const newDirectives = [...currentDirectives];
        acceptedSuggestions.forEach(s => {
          if (!newDirectives.includes(s)) newDirectives.push(s);
        });
        return { ...chap, directives: newDirectives };
      }
      return chap;
    });
    
    updateChapters(updatedChapters);
    setView('architect'); // Redirect to auto-draft
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { 
        onError?.(`File ${file.name} is too large (max 10MB).`);
        continue;
      }

      try {
        let content = '';
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          const workerUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => (item as any).str).join(' ');
            fullText += pageText + '\n\n';
          }
          content = fullText;
        } else {
          content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
          });
        }

        const CHUNK_SIZE = 400000;
        if (content.length > CHUNK_SIZE) {
          for (let i = 0; i < content.length; i += CHUNK_SIZE) {
            const chunk = content.substring(i, i + CHUNK_SIZE);
            const partNum = Math.floor(i / CHUNK_SIZE) + 1;
            const totalParts = Math.ceil(content.length / CHUNK_SIZE);
            const newSource: SourceMaterial = {
              id: crypto.randomUUID(),
              name: `${file.name} (Part ${partNum}/${totalParts})`,
              content: chunk,
              type: file.type || 'text/plain',
              updatedAt: Date.now()
            };
            await onUpsertSource(newSource);
          }
        } else {
          const newSource: SourceMaterial = {
            id: crypto.randomUUID(),
            name: file.name,
            content: content,
            type: file.type || 'text/plain',
            updatedAt: Date.now()
          };
          await onUpsertSource(newSource);
        }
      } catch (err) {
        console.error("Error processing file:", file.name, err);
        onError?.(`Failed to process ${file.name}.`);
      }
    }
    
    // Reset input so same file can be uploaded again
    e.target.value = '';
  };

  const removeSource = (id: string) => {
    onDeleteSource(id);
  };

  const wordCount = useMemo(() => {
    if (!localContent.trim()) return 0;
    // Strip symbols for word count and filter empty tokens
    return localContent.trim().split(/\s+/).filter(t => t.length > 0).length;
  }, [localContent]);

  const readingTime = useMemo(() => {
    return Math.ceil(wordCount / 200);
  }, [wordCount]);

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    foundations: false,
    sensory: false,
    intel: false,
    critique: false
  });

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const isOverWordLimit = useMemo(() => {
    if (!project.targetWordCount || selectedChapter?.isPlan) return false;
    return wordCount > (project.targetWordCount || 0) * 1.03;
  }, [wordCount, project.targetWordCount, selectedChapter?.isPlan]);

  const recenter = () => {
    setIsFocusMode(false);
    setIsLeftRailOpen(true);
    setIsRightRailOpen(true);
    setIsSidebarVisible(true);
    if (editorRef.current) {
      editorRef.current.scrollTo(0, 0);
    }
  };

  const toggleFocus = () => {
    const next = !isFocusMode;
    setIsFocusMode(next);
    if (next) {
      document.documentElement.requestFullscreen().catch(() => console.log("Fullscreen blocked"));
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => console.log("Exit fullscreen blocked"));
    }
  };

  return (
    <div 
      className={`h-full flex flex-col lg:flex-row gap-0 relative overflow-hidden transition-all duration-700 ${isFocusMode ? 'bg-black' : 'bg-surface-bg'}`}
      style={{ minHeight: 0 }}
    >
      {/* Sidebar - Chapter Navigation & Sources */}
      <AnimatePresence initial={false}>
        {!isFocusMode && isLeftRailOpen && (
          <motion.aside 
            initial={{ width: 0, opacity: 0, x: -50 }}
            animate={{ width: isMobile ? '100vw' : 'clamp(15rem, 21vw, 18rem)', opacity: 1, x: 0 }}
            exit={{ width: 0, opacity: 0, x: -50 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={`border-r border-border-subtle bg-surface-card flex flex-col z-30 h-full relative overflow-hidden shrink-0 no-print ${isMobile ? 'fixed inset-0 shadow-[0_0_100px_rgba(0,0,0,0.8)]' : 'relative'}`}
          >
            <div className="absolute top-4 right-4 z-40">
              <button 
                onClick={() => setIsLeftRailOpen(false)}
                className="p-1 hover:bg-white/5 rounded-md text-text-secondary hover:text-brand-primary flex"
                title="Collapse Sidebar"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
        {/* Manuscript Section */}
        <div className="flex-none p-4 xl:p-6 border-b border-border-subtle relative bg-surface-card shadow-sm">
          {isMobile && (
            <button 
              onClick={() => setIsSidebarVisible(false)}
              className="absolute top-6 right-6 p-2.5 text-text-secondary hover:text-text-primary bg-surface-muted rounded-xl transition-all md:hidden border border-border-subtle"
            >
              <X size={18} />
            </button>
          )}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black text-brand-primary uppercase tracking-[0.4em] flex items-center gap-3">
              <BookOpen size={16} />
              The Manuscript
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={() => toggleSection('foundations')}
                className="p-1 px-2 text-[8px] font-black uppercase text-brand-primary/40 hover:text-brand-primary transition-colors border border-brand-primary/10 hover:border-brand-primary/30 rounded-lg flex items-center gap-2"
                title={collapsedSections.foundations ? 'Restore View' : 'Collapse Section'}
              >
                {collapsedSections.foundations ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                {collapsedSections.foundations ? 'Probe' : 'Split'}
              </button>
              <label className="p-2.5 hover:bg-white/5 text-text-secondary hover:text-brand-primary rounded-xl transition-all cursor-pointer border border-transparent hover:border-border-subtle" title="Import Segment">
                <Upload size={18} />
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".txt,.md,.json,.yaml,.yml,.pdf" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 20 * 1024 * 1024) {
                      onError?.(`Manuscript excessive (max 20MB).`);
                      return;
                    }
                    
                    try {
                      let content = '';
                      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                        const workerUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
                        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

                        const arrayBuffer = await file.arrayBuffer();
                        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                        const pdf = await loadingTask.promise;
                        let fullText = '';
                        for (let i = 1; i <= pdf.numPages; i++) {
                          const page = await pdf.getPage(i);
                          const textContent = await page.getTextContent();
                          const pageText = textContent.items.map((item: any) => (item as any).str).join(' ');
                          fullText += pageText + '\n\n';
                        }
                        content = fullText;
                      } else {
                        content = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = (event) => resolve(event.target?.result as string);
                          reader.onerror = reject;
                          reader.readAsText(file);
                        });
                      }

                      const CHUNK_SIZE = 500000;
                      const contentChunks: string[] = [];
                      if (content.length > CHUNK_SIZE) {
                        for (let i = 0; i < content.length; i += CHUNK_SIZE) {
                          contentChunks.push(content.substring(i, i + CHUNK_SIZE));
                        }
                      } else {
                        contentChunks.push(content);
                      }

                      const newChapters: Chapter[] = contentChunks.map((chunk, index) => {
                        const baseTitle = file.name.replace(/\.[^/.]+$/, "");
                        const isPlan = /plan|outline|architecture|strategy|blueprint/i.test(baseTitle) || chunk.toLowerCase().includes("narrative plan");
                        
                        return {
                          id: crypto.randomUUID(),
                          title: contentChunks.length > 1 ? `${baseTitle} (Part ${index + 1})` : baseTitle,
                          summary: isPlan ? 'Strategic Narrative Architecture' : 'Auto-synthesized ingest.',
                          content: chunk,
                          order: chapters.length + index,
                          plotNodeIds: [],
                          isPlan,
                          tags: [isPlan ? 'plan' : 'ingested'],
                          updatedAt: Date.now()
                        };
                      });

                      const updatedChapters = [...chapters, ...newChapters];
                      updateChapters(updatedChapters);
                      
                      for (const ch of newChapters) {
                        if (upsertChapter) upsertChapter(ch);
                      }

                      setSelectedChapterId(newChapters[0].id);
                    } catch (err) {
                      console.error("Import failure:", err);
                      onError?.(`Artifact failed processing.`);
                    }
                  }} 
                />
              </label>
              <button 
                onClick={addChapter}
                className="p-2.5 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white rounded-xl transition-all border border-brand-primary/20 active:scale-95"
                title="Synthesize New Segment"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
          {!collapsedSections.foundations && (
            <div className="space-y-2 max-h-[32dvh] overflow-y-auto custom-scrollbar pr-1">
              {chapters.map((chapter: Chapter) => (
              <div key={chapter.id} className="group relative">
                <button
                  onClick={() => handleChapterSelect(chapter.id)}
                  className={`w-full text-left px-5 py-4 rounded-2xl transition-all flex items-center gap-4 border ${
                    selectedChapterId === chapter.id 
                      ? 'bg-brand-primary border-brand-primary text-white shadow-xl shadow-brand-primary/20' 
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/5 border-transparent hover:border-border-subtle'
                  }`}
                >
                  <span className={`text-[9px] font-black uppercase tracking-tighter tabular-nums ${selectedChapterId === chapter.id ? 'opacity-50' : 'text-brand-primary/50'}`}>
                    ID:{(chapter.order + 1).toString().padStart(2, '0')}
                  </span>
                  <span className="text-sm font-black truncate flex-1 italic font-serif">{chapter.title}</span>
                </button>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-all bg-surface-muted/95 backdrop-blur-xl border border-border-subtle rounded-xl p-1 shadow-2xl">
                  <button 
                    onClick={() => moveChapterToSource(chapter)}
                    className="p-2 text-text-secondary hover:text-brand-primary transition-all rounded-lg"
                    title="Archive to Source"
                  >
                    <ArrowRight size={14} />
                  </button>
                  <button 
                    onClick={() => deleteChapter(chapter.id)}
                    className="p-2 text-text-secondary hover:text-red-500 transition-all rounded-lg"
                    title="Purge Segment"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Source Ingestion Section */}
        <div className="p-4 xl:p-6 flex-1 flex flex-col gap-4 overflow-hidden bg-surface-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-[0.4em] flex items-center gap-3">
                <Library size={16} className="text-brand-primary" />
                Intelligence Rail
              </h3>
              <button 
                onClick={() => toggleSection('intel')}
                className="p-1 px-2 text-[8px] font-black uppercase text-brand-primary/40 hover:text-brand-primary transition-colors border border-brand-primary/10 hover:border-brand-primary/30 rounded-lg flex items-center gap-2"
                title={collapsedSections.intel ? 'Restore View' : 'Collapse Section'}
              >
                {collapsedSections.intel ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                {collapsedSections.intel ? 'Trace' : 'Hide'}
              </button>
            </div>
            <label className="p-2.5 bg-white/5 border border-border-subtle text-text-secondary hover:text-brand-primary rounded-xl transition-all cursor-pointer active:scale-95" title="Ingest Data">
              <Plus size={20} />
              <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt,.md,.json,.yaml,.yml,.pdf" multiple />
            </label>
          </div>

          {!collapsedSections.intel && (
            <>
              {/* Search and Filter UI */}
              <div className="space-y-4">
            <div className="relative group">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-brand-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Fuzzy Vector Search..." 
                value={archiveSearchTerm}
                onChange={(e) => setArchiveSearchTerm(e.target.value)}
                className="w-full bg-surface-card border border-border-subtle rounded-2xl py-3.5 pl-12 pr-6 text-xs font-black text-text-primary focus:border-brand-primary outline-none placeholder:text-text-secondary/30 transition-all shadow-inner"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              {(['All', 'Manuscript', 'Research', 'AI Compilation'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setArchiveFilter(type)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${
                    archiveFilter === type 
                      ? 'bg-brand-primary border-brand-primary text-white shadow-lg' 
                      : 'bg-surface-card text-text-secondary border-border-subtle hover:border-text-secondary/30'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
            {allSources.length > 0 ? (
              <div className="space-y-3">
                {allSources.map(source => (
                  <div 
                    key={source.id} 
                    onClick={() => {
                      setViewingSourceId(source.id);
                      if (isMobile) setIsSidebarVisible(false);
                    }}
                    className="p-5 bg-surface-card rounded-2xl border border-border-subtle group relative cursor-pointer hover:border-brand-primary/50 transition-all shadow-lg active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {(source as any).displayType === 'AI Compilation' ? (
                          <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center">
                            <Zap className="text-brand-primary fill-brand-primary" size={16} />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center">
                            <FileText className="text-text-secondary" size={16} />
                          </div>
                        )}
                        <span className="text-[10px] font-black text-text-primary uppercase tracking-widest truncate flex-1">{source.name}</span>
                      </div>
                      <span className={`text-[8px] font-black px-2 py-1 rounded-md uppercase tracking-widest shrink-0 border ${
                        (source as any).displayType === 'Manuscript' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                        (source as any).displayType === 'AI Compilation' ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20' :
                        'bg-surface-muted text-text-secondary border-border-subtle'
                      }`}>
                        {typeMap[(source as any).displayType as keyof typeof typeMap] || (source as any).displayType}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary font-medium line-clamp-2 italic font-serif leading-relaxed opacity-60">
                      {source.content.slice(0, 80)}...
                    </p>
                    {(source as any).displayType !== 'AI Compilation' && (source as any).displayType !== 'Research' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSource(source.id);
                        }}
                        className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-text-secondary hover:text-red-500 transition-all bg-surface-card border border-border-subtle rounded-lg shadow-2xl"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-text-secondary">
                <div className="w-20 h-20 bg-surface-muted rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-dashed border-border-subtle">
                  {archiveSearchTerm ? <Search size={28} className="opacity-20" /> : <Upload size={28} className="opacity-20" />}
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] leading-relaxed opacity-40">
                  {archiveSearchTerm ? 'No Secure Matches' : 'Ingest External\nArtifacts Here'}
                </p>
              </div>
            )}
          </div>
          </>
          )}
        </div>

        {/* Collaborative Presence */}
        {presence.length > 0 && (
          <div className="p-4 xl:p-6 border-t border-border-subtle bg-surface-card">
            <div className="text-[10px] font-black text-text-secondary mb-4 uppercase tracking-[0.3em] flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
              Live Presence Matrix
            </div>
            <div className="flex -space-x-3">
              {presence.map((p) => (
                <div 
                  key={p.userId} 
                  title={p.userName}
                  className="w-10 h-10 rounded-xl border-2 border-surface-card bg-brand-dark text-text-primary flex items-center justify-center text-xs font-black shadow-2xl ring-2 ring-brand-primary/20"
                >
                  {p.userName.charAt(0)}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.aside>
    )}
  </AnimatePresence>

  {/* Main Study Area */}
  <div 
    className="flex-1 flex flex-col bg-surface-bg relative z-0 min-w-0"
    style={{ minHeight: 0 }}
  >
        {/* Toggle Buttons for Rails */}
        {!isFocusMode && !isLeftRailOpen && (
          <motion.button 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setIsLeftRailOpen(true)}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-[55] w-6 h-24 bg-brand-dark border-y border-r border-border-subtle rounded-r-xl flex items-center justify-center text-text-secondary hover:text-brand-primary transition-all hover:w-8 group shadow-2xl"
            title="Restore Navigation"
          >
            <ChevronRight size={14} className="group-hover:scale-125 transition-transform" />
          </motion.button>
        )}

        {!isFocusMode && !isRightRailOpen && (
          <motion.button 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setIsRightRailOpen(true)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-[55] w-6 h-24 bg-brand-dark border-y border-l border-border-subtle rounded-l-xl flex items-center justify-center text-text-secondary hover:text-brand-primary transition-all hover:w-8 group shadow-2xl"
            title="Restore Ops Rail"
          >
            <ChevronLeft size={14} className="group-hover:scale-125 transition-transform" />
          </motion.button>
        )}

        <AnimatePresence mode="wait">
          {selectedChapter ? (
             <motion.div 
              key={selectedChapter.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col overflow-hidden"
              style={{ minHeight: 0 }}
            >
              {/* Internal Editor Header */}
              <div className={`h-auto min-h-16 studio-header border-b border-border-subtle flex flex-wrap items-center justify-between px-3 md:px-6 lg:px-8 py-3 bg-surface-card/80 backdrop-blur-xl shadow-2xl flex-none transition-all ${isFocusMode ? 'opacity-10 hover:opacity-100' : ''} no-print overflow-hidden gap-2 md:gap-4`}>
                <div className="flex items-center gap-2 md:gap-8 shrink-0">
                  {!isFocusMode && (
                    <button 
                      onClick={() => isMobile ? setIsLeftRailOpen(true) : setIsSidebarVisible(!isSidebarVisible)}
                      className="p-2 md:p-2.5 hover:bg-white/5 text-text-secondary hover:text-brand-primary rounded-xl border border-transparent hover:border-border-subtle transition-all active:scale-95"
                      title="Open chapter list"
                    >
                      <ChevronRight size={18} className={(!isMobile && isSidebarVisible) ? 'rotate-180 transition-transform' : 'transition-transform'} />
                    </button>
                  )}
                  {!isFocusMode && isMobile && (
                    <button
                      onClick={() => setIsRightRailOpen(true)}
                      className="p-2 hover:bg-white/5 text-text-secondary hover:text-brand-primary rounded-xl border border-transparent hover:border-border-subtle transition-all active:scale-95"
                      title="Open strategic ops"
                    >
                      <ChevronLeft size={18} />
                    </button>
                  )}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                       <input 
                        value={localTitle}
                        onChange={(e) => setLocalTitle(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 font-black text-text-primary text-xs md:text-base italic font-serif w-24 md:w-auto p-0 hover:text-brand-primary transition-colors cursor-text"
                      />
                      {selectedChapter.isPlan && (
                        <span className="px-2 py-0.5 bg-brand-primary/20 text-brand-primary text-[7px] font-black uppercase rounded border border-brand-primary/30 tracking-widest">Plan Mode</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${isSaving ? 'bg-amber-500 animate-pulse' : 'bg-brand-primary'}`} />
                      <span className="text-[7px] md:text-[8px] font-black text-text-secondary uppercase tracking-[0.2em] md:tracking-[0.3em] leading-none opacity-40">
                        {isSaving ? 'Synchronizing' : 'Secure Connection Active'}
                      </span>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 md:gap-6 ml-2 md:ml-4 border-l border-border-subtle pl-4 md:pl-6">
                    <div className="flex flex-col">
                      <span className="text-[8px] md:text-[9px] font-black text-text-secondary uppercase leading-none tracking-widest opacity-40 mb-1">Volume</span>
                      <span className={`text-[9px] md:text-[10px] font-black tabular-nums transition-colors ${isOverWordLimit ? 'text-red-500 animate-pulse' : 'text-brand-primary'}`}>
                        {wordCount.toLocaleString()} Words
                        {isOverWordLimit && <span className="ml-1 text-[7px] text-red-500 tracking-tighter">(LIMIT EXCEEDED)</span>}
                      </span>
                    </div>
                    <div className="flex flex-col border-l border-border-subtle pl-4 md:pl-6">
                      <span className="text-[8px] md:text-[9px] font-black text-text-secondary uppercase leading-none tracking-widest opacity-40 mb-1">Latency</span>
                      <span className="text-[9px] md:text-[10px] font-black text-text-primary tabular-nums">{readingTime}m Read</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4 shrink-0 overflow-x-auto custom-scrollbar pb-1 lg:pb-0">
                  <button 
                    onClick={handleManualSave}
                    disabled={isSaving}
                    className={`flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-2.5 rounded-xl md:rounded-2xl text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all border active:scale-95 whitespace-nowrap ${
                      dirtyRef.current 
                        ? 'bg-brand-primary border-brand-primary text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]' 
                        : (isSaving ? 'bg-white/5 border-border-subtle text-brand-primary' : 'bg-surface-muted border-border-subtle text-text-secondary hover:text-text-primary hover:border-text-secondary/30')
                    }`}
                  >
                    {isSaving ? <Activity size={12} className="animate-spin text-brand-primary" /> : <Save size={12} />}
                    {isSaving ? 'Cloud...' : (dirtyRef.current ? 'Commit' : 'Synced')}
                  </button>

                  <button 
                    onClick={recenter}
                    className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-surface-muted border border-border-subtle text-text-secondary hover:text-brand-primary hover:border-brand-primary transition-all active:scale-95 shrink-0"
                    title="Re-centre Architecture"
                  >
                    <RefreshCcw size={16} />
                  </button>

                  <button 
                    onClick={toggleFocus}
                    className={`p-2 md:p-3 rounded-xl md:rounded-2xl transition-all shrink-0 border active:scale-95 ${isFocusMode ? 'bg-brand-primary text-white border-brand-primary' : 'bg-surface-muted border-border-subtle text-text-secondary hover:text-text-primary hover:border-text-secondary/30'}`}
                    title="Toggle Void Focus"
                  >
                    {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>

                  <div className="h-6 w-px bg-border-subtle shrink-0 hidden md:block" />

                  {/* Plot Node Tags */}
                  <div className="relative shrink-0">
                    <button 
                      onClick={() => setShowNodePicker(!showNodePicker)}
                      className={`flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2.5 rounded-2xl bg-surface-muted border border-border-subtle transition-all active:scale-95 ${showNodePicker ? 'border-brand-primary text-brand-primary' : 'text-text-secondary hover:text-text-primary'}`}
                    >
                      <Tag size={14} />
                      {selectedChapter.plotNodeIds?.length || 0} Vectors
                    </button>
                    <AnimatePresence>
                      {showNodePicker && (
                        <motion.div 
                          initial={{ opacity: 0, y: 15, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 top-full mt-4 w-72 bg-surface-card border border-border-subtle rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] z-[60] p-6 backdrop-blur-2xl"
                        >
                          <div className="flex items-center justify-between mb-6">
                            <h4 className="text-[10px] font-black text-brand-primary uppercase tracking-[0.3em]">Meta-Vector Scene</h4>
                            <Tag size={14} className="text-text-secondary opacity-30" />
                          </div>
                          <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                            {plotNodes.map(node => (
                              <button
                                key={node.id}
                                onClick={() => toggleNode(node.id)}
                                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between group transition-all border ${
                                  selectedChapter.plotNodeIds?.includes(node.id) 
                                    ? 'bg-brand-primary border-brand-primary text-white shadow-lg' 
                                    : 'text-text-secondary border-transparent hover:bg-white/5 hover:border-border-subtle'
                                }`}
                              >
                                {node.title}
                                {selectedChapter.plotNodeIds?.includes(node.id) ? (
                                  <Zap size={12} className="fill-current animate-pulse" />
                                ) : (
                                  <div className="w-1.5 h-1.5 rounded-full bg-border-subtle group-hover:bg-brand-primary transition-colors" />
                                )}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="h-6 w-px bg-border-subtle shrink-0 hidden lg:block" />

                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSmartWrite}
                    disabled={isWriting}
                    className={`flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-2.5 border rounded-xl md:rounded-[1.25rem] text-[8px] md:text-[9px] font-black transition-all uppercase tracking-[0.1em] md:tracking-[0.2em] shrink-0 border-brand-primary/30 active:scale-95 ${
                      isWriting ? 'bg-brand-primary text-white border-brand-primary shadow-2xl shadow-brand-primary/20' : 'bg-surface-muted hover:bg-brand-primary/10 text-brand-primary'
                    }`}
                  >
                    {isWriting ? (
                      <>
                        <Activity size={12} className="animate-pulse" />
                        Writing...
                      </>
                    ) : (
                      <>
                        <Zap size={12} className="fill-current" />
                        Compose
                      </>
                    )}
                  </motion.button>

                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRefine}
                    disabled={isRefining || !selectedChapter.content.trim()}
                    className={`flex items-center gap-3 px-4 md:px-6 py-2 md:py-2.5 rounded-xl md:rounded-[1.25rem] text-[8px] md:text-[9px] font-black transition-all shadow-2xl uppercase tracking-[0.1em] md:tracking-[0.2em] shrink-0 active:scale-95 ${
                      isRefining ? 'bg-orange-600 text-white' : 'bg-brand-dark hover:bg-black text-text-primary border border-border-subtle hover:border-brand-primary/50'
                    }`}
                    title="Deep Quality Refinement"
                  >
                    {isRefining ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Simmering...
                      </>
                    ) : (
                      <>
                        <Activity size={14} />
                        Refine
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
              <div 
                className="flex-1 flex overflow-hidden lg:flex-row flex-col relative"
                style={{ minHeight: 0 }}
              >
                <div 
                  className={`flex-1 flex flex-col writing-scroll ${isFocusMode ? 'p-4 md:p-8 lg:px-14 lg:py-8' : 'p-4 md:p-8 lg:px-12 xl:px-20 2xl:px-32 lg:py-12 xl:py-16'} overflow-y-auto overscroll-contain w-full custom-scrollbar relative transition-all duration-500 pb-32`}
                  style={{ minHeight: 0 }}
                >
                   <div className="w-full max-w-[80ch] mx-auto flex flex-col items-center">
                   {/* Summary Box */}
                  <div className="max-w-[80ch] w-full mb-12 opacity-60 focus-within:opacity-100 transition-all duration-700 bg-surface-card/50 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-border-subtle hover:border-brand-primary/20 relative">
                    {/* Prose Analysis Flyout */}
                    <AnimatePresence>
                      {showProsePanel && (
                        <motion.div 
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="absolute right-0 lg:left-[calc(100%+2rem)] top-full lg:top-0 w-full lg:w-80 bg-surface-card border border-border-subtle rounded-3xl shadow-3xl p-6 z-[90] mt-4 lg:mt-0"
                        >
                          <div className="flex items-center justify-between mb-6">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary flex items-center gap-2">
                              {sceneTurnResult ? <Flame size={14} /> : <CircleSlash size={14} />}
                              {sceneTurnResult ? "Scene Reversal Meter" : "The Sludge Filter"}
                            </h4>
                            <button onClick={() => { setShowProsePanel(false); setSceneTurnResult(null); }} className="text-text-secondary hover:text-text-primary">
                              <X size={14} />
                            </button>
                          </div>

                          {isAnalyzingProse || isCheckingTurn ? (
                            <div className="py-20 flex flex-col items-center justify-center text-center">
                              <Activity className="text-brand-primary animate-pulse mb-4" size={32} />
                              <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                                {isCheckingTurn ? "Analyzing Narrative Engine..." : "Scanning for pretty sludge..."}
                              </p>
                            </div>
                          ) : sceneTurnResult ? (
                            <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                <div className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Reversal Intensity</div>
                                <div className={`text-xl font-black italic font-serif ${sceneTurnResult.turned ? 'text-brand-primary' : 'text-red-500'}`}>
                                  {sceneTurnResult.score}%
                                </div>
                              </div>
                              
                              <div className="w-full bg-surface-muted rounded-full h-1.5 overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${sceneTurnResult.score}%` }}
                                  className={`h-full ${sceneTurnResult.turned ? 'bg-brand-primary' : 'bg-red-500'}`}
                                />
                              </div>

                              <div className="space-y-4">
                                <div>
                                  <p className="text-[8px] font-black uppercase tracking-widest text-text-secondary mb-1">Reasoning</p>
                                  <p className="text-xs text-text-primary leading-relaxed italic">"{sceneTurnResult.reasoning}"</p>
                                </div>
                                {!sceneTurnResult.turned && (
                                  <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-red-500 mb-1">Critical Missing Component</p>
                                    <p className="text-xs text-text-secondary leading-relaxed font-serif uppercase tracking-tighter">{sceneTurnResult.missing}</p>
                                  </div>
                                )}
                              </div>

                              <button 
                                onClick={handleCheckTurn}
                                className="w-full py-4 bg-surface-muted hover:bg-surface-card border border-border-subtle rounded-2xl text-[10px] font-black uppercase tracking-widest text-text-primary transition-all flex items-center justify-center gap-2"
                              >
                                <RefreshCcw size={12} />
                                Re-Scan Sequence
                              </button>
                            </div>
                          ) : proseViolations.length > 0 ? (
                            <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                              {proseViolations.map((v, i) => (
                                <div key={i} className={`p-4 rounded-2xl border ${
                                  v.severity === 'high' ? 'bg-red-500/5 border-red-500/20' : 
                                  v.severity === 'medium' ? 'bg-orange-500/5 border-orange-500/20' : 
                                  'bg-brand-primary/5 border-brand-primary/20'
                                }`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle size={12} className={v.severity === 'high' ? 'text-red-500' : 'text-orange-500'} />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-text-primary">{v.type}</span>
                                  </div>
                                  <p className="text-xs text-text-secondary leading-relaxed capitalize">{v.message}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-20 flex flex-col items-center justify-center text-center">
                              <Sparkles className="text-brand-primary mb-4" size={32} />
                              <p className="text-[10px] font-black uppercase tracking-widest text-text-primary">No sludge detected.</p>
                              <p className="text-[9px] text-text-secondary mt-2">Your prose is surgical.</p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="flex items-center gap-3 text-[10px] font-black text-brand-primary mb-6 uppercase tracking-[0.4em] pl-1 font-sans">
                      <FileText size={16} />
                      Chapter Architecture
                    </div>
                    <textarea 
                      value={localSummary}
                      onChange={(e) => setLocalSummary(e.target.value)}
                      placeholder="Define the primary intelligence vector for this sequence..."
                      className="w-full bg-transparent border-t border-border-subtle/30 py-6 text-text-primary text-base md:text-lg resize-none focus:ring-0 outline-none placeholder:text-text-secondary/20 leading-relaxed font-serif italic"
                      rows={2}
                    />
                  </div>
 
                  {/* Writing Area */}
                  <div className="max-w-[80ch] w-full flex flex-col pb-60">
                    <AnimatePresence>
                      {hasDraft && (
                        <motion.div 
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="mb-8 p-6 bg-brand-primary/10 border border-brand-primary/20 rounded-3xl flex items-center justify-between gap-6"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-brand-primary/20 rounded-xl">
                              <Sparkles size={20} className="text-brand-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-black text-text-primary italic font-serif">Unsaved Draft Detected</p>
                              <p className="text-[10px] text-text-secondary font-medium uppercase tracking-widest mt-1">Local version is more detailed than cloud state.</p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button 
                              onClick={discardDraft}
                              className="px-5 py-2 text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-red-500 transition-all"
                            >
                              Discard
                            </button>
                            <button 
                              onClick={restoreDraft}
                              className="px-6 py-2 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand-primary/20 transition-all active:scale-95"
                            >
                              Restore Draft
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <textarea 
                      ref={editorRef}
                      value={localContent}
                      onChange={(e) => setLocalContent(e.target.value)}
                      placeholder="Initialize narrative thread..."
                      className="w-full h-auto min-h-[65dvh] bg-transparent border-none focus:ring-0 text-xl md:text-2xl text-text-primary leading-[1.8] resize-none outline-none font-serif placeholder:text-text-secondary/10 selection:bg-brand-primary/30"
                      spellCheck={true}
                    />
                  </div>
                </div>
              </div>


                {/* Right Rail - Analysis & Actions */}
                <AnimatePresence>
                  {!isFocusMode && isRightRailOpen && (
                    <motion.div 
                      key="right-rail"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: isMobile ? '100vw' : 'clamp(13rem, 18vw, 15.5rem)', opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ type: "spring", damping: 30, stiffness: 300 }}
                      className={`h-full border-l border-border-subtle bg-surface-card flex flex-col z-30 shrink-0 relative overflow-hidden ${isMobile ? 'fixed inset-0 pt-20' : ''}`}
                    >
                      <div className="p-8 border-b border-border-subtle flex items-center justify-between">
                        <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.4em]">Strategic Ops</span>
                        <div className="flex items-center gap-4">
                          <Sparkles size={14} className="text-brand-primary animate-pulse" />
                          <button 
                            onClick={() => setIsRightRailOpen(false)}
                            className="p-1 hover:bg-white/5 rounded-md text-text-secondary hover:text-brand-primary block"
                            title="Collapse Ops Rail"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 xl:p-5 space-y-4 xl:space-y-5">
                        <button 
                          onClick={handleAnalyzeProse}
                          disabled={isAnalyzingProse}
                          className={`w-full p-4 h-32 rounded-3xl border transition-all active:scale-95 group shadow-xl relative flex flex-col items-center justify-center gap-3 bg-surface-muted/30 ${
                            isAnalyzingProse ? 'animate-pulse border-brand-primary bg-brand-primary/5' : 'hover:border-brand-primary hover:bg-brand-primary/5'
                          }`}
                        >
                          <CircleSlash size={32} className={isAnalyzingProse ? 'text-brand-primary' : 'text-text-secondary group-hover:text-brand-primary'} />
                          <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary group-hover:text-brand-primary">The Sludge Filter</span>
                        </button>

                        <button 
                          onClick={handleCheckTurn}
                          disabled={isCheckingTurn}
                          className={`w-full p-4 h-32 rounded-3xl border transition-all active:scale-95 group shadow-xl relative flex flex-col items-center justify-center gap-3 bg-surface-muted/30 ${
                            isCheckingTurn ? 'animate-pulse border-brand-primary bg-brand-primary/5' : 'hover:border-brand-primary hover:bg-brand-primary/5'
                          }`}
                        >
                          <Flame size={32} className={isCheckingTurn ? 'text-brand-primary' : 'text-text-secondary group-hover:text-brand-primary'} />
                          <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary group-hover:text-brand-primary">Reversal Meter</span>
                        </button>

                        <div className="h-px bg-border-subtle mx-4" />

                        <button 
                          onClick={handleCritique}
                          disabled={isCritiquing}
                          className="w-full p-4 bg-brand-dark border border-border-subtle text-text-secondary hover:text-brand-primary hover:border-brand-primary rounded-3xl shadow-xl active:scale-95 transition-all group flex flex-col items-center justify-center gap-3"
                        >
                          <Users size={32} className={isCritiquing ? 'animate-pulse' : ''} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Narrative Swarm</span>
                        </button>

                        <button 
                          onClick={() => {/* Deep Scan */}}
                          className="w-full p-6 bg-brand-dark border border-border-subtle text-text-secondary hover:text-brand-primary hover:border-brand-primary rounded-3xl shadow-xl active:scale-95 transition-all group flex flex-col items-center justify-center gap-4 opacity-30 cursor-not-allowed"
                        >
                          <Fingerprint size={32} />
                          <span className="text-[9px] font-black uppercase tracking-widest">DNA Mapping</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Mobile Bottom Bar for Actions */}
                <div className="lg:hidden fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-surface-card/90 backdrop-blur-xl border border-border-subtle p-1.5 rounded-2xl shadow-2xl z-[80]">
                  <button onClick={recenter} className="p-3 text-text-secondary hover:text-brand-primary"><RefreshCcw size={20} /></button>
                  <button onClick={handleAnalyzeProse} className="p-3 text-text-secondary hover:text-brand-primary"><CircleSlash size={20} /></button>
                  <button onClick={handleCheckTurn} className="p-3 text-text-secondary hover:text-brand-primary"><Flame size={20} /></button>
                  <button onClick={handleSmartWrite} className="p-4 bg-brand-primary text-white rounded-xl"><Zap size={20} /></button>
                  <button onClick={handleRefine} className="p-3 text-text-secondary hover:text-brand-primary"><Flame size={20} /></button>
                  <button onClick={handleCritique} className="p-3 text-text-secondary hover:text-brand-primary"><Users size={20} /></button>
                </div>

                {/* Critique Sidebar */}
                <AnimatePresence>
                  {showCritique && (
                    <motion.div 
                      key="critique"
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: isMobile ? '100vw' : 'clamp(20rem, 30vw, 26rem)', opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      className={`border-l border-border-subtle bg-brand-dark flex flex-col overflow-hidden shadow-[-40px_0_100px_rgba(0,0,0,0.5)] h-full relative z-50 ${isMobile ? 'fixed inset-0 pt-20' : ''}`}
                    >
                      <div className="p-8 border-b border-border-subtle flex items-center justify-between bg-surface-card">
                        <div className="flex flex-col">
                          <h3 className="text-[10px] font-black text-brand-primary flex items-center gap-3 uppercase tracking-[0.4em] mb-1">
                            <Zap size={16} className="fill-brand-primary" />
                            Case Narrative
                          </h3>
                          <span className="text-[9px] font-black text-text-secondary opacity-40 uppercase tracking-widest">Spectral Deep Analysis</span>
                        </div>
                        <button 
                          onClick={() => setShowCritique(false)} 
                          className="p-4 text-white transition-all bg-red-600 rounded-2xl border-2 border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:bg-red-700 active:scale-90 group z-[100]"
                          title="Close Case Narrative"
                        >
                          <X size={24} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
                        </button>
                      </div>
                      <div className="p-10 overflow-y-auto custom-scrollbar flex-1 space-y-12">
                        {isCritiquing ? (
                          <div className="h-full flex flex-col items-center justify-center gap-8">
                             <div className="relative">
                               <motion.div 
                                animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.4, 0.1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="absolute inset-0 bg-brand-primary rounded-full blur-3xl" 
                              />
                              <Activity size={48} className="text-brand-primary animate-pulse relative z-10" />
                             </div>
                            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-brand-primary animate-shimmer italic">Deconstructing Manuscript Artifact...</p>
                          </div>
                        ) : (
                          <div className="space-y-12">
                            <div className="prose prose-invert prose-brand max-w-none text-text-secondary/80 prose-strong:text-text-primary prose-headings:text-brand-primary prose-headings:font-black prose-p:leading-relaxed border-b border-border-subtle pb-12">
                              <Markdown>{critiqueText}</Markdown>
                            </div>

                            {/* Suggestions */}
                            {(project.critiques || {})[selectedChapter.id]?.[0]?.suggestions.length > 0 && (
                              <div className="space-y-6">
                                <h4 className="text-[10px] font-black text-text-primary uppercase tracking-[0.3em] flex items-center gap-3">
                                  <Flame size={16} className="text-brand-primary" />
                                  Actionable High-Vector Suggestions
                                </h4>
                                <div className="space-y-4">
                                  {(project.critiques || {})[selectedChapter.id][0].suggestions.map((s: any, idx: number) => (
                                    <div key={idx} className="flex gap-4 text-xs text-text-secondary bg-surface-card p-6 rounded-[2rem] border border-border-subtle group hover:border-brand-primary/50 transition-all shadow-xl">
                                      <span className="font-black text-brand-primary text-base tabular-nums opacity-40 group-hover:opacity-100 transition-opacity">{(idx + 1).toString().padStart(2, '0')}</span>
                                      <p className="leading-relaxed font-medium">{s.text}</p>
                                    </div>
                                  ))}
                                </div>
                                <button 
                                  onClick={applySuggestionsToChapter}
                                  className="w-full py-6 bg-brand-primary text-white rounded-[2.5rem] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-brand-accent transition-all shadow-[0_20px_50px_rgba(59,130,246,0.5)] mt-10 flex items-center justify-center gap-3 group active:scale-95"
                                >
                                  <Zap size={18} className="text-white group-hover:rotate-12 transition-all fill-current" />
                                  Synthesize Refined Draft
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-surface-bg relative">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] grayscale pointer-events-none" />
              <div className="relative group">
                <div className="absolute inset-0 bg-brand-primary rounded-full blur-[100px] opacity-10 group-hover:opacity-20 transition-opacity" />
                <Library size={120} strokeWidth={0.5} className="text-text-secondary opacity-10 mb-12 relative z-10" />
              </div>
              <div className="max-w-md space-y-4 relative z-10">
                <h3 className="text-3xl font-black text-text-primary italic font-serif tracking-tight">Manuscript Rail Disconnected</h3>
                <p className="text-xs text-text-secondary font-black uppercase tracking-[0.3em] opacity-40">Initialize a new narrative thread to begin synthesis</p>
                <div className="pt-10">
                  <button 
                    onClick={addChapter}
                    className="px-10 py-5 bg-brand-primary text-white rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-brand-accent transition-all shadow-2xl active:scale-95 flex items-center gap-3 mx-auto"
                  >
                    <Plus size={18} />
                    New Sequence
                  </button>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Source Viewer Modal */}
      <AnimatePresence>
        {viewingSource && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/80 backdrop-blur-2xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-brand-dark w-full max-w-5xl h-[85vh] rounded-[4rem] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.8)] flex flex-col border border-border-subtle"
            >
              <div className="p-10 border-b border-border-subtle flex items-center justify-between bg-surface-card">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-brand-primary/10 text-brand-primary rounded-2xl flex items-center justify-center border border-brand-primary/20">
                    <FileText size={28} />
                  </div>
                  <div>
                    <h3 className="font-black text-text-primary uppercase tracking-[0.3em] text-sm mb-1">{viewingSource.name}</h3>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] text-brand-primary font-black uppercase tracking-[0.4em] px-3 py-1 bg-brand-primary/10 rounded-md border border-brand-primary/20 tabular-nums">
                         Secure Access: {viewingSource.id.slice(0, 8)}
                       </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingSourceId(null)}
                  className="w-14 h-14 flex items-center justify-center rounded-[2rem] hover:bg-white/5 text-text-secondary hover:text-text-primary transition-all border border-border-subtle active:scale-90"
                >
                  <X size={28} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-16 custom-scrollbar bg-surface-muted/30">
                <div className="max-w-[75ch] mx-auto">
                  <div className="text-text-primary/90 leading-[2] font-serif whitespace-pre-wrap text-xl md:text-2xl selection:bg-brand-primary/30 first-letter:text-5xl first-letter:font-black first-letter:mr-3 first-letter:float-left">
                    {viewingSource.content}
                  </div>
                </div>
              </div>
              <div className="p-10 bg-surface-card border-t border-border-subtle flex justify-end">
                <button 
                  onClick={() => setViewingSourceId(null)}
                  className="px-12 py-5 bg-brand-primary text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-[10px] hover:bg-brand-accent transition-all shadow-[0_20px_50px_rgba(59,130,246,0.3)] active:scale-95"
                >
                  Terminate Connection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
