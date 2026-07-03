/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Users, GitBranch, PenTool, Sparkles, FileText, BookOpen, Book, Layers, Save, Trash2, Trophy, Target, Plus, ChevronDown, Activity } from 'lucide-react';
import { Project, Chapter, ViewType, ProjectType, MaturityLevel } from '../types';
import DraftStagePanel from './DraftStagePanel';
import { motion, AnimatePresence } from 'motion/react';
import { PROJECT_TYPES, MATURITY_LEVELS, GENRES, TONES } from '../constants';

interface Props {
  project: Project;
  projects: Project[];
  chapters: Chapter[];
  selectProject: (project: Project) => void;
  createNewProject: (title?: string) => void;
  updateProject: (updates: Partial<Project>) => void;
  setView: (view: ViewType) => void;
  deleteProject: () => void;
  saveToCloud: () => void;
  isSaving: boolean;
}

export default function Dashboard({ 
  project, 
  projects, 
  chapters,
  selectProject, 
  createNewProject, 
  updateProject, 
  setView, 
  deleteProject, 
  saveToCloud, 
  isSaving 
}: Props) {
  const [localPremise, setLocalPremise] = useState(project.premise);
  const [localTitle, setLocalTitle] = useState(project.title);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);

  const updateProjectRef = useRef(updateProject);
  useEffect(() => {
    updateProjectRef.current = updateProject;
  }, [updateProject]);

  useEffect(() => {
    setLocalTitle(project.title);
    setLocalPremise(project.premise);
  }, [project.id]);

  // Debounced update for premise
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localPremise !== project.premise) {
        updateProjectRef.current({ premise: localPremise });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localPremise, project.premise]);

  // Debounced update for title
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localTitle !== project.title) {
        updateProjectRef.current({ title: localTitle });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localTitle, project.title]);

  const stats = [
    { label: 'Personnel Profiles', value: project.characters?.length || 0, icon: Users, color: 'text-brand-primary', bgColor: 'bg-brand-primary/10', view: 'characters' },
    { label: 'Narrative Vectors', value: project.plotNodes?.length || 0, icon: GitBranch, color: 'text-brand-primary', bgColor: 'bg-brand-primary/10', view: 'plot' },
    { label: 'Coded Segments', value: project.chapters?.length || 0, icon: Book, color: 'text-brand-primary', bgColor: 'bg-brand-primary/10', view: 'writing' },
    { 
      label: project.targetWordCount ? `${Math.round(((project.stats?.totalWords || 0) / project.targetWordCount) * 100)}% Synchronized` : 'Target Offline', 
      value: project.stats?.totalWords || 0, 
      icon: Target, 
      color: 'text-brand-primary', 
      bgColor: 'bg-brand-primary/10', 
      view: 'writing' 
    },
  ];

  return (
    <div className="h-full overflow-y-auto overscroll-contain custom-scrollbar" style={{ minHeight: 0 }}>
      <div className="max-w-7xl mx-auto space-y-12 pb-32 px-4 md:px-8">
      {/* Target Prize Banner */}
      {project.targetPrize && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setView('prizes')}
          className="bg-brand-primary text-white p-1 rounded-[2.5rem] shadow-2xl shadow-brand-primary/30 group cursor-pointer relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-brand-accent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="bg-brand-dark/20 backdrop-blur-md rounded-[2.4rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10 border border-white/10">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform">
                <Trophy size={28} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/60 mb-1">Strategic Objective</span>
                <span className="text-xl md:text-2xl font-black italic font-serif leading-tight">{project.targetPrize}</span>
              </div>
            </div>
            <div className="flex items-center gap-8 w-full md:w-auto">
               <div className="flex flex-col items-end flex-1 md:flex-initial">
                 <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50 mb-2">Eligibility Matrix</span>
                 <div className="h-2 w-full md:w-64 bg-white/10 rounded-full overflow-hidden border border-white/5 p-0.5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${project.prizeAssessments?.find(a => a.prizeName === project.targetPrize)?.eligibilityScore || 0}%` }}
                    className="h-full bg-white transition-all duration-1000 shadow-[0_0_15px_#fff] rounded-full" 
                  />
                 </div>
               </div>
              <div className="p-4 bg-white text-brand-primary rounded-2xl shadow-xl animate-pulse">
                <Target size={24} />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 md:gap-12 border-b border-border-subtle pb-12 md:pb-16 relative">
        <div className="flex-1 space-y-4 md:space-y-6">
          <div className="flex items-center gap-4">
            <span className="text-[9px] md:text-[10px] font-black text-brand-primary uppercase tracking-[0.4em] md:tracking-[0.5em] bg-brand-primary/10 border border-brand-primary/20 px-4 md:px-5 py-1.5 md:py-2 rounded-xl md:rounded-2xl flex items-center gap-3">
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-brand-primary animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
              Intelligence Vector
            </span>
            <span className="text-[8px] md:text-[9px] font-black text-text-secondary uppercase tracking-widest opacity-30 italic">Rev: {project.stats?.revCount || 1}</span>
          </div>
          <div className="relative group">
            <input 
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-black text-text-primary tracking-tighter italic font-serif bg-transparent border-none focus:ring-0 p-0 w-full leading-tight md:leading-none hover:text-brand-primary transition-all cursor-text placeholder:opacity-10"
              placeholder="Define Narrative..."
            />
            <div className="absolute -bottom-2 left-0 w-24 h-1 bg-brand-primary opacity-20 group-focus-within:w-full group-focus-within:opacity-100 transition-all duration-700" />
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 md:gap-4 items-center bg-surface-card p-3 md:p-4 rounded-[1.5rem] md:rounded-[2.5rem] border border-border-subtle shadow-[0_30px_60px_rgba(0,0,0,0.4)] relative z-20">
           <div className="flex items-center gap-2 md:gap-3 border-r border-border-subtle pr-3 md:pr-5 mr-1 group/sel">
              <Layers className="text-text-secondary group-hover/sel:text-brand-primary transition-colors h-4 w-4 md:h-5 md:w-5" />
              <select 
                value={project.type}
                onChange={(e) => updateProject({ type: e.target.value as ProjectType })}
                className="bg-transparent text-[9px] md:text-[11px] font-black text-text-primary outline-none py-1 md:py-2 uppercase tracking-[0.1em] md:tracking-[0.2em] cursor-pointer hover:text-brand-primary transition-colors appearance-none min-w-[100px] md:min-w-[120px]"
              >
                {PROJECT_TYPES.map(t => <option key={t.value} value={t.value} className="bg-brand-dark">{t.label}</option>)}
              </select>
           </div>

           <div className="flex items-center gap-2 md:gap-3 sm:border-r border-border-subtle sm:pr-3 md:pr-5 sm:mr-1 group/sel">
              <BookOpen className="text-text-secondary group-hover/sel:text-brand-primary transition-colors h-4 w-4 md:h-5 md:w-5" />
              <select 
                value={project.genre}
                onChange={(e) => updateProject({ genre: e.target.value })}
                className="bg-transparent text-[9px] md:text-[11px] font-black text-text-primary outline-none py-1 md:py-2 uppercase tracking-[0.1em] md:tracking-[0.2em] cursor-pointer hover:text-brand-primary transition-colors max-w-[140px] md:max-w-[160px] appearance-none"
              >
                <option value="" className="bg-brand-dark">Unset Genre</option>
                {GENRES.map(g => <option key={g} value={g} className="bg-brand-dark">{g}</option>)}
              </select>
           </div>

           <div className="flex items-center gap-2 md:gap-3 border-r border-border-subtle pr-3 md:pr-5 mr-1 group/sel hidden sm:flex">
              <Sparkles className="text-text-secondary group-hover/sel:text-brand-primary transition-colors h-4 w-4 md:h-5 md:w-5" />
              <select 
                value={project.tone}
                onChange={(e) => updateProject({ tone: e.target.value })}
                className="bg-transparent text-[9px] md:text-[11px] font-black text-text-primary outline-none py-1 md:py-2 uppercase tracking-[0.1em] md:tracking-[0.2em] cursor-pointer hover:text-brand-primary transition-colors max-w-[140px] md:max-w-[160px] appearance-none"
              >
                <option value="" className="bg-brand-dark">Unset Tone</option>
                {TONES.map(t => <option key={t} value={t} className="bg-brand-dark">{t}</option>)}
              </select>
           </div>

           <div className="flex items-center gap-2 md:gap-4 border-r border-border-subtle pr-4 md:pr-8 mr-1 px-2 md:px-4">
              {MATURITY_LEVELS.map((lvl) => (
                <button
                  key={lvl.value}
                  onClick={() => updateProject({ maturity: lvl.value })}
                  title={`${lvl.label} Protocol`}
                  className={`p-2 md:p-3 rounded-lg md:rounded-2xl transition-all relative group/maturity ${
                    project.maturity === lvl.value 
                      ? `bg-brand-primary text-white shadow-2xl shadow-brand-primary/30 scale-110` 
                      : 'bg-surface-muted text-text-secondary hover:text-brand-primary grayscale opacity-30 hover:opacity-100 hover:grayscale-0'
                  }`}
                >
                  <lvl.icon size={16} className="md:w-5 md:h-5" />
                  {project.maturity === lvl.value && (
                    <motion.div layoutId="maturity-glow" className="absolute inset-0 bg-white/20 rounded-lg md:rounded-2xl blur-md" />
                  )}
                </button>
              ))}
           </div>

           <div className="flex items-center gap-4 pr-2">
              <button 
                onClick={saveToCloud}
                className={`p-4 rounded-2xl transition-all shadow-xl active:scale-95 border ${isSaving ? 'bg-brand-primary border-brand-primary text-white shadow-brand-primary/20' : 'bg-surface-muted border-border-subtle text-text-secondary hover:text-brand-primary hover:border-brand-primary/40'}`}
                title="Sync Intent"
              >
                {isSaving ? <Activity size={22} className="animate-spin" /> : <Save size={22} />}
              </button>
              <button 
                onClick={deleteProject}
                className="p-4 bg-surface-muted text-text-secondary hover:text-red-500 hover:bg-red-500/10 border border-border-subtle hover:border-red-500/30 rounded-2xl transition-all active:scale-95"
                title="Purge Artifact"
              >
                <Trash2 size={22} />
              </button>
           </div>
        </div>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
        {stats.map((stat, i) => (
          <motion.button
            key={stat.label}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
            onClick={() => setView(stat.view as ViewType)}
            className="p-6 md:p-8 bg-surface-card border border-border-subtle rounded-[2rem] md:rounded-[2.5rem] flex flex-col items-start gap-4 md:gap-6 hover:border-brand-primary/50 hover:shadow-[0_20px_50px_rgba(0,0,0,0.4)] transition-all group text-left relative overflow-hidden active:scale-[0.98]"
          >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-opacity">
               <stat.icon size={80} />
            </div>
            <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl bg-surface-muted text-text-secondary group-hover:bg-brand-primary group-hover:text-white transition-all duration-500 shadow-sm`}>
              <stat.icon className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl md:text-4xl font-black text-text-primary leading-none mb-2 tabular-nums">{stat.value.toLocaleString()}</div>
              <div className="text-[9px] md:text-[10px] text-text-secondary font-black uppercase tracking-[0.2em] leading-none opacity-60 group-hover:opacity-100 transition-opacity">{stat.label}</div>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10">
        {/* Premise Editor */}
        <section className="md:col-span-12 p-6 md:p-10 bg-surface-card border border-border-subtle rounded-[2rem] md:rounded-[3rem] space-y-6 shadow-2xl group transition-all hover:border-brand-primary/30">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-brand-primary flex items-center gap-3 uppercase tracking-[0.3em]">
              <FileText size={18} />
              Strategic Narrative Focus
            </h3>
            <span className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] opacity-40">Artifact ID: {project.id.slice(-8)}</span>
          </div>
          <textarea
            value={localPremise}
            onChange={(e) => setLocalPremise(e.target.value)}
            placeholder="Define the primary intelligence vector for this narrative..."
            className="w-full h-40 bg-surface-muted border border-border-subtle rounded-2xl p-8 text-text-primary focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary focus:bg-surface-card resize-none transition-all outline-none leading-relaxed text-xl md:text-2xl font-serif italic placeholder:opacity-30"
          />
        </section>

        {/* Word Count Strategy */}
        <section className="md:col-span-12 p-6 md:p-12 bg-brand-dark rounded-[2rem] md:rounded-[3.5rem] text-text-primary space-y-6 md:space-y-10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] border border-border-subtle relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-16 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-1000 grayscale">
             <Target size={240} />
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
            <div>
              <div className="text-[10px] font-black text-brand-primary uppercase tracking-[0.4em] mb-4">Volume of Intent</div>
              <h3 className="text-3xl md:text-4xl font-black italic font-serif tracking-tight leading-none">Architectural Density</h3>
            </div>
            <div className="text-right">
              <div className="text-4xl md:text-6xl font-black italic font-serif text-brand-primary leading-none mb-3 tabular-nums drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                {project.stats?.totalWords?.toLocaleString() || 0} <span className="text-text-secondary/40 text-2xl md:text-3xl font-normal not-italic mx-2">/</span> {project.targetWordCount?.toLocaleString() || '∞'}
              </div>
              <div className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] opacity-60">Synthesized Words</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 relative z-10">
            {[1000, 5000, 20000, 50000, 80000, 100000].map(count => (
              <button 
                key={count}
                onClick={() => updateProject({ targetWordCount: count })}
                className={`py-4 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  project.targetWordCount === count 
                    ? 'bg-brand-primary border-brand-primary text-white shadow-2xl shadow-brand-primary/40 scale-105' 
                    : 'bg-white/5 border-white/5 text-text-secondary hover:bg-white/10 hover:border-white/20 hover:text-text-primary'
                }`}
              >
                {count >= 1000 ? `${count/1000}k` : count} Units
              </button>
            ))}
            <div className="col-span-1">
              <input 
                type="number"
                placeholder="Custom..."
                value={![1000, 5000, 20000, 50000, 80000, 100000].includes(project.targetWordCount ?? 0) && project.targetWordCount ? project.targetWordCount : ''}
                className="w-full py-4 px-6 bg-white/5 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-text-primary outline-none focus:border-brand-primary focus:bg-white/10 transition-all placeholder:text-text-secondary/30"
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (val > 0) updateProject({ targetWordCount: val });
                }}
              />
            </div>
          </div>

          {project.targetWordCount && (
            <div className="relative pt-6 z-10">
              <div className="h-6 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-1">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, ((project.stats?.totalWords || 0) / project.targetWordCount) * 100)}%` }}
                  className="h-full bg-brand-primary relative rounded-full shadow-[0_0_20px_rgba(59,130,246,0.6)]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/30 animate-shimmer" />
                </motion.div>
              </div>
              <div className="mt-4 flex justify-between items-center text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary">
                <span>Vector Star: 0</span>
                <span className="text-brand-primary bg-brand-primary/10 px-3 py-1 rounded-md border border-brand-primary/20">
                  {Math.round(((project.stats?.totalWords || 0) / project.targetWordCount) * 100)}% Synchronized
                </span>
                <span>Limit: {project.targetWordCount.toLocaleString()}</span>
              </div>
            </div>
          )}
        </section>

        {/* Draft Stage Panel */}
        <section className="md:col-span-12">
          <DraftStagePanel project={project} chapters={chapters} updateProject={updateProject} />
        </section>

      </div>
      </div>
    </div>
  );
}
