'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Clapperboard,
  Sparkles,
  Film,
  Image as ImageIcon,
  Mic,
  Music,
  Play,
  Download,
  Loader2,
  MonitorPlay,
  AlertCircle,
  CircleDot,
  Plus,
  LayoutGrid,
  Save,
  FolderOpen,
  FilePlus2,
  X,
  Check,
  Lock,
  Repeat,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { STYLES, VOICES } from '@/lib/studio-constants';
import type {
  Scene,
  ScriptResult,
  AssetStatus,
  SceneAssets,
  StudioMode,
  ImitateInputType,
} from '@/lib/types';
import { Lamp, StepNode } from './studio/lamp';
import { SceneCard } from './studio/scene-card';
import { CreativePanel, ImitatePanel, type RefMedia } from './studio/console-panels';

type Phase = AssetStatus;

function emptyAssets(): SceneAssets {
  return { imageStatus: 'idle', videoStatus: 'idle', audioStatus: 'idle' };
}

function parseScript(raw: string): ScriptResult {
  const errIdx = raw.indexOf('__ERROR__');
  if (errIdx >= 0) {
    throw new Error(raw.slice(errIdx + 9).trim() || '脚本生成失败');
  }
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('脚本格式解析失败，请重试');
  }
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as ScriptResult;
  if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error('脚本中没有分镜，请重试');
  }
  return parsed;
}

async function downloadFile(url: string, filename: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(blobUrl);
}

const STORAGE_KEY = 'cineflow-studio-state-v2';
const DRAFTS_KEY = 'cineflow-studio-drafts-v2';

interface ProjectState {
  mode: StudioMode;
  topic: string;
  style: string;
  sceneCount: number;
  ratio: '16:9' | '9:16';
  speaker: string;
  creativeRefs: RefMedia[];
  imitateInputType: ImitateInputType;
  imitateFile: RefMedia | null;
  imitateLink: string;
  linkAnalysis: string;
  protagonistUrl: string;
  detail: string;
  refImageUrl: string;
  script: ScriptResult | null;
  assets: Record<number, SceneAssets>;
  canvasConfirmed: boolean;
  styleByScene: Record<number, string>;
  ratioByScene: Record<number, '16:9' | '9:16'>;
  imageRes: '2K' | '4K';
  videoRes: '480p' | '720p' | '1080p';
  resByScene: Record<number, '480p' | '720p' | '1080p'>;
  /** 视频是否同步生成配乐/环境音（开启会显著变慢） */
  withAudio: boolean;
  finalUrl: string;
}

interface Draft extends ProjectState {
  id: string;
  name: string;
  savedAt: string;
}

/** 刷新页面时把「生成中」的状态收敛为可重试状态 */
function reviveAssets(saved: Record<number, SceneAssets>): Record<number, SceneAssets> {
  return Object.fromEntries(
    Object.entries(saved).map(([k, a]) => [
      k,
      {
        ...emptyAssets(),
        ...a,
        imageStatus: a.imageStatus === 'loading' ? ('idle' as const) : a.imageStatus,
        videoStatus: a.videoStatus === 'loading' ? ('idle' as const) : a.videoStatus,
        audioStatus: a.audioStatus === 'loading' ? ('idle' as const) : a.audioStatus,
        imageError:
          a.imageStatus === 'loading' && !a.imageUrl ? '页面刷新中断，请重出此镜画面' : a.imageError,
        videoError:
          a.videoStatus === 'loading' && !a.videoUrl ? '页面刷新中断，请重出此镜视频' : a.videoError,
        audioError:
          a.audioStatus === 'loading' && !a.audioUrl ? '页面刷新中断，请重出此镜配音' : a.audioError,
      },
    ]),
  );
}

export default function Studio() {
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<StudioMode>('creative');

  // 创意端口
  const [topic, setTopic] = useState('');
  const [creativeRefs, setCreativeRefs] = useState<RefMedia[]>([]);
  const [creativeRefUploading, setCreativeRefUploading] = useState(false);

  // 模仿端口
  const [imitateInputType, setImitateInputType] = useState<ImitateInputType>('upload');
  const [imitateFile, setImitateFile] = useState<RefMedia | null>(null);
  const [imitateFileUploading, setImitateFileUploading] = useState(false);
  const [imitateLink, setImitateLink] = useState('');
  const [linkAnalysis, setLinkAnalysis] = useState('');
  const [linkAnalyzing, setLinkAnalyzing] = useState(false);
  const [protagonistUrl, setProtagonistUrl] = useState('');
  const [protagonistUploading, setProtagonistUploading] = useState(false);
  const [detail, setDetail] = useState('');

  // 公共参数
  const [style, setStyle] = useState(STYLES[0]);
  const [sceneCount, setSceneCount] = useState(4);
  const [ratio, setRatio] = useState<'16:9' | '9:16'>('16:9');
  const [speaker, setSpeaker] = useState(VOICES[0].id);
  const [refImageUrl, setRefImageUrl] = useState('');
  const [refImageUploading, setRefImageUploading] = useState(false);
  const [refImageError, setRefImageError] = useState('');

  // 脚本与资产
  const [scriptPhase, setScriptPhase] = useState<Phase>('idle');
  const [scriptRaw, setScriptRaw] = useState('');
  const [script, setScript] = useState<ScriptResult | null>(null);
  const [scriptError, setScriptError] = useState('');

  const [assets, setAssets] = useState<Record<number, SceneAssets>>({});
  const [canvasConfirmed, setCanvasConfirmed] = useState(false);
  const [styleByScene, setStyleByScene] = useState<Record<number, string>>({});
  const [ratioByScene, setRatioByScene] = useState<Record<number, '16:9' | '9:16'>>({});
  const [imageRes, setImageRes] = useState<'2K' | '4K'>('2K');
  // 默认 480p：出片快 30%-50%，满意后单镜切 720p/1080p 重出即可
  const [videoRes, setVideoRes] = useState<'480p' | '720p' | '1080p'>('480p');
  const [resByScene, setResByScene] = useState<Record<number, '480p' | '720p' | '1080p'>>({});
  const [withAudio, setWithAudio] = useState(false);
  const [imagesRunning, setImagesRunning] = useState(false);
  const [videosRunning, setVideosRunning] = useState(false);
  const [audiosRunning, setAudiosRunning] = useState(false);

  const [finalUrl, setFinalUrl] = useState('');
  const [composeStatus, setComposeStatus] = useState<AssetStatus>('idle');
  const [composeError, setComposeError] = useState('');

  const [autoRunning, setAutoRunning] = useState(false);
  const scriptMonitorRef = useRef<HTMLDivElement>(null);
  const sceneImageInputRef = useRef<HTMLInputElement>(null);
  const sceneAudioInputRef = useRef<HTMLInputElement>(null);
  const sceneUploadTargetRef = useRef<number | null>(null);
  const sceneAudioTargetRef = useRef<number | null>(null);
  const dragSceneIdxRef = useRef<number | null>(null);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const [draftSavedTip, setDraftSavedTip] = useState(false);

  // 页面加载后从 localStorage 恢复上次的创作状态（仅客户端执行，避免 hydration 问题）
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as ProjectState;
        if (saved.mode) setMode(saved.mode);
        if (saved.topic) setTopic(saved.topic);
        if (saved.style && STYLES.includes(saved.style)) setStyle(saved.style);
        if (saved.sceneCount) setSceneCount(saved.sceneCount);
        if (saved.ratio) setRatio(saved.ratio);
        if (saved.speaker && VOICES.some((v) => v.id === saved.speaker)) setSpeaker(saved.speaker);
        if (Array.isArray(saved.creativeRefs)) setCreativeRefs(saved.creativeRefs);
        if (saved.imitateInputType) setImitateInputType(saved.imitateInputType);
        if (saved.imitateFile) setImitateFile(saved.imitateFile);
        if (saved.imitateLink) setImitateLink(saved.imitateLink);
        if (saved.linkAnalysis) setLinkAnalysis(saved.linkAnalysis);
        if (saved.protagonistUrl) setProtagonistUrl(saved.protagonistUrl);
        if (saved.detail) setDetail(saved.detail);
        if (saved.refImageUrl) setRefImageUrl(saved.refImageUrl);
        if (saved.script) {
          setScript(saved.script);
          setScriptPhase('done');
        }
        if (saved.assets && Object.keys(saved.assets).length > 0) {
          setAssets(reviveAssets(saved.assets));
        }
        if (saved.canvasConfirmed) setCanvasConfirmed(true);
        if (saved.styleByScene) setStyleByScene(saved.styleByScene);
        if (saved.ratioByScene) setRatioByScene(saved.ratioByScene);
        if (saved.imageRes) setImageRes(saved.imageRes);
        if (saved.videoRes) setVideoRes(saved.videoRes);
        if (saved.resByScene) setResByScene(saved.resByScene);
        if (typeof saved.withAudio === 'boolean') setWithAudio(saved.withAudio);
        if (saved.finalUrl) {
          setFinalUrl(saved.finalUrl);
          setComposeStatus('done');
        }
      }
    } catch {
      // 本地数据损坏时静默忽略，按全新工作台启动
    }
    try {
      const rawD = localStorage.getItem(DRAFTS_KEY);
      if (rawD) {
        const parsed = JSON.parse(rawD) as Draft[];
        if (Array.isArray(parsed)) setDrafts(parsed);
      }
    } catch {
      // 草稿损坏时忽略
    }
    setHydrated(true);
  }, []);

  // 状态变更后自动持久化到 localStorage，刷新/重开页面不丢失
  useEffect(() => {
    if (!hydrated) return;
    const data: ProjectState = {
      mode,
      topic,
      style,
      sceneCount,
      ratio,
      speaker,
      creativeRefs,
      imitateInputType,
      imitateFile,
      imitateLink,
      linkAnalysis,
      protagonistUrl,
      detail,
      refImageUrl,
      script,
      assets,
      canvasConfirmed,
      styleByScene,
      ratioByScene,
      imageRes,
      videoRes,
      resByScene,
      withAudio,
      finalUrl,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // 存储超限时静默忽略
    }
  }, [hydrated, mode, topic, style, sceneCount, ratio, speaker, creativeRefs, imitateInputType, imitateFile, imitateLink, linkAnalysis, protagonistUrl, detail, refImageUrl, script, assets, canvasConfirmed, styleByScene, ratioByScene, imageRes, videoRes, resByScene, withAudio, finalUrl]);

  /** 清空全部创作状态与本地存档，开始新作品 */
  const resetWorkspace = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setScript(null);
    setScriptRaw('');
    setScriptPhase('idle');
    setScriptError('');
    setAssets({});
    setCanvasConfirmed(false);
    setFinalUrl('');
    setComposeStatus('idle');
    setComposeError('');
    setStyleByScene({});
    setRatioByScene({});
    setResByScene({});
    setCreativeRefs([]);
    setImitateFile(null);
    setImitateLink('');
    setLinkAnalysis('');
    setProtagonistUrl('');
    setDetail('');
    setRefImageUrl('');
  }, []);

  const getAssets = useCallback(
    (id: number): SceneAssets => assets[id] ?? emptyAssets(),
    [assets],
  );

  const patchAssets = useCallback((id: number, patch: Partial<SceneAssets>) => {
    setAssets((prev) => ({ ...prev, [id]: { ...emptyAssets(), ...prev[id], ...patch } }));
  }, []);

  /** 上传文件到对象存储，返回可访问 URL 与媒体类型 */
  const uploadMedia = useCallback(async (file: File): Promise<RefMedia> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) throw new Error(data.error || '上传失败');
    return { url: data.url, type: file.type.startsWith('video') ? 'video' : 'image' };
  }, []);

  const handleUploadCreativeRef = useCallback(
    async (file: File) => {
      setCreativeRefUploading(true);
      try {
        const media = await uploadMedia(file);
        setCreativeRefs((prev) => [...prev, media].slice(0, 6));
      } catch {
        // 上传失败静默：面板上有上传按钮可重试
      } finally {
        setCreativeRefUploading(false);
      }
    },
    [uploadMedia],
  );

  const handleUploadImitateFile = useCallback(
    async (file: File) => {
      setImitateFileUploading(true);
      try {
        const media = await uploadMedia(file);
        setImitateFile(media);
      } catch {
        // 同上
      } finally {
        setImitateFileUploading(false);
      }
    },
    [uploadMedia],
  );

  const handleUploadProtagonist = useCallback(
    async (file: File) => {
      setProtagonistUploading(true);
      try {
        const media = await uploadMedia(file);
        setProtagonistUrl(media.url);
      } catch {
        // 同上
      } finally {
        setProtagonistUploading(false);
      }
    },
    [uploadMedia],
  );

  const handleRefImageUpload = useCallback(
    async (file: File) => {
      setRefImageUploading(true);
      setRefImageError('');
      try {
        const media = await uploadMedia(file);
        setRefImageUrl(media.url);
      } catch (e) {
        setRefImageError(e instanceof Error ? e.message : '上传失败');
      } finally {
        setRefImageUploading(false);
      }
    },
    [uploadMedia],
  );

  /** 链接识别模仿：流式读取拉片分析 */
  const analyzeLink = useCallback(async () => {
    const url = imitateLink.trim();
    if (!/^https?:\/\//.test(url)) return;
    setLinkAnalyzing(true);
    setLinkAnalysis('');
    try {
      const res = await fetch('/api/analyze-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok || !res.body) throw new Error(`请求失败 (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setLinkAnalysis(acc);
      }
      const errIdx = acc.indexOf('__ERROR__');
      if (errIdx >= 0) {
        throw new Error(acc.slice(errIdx + 9).trim() || '链接识别失败');
      }
    } catch (e) {
      setLinkAnalysis('');
      setScriptError(e instanceof Error ? e.message : '链接识别失败');
    } finally {
      setLinkAnalyzing(false);
    }
  }, [imitateLink]);

  /** 创意画布：拖拽排序分镜 */
  const moveScene = useCallback((from: number, to: number) => {
    setScript((prev) => {
      if (
        !prev ||
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= prev.scenes.length ||
        to >= prev.scenes.length
      ) {
        return prev;
      }
      const scenes = [...prev.scenes];
      const [moved] = scenes.splice(from, 1);
      scenes.splice(to, 0, moved);
      return { ...prev, scenes };
    });
  }, []);

  /** 创意画布：删除分镜（至少保留一镜） */
  const deleteScene = useCallback((id: number) => {
    setScript((prev) => {
      if (!prev || prev.scenes.length <= 1) return prev;
      return { ...prev, scenes: prev.scenes.filter((s) => s.id !== id) };
    });
    setAssets((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  /** 创意画布：新增空白分镜 */
  const addScene = useCallback(() => {
    setScript((prev) => {
      if (!prev || prev.scenes.length >= 20) return prev;
      const nextId = prev.scenes.reduce((m, s) => Math.max(m, s.id), 0) + 1;
      return {
        ...prev,
        scenes: [
          ...prev.scenes,
          { id: nextId, title: `新分镜 ${nextId}`, visualPrompt: '', narration: '', duration: 5 },
        ],
      };
    });
  }, []);

  /** 创意画布：点击定位到对应分镜卡片 */
  const scrollToScene = useCallback((id: number) => {
    document
      .getElementById(`scene-card-${id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  /** 上传图片直接替换某个分镜的画面（旧视频随之失效） */
  const handleSceneImageUpload = useCallback(
    async (sceneId: number, file: File) => {
      patchAssets(sceneId, { imageStatus: 'loading', imageError: undefined });
      try {
        const media = await uploadMedia(file);
        patchAssets(sceneId, {
          imageStatus: 'done',
          imageUrl: media.url,
          videoStatus: 'idle',
          videoUrl: undefined,
          videoError: undefined,
        });
      } catch (e) {
        patchAssets(sceneId, {
          imageStatus: 'error',
          imageError: e instanceof Error ? e.message : '上传失败',
        });
      }
    },
    [patchAssets, uploadMedia],
  );

  /** 上传音频直接替换某个分镜的配音 */
  const handleSceneAudioUpload = useCallback(
    async (sceneId: number, file: File) => {
      patchAssets(sceneId, { audioStatus: 'loading', audioError: undefined });
      try {
        const media = await uploadMedia(file);
        patchAssets(sceneId, { audioStatus: 'done', audioUrl: media.url });
      } catch (e) {
        patchAssets(sceneId, {
          audioStatus: 'error',
          audioError: e instanceof Error ? e.message : '上传失败',
        });
      }
    },
    [patchAssets, uploadMedia],
  );

  const updateScene = useCallback((id: number, patch: Partial<Scene>) => {
    setScript((prev) =>
      prev
        ? { ...prev, scenes: prev.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) }
        : prev,
    );
  }, []);

  /** 脚本生成通用流程：流式读取 → 解析 → 初始化资产 */
  const runScriptRequest = useCallback(
    async (fetcher: () => Promise<Response>): Promise<ScriptResult | null> => {
      setScriptPhase('loading');
      setScriptError('');
      setScriptRaw('');
      setScript(null);
      setAssets({});
      setCanvasConfirmed(false);
      setFinalUrl('');
      setComposeStatus('idle');
      try {
        const res = await fetcher();
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error || `请求失败 (${res.status})`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setScriptRaw(acc);
          scriptMonitorRef.current?.scrollTo({ top: scriptMonitorRef.current.scrollHeight });
        }
        const parsed = parseScript(acc);
        setScript(parsed);
        setScriptPhase('done');
        const init: Record<number, SceneAssets> = {};
        parsed.scenes.forEach((s) => {
          init[s.id] = emptyAssets();
        });
        setAssets(init);
        return parsed;
      } catch (e) {
        setScriptError(e instanceof Error ? e.message : '脚本生成失败');
        setScriptPhase('error');
        return null;
      }
    },
    [],
  );

  /** 创意端口：仅按诉求直接生成脚本 */
  const generateScript = useCallback((): Promise<ScriptResult | null> => {
    if (!topic.trim()) {
      setScriptError('先写下你的故事诉求');
      setScriptPhase('error');
      return Promise.resolve(null);
    }
    return runScriptRequest(() =>
      fetch('/api/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), sceneCount, style }),
      }),
    );
  }, [topic, sceneCount, style, runScriptRequest]);

  /** 创意端口：拆解参考照片/视频生成分镜脚本 */
  const generateScriptFromRef = useCallback((): Promise<ScriptResult | null> => {
    const imageUrls = creativeRefs.filter((r) => r.type === 'image').map((r) => r.url);
    const video = creativeRefs.find((r) => r.type === 'video');
    return runScriptRequest(() =>
      fetch('/api/analyze-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'creative',
          topic: topic.trim() || undefined,
          imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
          videoUrl: video?.url,
          sceneCount,
          style,
        }),
      }),
    );
  }, [creativeRefs, topic, sceneCount, style, runScriptRequest]);

  /** 模仿端口：基于上传素材/链接分析生成模仿脚本 */
  const generateImitateScript = useCallback((): Promise<ScriptResult | null> => {
    const payload: Record<string, unknown> = {
      mode: 'imitate',
      sceneCount,
      style,
      detail: detail.trim() || undefined,
      protagonistUrl: protagonistUrl || undefined,
    };
    if (imitateInputType === 'upload') {
      if (!imitateFile) {
        setScriptError('先上传要模仿的图片或视频');
        setScriptPhase('error');
        return Promise.resolve(null);
      }
      if (imitateFile.type === 'image') payload.imageUrls = [imitateFile.url];
      else payload.videoUrl = imitateFile.url;
    } else {
      if (!linkAnalysis.trim()) {
        setScriptError('先点「识别分析视频」完成链接拆解');
        setScriptPhase('error');
        return Promise.resolve(null);
      }
      payload.linkAnalysis = linkAnalysis;
      payload.videoUrl = imitateLink.trim();
    }
    return runScriptRequest(() =>
      fetch('/api/analyze-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );
  }, [imitateInputType, imitateFile, linkAnalysis, imitateLink, detail, protagonistUrl, sceneCount, style, runScriptRequest]);

  /** 一键全自动时按当前模式与素材选择脚本入口 */
  const generateScriptByMode = useCallback((): Promise<ScriptResult | null> => {
    if (mode === 'imitate') return generateImitateScript();
    if (creativeRefs.length > 0) return generateScriptFromRef();
    return generateScript();
  }, [mode, generateImitateScript, generateScriptFromRef, generateScript, creativeRefs.length]);

  const generateImage = useCallback(
    async (scene: Scene): Promise<string | null> => {
      const effStyle = styleByScene[scene.id] || style;
      const effRatio = ratioByScene[scene.id] || ratio;
      // 主角形象优先作为生图参考，保证全片主角一致
      const referenceImageUrl = protagonistUrl || refImageUrl || undefined;
      patchAssets(scene.id, { imageStatus: 'loading', imageError: undefined });
      try {
        const res = await fetch('/api/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `${effStyle}风格。${scene.visualPrompt}`,
            ratio: effRatio,
            resolution: imageRes,
            referenceImageUrl,
          }),
        });
        const data = (await res.json()) as { imageUrl?: string; error?: string };
        if (!res.ok || !data.imageUrl) throw new Error(data.error || '图片生成失败');
        // 画面更新后，旧视频随之失效
        patchAssets(scene.id, {
          imageStatus: 'done',
          imageUrl: data.imageUrl,
          videoStatus: 'idle',
          videoUrl: undefined,
          videoError: undefined,
        });
        return data.imageUrl;
      } catch (e) {
        patchAssets(scene.id, {
          imageStatus: 'error',
          imageError: e instanceof Error ? e.message : '图片生成失败',
        });
        return null;
      }
    },
    [patchAssets, ratio, style, styleByScene, ratioByScene, imageRes, refImageUrl, protagonistUrl],
  );

  const generateAllImages = useCallback(
    async (scenes: Scene[]): Promise<Record<number, string>> => {
      setImagesRunning(true);
      const map: Record<number, string> = {};
      // 四路并行出图，缩短整体等待
      for (let i = 0; i < scenes.length; i += 4) {
        const batch = scenes.slice(i, i + 4);
        const results = await Promise.all(batch.map((s) => generateImage(s)));
        batch.forEach((s, j) => {
          const url = results[j];
          if (url) map[s.id] = url;
        });
      }
      setImagesRunning(false);
      return map;
    },
    [generateImage],
  );

  /** 视频生成借鉴的参考视频：模仿端口取模仿对象，创意端口取参考素材中的视频 */
  const referenceVideoForGeneration = useMemo(() => {
    if (mode === 'imitate') {
      if (imitateFile?.type === 'video') return imitateFile.url;
      if (/^https?:\/\//.test(imitateLink.trim())) return imitateLink.trim();
      return '';
    }
    const v = creativeRefs.find((r) => r.type === 'video');
    return v ? v.url : '';
  }, [mode, imitateFile, imitateLink, creativeRefs]);

  const generateVideo = useCallback(
    async (scene: Scene, imageUrl: string | undefined, musicStyle: string): Promise<string | null> => {
      const effRatio = ratioByScene[scene.id] || ratio;
      const effRes = resByScene[scene.id] || videoRes;
      patchAssets(scene.id, { videoStatus: 'loading', videoError: undefined });
      try {
        const res = await fetch('/api/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: scene.visualPrompt,
            imageUrl,
            duration: scene.duration,
            ratio: effRatio,
            musicStyle,
            resolution: effRes,
            referenceVideoUrl: referenceVideoForGeneration || undefined,
            withAudio,
          }),
        });
        const data = (await res.json()) as { videoUrl?: string; error?: string };
        if (!res.ok || !data.videoUrl) throw new Error(data.error || '视频生成失败');
        patchAssets(scene.id, { videoStatus: 'done', videoUrl: data.videoUrl });
        return data.videoUrl;
      } catch (e) {
        patchAssets(scene.id, {
          videoStatus: 'error',
          videoError: e instanceof Error ? e.message : '视频生成失败',
        });
        return null;
      }
    },
    [patchAssets, ratio, referenceVideoForGeneration, ratioByScene, resByScene, videoRes, withAudio],
  );

  const generateAllVideos = useCallback(
    async (scenes: Scene[], imageMap: Record<number, string>, musicStyle: string) => {
      setVideosRunning(true);
      const map: Record<number, string> = {};
      // 三路并行生成视频（视频是最耗时环节，并行可省一半以上时间；三路避免触发模型并发限流）
      for (let i = 0; i < scenes.length; i += 3) {
        const batch = scenes.slice(i, i + 3);
        const results = await Promise.all(batch.map((s) => generateVideo(s, imageMap[s.id], musicStyle)));
        batch.forEach((s, j) => {
          const url = results[j];
          if (url) map[s.id] = url;
        });
      }
      setVideosRunning(false);
      return map;
    },
    [generateVideo],
  );

  /** 逐镜配音：用本镜旁白文案 + 当前音色合成 */
  const generateSceneAudio = useCallback(
    async (scene: Scene): Promise<string | null> => {
      if (!scene.narration.trim()) return null;
      patchAssets(scene.id, { audioStatus: 'loading', audioError: undefined });
      try {
        const res = await fetch('/api/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: scene.narration, speaker }),
        });
        const data = (await res.json()) as { audioUrl?: string; error?: string };
        if (!res.ok || !data.audioUrl) throw new Error(data.error || '配音生成失败');
        patchAssets(scene.id, { audioStatus: 'done', audioUrl: data.audioUrl });
        return data.audioUrl;
      } catch (e) {
        patchAssets(scene.id, {
          audioStatus: 'error',
          audioError: e instanceof Error ? e.message : '配音生成失败',
        });
        return null;
      }
    },
    [patchAssets, speaker],
  );

  const generateAllAudios = useCallback(
    async (scenes: Scene[]): Promise<Record<number, string>> => {
      setAudiosRunning(true);
      const map: Record<number, string> = {};
      for (let i = 0; i < scenes.length; i += 4) {
        const batch = scenes.slice(i, i + 4);
        const results = await Promise.all(batch.map((s) => generateSceneAudio(s)));
        batch.forEach((s, j) => {
          const url = results[j];
          if (url) map[s.id] = url;
        });
      }
      setAudiosRunning(false);
      return map;
    },
    [generateSceneAudio],
  );

  /** 合成成片：逐镜混音（音画对齐）→ 转场拼接 */
  const composeFilm = useCallback(
    async (
      scenes: Scene[],
      videoMap: Record<number, string>,
      audioMap: Record<number, string>,
    ) => {
      const ordered = scenes
        .map((s): { video: string | undefined; audio: string | null } => ({
          video: videoMap[s.id],
          audio: audioMap[s.id] ?? null,
        }))
        .filter((x): x is { video: string; audio: string | null } => Boolean(x.video));
      if (ordered.length === 0) {
        setComposeError('没有可用的视频片段');
        setComposeStatus('error');
        return;
      }
      setComposeStatus('loading');
      setComposeError('');
      try {
        const res = await fetch('/api/compose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoUrls: ordered.map((x) => x.video),
            sceneAudios: ordered.map((x) => x.audio),
          }),
        });
        const data = (await res.json()) as { finalUrl?: string; error?: string };
        if (!res.ok || !data.finalUrl) throw new Error(data.error || '成片合成失败');
        setFinalUrl(data.finalUrl);
        setComposeStatus('done');
      } catch (e) {
        setComposeError(e instanceof Error ? e.message : '成片合成失败');
        setComposeStatus('error');
      }
    },
    [],
  );

  const runAuto = useCallback(async () => {
    setAutoRunning(true);
    const result = await generateScriptByMode();
    if (!result) {
      setAutoRunning(false);
      return;
    }
    const imageMap = await generateAllImages(result.scenes);
    setCanvasConfirmed(true);
    const [videoMap, audioMap] = await Promise.all([
      generateAllVideos(result.scenes, imageMap, result.musicStyle),
      generateAllAudios(result.scenes),
    ]);
    await composeFilm(result.scenes, videoMap, audioMap);
    setAutoRunning(false);
  }, [generateScriptByMode, generateAllImages, generateAllVideos, generateAllAudios, composeFilm]);

  const videoReadyMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (script) {
      script.scenes.forEach((s) => {
        const v = assets[s.id]?.videoUrl;
        if (v) map[s.id] = v;
      });
    }
    return map;
  }, [script, assets]);

  const audioReadyMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (script) {
      script.scenes.forEach((s) => {
        const u = assets[s.id]?.audioUrl;
        if (u) map[s.id] = u;
      });
    }
    return map;
  }, [script, assets]);

  const imagesAllDone = useMemo(
    () => Boolean(script) && script!.scenes.every((s) => assets[s.id]?.imageUrl),
    [script, assets],
  );

  const steps = useMemo(() => {
    const imageList = script?.scenes.map((s) => getAssets(s.id).imageStatus) ?? [];
    const videoList = script?.scenes.map((s) => getAssets(s.id).videoStatus) ?? [];
    const audioList = script?.scenes.map((s) => getAssets(s.id).audioStatus) ?? [];
    const agg = (list: AssetStatus[]): AssetStatus => {
      if (list.length === 0) return 'idle';
      if (list.every((s) => s === 'done')) return 'done';
      if (list.some((s) => s === 'loading')) return 'loading';
      if (list.some((s) => s === 'error')) return 'error';
      return 'idle';
    };
    return {
      script: scriptPhase === 'loading' ? 'loading' : scriptPhase,
      image: agg(imageList),
      video: agg(videoList),
      voice: agg(audioList),
      film: composeStatus,
    } as Record<string, AssetStatus>;
  }, [script, assets, scriptPhase, composeStatus, getAssets]);

  const totalDuration = script?.scenes.reduce((sum, s) => sum + s.duration, 0) ?? 0;

  /** 把当前创作存入草稿箱（同主题覆盖旧草稿） */
  const saveDraft = useCallback(() => {
    if (!script) return;
    const name = topic.trim() || script.title || '未命名草稿';
    const draft: Draft = {
      id: name,
      name,
      savedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      mode,
      topic,
      style,
      sceneCount,
      ratio,
      speaker,
      creativeRefs,
      imitateInputType,
      imitateFile,
      imitateLink,
      linkAnalysis,
      protagonistUrl,
      detail,
      refImageUrl,
      script,
      assets,
      canvasConfirmed,
      styleByScene,
      ratioByScene,
      imageRes,
      videoRes,
      resByScene,
      withAudio,
      finalUrl,
    };
    setDrafts((prev) => {
      const next = [draft, ...prev.filter((d) => d.id !== draft.id)].slice(0, 20);
      try {
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
      } catch {
        // 存储超限时忽略
      }
      return next;
    });
    setDraftSavedTip(true);
    setTimeout(() => setDraftSavedTip(false), 1500);
  }, [script, topic, mode, style, sceneCount, ratio, speaker, creativeRefs, imitateInputType, imitateFile, imitateLink, linkAnalysis, protagonistUrl, detail, refImageUrl, assets, canvasConfirmed, styleByScene, ratioByScene, imageRes, videoRes, resByScene, withAudio, finalUrl]);

  /** 从草稿箱载入一份草稿到工作台 */
  const loadDraft = useCallback((d: Draft) => {
    setMode(d.mode || 'creative');
    setTopic(d.topic || '');
    setStyle(d.style || STYLES[0]);
    setSceneCount(d.sceneCount || 4);
    setRatio(d.ratio || '16:9');
    setSpeaker(d.speaker || VOICES[0].id);
    setCreativeRefs(d.creativeRefs || []);
    setImitateInputType(d.imitateInputType || 'upload');
    setImitateFile(d.imitateFile || null);
    setImitateLink(d.imitateLink || '');
    setLinkAnalysis(d.linkAnalysis || '');
    setProtagonistUrl(d.protagonistUrl || '');
    setDetail(d.detail || '');
    setRefImageUrl(d.refImageUrl || '');
    setScript(d.script);
    setScriptRaw('');
    setScriptPhase(d.script ? 'done' : 'idle');
    setScriptError('');
    setAssets(reviveAssets(d.assets || {}));
    setCanvasConfirmed(d.canvasConfirmed || false);
    setStyleByScene(d.styleByScene || {});
    setRatioByScene(d.ratioByScene || {});
    setImageRes(d.imageRes || '2K');
    setVideoRes(d.videoRes || '480p');
    setResByScene(d.resByScene || {});
    setWithAudio(d.withAudio ?? false);
    setFinalUrl(d.finalUrl || '');
    setComposeStatus(d.finalUrl ? 'done' : 'idle');
    setComposeError('');
    setShowDrafts(false);
  }, []);

  const deleteDraft = useCallback((id: string) => {
    setDrafts((prev) => {
      const next = prev.filter((d) => d.id !== id);
      try {
        localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 顶栏 */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Clapperboard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-medium tracking-[0.3em]">CINEFLOW 片场</h1>
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground">
                AI VIDEO STUDIO
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 rounded-md border border-border p-1">
              <button
                type="button"
                onClick={resetWorkspace}
                disabled={autoRunning}
                title="清空当前工作台，开始新项目（已存草稿不受影响）"
                className="flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px] tracking-widest text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40"
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                新建
              </button>
              <button
                type="button"
                onClick={saveDraft}
                disabled={!script || autoRunning}
                title="把当前全部进度存入草稿箱"
                className="flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px] tracking-widest text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
                {draftSavedTip ? '已存✓' : '保存'}
              </button>
              <button
                type="button"
                onClick={() => setShowAssets(true)}
                title="查看当前项目与草稿中的所有素材"
                className="flex items-center gap-1 rounded px-2 py-1 font-mono text-[10px] tracking-widest text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                资产记录
              </button>
            </div>
            <div className="hidden items-center gap-5 md:flex">
              <StepNode label="脚本" status={steps.script} />
              <StepNode label="画面" status={steps.image} />
              <StepNode label="视频" status={steps.video} />
              <StepNode label="声音" status={steps.voice} />
              <StepNode label="成片" status={steps.film} />
            </div>
            <div className="flex items-center gap-1.5 rounded border border-border px-2 py-1">
              <CircleDot
                className={cn('h-3 w-3', autoRunning ? 'text-destructive lamp-loading' : 'text-muted-foreground')}
              />
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                {autoRunning ? 'REC' : 'STANDBY'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[340px_1fr]">
        {/* 左侧：控制台（双端口切换） */}
        <aside className="space-y-5">
          <section className="rounded-lg border border-border bg-secondary p-5">
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-md border border-border p-1">
              <button
                type="button"
                onClick={() => setMode('creative')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded px-2 py-2 text-xs font-medium tracking-widest transition-colors',
                  mode === 'creative'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Lightbulb className="h-3.5 w-3.5" />
                创意端口
              </button>
              <button
                type="button"
                onClick={() => setMode('imitate')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded px-2 py-2 text-xs font-medium tracking-widest transition-colors',
                  mode === 'imitate'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Repeat className="h-3.5 w-3.5" />
                模仿端口
              </button>
            </div>

            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium tracking-widest">
                {mode === 'creative' ? '创意控制台' : '模仿控制台'}
              </h2>
              {script && (
                <div className="ml-auto flex items-center gap-3">
                  <button
                    type="button"
                    onClick={saveDraft}
                    className="font-mono text-[10px] tracking-widest text-primary/90 transition-colors hover:text-primary"
                  >
                    {draftSavedTip ? '已存 ✓' : '存草稿'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDrafts(true)}
                    className="font-mono text-[10px] tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                  >
                    草稿箱({drafts.length})
                  </button>
                </div>
              )}
            </div>

            {mode === 'creative' ? (
              <CreativePanel
                topic={topic}
                setTopic={setTopic}
                style={style}
                setStyle={setStyle}
                sceneCount={sceneCount}
                setSceneCount={setSceneCount}
                ratio={ratio}
                setRatio={setRatio}
                imageRes={imageRes}
                setImageRes={setImageRes}
                videoRes={videoRes}
                setVideoRes={setVideoRes}
                withAudio={withAudio}
                setWithAudio={setWithAudio}
                speaker={speaker}
                setSpeaker={setSpeaker}
                creativeRefs={creativeRefs}
                refUploading={creativeRefUploading}
                onUploadRef={(f) => void handleUploadCreativeRef(f)}
                onRemoveRef={(url) => setCreativeRefs((prev) => prev.filter((r) => r.url !== url))}
                refImageUrl={refImageUrl}
                refImageUploading={refImageUploading}
                refImageError={refImageError}
                onUploadRefImage={(f) => void handleRefImageUpload(f)}
                onClearRefImage={() => setRefImageUrl('')}
                scriptPhase={scriptPhase}
                scriptError={scriptError}
                autoRunning={autoRunning}
                onGenerateDirect={() => void generateScript()}
                onGenerateFromRef={() => void generateScriptFromRef()}
                onRunAuto={() => void runAuto()}
              />
            ) : (
              <ImitatePanel
                inputType={imitateInputType}
                setInputType={setImitateInputType}
                imitateFile={imitateFile}
                fileUploading={imitateFileUploading}
                onUploadFile={(f) => void handleUploadImitateFile(f)}
                onClearFile={() => setImitateFile(null)}
                link={imitateLink}
                setLink={setImitateLink}
                linkAnalysis={linkAnalysis}
                linkAnalyzing={linkAnalyzing}
                onAnalyzeLink={() => void analyzeLink()}
                protagonistUrl={protagonistUrl}
                protagonistUploading={protagonistUploading}
                onUploadProtagonist={(f) => void handleUploadProtagonist(f)}
                onClearProtagonist={() => setProtagonistUrl('')}
                detail={detail}
                setDetail={setDetail}
                speaker={speaker}
                setSpeaker={setSpeaker}
                withAudio={withAudio}
                setWithAudio={setWithAudio}
                style={style}
                setStyle={setStyle}
                sceneCount={sceneCount}
                setSceneCount={setSceneCount}
                ratio={ratio}
                setRatio={setRatio}
                scriptPhase={scriptPhase}
                scriptError={scriptError}
                autoRunning={autoRunning}
                canGenerate={
                  imitateInputType === 'upload' ? Boolean(imitateFile) : Boolean(linkAnalysis.trim())
                }
                onGenerateScript={() => void generateImitateScript()}
                onRunAuto={() => void runAuto()}
              />
            )}
          </section>

          <section className="rounded-lg border border-border bg-secondary p-5">
            <div className="mb-3 flex items-center gap-2">
              <Music className="h-4 w-4 text-[#4FD1C5]" />
              <h2 className="text-sm font-medium tracking-widest">流程说明</h2>
            </div>
            <ol className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li className="flex gap-2"><span className="font-mono text-primary">01</span>大模型拆解诉求/参考素材，产出分镜脚本与配乐风格</li>
              <li className="flex gap-2"><span className="font-mono text-primary">02</span>每个分镜生成电影级画面，画布中逐镜整改</li>
              <li className="flex gap-2"><span className="font-mono text-primary">03</span>确认画面后开拍，Seedance 同步生成环境音与配乐</li>
              <li className="flex gap-2"><span className="font-mono text-primary">04</span>每镜独立合成 TTS 配音，可单独修改重出</li>
              <li className="flex gap-2"><span className="font-mono text-primary">05</span>逐镜混音（音画对齐）+ 转场拼接，输出成片</li>
            </ol>
          </section>
        </aside>

        {/* 右侧：工作区 */}
        <div className="space-y-6">
          {/* 脚本监视器 */}
          <section className="rounded-lg border border-border bg-secondary">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <Lamp status={steps.script} />
                <h2 className="text-sm font-medium tracking-widest">脚本监视器</h2>
              </div>
              {script && (
                <div className="flex items-center gap-3 font-mono text-[10px] tracking-widest text-muted-foreground">
                  <span className="text-primary">{script.title}</span>
                  <span>{script.scenes.length} SCENES</span>
                  <span>{totalDuration}s</span>
                </div>
              )}
            </div>
            <div
              ref={scriptMonitorRef}
              className={cn(
                'max-h-56 overflow-y-auto px-5 py-4',
                scriptPhase === 'loading' && 'scanlines',
              )}
            >
              {!script && scriptPhase !== 'loading' && scriptPhase !== 'error' && (
                <p className="py-6 text-center font-mono text-xs tracking-widest text-muted-foreground/60">
                  STANDBY — 等待{mode === 'creative' ? '创意输入' : '模仿对象'}
                </p>
              )}
              {scriptPhase === 'error' && (
                <p className="py-6 text-center font-mono text-xs tracking-widest text-destructive">
                  ERROR — {scriptError}
                </p>
              )}
              {!script && scriptRaw && (
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
                  {scriptRaw}
                  {scriptPhase === 'loading' && <span className="text-[#4FD1C5]">▌</span>}
                </pre>
              )}
              {script && (
                <div className="space-y-1">
                  <p className="font-mono text-xs text-muted-foreground">
                    配乐风格：<span className="text-[#4FD1C5]">{script.musicStyle}</span>
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    分镜脚本已就绪，可在下方场记板中微调画面提示词与旁白。
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* 创意画布：分镜画面整改进度总览（拖拽排序 / 删除 / 新增 / 点击定位编辑） */}
          {script && (
            <section className="rounded-lg border border-border bg-secondary">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-medium tracking-widest">画面画布</h2>
                  <span className="font-mono text-[10px] tracking-widest text-muted-foreground/60">
                    逐镜整改 · 确认后开拍
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                    {script.scenes.filter((s) => getAssets(s.id).imageUrl).length}/{script.scenes.length} 画面已就绪
                  </span>
                  <Button
                    size="sm"
                    variant={canvasConfirmed ? 'outline' : 'default'}
                    disabled={!imagesAllDone || imagesRunning || autoRunning}
                    onClick={() => setCanvasConfirmed(true)}
                    title="确认全部画面整改完成，解锁视频拍摄"
                    className={cn(
                      'h-7 text-xs',
                      canvasConfirmed
                        ? 'border-[#4FD1C5]/50 bg-transparent text-[#4FD1C5]'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90',
                    )}
                  >
                    {canvasConfirmed ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        画面已确认 · 可拍摄
                      </>
                    ) : (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        确认画面 · 进入拍摄
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto px-5 py-4">
                {script.scenes.map((scene, index) => {
                  const a = getAssets(scene.id);
                  return (
                    <div
                      key={scene.id}
                      draggable
                      onDragStart={() => {
                        dragSceneIdxRef.current = index;
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        const from = dragSceneIdxRef.current;
                        if (from !== null) moveScene(from, index);
                        dragSceneIdxRef.current = null;
                      }}
                      onClick={() => scrollToScene(scene.id)}
                      title="拖拽调整顺序，点击定位到分镜卡片编辑"
                      className="group relative w-36 shrink-0 cursor-grab overflow-hidden rounded-md border border-border bg-black transition-colors hover:border-primary/60 active:cursor-grabbing"
                    >
                      <div className="aspect-video w-full">
                        {a.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.imageUrl} alt={scene.title} className="h-full w-full object-cover" />
                        ) : (
                          <div
                            className={cn(
                              'flex h-full items-center justify-center',
                              a.imageStatus === 'loading' && 'scanlines',
                            )}
                          >
                            {a.imageStatus === 'loading' ? (
                              <Loader2 className="h-4 w-4 animate-spin text-[#4FD1C5]" />
                            ) : (
                              <span className="font-mono text-[10px] tracking-widest text-muted-foreground/40">
                                EMPTY
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label="删除此分镜"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteScene(scene.id);
                        }}
                        className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded bg-black/70 text-muted-foreground hover:bg-[#E5484D] hover:text-white group-hover:flex"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="flex items-center justify-between px-2 py-1">
                        <span className="font-mono text-[9px] tracking-widest text-primary">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <Lamp status={a.videoStatus === 'done' ? 'done' : a.imageStatus} />
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={addScene}
                  title="新增空白分镜"
                  className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 self-stretch rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
                >
                  <Plus className="h-4 w-4" />
                  <span className="font-mono text-[9px] tracking-widest">添加分镜</span>
                </button>
              </div>
            </section>
          )}

          {/* 分镜场记板 */}
          {script && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-medium tracking-widest">分镜场记板</h2>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={imagesRunning || videosRunning || autoRunning}
                    onClick={() => void generateAllImages(script.scenes)}
                    className="border-border bg-transparent text-xs hover:border-primary/50"
                  >
                    {imagesRunning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="mr-1.5 h-3.5 w-3.5" />}
                    全部生成画面
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={imagesRunning || videosRunning || autoRunning || !canvasConfirmed}
                    title={!canvasConfirmed ? '先在画布确认全部画面，再开始拍摄' : undefined}
                    onClick={() =>
                      void generateAllVideos(
                        script.scenes,
                        Object.fromEntries(
                          script.scenes
                            .map((s): [number, string | undefined] => [s.id, assets[s.id]?.imageUrl])
                            .filter((entry): entry is [number, string] => Boolean(entry[1])),
                        ),
                        script.musicStyle,
                      )
                    }
                    className="border-border bg-transparent text-xs hover:border-primary/50"
                  >
                    {videosRunning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : canvasConfirmed ? <MonitorPlay className="mr-1.5 h-3.5 w-3.5" /> : <Lock className="mr-1.5 h-3.5 w-3.5" />}
                    全部生成视频
                  </Button>
                </div>
              </div>
              {!canvasConfirmed && imagesAllDone && (
                <p className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-500/90">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  全部画面已就绪。请在画布或场记板中逐镜整改，确认无误后点上方「确认画面 · 进入拍摄」解锁视频生成。
                </p>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                {script.scenes.map((scene) => (
                  <SceneCard
                    key={scene.id}
                    scene={scene}
                    assets={getAssets(scene.id)}
                    globalStyle={style}
                    globalRatio={ratio}
                    globalVideoRes={videoRes}
                    styleByScene={styleByScene[scene.id]}
                    ratioByScene={ratioByScene[scene.id]}
                    resByScene={resByScene[scene.id]}
                    autoRunning={autoRunning}
                    videosLocked={!canvasConfirmed}
                    onGenerateImage={(s) => void generateImage(s)}
                    onGenerateVideo={(s) => void generateVideo(s, getAssets(s.id).imageUrl, script.musicStyle)}
                    onGenerateAudio={(s) => void generateSceneAudio(s)}
                    onUploadImage={(id) => {
                      sceneUploadTargetRef.current = id;
                      sceneImageInputRef.current?.click();
                    }}
                    onUploadAudio={(id) => {
                      sceneAudioTargetRef.current = id;
                      sceneAudioInputRef.current?.click();
                    }}
                    onUpdateScene={updateScene}
                    onStyleChange={(id, v) => setStyleByScene((p) => ({ ...p, [id]: v }))}
                    onRatioChange={(id, v) => setRatioByScene((p) => ({ ...p, [id]: v }))}
                    onResChange={(id, v) => setResByScene((p) => ({ ...p, [id]: v }))}
                    onDownload={(url, name) => void downloadFile(url, name)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 声音棚：逐镜配音总控 */}
          {script && (
            <section className="rounded-lg border border-border bg-secondary">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="flex items-center gap-2">
                  <Lamp status={steps.voice} />
                  <Mic className="h-4 w-4 text-[#4FD1C5]" />
                  <h2 className="text-sm font-medium tracking-widest">声音棚</h2>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={audiosRunning || autoRunning}
                  onClick={() => void generateAllAudios(script.scenes)}
                  className="border-border bg-transparent text-xs hover:border-primary/50"
                >
                  {audiosRunning ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Mic className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  全部生成配音
                </Button>
              </div>
              <div className="space-y-3 px-5 py-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  每个分镜独立配音（当前音色：{VOICES.find((v) => v.id === speaker)?.name}），合成成片时逐镜混音、音画严格对齐。单镜配音可在分镜卡片的「音频区」试听、改文案重出或上传本地音频替换；环境音与配乐（{script.musicStyle}）已随各视频片段由 Seedance 同步生成。
                </p>
                <p className="font-mono text-[10px] tracking-widest text-muted-foreground">
                  {Object.keys(audioReadyMap).length}/{script.scenes.length} 配音已就绪
                </p>
              </div>
            </section>
          )}

          {/* 成片放映厅 */}
          {script && (
            <section className="rounded-lg border border-border bg-secondary">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="flex items-center gap-2">
                  <Lamp status={composeStatus} />
                  <MonitorPlay className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-medium tracking-widest">成片放映厅</h2>
                </div>
                <div className="flex items-center gap-2">
                  {finalUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void downloadFile(finalUrl, `${script.title || 'cineflow'}.mp4`)}
                      className="border-border bg-transparent text-xs hover:border-primary/50"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      下载成片
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={
                      composeStatus === 'loading' ||
                      autoRunning ||
                      Object.keys(videoReadyMap).length === 0
                    }
                    onClick={() => void composeFilm(script.scenes, videoReadyMap, audioReadyMap)}
                    className="bg-primary text-xs text-primary-foreground hover:bg-primary/90"
                  >
                    {composeStatus === 'loading' ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Film className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    合成成片
                  </Button>
                </div>
              </div>
              <div className="px-5 py-4">
                {composeError && <p className="mb-3 text-xs text-destructive">{composeError}</p>}
                {finalUrl ? (
                  <div className="fade-from-black overflow-hidden rounded-md border border-border bg-black">
                    <video src={finalUrl} controls autoPlay className="mx-auto max-h-[480px] w-full object-contain" />
                  </div>
                ) : (
                  <div
                    className={cn(
                      'flex aspect-video flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border text-muted-foreground/50',
                      composeStatus === 'loading' && 'scanlines',
                    )}
                  >
                    {composeStatus === 'loading' ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-[#4FD1C5]" />
                        <span className="font-mono text-[10px] tracking-widest text-[#4FD1C5]">
                          COMPOSING · 逐镜混音与转场拼接中
                        </span>
                      </>
                    ) : (
                      <>
                        <Film className="h-5 w-5" />
                        <span className="font-mono text-[10px] tracking-widest">
                          {Object.keys(videoReadyMap).length > 0
                            ? `${Object.keys(videoReadyMap).length} 个片段就绪，确认修改完毕后合成`
                            : '等待视频片段'}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* 分镜画面替换用隐藏文件选择器 */}
      <input
        ref={sceneImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          const target = sceneUploadTargetRef.current;
          if (f && target !== null) void handleSceneImageUpload(target, f);
          sceneUploadTargetRef.current = null;
          e.target.value = '';
        }}
      />

      {/* 分镜配音替换用隐藏文件选择器 */}
      <input
        ref={sceneAudioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          const target = sceneAudioTargetRef.current;
          if (f && target !== null) void handleSceneAudioUpload(target, f);
          sceneAudioTargetRef.current = null;
          e.target.value = '';
        }}
      />

      {/* 草稿箱抽屉 */}
      {showDrafts && (
        <div
          className="fixed inset-0 z-50 bg-black/60"
          onClick={() => setShowDrafts(false)}
        >
          <aside
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-secondary"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-sm font-medium tracking-widest">
                草稿箱（{drafts.length}）
              </h3>
              <button
                type="button"
                onClick={() => setShowDrafts(false)}
                className="font-mono text-[10px] tracking-widest text-muted-foreground hover:text-foreground"
              >
                关闭
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {drafts.length === 0 && (
                <p className="py-10 text-center font-mono text-xs text-muted-foreground">
                  还没有草稿。生成脚本后点「存草稿」即可保存当前全部进度。
                </p>
              )}
              {drafts.map((d) => {
                const firstImg = Object.values(d.assets || {}).find(
                  (a) => a.imageUrl,
                )?.imageUrl;
                const videoCount = Object.values(d.assets || {}).filter(
                  (a) => a.videoUrl,
                ).length;
                return (
                  <div
                    key={d.id}
                    className="rounded-md border border-border bg-card p-3 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-start gap-3">
                      {firstImg && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={firstImg}
                          alt=""
                          className="h-12 w-20 shrink-0 rounded object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{d.name}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          {d.savedAt} · {d.script?.scenes.length ?? 0}镜 ·{' '}
                          {d.mode === 'imitate' ? '模仿' : '创意'} · {d.style} · 视频{videoCount}段
                          {d.finalUrl ? ' · 已出片' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => loadDraft(d)}
                        className="flex-1 rounded bg-primary px-2 py-1 font-mono text-[10px] tracking-widest text-primary-foreground hover:opacity-90"
                      >
                        载入续作
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDraft(d.id)}
                        className="rounded border border-border px-2 py-1 font-mono text-[10px] tracking-widest text-muted-foreground hover:border-destructive/50 hover:text-destructive"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      )}

      {/* 资产记录抽屉：当前项目 + 草稿中的全部素材 */}
      {showAssets &&
        (() => {
          interface AssetItem {
            kind: '成片' | '视频' | '画面' | '配音' | '参考图';
            name: string;
            url: string;
            source: string;
          }
          const collectAssets = (
            source: string,
            sc: ScriptResult | null,
            as: Record<number, SceneAssets>,
            final: string,
            items: AssetItem[],
          ) => {
            if (final) items.push({ kind: '成片', name: '最终成片.mp4', url: final, source });
            sc?.scenes.forEach((scene, i) => {
              const a = as[scene.id];
              if (a?.videoUrl) items.push({ kind: '视频', name: `分镜${i + 1}视频.mp4`, url: a.videoUrl, source });
              if (a?.imageUrl) items.push({ kind: '画面', name: `分镜${i + 1}画面.jpg`, url: a.imageUrl, source });
              if (a?.audioUrl) items.push({ kind: '配音', name: `分镜${i + 1}配音.mp3`, url: a.audioUrl, source });
            });
          };
          const items: AssetItem[] = [];
          collectAssets('当前项目', script, assets, finalUrl, items);
          if (refImageUrl) {
            items.push({ kind: '参考图', name: '全局参考图', url: refImageUrl, source: '当前项目' });
          }
          if (protagonistUrl) {
            items.push({ kind: '参考图', name: '主角形象', url: protagonistUrl, source: '当前项目' });
          }
          drafts.forEach((d) => {
            collectAssets(`草稿·${d.name}`, d.script, d.assets || {}, d.finalUrl || '', items);
          });
          const kindColor: Record<AssetItem['kind'], string> = {
            成片: 'text-primary border-primary/40',
            视频: 'text-[#4FD1C5] border-[#4FD1C5]/40',
            画面: 'text-foreground/80 border-border',
            配音: 'text-foreground/80 border-border',
            参考图: 'text-muted-foreground border-border',
          };
          return (
            <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowAssets(false)}>
              <aside
                className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-secondary"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <h3 className="text-sm font-medium tracking-widest">资产记录（{items.length}）</h3>
                  <button
                    type="button"
                    onClick={() => setShowAssets(false)}
                    className="font-mono text-[10px] tracking-widest text-muted-foreground hover:text-foreground"
                  >
                    关闭
                  </button>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-5">
                  {items.length === 0 && (
                    <p className="py-10 text-center font-mono text-xs text-muted-foreground">
                      还没有任何素材。生成画面、视频、配音或成片后会自动记录在这里。
                    </p>
                  )}
                  {items.map((item, idx) => (
                    <div
                      key={`${item.url}-${idx}`}
                      className="flex items-center gap-3 rounded-md border border-border bg-card p-2.5"
                    >
                      {item.kind === '画面' || item.kind === '参考图' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.url} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
                      ) : (
                        <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded bg-black/50">
                          {item.kind === '配音' ? (
                            <Mic className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Film className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'rounded-sm border px-1 font-mono text-[9px] tracking-widest',
                              kindColor[item.kind],
                            )}
                          >
                            {item.kind}
                          </span>
                          <p className="truncate text-xs">{item.name}</p>
                        </div>
                        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                          {item.source}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void downloadFile(item.url, item.name)}
                        title="下载"
                        className="rounded border border-border p-1.5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          );
        })()}

      <footer className="border-t border-border py-4 text-center font-mono text-[10px] tracking-widest text-muted-foreground/50">
        CINEFLOW STUDIO — SCRIPT / FRAME / MOTION / VOICE / FILM
      </footer>
    </div>
  );
}
