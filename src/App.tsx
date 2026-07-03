/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  GitBranch, 
  PenTool, 
  Sparkles, 
  BarChart3,
  Library,
  LogOut,
  LogIn,
  Globe,
  Zap,
  RotateCcw,
  RotateCw,
  Save,
  Trash2,
  Construction,
  Settings,
  Trophy,
  X,
  BrainCircuit,
  Menu,
  MessageSquare,
  Upload,
  Activity,
  ChevronDown,
  Plus,
  Scissors
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
import { 
  Project, 
  ViewType, 
  Character, 
  PlotNode, 
  Chapter, 
  ResearchNote, 
  SourceMaterial,
  Presence,
  ExternalReview
} from './types';
import { auth, db, loginWithGoogle, logout, onAuthStateChanged } from './lib/firebase';
import { handleFirestoreError, OperationType } from './lib/firestoreUtils';
// Firebase/Firestore replaced with localStorage stubs for offline preview
import { lsGet, lsSet, lsDel, lsGetCollection, lsUpsertDoc, lsDeleteDoc, lsDeleteCollection } from './lib/localStore';
const serverTimestamp = () => Date.now();
const doc = (..._args: any[]) => ({});
const collection = (..._args: any[]) => ({});
const setDoc = async (..._args: any[]) => {};
const updateDoc = async (..._args: any[]) => {};
const deleteDoc = async (..._args: any[]) => {};
const writeBatch = (_db: any) => ({
  set: (..._a: any[]) => {},
  delete: (..._a: any[]) => {},
  commit: async () => {},
});
const onSnapshot = (_ref: any, cb: any, _err?: any) => { return () => {}; };
const query = (..._args: any[]) => ({});
const where = (..._args: any[]) => ({});
const orderBy = (..._args: any[]) => ({});
const getDocs = async (_ref: any) => ({ docs: [], size: 0 });

// Services
import { AIService } from './services/ai';

// Components
import Dashboard from './components/Dashboard';
import Brainstorm from './components/Brainstorm';
import CharacterForge from './components/CharacterForge';
import PlotArchitect from './components/PlotArchitect';
import WritingStudio from './components/WritingStudio';
import LibraryView from './components/Library';
import IntelligenceLab from './components/IntelligenceLab';
import CriticSwarm from './components/CriticSwarm';
import ManuscriptFixer from './components/ManuscriptFixer';
import SettingsView from './components/SettingsView';
import PublishView from './components/PublishView';
import PrizeView from './components/PrizeView';
import ReaderView from './components/ReaderView';
import ReviewVault from './components/ReviewVault';
import PinGate from './components/PinGate';
import ScalpelModule from './components/ScalpelModule';

const INITIAL_PROJECT: Project = {
  id: 'default',
  title: 'Untitled Narrative',
  type: 'novel',
  maturity: 'standard',
  genre: 'Science Fiction',
  premise: '',
  tone: 'Cinematic', // Default tone
  collaborators: [],
  ownerId: '',
  sourceMaterials: [],
  lastModified: Date.now(),
  createdAt: Date.now(),
  stats: {
    narrativeStreak: 0,
    totalWords: 0,
    aiContributions: 0,
    lastActiveDay: new Date().toISOString().split('T')[0]
  }
};

export default function App() {
  const [user, setUser] = useState(auth.currentUser);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);

  // Load project cache on mount
  useEffect(() => {
    if (user) {
      const cached = localStorage.getItem(`ls_projects_cache_${user.uid}`);
      if (cached) {
        setProjects(JSON.parse(cached));
      }
    }
  }, [user]);

  const [project, setProject] = useState<Project>(INITIAL_PROJECT);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [plotNodes, setPlotNodes] = useState<PlotNode[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [research, setResearch] = useState<ResearchNote[]>([]);
  const [sourceMaterials, setSourceMaterials] = useState<SourceMaterial[]>([]);
  const [externalReviews, setExternalReviews] = useState<ExternalReview[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    const saved = localStorage.getItem('ls_current_view');
    return (saved as ViewType) || 'dashboard';
  });

  useEffect(() => {
    localStorage.setItem('ls_current_view', currentView);
  }, [currentView]);

  const [lastProjectId, setLastProjectId] = useState(() => localStorage.getItem('ls_project_id'));

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const [notifications, setNotifications] = useState<{ id: string; message: string; type: 'error' | 'success' | 'info' }[]>([]);
  const [readerProject, setReaderProject] = useState<Project | null>(null);
  const [readerChapters, setReaderChapters] = useState<Chapter[]>([]);
  const [isReading, setIsReading] = useState(false);

  useEffect(() => {
    if (project.id !== 'default') {
      localStorage.setItem('ls_project_id', project.id);
    }
  }, [project.id]);

  // Handle Reading Link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const readId = params.get('read');
    if (readId) {
      const fetchPublicProject = async () => {
        try {
          const getDoc = async () => ({ exists: () => false, data: () => ({}) });
          const pSnap = await getDoc(doc(db, 'projects', readId));
          if (pSnap.exists()) {
            const data = pSnap.data() as Project;
            if (data.isPublic) {
              setReaderProject(data);
              setIsReading(true);
              const cSnap = await getDocs(query(collection(db, 'projects', readId, 'chapters'), orderBy('order')));
              setReaderChapters(cSnap.docs.map(d => d.data() as Chapter));
            }
          }
        } catch (e) {
          console.error("Public fetch error:", e);
        }
      };
      fetchPublicProject();
    }
  }, []);

  const addNotification = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    const id = crypto.randomUUID();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 6000);
  };

  // Mobile Detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) setIsSidebarOpen(false);
    else setIsSidebarOpen(true);
  }, [isMobile]);

  // History State
  const [history, setHistory] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Derived Stats
  const totalWords = chapters.reduce((acc, c) => {
    const words = c.content?.trim().split(/\s+/).filter(w => w.length > 0).length || 0;
    return acc + words;
  }, 0);

  const pushToHistory = (state: Project) => {
    setHistory(prev => [state, ...prev].slice(0, 50));
    setFuture([]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[0];
    const newHistory = history.slice(1);
    
    setFuture(prev => [project, ...prev]);
    setHistory(newHistory);
    setProject(previous);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);

    setHistory(prev => [project, ...prev]);
    setFuture(newFuture);
    setProject(next);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [project, history, future]);

  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);

  // Auth Listener
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      console.log('Auth state changed:', u?.uid || 'no user');
      setUser(u);
      if (u) {
        setLoginError(null);
      } else {
        setProject(INITIAL_PROJECT);
        setCharacters([]);
        setPlotNodes([]);
        setChapters([]);
        setResearch([]);
        setSourceMaterials([]);
        setExternalReviews([]);
      }
      setLoading(false);
    });
  }, []);

  const handleLogin = async () => {
    try {
      setLoginError(null);
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-blocked') {
        setLoginError('Popup was blocked by your browser. Please allow popups for this site.');
      } else {
        setLoginError(err.message || 'An error occurred during login.');
      }
    }
  };

  // Sync AI Provider
  useEffect(() => {
    if (project.primaryProvider) {
      AIService.setPrimaryProvider(project.primaryProvider);
    }
  }, [project.primaryProvider]);

  const isCreatingInitialProjectRef = useRef(false);

  // Project List Sync
  // LocalStorage project list sync
  useEffect(() => {
    if (!user) { setProjects([]); return; }
    const projectsList = lsGetCollection<Project>(`users/${user.uid}/projects`)
      .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
    setProjects(projectsList);
    setIsProjectsLoading(false);
    const savedId = localStorage.getItem(`lastProject_${user.uid}`);
    if (projectsList.length > 0) {
      const found = savedId ? projectsList.find(p => p.id === savedId) : null;
      setProject(found || projectsList[0]);
    }
  }, [user]);

  // Clear sub-states when project changes to prevent data bleeding
  useEffect(() => {
    setCharacters([]);
    setPlotNodes([]);
    setChapters([]);
    setResearch([]);
    setSourceMaterials([]);
    setExternalReviews([]);
    setPresence([]);
    setHistory([]);
    setFuture([]);
  }, [project.id]);

  const createNewProject = async (title: string = 'Untitled Narrative') => {
    if (!user) return;
    const newId = `project_${crypto.randomUUID()}`;
    const newProjectData: Project = { 
      ...INITIAL_PROJECT, title, id: newId, ownerId: user.uid,
      createdAt: Date.now(), lastModified: Date.now()
    };
    lsUpsertDoc(`users/${user.uid}/projects`, newProjectData);
    localStorage.setItem(`lastProject_${user.uid}`, newId);
    setProjects(prev => [newProjectData, ...prev]);
    setProject(newProjectData);
    setCurrentView('dashboard');
  };

  // Auto-create initial project if none exist
  useEffect(() => {
    if (user && !loading && !isProjectsLoading && projects.length === 0 && project.id === 'default' && !isCreatingInitialProjectRef.current) {
      isCreatingInitialProjectRef.current = true;
      console.log('No projects found, triggering auto-creation...');
      createNewProject('My First Manuscript');
    }
  }, [user, loading, isProjectsLoading, projects.length, project.id]);

  // LocalStorage subcollections sync — load on project change
  useEffect(() => {
    if (!user || !project.id || project.id === 'default') return;
    const pid = project.id;
    localStorage.setItem(`lastProject_${user.uid}`, pid);
    const normaliseChar = (d: any): Character => ({
      ...d,
      traits: Array.isArray(d.traits) ? d.traits : [],
      goals: Array.isArray(d.goals) ? d.goals : [],
      fears: Array.isArray(d.fears) ? d.fears : [],
      motivations: Array.isArray(d.motivations) ? d.motivations : [],
      quirks: Array.isArray(d.quirks) ? d.quirks : [],
    });
    setCharacters(lsGetCollection<Character>(`projects/${pid}/characters`).map(normaliseChar).sort((a,b) => (b.updatedAt||0)-(a.updatedAt||0)));
    setPlotNodes(lsGetCollection<PlotNode>(`projects/${pid}/plotNodes`).sort((a,b) => a.order-b.order));
    const chapterList = lsGetCollection<Chapter>(`projects/${pid}/chapters`).sort((a,b) => a.order-b.order);
    setChapters(chapterList);
    setResearch(lsGetCollection<ResearchNote>(`projects/${pid}/research`).sort((a,b) => (b.updatedAt||0)-(a.updatedAt||0)));
    setSourceMaterials(lsGetCollection<SourceMaterial>(`projects/${pid}/sourceMaterials`).sort((a,b) => (a.name||'').localeCompare(b.name||'')));
    setExternalReviews(lsGetCollection<ExternalReview>(`projects/${pid}/externalReviews`).sort((a,b) => (b.date||0)-(a.date||0)));
  }, [user, project.id]);


  const updateProject = async (updates: Partial<Project>) => {
    if (!user || !project.id || project.id === 'default') return;
    const cleaned = Object.entries(updates).reduce((acc, [k, v]) => { if (v !== undefined) acc[k] = v; return acc; }, {} as any);
    const updated = { ...project, ...cleaned, lastModified: Date.now() };
    setProject(updated);
    pushToHistory(project);
    setIsSaving(true);
    lsUpsertDoc(`users/${user.uid}/projects`, updated);
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
    setTimeout(() => setIsSaving(false), 300);
  };

  const deleteProject = async (idToStepDown?: string) => {
    const targetId = idToStepDown || project.id;
    if (!user || !targetId || targetId === 'default') return;
    ['characters','plotNodes','chapters','research','sourceMaterials','externalReviews'].forEach(c => lsDeleteCollection(`projects/${targetId}/${c}`));
    lsDeleteDoc(`users/${user.uid}/projects`, targetId);
    const remaining = projects.filter(p => p.id !== targetId);
    setProjects(remaining);
    if (project.id === targetId) {
      if (remaining.length > 0) setProject(remaining[0]);
      else { setProject(INITIAL_PROJECT); setCurrentView('dashboard'); }
      setHistory([]); setFuture([]);
    }
    addNotification('Project permanently deleted.', 'info');
  };

  const saveToCloud = async () => {
    if (!user || !project.id || project.id === 'default') return;
    setIsSaving(true);
    const saved = { ...project, lastModified: Date.now() };
    lsUpsertDoc(`users/${user.uid}/projects`, saved);
    setProjects(prev => prev.map(p => p.id === saved.id ? saved : p));
    setTimeout(() => setIsSaving(false), 500);
  };

  const onNotify = addNotification;

  const handleBulkIngest = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    if (file.size > 20 * 1024 * 1024) {
      onNotify("Manuscript excessive in size. 20MB limit enforced.", "error");
      return;
    }

    setIsSaving(true);
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
      } else if (
        file.name.endsWith('.docx') || file.name.endsWith('.doc') ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'application/msword'
      ) {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        content = result.value;
      } else {
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      }

      const title = file.name.replace(/\.[^/.]+$/, "");
      const newId = `project_${crypto.randomUUID()}`;
      const newProjectData: Project = { 
        ...INITIAL_PROJECT, title, id: newId, ownerId: user.uid,
        createdAt: Date.now(), lastModified: Date.now(), premise: content.slice(0, 500)
      };
      lsUpsertDoc(`users/${user.uid}/projects`, newProjectData);
      const CHUNK_SIZE = 400000;
      let chaptersCreated = 0;
      for (let i = 0; i < content.length; i += CHUNK_SIZE) {
        const chunk = content.substring(i, i + CHUNK_SIZE);
        const chapterId = crypto.randomUUID();
        const newChapter: Chapter = {
          id: chapterId,
          title: content.length > CHUNK_SIZE ? `Ingested Section (Part ${chaptersCreated + 1})` : 'Full Manuscript Ingest',
          content: chunk, summary: 'Auto-synthesized from bulk ingestion.',
          order: chaptersCreated, plotNodeIds: [], tags: ['ingested'], updatedAt: Date.now()
        };
        lsUpsertDoc(`projects/${newId}/chapters`, newChapter);
        chaptersCreated++;
      }
      localStorage.setItem(`lastProject_${user.uid}`, newId);
      setProjects(prev => [newProjectData, ...prev]);
      setProject(newProjectData);
      setCurrentView('dashboard');
      onNotify('Manuscript successfully ingested.', 'success');
    } catch (err) {
      onNotify(`Ingest failure: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setIsSaving(false);
      if (e.target) e.target.value = '';
    }
  };

  // Subcollection Handlers — localStorage backed
  const upsertCharacter = async (char: Character) => {
    if (!user) return;
    const c = { ...char, updatedAt: Date.now() };
    lsUpsertDoc(`projects/${project.id}/characters`, c);
    setCharacters(prev => { const f = prev.filter(x => x.id !== c.id); return [c, ...f]; });
  };
  const upsertCharacterBatch = async (charList: Character[]) => {
    if (!user || charList.length === 0) return;
    const existing = lsGetCollection<Character>(`projects/${project.id}/characters`);
    const existingNames = new Set(existing.map(c => (c.name||'').trim().toLowerCase()));
    const seen = new Set<string>();
    const deduped = charList.filter(c => {
      const k = (c.name||'').trim().toLowerCase();
      if (!k || existingNames.has(k) || seen.has(k)) return false;
      seen.add(k); return true;
    });
    deduped.forEach(c => lsUpsertDoc(`projects/${project.id}/characters`, { ...c, updatedAt: Date.now() }));
    if (deduped.length > 0) setCharacters(prev => [...deduped.map(c => ({...c, updatedAt: Date.now()})), ...prev]);
  };
  const deduplicateCharacters = async () => {
    if (!user || !project.id) return;
    const all = lsGetCollection<Character>(`projects/${project.id}/characters`);
    const byName = new Map<string, Character[]>();
    all.forEach(c => { const k = (c.name||'').trim().toLowerCase(); if (!k) return; if (!byName.has(k)) byName.set(k, []); byName.get(k)!.push(c); });
    let deleted = 0;
    byName.forEach(entries => {
      if (entries.length <= 1) return;
      entries.sort((a,b) => (b.updatedAt||0)-(a.updatedAt||0));
      entries.slice(1).forEach(e => { lsDeleteDoc(`projects/${project.id}/characters`, e.id); deleted++; });
    });
    if (deleted === 0) { onNotify('No duplicates found.', 'success'); return; }
    setCharacters(lsGetCollection<Character>(`projects/${project.id}/characters`));
    onNotify(`Removed ${deleted} duplicate character${deleted>1?'s':''}.`, 'success');
  };
  const upsertPlotNode = async (node: PlotNode) => {
    if (!user) return;
    lsUpsertDoc(`projects/${project.id}/plotNodes`, { ...node, updatedAt: Date.now() });
    setPlotNodes(prev => { const f = prev.filter(x => x.id !== node.id); return [...f, node].sort((a,b) => a.order-b.order); });
  };
  const upsertChapter = async (chap: Chapter) => {
    if (!user) return;
    const c = { ...chap, updatedAt: Date.now() };
    lsUpsertDoc(`projects/${project.id}/chapters`, c);
    setChapters(prev => { const f = prev.filter(x => x.id !== c.id); return [...f, c].sort((a,b) => a.order-b.order); });
  };
  const upsertSourceMaterial = async (source: SourceMaterial) => {
    if (!user) return;
    lsUpsertDoc(`projects/${project.id}/sourceMaterials`, { ...source, updatedAt: Date.now() });
    setSourceMaterials(prev => { const f = prev.filter(x => x.id !== source.id); return [...f, source].sort((a,b) => (a.name||'').localeCompare(b.name||'')); });
  };
  const upsertExternalReview = async (review: ExternalReview) => {
    if (!user) return;
    lsUpsertDoc(`projects/${project.id}/externalReviews`, review);
    setExternalReviews(prev => { const f = prev.filter(x => x.id !== review.id); return [review, ...f]; });
  };
  const upsertResearch = async (note: ResearchNote) => {
    if (!user) return;
    lsUpsertDoc(`projects/${project.id}/research`, { ...note, updatedAt: Date.now() });
    setResearch(prev => { const f = prev.filter(x => x.id !== note.id); return [note, ...f]; });
  };
  const deleteSubDoc = async (coll: string, id: string) => {
    if (!user) return;
    lsDeleteDoc(`projects/${project.id}/${coll}`, id);
    if (coll === 'characters') setCharacters(prev => prev.filter(x => x.id !== id));
    else if (coll === 'plotNodes') setPlotNodes(prev => prev.filter(x => x.id !== id));
    else if (coll === 'chapters') setChapters(prev => prev.filter(x => x.id !== id));
    else if (coll === 'research') setResearch(prev => prev.filter(x => x.id !== id));
    else if (coll === 'sourceMaterials') setSourceMaterials(prev => prev.filter(x => x.id !== id));
    else if (coll === 'externalReviews') setExternalReviews(prev => prev.filter(x => x.id !== id));
  };
  const upsertChapterBatch = async (chapList: Chapter[]) => {
    if (!user || !project.id || project.id === 'default') return;
    const newIds = new Set(chapList.map(c => c.id));
    chapters.filter(c => !newIds.has(c.id)).forEach(o => lsDeleteDoc(`projects/${project.id}/chapters`, o.id));
    chapList.forEach(c => lsUpsertDoc(`projects/${project.id}/chapters`, { ...c, updatedAt: Date.now() }));
    setChapters([...chapList].sort((a,b) => a.order-b.order));
  };
  const upsertPlotNodesBatch = async (nodes: PlotNode[]) => {
    if (!user || !project.id || project.id === 'default' || nodes.length === 0) return;
    const newIds = new Set(nodes.map(n => n.id));
    plotNodes.filter(n => !newIds.has(n.id)).forEach(o => lsDeleteDoc(`projects/${project.id}/plotNodes`, o.id));
    nodes.forEach((n, idx) => lsUpsertDoc(`projects/${project.id}/plotNodes`, { ...n, order: idx, updatedAt: Date.now() }));
    setPlotNodes([...nodes].sort((a,b) => a.order-b.order));
  };

  const navGroups = [
    {
      title: "Manuscripts",
      items: [
        { id: 'library', label: 'Universal Vault', icon: Library },
        { id: 'dashboard', label: 'Narrative Pulse', icon: BarChart3 },
      ]
    },
    {
      title: "1. Strategy",
      items: [
        { id: 'prizes', label: 'Prize Cabinet', icon: Trophy },
        { id: 'reviews', label: 'Critical Vault', icon: MessageSquare },
        { id: 'brainstorm', label: 'AI Spark', icon: Sparkles },
      ]
    },
    {
      title: "2. Foundations",
      items: [
        { id: 'characters', label: 'Character Forge', icon: Users },
        { id: 'intelligence', label: 'Intelligence Lab', icon: BrainCircuit },
      ]
    },    {
      title: "3. Structure",
      items: [
        { id: 'plot', label: 'Plot Architect', icon: GitBranch },
        { id: 'architect', label: 'Finish & Fix', icon: Construction },
      ]
    },
    {
      title: "4. Execution",
      items: [
        { id: 'writing', label: 'Writing Studio', icon: PenTool },
        { id: 'scalpel', label: "Mrs. Parry's Razor", icon: Scissors },
        { id: 'swarm', label: 'Critic Swarm', icon: Zap },
      ]
    },
    {
      title: "5. Delivery",
      items: [
        { id: 'export', label: 'Export & Publish', icon: Globe },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    }
  ];

  if (loading) {
    return (
      <div className="h-screen bg-surface-bg flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-2 border-brand-primary/20 border-t-brand-primary rounded-[2rem] shadow-[0_0_50px_rgba(59,130,246,0.3)]"
          />
          <div className="absolute inset-0 bg-brand-primary/10 rounded-[2rem] blur-xl animate-pulse" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-text-primary/80 font-black uppercase tracking-[0.4em] text-[10px] italic">Calibrating Narrative Systems</p>
          <div className="w-32 h-0.5 bg-border-subtle rounded-full overflow-hidden">
            <motion.div 
              animate={{ x: [-128, 128] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="w-full h-full bg-brand-primary"
            />
          </div>
        </div>
      </div>
    );
  }

  if (isReading && readerProject) {
    return (
      <ReaderView 
        project={readerProject} 
        chapters={readerChapters} 
        isLoggedIn={!!user}
        onBack={() => {
          setIsReading(false);
          window.history.replaceState({}, '', window.location.pathname);
        }}
      />
    );
  }

  if (!user) {
    return (
      <div className="h-screen bg-surface-bg flex items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-primary/5 rounded-full blur-[120px] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-surface-card rounded-[3.5rem] p-12 shadow-[0_50px_100px_rgba(0,0,0,0.6)] text-center space-y-10 border border-border-subtle relative z-10"
        >
          <div className="w-24 h-24 bg-brand-primary rounded-[2.5rem] mx-auto flex items-center justify-center shadow-[0_20px_50px_rgba(59,130,246,0.4)] rotate-3 border-4 border-white/10">
             <Globe size={48} className="text-white" />
          </div>
          <div>
            <h1 className="text-5xl font-black text-text-primary tracking-tighter mb-3 italic font-serif">NovelWrite <span className="text-brand-primary font-sans tracking-wide not-italic">PRO</span></h1>
            <p className="text-text-secondary font-black uppercase tracking-[0.2em] text-[10px] opacity-60">Architecting tomorrow's narratives</p>
          </div>
          <button 
            onClick={handleLogin}
            className="group w-full py-5 bg-brand-primary hover:bg-brand-accent text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-4 transition-all shadow-[0_20px_40px_rgba(59,130,246,0.3)] active:scale-95"
          >
            <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
            Authorize Core Sync
          </button>
          {loginError && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium"
            >
              {loginError}
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <PinGate>
    <div 
      className="flex h-dvh bg-surface-bg text-text-primary font-sans selection:bg-brand-primary/30 overflow-hidden print:h-auto print:overflow-visible"
      style={{ minHeight: 0 }}
    >
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-brand-dark/80 backdrop-blur-md z-[100]"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? (isMobile ? '85%' : 260) : (isMobile ? 0 : 80),
          x: isMobile && !isSidebarOpen ? '-100%' : 0
        }}
        className={`flex flex-col bg-brand-dark text-text-primary relative shadow-[0_0_50px_rgba(0,0,0,0.5)] border-r border-border-subtle overflow-hidden no-print ${
          isMobile ? 'fixed inset-y-0 left-0 z-[101]' : 'z-50'
        }`}
      >
        <div className="p-8 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-primary flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)] font-black text-xl rotate-3 text-white border border-white/10">
            N
          </div>
          {isSidebarOpen && (
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-black text-2xl italic tracking-tighter font-serif text-text-primary"
            >
              NovelWrite <span className="text-brand-primary font-normal font-sans tracking-widest text-[10px] uppercase ml-1 relative -top-1 opacity-80">AGENT</span>
            </motion.h1>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-6 mt-4 overflow-y-auto custom-scrollbar">
          {navGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="space-y-2">
              {isSidebarOpen ? (
                <div className="text-[10px] font-black text-text-secondary uppercase tracking-[0.3em] px-4 mb-3 opacity-40">{group.title}</div>
              ) : (
                <div className="w-full h-px bg-border-subtle my-6" />
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentView(item.id as ViewType);
                      if (isMobile) setIsSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group text-xs font-bold uppercase tracking-widest ${
                      isActive 
                        ? 'bg-brand-primary text-white shadow-xl shadow-brand-primary/30 scale-[1.02]' 
                        : 'text-text-secondary hover:text-text-primary hover:bg-white/5 active:scale-95'
                    }`}
                    title={item.label}
                  >
                    <Icon size={20} className={isActive ? 'text-white' : 'group-hover:text-brand-primary transition-colors'} />
                    {isSidebarOpen && (
                      <span className="flex-1 text-left truncate">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-4 py-6 space-y-3 border-t border-border-subtle mx-4">
          <div className={`flex items-center gap-2 ${isSidebarOpen ? 'justify-between' : 'justify-center flex-col'}`}>
            <button 
              onClick={undo}
              disabled={history.length === 0}
              className="p-2.5 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-xl transition-all disabled:opacity-10 active:scale-90"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw size={18} />
            </button>
            <button 
              onClick={redo}
              disabled={future.length === 0}
              className="p-2.5 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-xl transition-all disabled:opacity-10 active:scale-90"
              title="Redo (Ctrl+Y)"
            >
              <RotateCw size={18} />
            </button>
            <button 
              onClick={saveToCloud}
              className={`p-2.5 text-text-secondary hover:text-brand-primary hover:bg-white/5 rounded-xl transition-all active:scale-90 ${isSaving ? 'text-brand-primary' : ''}`}
              title="Manual Sync"
            >
              <Save size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 border-t border-border-subtle flex items-center gap-4 bg-white/5">
          {user.photoURL 
            ? <img src={user.photoURL} className="w-12 h-12 rounded-xl border border-border-subtle shadow-2xl" alt="Profile" />
            : <div className="w-12 h-12 rounded-xl border border-border-subtle bg-brand-primary/20 flex items-center justify-center text-brand-primary font-black text-lg">{(user.displayName||'D')[0]}</div>
          }
          {isSidebarOpen && (
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-black truncate text-text-primary uppercase tracking-widest">{user.displayName || 'Demo Author'}</div>
              <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mt-1 opacity-50">Local Mode</div>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Main Content */}
      <main 
        className="flex-1 flex flex-col relative overflow-hidden print:overflow-visible print:block print:static min-w-0"
        style={{ minHeight: 0 }}
      >
        {/* Top Header */}
        <header className="h-14 md:h-20 border-b border-border-subtle flex items-center justify-between px-3 md:px-10 bg-surface-card relative z-10 shrink-0 no-print shadow-sm">
          <div className="flex items-center gap-2 md:gap-12 overflow-hidden h-full">
            {!isMobile && <div className="text-[10px] bg-white/5 px-3 py-1 rounded-full font-mono text-text-secondary border border-border-subtle/50 uppercase tracking-widest italic opacity-50">MANUSCRIPT_CORE_2.5.5</div>}
            
            <div className="relative h-full flex items-center">
              <button 
                onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
                className="flex items-center gap-4 px-5 py-2.5 hover:bg-white/5 transition-all rounded-2xl group overflow-hidden border border-transparent hover:border-border-subtle"
              >
                <div className="flex flex-col items-start min-w-0 text-left">
                  <div className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em] leading-none mb-1.5 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                    Live Vault
                  </div>
                  <div className="flex items-center gap-3 text-text-primary">
                    <span className="italic font-serif truncate max-w-[120px] md:max-w-[400px] font-bold text-base md:text-2xl leading-tight">{project.title}</span>
                    <ChevronDown size={18} className={`text-text-secondary group-hover:text-brand-primary transition-all duration-300 ${isProjectMenuOpen ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {isProjectMenuOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 5, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.98 }}
                    className="absolute top-full left-0 w-[90vw] md:w-[480px] bg-surface-card rounded-3xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] border border-border-subtle z-[110] overflow-hidden mt-2"
                  >
                    <div className="p-6 max-h-[500px] overflow-y-auto custom-scrollbar">
                      <div className="flex items-center justify-between mb-6 px-2">
                        <p className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em]">Archived Artifacts</p>
                        <span className="text-[10px] bg-brand-primary/10 px-3 py-1 rounded-full text-brand-primary font-black uppercase">{projects.length} Total</span>
                      </div>
                      <div className="space-y-2">
                        {isProjectsLoading ? (
                          <div className="py-12 text-center text-[11px] font-black text-text-secondary animate-pulse uppercase tracking-[0.3em]">Calibrating Vault...</div>
                        ) : projects.length === 0 ? (
                          <div className="py-12 text-center text-[11px] font-black text-text-secondary uppercase tracking-[0.3em]">Void Detected</div>
                        ) : (
                          projects.map(p => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setProject(p);
                                setIsProjectMenuOpen(false);
                              }}
                              className={`w-full text-left p-5 rounded-2xl transition-all group/item border ${
                                p.id === project.id 
                                  ? 'bg-brand-primary border-brand-primary text-white shadow-2xl shadow-brand-primary/20' 
                                  : 'hover:bg-white/5 border-border-subtle/30 text-text-secondary hover:text-text-primary'
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${p.id === project.id ? 'bg-white/20' : 'bg-surface-muted group-hover/item:bg-brand-primary/10 transition-colors'}`}>
                                  <Library size={18} className={p.id === project.id ? 'text-white' : 'text-text-secondary group-hover/item:text-brand-primary'} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-black leading-tight truncate italic font-serif">{p.title || 'Untitled Narrative'}</div>
                                  <div className={`text-[9px] uppercase mt-1 tracking-widest font-bold opacity-60 flex items-center gap-2`}>
                                    {p.type} <div className="w-1 h-1 rounded-full bg-current" /> {new Date(p.lastModified).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="p-4 sm:p-6 bg-surface-muted/50 border-t border-border-subtle grid grid-cols-2 gap-3 shrink-0">
                       <button 
                        onClick={() => {
                          const title = window.prompt('Define narrative title:');
                          if (title) createNewProject(title);
                          setIsProjectMenuOpen(false);
                        }}
                        className="flex items-center justify-center gap-2 py-4 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-brand-primary hover:text-white shadow-xl active:scale-95"
                      >
                        <Plus size={16} />
                        New Archive
                      </button>

                      <label className="flex items-center justify-center gap-2 py-4 bg-brand-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-brand-accent shadow-xl shadow-brand-primary/20 cursor-pointer active:scale-95">
                        <Upload size={16} />
                        Ingest Case
                        <input 
                          type="file" 
                          className="hidden" 
                          accept=".pdf,.txt,.md,.json,.doc,.docx" 
                          onChange={handleBulkIngest} 
                        />
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {isSaving && (
              <motion.div 
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="hidden md:flex items-center gap-2 px-3 py-1 bg-brand-primary/10 border border-brand-primary/20 rounded-full text-[9px] font-black text-brand-primary uppercase tracking-[0.1em]"
              >
                <div className="w-1 h-1 rounded-full bg-brand-primary animate-ping" />
                Intelligence Synced
              </motion.div>
            )}
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 lg:gap-3 shrink-0">
             {isMobile && (
               <button 
                 onClick={() => setIsSidebarOpen(true)}
                 className="p-2.5 text-text-primary bg-surface-muted rounded-xl hover:bg-white/5 transition-colors border border-border-subtle"
               >
                 <Menu size={20} />
               </button>
             )}
             {!isMobile && (
               <button 
                onClick={() => setCurrentView('export')}
                className="px-6 py-2.5 bg-brand-primary text-white rounded-xl font-black text-[10px] hover:bg-brand-accent transition-all uppercase tracking-[0.2em] shadow-lg shadow-brand-primary/20 hover:scale-105 active:scale-95"
              >
                Export & Publish
              </button>
             )}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 bg-surface-muted border border-border-subtle rounded-xl text-text-secondary hover:text-brand-primary hover:border-brand-primary/30 transition-all hidden lg:flex items-center justify-center active:scale-90 shadow-sm"
              title="Toggle Sidebar Architecture"
            >
              <GitBranch size={18} className={isSidebarOpen ? 'rotate-90 transition-transform duration-500' : 'transition-transform duration-500'} />
            </button>
          </div>
        </header>

        {/* View Transition Area */}
        <div 
          className={`flex-1 relative bg-surface-bg print:bg-white print:p-0 flex flex-col overflow-hidden`}
          style={{ minHeight: 0 }}
        >
          <div
            className={`w-full flex-1 flex flex-col min-h-0 overflow-hidden ${
              ['writing', 'scalpel', 'plot', 'swarm', 'brainstorm', 'characters', 'research', 'library', 'intelligence'].includes(currentView) 
                ? `w-full ${['writing', 'scalpel'].includes(currentView) ? '' : 'p-2 md:p-6 lg:p-8'}`
                : 'w-full'
            }`}
            style={{ minHeight: 0 }}
          >
            {currentView === 'library' && (
              <LibraryView 
                key="library"
                projects={projects}
                onSelectProject={(p) => {
                  setProject(p);
                  setCurrentView('dashboard');
                }}
                onCreateProject={() => createNewProject()}
                onDeleteProject={(id) => deleteProject(id)}
              />
            )}
            {(currentView === 'dashboard' || currentView === 'brainstorm') && (
                 <div key={project.id} className="flex-1 flex flex-col min-h-0">
                   {currentView === 'dashboard' && (
                     <Dashboard 
                       project={{ ...project, stats: { ...project.stats, totalWords } }} 
                       projects={projects}
                       chapters={chapters}
                       selectProject={(p) => setProject(p)}
                       createNewProject={createNewProject}
                       updateProject={updateProject} 
                       setView={setCurrentView} 
                       deleteProject={deleteProject}
                       saveToCloud={saveToCloud}
                       isSaving={isSaving}
                     />
                   )}
                   {currentView === 'brainstorm' && (
                     <Brainstorm 
                       project={project} 
                       research={research}
                       sourceMaterials={sourceMaterials}
                       updateProject={updateProject} 
                       onAddResearch={upsertResearch}
                       onError={(msg) => addNotification(msg, 'error')}
                     />
                   )}
                 </div>
              )}
              {currentView === 'characters' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <CharacterForge 
                    key={project.id}
                    project={{ ...project, characters }} 
                    research={research}
                    chapters={chapters}
                    updateProject={async (updates) => {
                      if (updates.characters) {
                        await upsertCharacterBatch(updates.characters);
                      }
                    }} 
                    onDeduplicateCharacters={deduplicateCharacters}
                    onError={(msg) => addNotification(msg, 'error')}
                  />
                </div>
              )}
              {currentView === 'plot' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <PlotArchitect 
                    key={project.id}
                    project={{ ...project, chapters, sourceMaterials }}
                    chapters={chapters} 
                    plotNodes={plotNodes} 
                    research={research}
                    updateProject={updateProject}
                    updatePlotNodes={async (nodes) => {
                       setPlotNodes(nodes);
                       await upsertPlotNodesBatch(nodes);
                    }}
                    updateChapters={async (chapList) => {
                      setChapters(chapList);
                      await upsertChapterBatch(chapList);
                    }}
                    onNotify={(msg, type) => addNotification(msg, type)}
                    onError={(msg) => addNotification(msg, 'error')}
                  />
                </div>
              )}
              {currentView === 'intelligence' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <IntelligenceLab 
                    key={project.id}
                    project={project} 
                    research={research} 
                    chapters={chapters}
                    sourceMaterials={sourceMaterials}
                    onAddResearch={upsertResearch}
                    onDeleteResearch={(id) => deleteSubDoc('research', id)}
                    onAddChapter={upsertChapter}
                    onAddSource={upsertSourceMaterial}
                    onDeleteSource={(id) => deleteSubDoc('sourceMaterials', id)}
                    onNotify={(msg, type) => addNotification(msg, type)}
                  />
                </div>
              )}
              {currentView === 'writing' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <WritingStudio 
                    key={project.id}
                    project={{ ...project, chapters, sourceMaterials, research, externalReviews }} 
                    plotNodes={plotNodes}
                    presence={presence}
                    updateProject={updateProject} 
                    updateChapters={async (chapList) => {
                       setChapters(chapList);
                       await upsertChapterBatch(chapList);
                    }}
                    setView={setCurrentView}
                    upsertChapter={upsertChapter}
                    onDeleteChapter={(id) => deleteSubDoc('chapters', id)}
                    onUpsertSource={upsertSourceMaterial}
                    onDeleteSource={(id) => deleteSubDoc('sourceMaterials', id)}
                    onUpsertCharacters={upsertCharacterBatch}
                    onError={(msg) => addNotification(msg, 'error')}
                  />
                </div>
              )}
              {currentView === 'swarm' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <CriticSwarm 
                    key={project.id}
                    projectType={project.type}
                    maturity={project.maturity}
                    chapters={chapters}
                    sourceMaterials={[...sourceMaterials, ...research.map(r => ({ id: r.id, name: r.title, content: r.content, type: 'Research' }))]}
                    existingCritiques={project.critiques}
                    updateProject={updateProject}
                    updateChapters={async (chaps) => {
                      setChapters(chaps);
                      await upsertChapterBatch(chaps);
                    }}
                    setView={setCurrentView}
                    onError={(msg) => addNotification(msg, 'error')}
                  />
                </div>
              )}
              {currentView === 'prizes' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <PrizeView 
                    key={project.id}
                    project={project}
                    chapters={chapters}
                    updateProject={updateProject}
                  />
                </div>
              )}
              {currentView === 'reviews' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <ReviewVault 
                    key={project.id}
                    project={project}
                    reviews={externalReviews}
                    onUpsert={upsertExternalReview}
                    onDelete={(id) => deleteSubDoc('externalReviews', id)}
                  />
                </div>
              )}
              {currentView === 'export' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <PublishView 
                    key={project.id}
                    project={project}
                    chapters={chapters}
                    updateProject={updateProject}
                    onNotify={(msg, type) => addNotification(msg, type)}
                  />
                </div>
              )}
              {currentView === 'architect' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <ManuscriptFixer 
                    key={project.id}
                    project={{ ...project, sourceMaterials, research }}
                    chapters={chapters}
                    research={research}
                    updateProject={updateProject}
                    updateChapters={async (chaps) => {
                      setChapters(chaps);
                      await upsertChapterBatch(chaps);
                    }}
                    updatePlotNodes={async (nodes) => {
                      setPlotNodes(nodes);
                      await upsertPlotNodesBatch(nodes);
                    }}
                    onAddResearch={upsertResearch}
                    setView={setCurrentView}
                    onError={(msg) => addNotification(msg, 'error')}
                  />
                </div>
              )}
              {currentView === 'scalpel' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <ScalpelModule
                    key={project.id}
                    project={project}
                    chapters={chapters}
                    updateProject={updateProject}
                    updateChapters={async (chaps) => {
                      setChapters(chaps);
                      await upsertChapterBatch(chaps);
                    }}
                    setView={setCurrentView}
                    onNotify={(msg, type) => addNotification(msg, type)}
                  />
                </div>
              )}
              {currentView === 'settings' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <SettingsView 
                    key={project.id}
                    project={project} 
                    updateProject={updateProject}
                    deleteProject={deleteProject}
                  />
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Notifications Toast */}
        <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-3 pointer-events-none">
          <AnimatePresence>
            {notifications.map((n) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 20, y: 0, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                className={`pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border min-w-[300px] backdrop-blur-xl ${
                  n.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                  n.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                  'bg-brand-primary/10 border-brand-primary/20 text-brand-primary'
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  n.type === 'error' ? 'bg-red-500/20' :
                  n.type === 'success' ? 'bg-emerald-500/20' :
                  'bg-brand-primary/20'
                }`}>
                  {n.type === 'error' ? <X size={14} /> : n.type === 'success' ? <Zap size={14} /> : <Activity size={14} />}
                </div>
                <p className="text-xs font-black uppercase tracking-widest leading-tight">{n.message}</p>
                <button 
                  onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))}
                  className="ml-auto opacity-50 hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </PinGate>
    );
}

