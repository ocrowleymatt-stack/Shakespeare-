import React, { useState } from 'react';
import { 
  Search, Book, Globe, Sparkles, BrainCircuit, ListTree, 
  ChevronRight, ArrowRight, Microchip, Database, Info, 
  Eye, Headphones, Wind, Hand, Layers, RefreshCcw,
  Library, Trash2, Zap, AlertCircle, Upload
} from 'lucide-react';
import { Project, ResearchNote, Chapter, SourceMaterial } from '../types';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface Props {
  project: Project;
  research: ResearchNote[];
  chapters: Chapter[];
  sourceMaterials: SourceMaterial[];
  onAddResearch: (note: ResearchNote) => void | Promise<void>;
  onDeleteResearch: (id: string) => void | Promise<void>;
  onAddChapter: (chapter: Chapter) => void | Promise<void>;
  onAddSource: (source: SourceMaterial) => void | Promise<void>;
  onDeleteSource: (id: string) => void | Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function IntelligenceLab({ 
  project, 
  research, 
  chapters, 
  sourceMaterials,
  onAddResearch, 
  onDeleteResearch,
  onAddChapter, 
  onAddSource,
  onDeleteSource,
  onNotify 
}: Props) {
  const [activeStep, setActiveStep] = useState<'architecture' | 'exploration' | 'synthesis' | 'archive'>('architecture');
  const [loading, setLoading] = useState(false);
  const [structure, setStructure] = useState<any>(null);
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [synthesisResult, setSynthesisResult] = useState<string>('');

  const [pushing, setPushing] = useState(false);
  const [researchingTracks, setResearchingTracks] = useState<string[]>([]);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);

  // For Archive Tab
  const [archiveSearchTerm, setArchiveSearchTerm] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<'All' | 'Research' | 'Source'>('All');
  const [selectedArchiveItem, setSelectedArchiveItem] = useState<any | null>(null);

  const allArchiveItems = [
    ...research.map(r => ({ ...r, displayType: 'Research' })),
    ...sourceMaterials.map(s => ({ ...s, displayType: 'Source' }))
  ].sort((a, b) => b.updatedAt - a.updatedAt);

  const filteredArchive = allArchiveItems.filter(item => {
    if (archiveFilter !== 'All' && item.displayType !== archiveFilter) return false;
    if (!archiveSearchTerm) return true;
    const term = archiveSearchTerm.toLowerCase();
    const searchable = `${('title' in item ? item.title : item.name)} ${item.content} ${('category' in item ? item.category : '')}`;
    return searchable.toLowerCase().includes(term);
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) { 
        onNotify(`File ${file.name} is too large (max 15MB).`, 'error');
        continue;
      }

      onNotify(`Ingesting ${file.name}...`, 'info');
      try {
        let content = '';
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
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
            await onAddSource(newSource);
          }
        } else {
          const newSource: SourceMaterial = {
            id: crypto.randomUUID(),
            name: file.name,
            content: content,
            type: file.type || 'text/plain',
            updatedAt: Date.now()
          };
          await onAddSource(newSource);
        }
        onNotify(`Successfully ingested ${file.name}`, 'success');
      } catch (err) {
        console.error("Error processing file:", file.name, err);
        onNotify(`Failed to process ${file.name}.`, 'error');
      }
    }
    
    e.target.value = '';
  };

  const scanArtifacts = async () => {
    setLoading(true);
    try {
      onNotify('Scanning manuscript for intelligence gaps...', 'info');
      const fullText = chapters.map(c => c.content).join('\n\n');
      if (!fullText.trim()) {
        onNotify('Manuscript is empty. Provide text for intelligence analysis.', 'info');
        return;
      }
      const needs = await AIService.extractResearchNeeds(fullText, project.type);
      
      if (needs.length > 0) {
        const newTracks = needs.map(topic => ({ topic, priority: 'High' }));
        if (structure) {
          const existingTopics = (structure.researchTracks || []).map((t: any) => t.topic);
          const uniqueNewTracks = newTracks.filter(nt => !existingTopics.includes(nt.topic));
          setStructure({
            ...structure,
            researchTracks: [...(structure.researchTracks || []), ...uniqueNewTracks]
          });
        } else {
          setStructure({ chapters: [], researchTracks: newTracks });
        }
        onNotify(`Analysis complete: ${needs.length} knowledge gaps identified.`, 'success');
      } else {
        onNotify('Current knowledge graph satisfies manuscript requirements.', 'success');
      }
    } catch (e) {
      onNotify('Failed to index manuscript artifacts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const researchSelectedTracks = async () => {
    if (selectedTracks.length === 0) return;
    const tracksToProcess = [...selectedTracks];
    setSelectedTracks([]);
    onNotify(`Starting parallel research on ${tracksToProcess.length} topics...`, 'info');
    
    // Parallel execution
    await Promise.all(tracksToProcess.map(topic => handleDeepResearch(topic)));
  };

  const generateArchitecture = async () => {
    setLoading(true);
    try {
      const data = await AIService.generateNarrativeGraph(project.title, project.genre, project.premise, project.type, research, sourceMaterials);
      setStructure(data);
      onNotify('Narrative Intelligence Graph mapped.', 'success');
    } catch (error) {
      onNotify('Failed to map knowledge graph.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeepResearch = async (topic: string) => {
    if (researchingTracks.includes(topic)) return;
    setResearchingTracks(prev => [...prev, topic]);
    try {
      const context = `Genre focus for project ${project.title}. Premise: ${project.premise}. Type: ${project.type}`;
      const note = await AIService.compileResearch(topic, context, project.type, true);
      await onAddResearch(note);
      onNotify(`Intelligence archived: ${topic}`, 'success');
    } catch (error) {
      onNotify('Research agent failed.', 'error');
    } finally {
      setResearchingTracks(prev => prev.filter(t => t !== topic));
    }
  };

  const synthesize = async () => {
    if (selectedNotes.length === 0) {
      onNotify('Select intelligence markers first.', 'info');
      return;
    }
    setLoading(true);
    try {
      const notesToUse = research.filter(n => selectedNotes.includes(n.id));
      const prompt = `Synthesize the following research data into a coherent, prize-winning section or world-building node. 
        Focus on "sensory subtext": descriptive precision, technical jargon, and social nuances.
        
        RESEARCH DATA:
        ${notesToUse.map(n => `TITLE: ${n.title}\nCONTENT: ${n.content}\nSENSORY: ${JSON.stringify(n.sensoryDetails)}`).join('\n\n')}
        
        Format as a professional manuscript section or world-bible entry.`;
      
      const result = await AIService.callAI({ prompt, model: "gemini-2.5-pro-preview-05-06" });
      setSynthesisResult(result || '');
      setActiveStep('synthesis');
    } catch (error) {
      onNotify('Synthesis failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="h-full overflow-y-auto overscroll-contain custom-scrollbar px-4 pb-32"
      style={{ minHeight: 0 }}
    >
      <div className="max-w-6xl mx-auto py-6 md:py-12 md:px-2">
      <header className="mb-8 md:mb-12">
        <div className="flex items-center gap-2 px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full w-fit mb-4">
          <BrainCircuit size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest">Intelligence Lab Mode</span>
        </div>
        <h1 className="text-2xl md:text-5xl font-black text-text-primary tracking-tighter italic font-serif">Narrative Intelligence Engine</h1>
        <p className="text-text-secondary max-w-2xl mt-2 font-medium text-sm md:text-lg">Forge the factual and sensory foundations of your masterpiece, and ingest third-party source material.</p>
      </header>

      <div className="flex gap-2 md:gap-4 mb-8 p-1 bg-surface-muted rounded-2xl w-full md:w-fit overflow-x-auto custom-scrollbar">
        {(['architecture', 'exploration', 'synthesis', 'archive'] as const).map(step => (
          <button
            key={step}
            onClick={() => setActiveStep(step)}
            className={`px-4 md:px-6 py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-1 md:flex-none ${
              activeStep === step 
                ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {step}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {activeStep === 'architecture' && (
              <motion.div 
                key="arch"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                {!structure ? (
                  <div className="bg-surface-card p-6 md:p-12 rounded-[2rem] md:rounded-[3rem] border border-border-subtle shadow-sm text-center">
                    <div className="w-12 h-12 md:w-16 md:h-16 bg-brand-primary/10 text-brand-primary rounded-3xl flex items-center justify-center mx-auto mb-4 md:mb-6">
                      <ListTree size={28} />
                    </div>
                    <h3 className="text-xl md:text-2xl font-black text-text-primary mb-2 italic font-serif">Map the Knowledge Graph</h3>
                    <p className="text-xs md:text-sm text-text-secondary max-w-md mx-auto mb-6 md:mb-8">
                      The agent will extract the structural and sensory roadmap required to sustain a world-class narrative arc.
                    </p>
                    <button 
                      onClick={generateArchitecture}
                      disabled={loading}
                      className="w-full md:w-auto px-10 py-4 bg-brand-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-accent transition-all flex items-center justify-center gap-3 mx-auto shadow-xl shadow-brand-primary/20"
                    >
                      {loading ? <RefreshCcw className="animate-spin" size={16} /> : <Sparkles size={16} />}
                      Initialize Intelligence Graph
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-surface-card p-8 rounded-[2.5rem] border border-border-subtle">
                      <h4 className="text-xs font-black uppercase tracking-widest text-text-secondary mb-6 flex items-center gap-2">
                        <Database size={14} /> Structural Nodes
                      </h4>
                      <div className="space-y-4">
                        {(structure.nodes || structure.chapters)?.map((ch: any, idx: number) => (
                          <div key={idx} className="p-5 bg-surface-muted rounded-2xl border border-border-subtle hover:border-brand-primary/30 transition-colors group">
                            <div className="text-[10px] font-black text-brand-primary mb-1">NODE {idx + 1}</div>
                            <div className="text-base font-black text-text-primary italic font-serif mb-1 group-hover:text-brand-primary transition-colors">{ch.title}</div>
                            <p className="text-[10px] text-text-secondary leading-relaxed font-medium">{ch.focus}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-black text-white p-8 rounded-[2.5rem] border border-border-subtle flex flex-col h-full">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                          <Globe size={14} /> Research Tracks
                        </h4>
                        {structure.researchTracks?.length > 0 && (
                          <div className="flex gap-3">
                            <button 
                              onClick={() => setSelectedTracks(selectedTracks.length === structure.researchTracks.length ? [] : structure.researchTracks.map((t: any) => t.topic))}
                              className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                            >
                              {selectedTracks.length === structure.researchTracks.length ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 flex-1 pr-1 overflow-y-auto custom-scrollbar">
                        {structure.researchTracks?.map((track: any, idx: number) => {
                          const isResearching = researchingTracks.includes(track.topic);
                          const isSelected = selectedTracks.includes(track.topic);
                          return (
                            <button 
                              key={idx}
                              onClick={() => {
                                if (isResearching) return;
                                setSelectedTracks(prev => isSelected ? prev.filter(t => t !== track.topic) : [...prev, track.topic]);
                              }}
                              className={`w-full text-left p-5 rounded-2xl border transition-all group relative overflow-hidden active:scale-[0.98] ${
                                isSelected 
                                  ? 'bg-brand-primary border-brand-primary shadow-[0_15px_30px_rgba(59,130,246,0.2)]' 
                                  : 'bg-surface-card border-border-subtle hover:border-brand-primary/40'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.4)] transition-all ${isSelected ? 'bg-white scale-125 animate-pulse' : 'bg-brand-primary'}`} />
                                  <span className={`text-xs font-black uppercase tracking-widest transition-colors ${isSelected ? 'text-white' : 'text-text-primary'}`}>{track.topic}</span>
                                </div>
                                {isResearching ? (
                                  <RefreshCcw size={14} className="animate-spin text-white" />
                                ) : (
                                  <ChevronRight size={14} className={`transition-all ${isSelected ? 'opacity-100 text-white' : 'opacity-0 group-hover:opacity-100 text-brand-primary'}`} />
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                                  isSelected 
                                    ? 'bg-white/20 text-white' 
                                    : track.priority === 'High' ? 'bg-brand-primary/20 text-brand-primary' : 'bg-surface-muted text-text-secondary'
                                }`}>
                                  {isResearching ? 'Archiving Intelligence...' : `${track.priority} Priority`}
                                </span>
                              </div>
                              {isResearching && (
                                <motion.div 
                                  layoutId="loading-bar-track"
                                  className="absolute bottom-0 left-0 h-1 bg-white"
                                  initial={{ width: '0%' }}
                                  animate={{ width: '100%' }}
                                  transition={{ duration: 15, ease: "linear" }}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {selectedTracks.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="mt-8 pt-8 border-t border-border-subtle"
                        >
                          <button 
                            onClick={researchSelectedTracks}
                            disabled={loading || researchingTracks.length > 0}
                            className="w-full py-5 bg-brand-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-brand-accent transition-all shadow-2xl shadow-brand-primary/30 flex items-center justify-center gap-3 active:scale-95 group/btn"
                          >
                            <Search size={16} className="group-hover/btn:scale-110 transition-transform" />
                            Deep Research Fragments ({selectedTracks.length})
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeStep === 'exploration' && (
              <motion.div 
                key="explore"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-surface-card p-8 rounded-[3rem] border border-border-subtle space-y-6"
              >
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <h3 className="text-xl font-black italic font-serif text-text-primary">Intelligence Clusters</h3>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setSelectedNotes(research.map(n => n.id))}
                      className="text-[9px] font-black text-text-secondary uppercase tracking-widest hover:text-brand-primary transition-colors"
                    >
                      Select All
                    </button>
                    <button 
                      onClick={() => setSelectedNotes([])}
                      className="text-[9px] font-black text-text-secondary uppercase tracking-widest hover:text-red-500 transition-colors"
                    >
                      Clear
                    </button>
                    <button 
                      onClick={scanArtifacts}
                      disabled={loading}
                      className="text-[10px] font-black text-brand-primary uppercase tracking-widest flex items-center gap-1 hover:text-brand-accent disabled:opacity-50"
                    >
                      <RefreshCcw size={12} className={loading ? 'animate-spin' : ''} /> Analyze Intelligence Gaps
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {research.map(note => {
                    const isSelected = selectedNotes.includes(note.id);
                    return (
                      <button 
                        key={note.id}
                        onClick={() => setSelectedNotes(prev => isSelected ? prev.filter(id => id !== note.id) : [...prev, note.id])}
                        className={`p-6 rounded-2xl border text-left transition-all ${
                          isSelected 
                            ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary/30 shadow-xl shadow-brand-primary/10' 
                            : 'border-border-subtle bg-surface-muted hover:border-text-secondary/30'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`w-2 h-2 rounded-full ${note.isDeepResearch ? 'bg-brand-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-text-secondary/40'} ${isSelected ? 'scale-125' : ''}`} />
                          <h4 className="text-sm font-black text-text-primary truncate flex-1">{note.title}</h4>
                          {isSelected && <Sparkles size={12} className="text-brand-primary animate-pulse" />}
                        </div>
                        <p className="text-[10px] text-text-secondary line-clamp-2 leading-relaxed mb-4 font-medium">{note.content}</p>
                        
                        {note.sensoryDetails && (
                          <div className="flex gap-2 opacity-40">
                             {note.sensoryDetails.visuals && <Eye size={12} />}
                             {note.sensoryDetails.sounds && <Headphones size={12} />}
                             {note.sensoryDetails.smells && <Wind size={12} />}
                             {note.sensoryDetails.textures && <Hand size={12} />}
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {research.length === 0 && (
                    <div className="col-span-1 md:col-span-2 text-center py-10">
                      <p className="text-text-secondary text-sm">No intelligence clusters available. Generate them from the Architecture view.</p>
                    </div>
                  )}
                </div>

                <div className="pt-6 border-t border-border-subtle flex justify-end">
                   <button 
                    onClick={synthesize}
                    disabled={loading || selectedNotes.length === 0}
                    className="px-8 py-3 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-accent transition-all flex items-center gap-2 shadow-lg shadow-brand-primary/20 disabled:opacity-50"
                   >
                     Synthesize Intelligence ({selectedNotes.length}) <ArrowRight size={14} />
                   </button>
                </div>
              </motion.div>
            )}

            {activeStep === 'synthesis' && (
              <motion.div 
                key="synth"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="bg-surface-card p-10 rounded-[3rem] border border-border-subtle shadow-sm min-h-[400px]">
                  <header className="flex flex-col md:flex-row items-center justify-between mb-8 pb-4 border-b border-border-subtle gap-4">
                    <h3 className="text-2xl font-black italic font-serif text-text-primary">Intelligence Synthesis</h3>
                    <div className="flex gap-2">
                       <button 
                        onClick={async () => {
                          if (pushing || !synthesisResult) return;
                          setPushing(true);
                          try {
                            const chapId = crypto.randomUUID();
                            await onAddChapter({
                              id: chapId,
                              title: 'Narrative Synthesis',
                              content: synthesisResult,
                              summary: 'Generated from synthesized intelligence clusters.',
                              order: chapters.length + 1,
                              plotNodeIds: [],
                              tags: ['synthesis'],
                              updatedAt: Date.now()
                            });
                            onNotify('Intelligence added to Writing Studio.', 'success');
                          } catch (e) {
                            onNotify('Failed to integrate synthesis.', 'error');
                          } finally {
                            setPushing(false);
                          }
                        }}
                        disabled={pushing || !synthesisResult}
                        className="px-5 py-2.5 bg-brand-primary/10 text-brand-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-primary/20 transition-all flex items-center gap-2 disabled:opacity-50 border border-brand-primary/20"
                       >
                         {pushing ? <RefreshCcw className="animate-spin" size={12} /> : null}
                         Push to Studio
                       </button>
                       <button 
                        onClick={() => setSynthesisResult('')}
                        className="p-2 text-text-secondary hover:text-text-primary transition-colors"
                       >
                        <RefreshCcw size={18} />
                       </button>
                    </div>
                  </header>
                  <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-headings:font-serif prose-p:text-text-secondary text-text-primary">
                   <Markdown>{synthesisResult || 'Intelligence matrix ready. Select notes in "Exploration" tab to begin synthesis.'}</Markdown>
                  </div>
                </div>
              </motion.div>
            )}

            {activeStep === 'archive' && (
              <motion.div 
                key="archive"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-surface-card p-6 md:p-8 rounded-[3rem] border border-border-subtle space-y-6 min-h-[500px] flex flex-col"
              >
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <h3 className="text-xl font-black italic font-serif text-text-primary">Evidence Archive & Source Ingestion</h3>
                  <div className="flex gap-2">
                    <label className="cursor-pointer px-4 py-2 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-accent transition-all flex items-center gap-2 shadow-lg shadow-brand-primary/20">
                      <Upload size={14} />
                      Ingest Source Files
                      <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt,.md,.json,.yaml,.yml,.pdf" multiple />
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2 bg-surface-muted p-1 rounded-xl w-fit">
                  {['All', 'Research', 'Source'].map(type => (
                    <button
                      key={type}
                      onClick={() => setArchiveFilter(type as any)}
                      className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        archiveFilter === type ? 'bg-surface-card text-brand-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                  <input 
                    value={archiveSearchTerm}
                    onChange={(e) => setArchiveSearchTerm(e.target.value)}
                    placeholder="Search evidence archive..."
                    className="w-full bg-surface-muted border border-border-subtle rounded-xl pl-11 pr-4 py-3 text-sm text-text-primary focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 pt-2 min-h-[500px]">
                  <div className="space-y-3 pr-2 overflow-y-auto custom-scrollbar">
                    {filteredArchive.map(item => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedArchiveItem(item)}
                        className={`w-full text-left p-4 rounded-xl border transition-all relative group flex flex-col gap-2 ${
                          selectedArchiveItem?.id === item.id 
                            ? 'bg-brand-primary/5 border-brand-primary ring-1 ring-brand-primary/20' 
                            : 'bg-surface-muted border-border-subtle hover:border-text-secondary/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-black text-text-primary truncate">{('title' in item ? item.title : item.name)}</h4>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                            item.displayType === 'Source' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'
                          }`}>
                            {item.displayType}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary line-clamp-2">{item.content}</p>
                      </button>
                    ))}
                    {filteredArchive.length === 0 && (
                      <div className="text-center p-8 text-text-secondary">
                        <p className="text-sm font-medium">No items found matching your filters.</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-surface-muted border border-border-subtle rounded-2xl p-6 relative overflow-y-auto custom-scrollbar">
                    {selectedArchiveItem ? (
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-black text-text-primary mb-1">{selectedArchiveItem.title || selectedArchiveItem.name}</h3>
                            <div className="text-[10px] font-bold text-text-secondary tracking-widest uppercase">
                              {selectedArchiveItem.category || selectedArchiveItem.type}
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              if (selectedArchiveItem.displayType === 'Research') {
                                onDeleteResearch(selectedArchiveItem.id);
                              } else {
                                onDeleteSource(selectedArchiveItem.id);
                              }
                              setSelectedArchiveItem(null);
                              onNotify('Item removed from archive.', 'success');
                            }}
                            className="p-2 text-text-secondary hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="prose prose-sm max-w-none prose-p:text-text-secondary">
                          <Markdown>{selectedArchiveItem.content}</Markdown>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-text-secondary opacity-50 space-y-4">
                        <Library size={48} strokeWidth={1} />
                        <p className="text-xs font-medium uppercase tracking-widest">Select an item to view</p>
                      </div>
                    )}
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar / Tips */}
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-brand-primary text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                <Microchip size={120} />
             </div>
             <h4 className="text-xs font-black text-white/70 uppercase tracking-widest mb-4">Neural Strategy</h4>
             <p className="text-sm font-medium leading-relaxed mb-6">
               Authenticity is born from <b>granularity</b>. Use the Intelligence Engine to extract exact specifications, historical textures, and social artifacts. Ingest third-party materials in the Archive.
             </p>
             <div className="space-y-4">
                <div className="flex items-start gap-4">
                   <div className="p-2 bg-white/10 rounded-xl"><Layers size={14} /></div>
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-tight text-white">Layered Evidence</p>
                     <p className="text-[9px] text-white/60 font-medium">Merge technical specifications with sensory eyewitness context.</p>
                   </div>
                </div>
                <div className="flex items-start gap-4">
                   <div className="p-2 bg-white/10 rounded-xl"><Database size={14} /></div>
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-tight text-white">Truth Logic</p>
                     <p className="text-[9px] text-white/60 font-medium">Verify through the global Knowledge Graph (Google AI Support) or your uploaded material.</p>
                   </div>
                </div>
             </div>
           </div>

           <div className="p-6 bg-surface-card border border-border-subtle rounded-[2.5rem]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-4 px-2 tracking-[0.2em]">Intelligence Pulse</h4>
              <div className="space-y-2">
                 <div className="flex items-center justify-between p-3.5 bg-surface-muted rounded-xl text-[9px] font-bold border border-border-subtle/50">
                    <span className="text-text-secondary">Knowledge Clusters</span>
                    <span className="text-text-primary px-2 py-0.5 bg-brand-primary/20 rounded-md">{research.length}</span>
                 </div>
                 <div className="flex items-center justify-between p-3.5 bg-surface-muted rounded-xl text-[9px] font-bold border border-border-subtle/50">
                    <span className="text-text-secondary">Source Materials</span>
                    <span className="text-text-primary px-2 py-0.5 bg-brand-primary/20 rounded-md">
                      {sourceMaterials.length}
                    </span>
                 </div>
                 <div className="flex items-center justify-between p-3.5 bg-surface-muted rounded-xl text-[9px] font-bold border border-border-subtle/50">
                    <span className="text-text-secondary">Synthesis Rank</span>
                    <span className="text-brand-primary">MASTER</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
      </div>
    </div>
  );
}
