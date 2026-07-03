/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Shield, Target, ScrollText, Flame, Zap, UserCircle, Activity, Camera, RefreshCcw, ChevronLeft } from 'lucide-react';
import { Project, Character, ResearchNote, Chapter } from '../types';
import { AIService } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  project: Project;
  research: ResearchNote[];
  chapters?: Chapter[];
  updateProject: (updates: Partial<Project>) => void;
  updateCharacters?: (chars: Character[]) => void;
  onDeduplicateCharacters?: () => Promise<void>;
  onError?: (msg: string) => void;
}

export default function CharacterForge({ project, research, chapters = [], updateProject, updateCharacters, onDeduplicateCharacters, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState(false);
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [newCharConcept, setNewCharConcept] = useState('');
  const [archetype, setArchetype] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const updateCharacter = (id: string, updates: Partial<Character>) => {
    const chars = project.characters || [];
    const newChars = chars.map(c => c.id === id ? { ...c, ...updates } : c);
    
    if (updateCharacters) {
      updateCharacters(newChars);
    } else {
      updateProject({ characters: newChars });
    }
    
    if (selectedChar?.id === id) {
      setSelectedChar({ ...selectedChar, ...updates });
    }
  };

  const handleGeneratePortrait = async () => {
    if (!selectedChar) return;
    setIsGeneratingPortrait(true);
    try {
      onError?.("Visual DNA synthesis in progress. Connecting to Narrative Lattice...");
      
      // Use physical description from character if available, but for now we generate it along the way
      // Actually, let's just use the name and role if we don't have a specific description
      const portraitUrl = await AIService.synthesizePortrait(
        `${selectedChar.name}, ${selectedChar.role}. ${selectedChar.physicalDescription || selectedChar.backstory}`,
        selectedChar.archetype || selectedChar.role
      );
      
      updateCharacter(selectedChar.id, { avatarUrl: portraitUrl });
      onError?.("Personnel record updated with biometric visual trace.");
    } catch (err: any) {
      console.error(err);
      onError?.("Visual synthesis failed: " + (err.message || "Unknown error"));
    } finally {
      setIsGeneratingPortrait(false);
    }
  };

  const handleGenerate = async () => {
    if (!newCharConcept) return;
    setLoading(true);
    try {
      const char = await AIService.generateCharacter(newCharConcept, project.type, research, project.maturity);
      const newChars = [...(project.characters || []), char];
      
      if (updateCharacters) {
        updateCharacters(newChars);
      } else {
        updateProject({ characters: newChars });
      }
      
      setNewCharConcept('');
      setArchetype('');
      setSelectedChar(char);
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Character generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleExtract = async () => {
    if (!chapters.length) return;
    setExtracting(true);
    try {
      const extracted = await AIService.extractCharacters(chapters, project);
      if (extracted.length === 0) {
        onError?.("No new characters detected in current manuscript.");
        return;
      }
      
      const newChars = [...(project.characters || []), ...extracted];
      if (updateCharacters) {
        updateCharacters(newChars);
      } else {
        updateProject({ characters: newChars });
      }
      
      if (!selectedChar && extracted.length > 0) {
        setSelectedChar(extracted[0]);
      }
    } catch (err: any) {
      console.error(err);
      onError?.(err.message || 'Character extraction failed.');
    } finally {
      setExtracting(false);
    }
  };

  const deleteCharacter = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    updateProject({
      characters: (project.characters || []).filter(c => c.id !== id)
    });
    if (selectedChar?.id === id) setSelectedChar(null);
  };

  const handleCharSelect = (char: Character) => {
    setSelectedChar(char);
    if (isMobile) setShowMobileDetail(true);
  };

  return (
    <div 
      className="h-full flex flex-col min-h-0 px-4 pb-10"
    >
      <div className="flex-1 min-h-0 max-w-7xl w-full mx-auto py-6 md:py-12 md:px-2 flex flex-col md:flex-row gap-10">
      {/* Left List - hidden on mobile when detail is shown */}
      <div className={`w-full md:w-[400px] flex flex-col gap-8 shrink-0 md:pr-10 md:overflow-y-auto md:custom-scrollbar ${isMobile && showMobileDetail ? 'hidden' : 'flex'}`}>
        <header className="text-center md:text-left bg-surface-card p-8 rounded-[2.5rem] border border-border-subtle shadow-2xl">
          <div className="flex items-center gap-3 mb-2 justify-center md:justify-start">
             <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
             <h2 className="text-2xl md:text-3xl font-black tracking-tight text-text-primary italic font-serif">Character Forge</h2>
          </div>
          <p className="text-[10px] text-text-secondary font-black uppercase tracking-[0.4em] opacity-40">Personnel Profile Encryption & Architecture</p>
        </header>

        <div className="flex flex-col gap-6 bg-brand-dark p-8 rounded-[3rem] border border-border-subtle shadow-xl">
          <button 
            onClick={handleExtract}
            disabled={extracting || !chapters.some(c => c.content)}
            className="w-full py-5 bg-brand-primary text-white rounded-2xl disabled:opacity-30 transition-all shadow-[0_15px_40px_rgba(59,130,246,0.3)] flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] active:scale-95"
          >
            {extracting ? (
              <Activity size={16} className="animate-spin" />
            ) : <Plus size={16} />}
            Absorb from Archives
          </button>

          {onDeduplicateCharacters && (
            <button
              onClick={onDeduplicateCharacters}
              className="w-full py-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded-2xl transition-all hover:bg-red-900/40 flex items-center justify-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] active:scale-95"
            >
              <Trash2 size={13} />
              Purge Duplicate Personnel
            </button>
          )}

          <div className="space-y-3 pt-4 border-t border-border-subtle/30">
            <div className="relative">
              <input 
                value={newCharConcept}
                onChange={(e) => setNewCharConcept(e.target.value)}
                placeholder="Core Profile Concept..."
                className="w-full bg-surface-card border border-border-subtle rounded-2xl px-6 py-4 text-sm text-text-primary focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all outline-none shadow-inner placeholder:italic placeholder:text-text-secondary/20 font-serif"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20">
                <Shield size={16} className="text-text-secondary" />
              </div>
            </div>
            <input 
              value={archetype}
              onChange={(e) => setArchetype(e.target.value)}
              placeholder="Operational Archetype (Optional)"
              className="w-full bg-surface-card border border-border-subtle rounded-2xl px-6 py-3 text-xs text-text-primary focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all outline-none shadow-inner placeholder:italic placeholder:text-text-secondary/20 font-serif"
            />
            <button 
              onClick={handleGenerate}
              disabled={loading || !newCharConcept}
              className="w-full py-4 bg-brand-primary/10 border border-brand-primary/30 text-brand-primary rounded-2xl disabled:opacity-30 transition-all hover:bg-brand-primary/20 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] active:scale-95"
            >
              {loading ? (
                <Activity size={16} className="animate-spin" />
              ) : <Zap size={16} className="fill-current" />}
              Initialize Profile
            </button>
          </div>

                <div className="space-y-3 pr-2 mt-6">
            {(project.characters || []).map((char) => (
              <motion.button
                layout
                key={char.id}
                onClick={() => handleCharSelect(char)}
                className={`w-full group p-5 rounded-[1.5rem] border transition-all duration-300 flex items-center justify-between ${
                  selectedChar?.id === char.id 
                    ? 'bg-brand-primary border-brand-primary text-white shadow-[0_15px_30px_rgba(59,130,246,0.3)]' 
                    : 'bg-surface-card border-border-subtle text-text-secondary hover:border-text-secondary/30'
                }`}
              >
                <div className="flex items-center gap-4">
                  {char.avatarUrl ? (
                    <img 
                      src={char.avatarUrl} 
                      alt={char.name} 
                      className="w-10 h-10 rounded-xl object-cover grayscale brightness-75 group-hover:grayscale-0 transition-all shadow-inner"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-all ${
                      selectedChar?.id === char.id ? 'bg-white text-brand-primary shadow-inner scale-110' : 'bg-brand-dark group-hover:bg-brand-primary/10 text-text-secondary group-hover:text-brand-primary'
                    }`}>
                      {char.name.charAt(0)}
                    </div>
                  )}
                  <div className="text-left">
                    <div className={`font-black text-sm truncate w-32 font-serif italic ${selectedChar?.id === char.id ? 'text-white' : 'text-text-primary group-hover:text-brand-primary'}`}>{char.name}</div>
                    <div className={`text-[8px] uppercase tracking-[0.3em] font-black opacity-50 ${selectedChar?.id === char.id ? 'text-white/70' : 'text-text-secondary'}`}>{char.role}</div>
                  </div>
                </div>
                <button 
                  onClick={(e) => deleteCharacter(char.id, e)}
                  className={`p-2 transition-all opacity-0 group-hover:opacity-100 ${selectedChar?.id === char.id ? 'text-white/40 hover:text-white' : 'text-text-secondary hover:text-brand-primary'}`}
                >
                  <Trash2 size={16} />
                </button>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Detail - full screen on mobile when character selected */}
      <div className={`flex-1 min-h-0 bg-brand-dark border border-border-subtle rounded-[4rem] overflow-y-auto custom-scrollbar flex flex-col shadow-2xl relative ${isMobile && !showMobileDetail ? 'hidden' : ''}`}>
        {/* Mobile back button */}
        {isMobile && showMobileDetail && (
          <button
            onClick={() => setShowMobileDetail(false)}
            className="sticky top-4 left-4 z-20 flex items-center gap-2 px-4 py-2 bg-surface-card border border-border-subtle rounded-2xl text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-brand-primary transition-all m-4 self-start"
          >
            <ChevronLeft size={14} />
            Back to List
          </button>
        )}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] grayscale pointer-events-none" />
        <AnimatePresence mode="wait">
          {selectedChar ? (
            <motion.div 
              key={selectedChar.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8 md:p-16 space-y-16 flex-1 relative z-10"
            >
              <header className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8 border-b border-border-subtle pb-12">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                  <div className="relative group/avatar">
                    <div className="w-32 h-32 md:w-48 md:h-48 bg-surface-card rounded-[3rem] border border-border-subtle overflow-hidden flex items-center justify-center shadow-2xl">
                      {selectedChar.avatarUrl ? (
                        <img 
                          src={selectedChar.avatarUrl} 
                          alt={selectedChar.name} 
                          className="w-full h-full object-cover grayscale brightness-90 group-hover/avatar:grayscale-0 group-hover/avatar:scale-110 transition-all duration-700" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <UserCircle size={80} strokeWidth={0.5} className="text-text-secondary opacity-10" />
                      )}
                    </div>
                    <button 
                      onClick={handleGeneratePortrait}
                      disabled={isGeneratingPortrait}
                      className="absolute -bottom-4 -right-4 p-4 bg-brand-primary text-white rounded-2xl shadow-xl shadow-brand-primary/40 hover:scale-110 active:scale-95 transition-all z-20 group/btn"
                    >
                      {isGeneratingPortrait ? <Activity size={20} className="animate-spin" /> : <Camera size={20} />}
                      <span className="absolute left-full ml-4 whitespace-nowrap bg-surface-card border border-border-subtle text-text-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest opacity-0 group-hover/btn:opacity-100 transition-all pointer-events-none shadow-2xl">
                        Synthesize Visual DNA
                      </span>
                    </button>
                  </div>

                  <div className="text-center md:text-left">
                    <h3 className="text-3xl md:text-5xl font-black tracking-tight text-text-primary mb-4 italic font-serif">{selectedChar.name}</h3>
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <div className="flex items-center gap-3 px-5 py-2 bg-brand-primary/10 border border-brand-primary/20 rounded-2xl">
                         <Shield size={18} className="text-brand-primary" />
                         <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-primary ">{selectedChar.role}</span>
                      </div>
                      {selectedChar.archetype && (
                         <div className="flex items-center gap-3 px-5 py-2 bg-surface-card border border-border-subtle rounded-2xl">
                            <UserCircle size={16} className="text-text-secondary opacity-40" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary">{selectedChar.archetype}</span>
                         </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 max-w-[400px] justify-center md:justify-end">
                  {(selectedChar.traits || []).slice(0, 5).map(trait => (
                    <span key={trait} className="px-4 py-2 bg-surface-card border border-border-subtle rounded-xl text-[9px] font-black text-text-secondary uppercase tracking-[0.2em] shadow-lg">{trait}</span>
                  ))}
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
                <div className="space-y-16">
                  <section className="space-y-6">
                    <h4 className="text-[10px] font-black text-brand-primary flex items-center gap-3 uppercase tracking-[0.4em]">
                      <ScrollText size={18} className="text-brand-primary" />
                      Personnel Bio-Archives
                    </h4>
                    <p className="text-text-secondary/90 leading-[2] text-xl font-serif italic border-l-2 border-brand-primary/20 pl-8">
                      {selectedChar.backstory}
                    </p>
                    {selectedChar.physicalDescription && (
                      <div className="mt-8 p-6 bg-surface-card border border-border-subtle rounded-[2rem] shadow-inner">
                         <p className="text-[8px] font-black uppercase tracking-widest text-text-secondary mb-3 opacity-50">Biometric Physical Trace</p>
                         <p className="text-sm text-text-primary/80 leading-relaxed italic font-serif">"{selectedChar.physicalDescription}"</p>
                      </div>
                    )}
                  </section>

                  <section className="space-y-6">
                    <h4 className="text-[10px] font-black text-amber-500 flex items-center gap-3 uppercase tracking-[0.4em]">
                      <Flame size={18} className="text-amber-500" />
                      Instabilities & Divergence
                    </h4>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <p className="text-[9px] font-black text-text-secondary uppercase tracking-widest opacity-40">Psychological Fractures</p>
                        <div className="space-y-3">
                          {(selectedChar.fears || []).map((fear, i) => (
                             <div key={i} className="text-xs text-text-secondary/80 leading-relaxed flex items-start gap-2 italic">
                               <div className="w-1 h-1 rounded-full bg-amber-500 mt-2 shrink-0" />
                               {fear}
                             </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <p className="text-[9px] font-black text-text-secondary uppercase tracking-widest opacity-40">Behavioral Anomalies</p>
                        <div className="space-y-3">
                          {(selectedChar.quirks || []).map((quirk, i) => (
                             <div key={i} className="text-xs text-text-secondary/80 leading-relaxed flex items-start gap-2 italic">
                               <div className="w-1 h-1 rounded-full bg-text-secondary/30 mt-2 shrink-0" />
                               {quirk}
                             </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="space-y-16">
                  <section className="space-y-6">
                    <h4 className="text-[10px] font-black text-indigo-500 flex items-center gap-3 uppercase tracking-[0.4em]">
                      <Target size={18} className="text-indigo-500" />
                      Synchronicity & Momentum
                    </h4>
                    <div className="space-y-6">
                      <div className="p-8 bg-surface-card border border-border-subtle rounded-[2.5rem] shadow-2xl relative group">
                        <div className="absolute top-4 right-4 opacity-5 group-hover:opacity-10 transition-opacity">
                          <Target size={40} className="text-indigo-500" />
                        </div>
                        <p className="text-[9px] font-black text-text-secondary uppercase tracking-widest opacity-40 mb-4">Core Operational Drivers</p>
                        <ul className="space-y-4">
                          {(selectedChar.motivations || []).map((m, i) => (
                             <li key={i} className="text-xs text-text-primary/90 flex items-center gap-3 font-serif italic">
                               <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                               {m}
                             </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-8 bg-brand-primary/5 border border-brand-primary/20 rounded-[2.5rem] shadow-inner">
                        <p className="text-[9px] font-black text-brand-primary uppercase tracking-widest opacity-60 mb-4">Primary Strategic Objectives</p>
                        <ul className="space-y-4">
                          {(selectedChar.goals || []).map((goal, i) => (
                            <li key={i} className="text-xs text-brand-primary/90 font-black italic flex items-center gap-3 uppercase tracking-wider">
                               <div className="w-4 h-px bg-brand-primary/30" />
                               {goal}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-20 relative">
              <div className="absolute inset-0 bg-brand-primary/5 blur-[150px] rounded-full" />
              {loading ? (
                <div className="flex flex-col items-center gap-10 relative z-10">
                   <div className="relative">
                      <motion.div 
                        animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.3, 0.1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-0 bg-brand-primary rounded-full blur-2xl" 
                      />
                      <Activity size={64} className="text-brand-primary animate-pulse relative z-10" />
                   </div>
                   <p className="text-[10px] font-black text-brand-primary uppercase tracking-[0.5em] animate-shimmer italic">Synthesizing Biological Profile...</p>
                </div>
              ) : (
                <div className="relative z-10 flex flex-col items-center gap-10">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-text-secondary rounded-full blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity" />
                    <Users size={120} strokeWidth={0.5} className="text-text-secondary opacity-10 relative z-10" />
                  </div>
                  <div className="max-w-xs space-y-4">
                    <p className="text-2xl font-black text-text-primary italic font-serif">Biological Registry Offline</p>
                    <p className="text-[10px] text-text-secondary font-black uppercase tracking-[0.3em] opacity-40 leading-relaxed italic">Select or initialize a core شخصیت from the operational forge to begin personnel encryption.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
      </div>
    </div>
  );
}
