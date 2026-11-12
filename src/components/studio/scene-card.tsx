'use client';

import {
  Image as ImageIcon,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  Upload,
  Download,
  Wand2,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { STYLES } from '@/lib/studio-constants';
import type { Scene, SceneAssets } from '@/lib/types';
import { Lamp } from './lamp';

interface SceneCardProps {
  scene: Scene;
  assets: SceneAssets;
  globalStyle: string;
  globalRatio: '16:9' | '9:16';
  globalVideoRes: '480p' | '720p' | '1080p';
  styleByScene?: string;
  ratioByScene?: '16:9' | '9:16';
  resByScene?: '480p' | '720p' | '1080p';
  autoRunning: boolean;
  /** 画面画布未确认前，视频生成锁定 */
  videosLocked: boolean;
  onGenerateImage: (scene: Scene) => void;
  onGenerateVideo: (scene: Scene) => void;
  onGenerateAudio: (scene: Scene) => void;
  onUploadImage: (sceneId: number) => void;
  onUploadAudio: (sceneId: number) => void;
  onUpdateScene: (id: number, patch: Partial<Scene>) => void;
  onStyleChange: (id: number, style: string) => void;
  onRatioChange: (id: number, ratio: '16:9' | '9:16') => void;
  onResChange: (id: number, res: '480p' | '720p' | '1080p') => void;
  onDownload: (url: string, filename: string) => void;
}

export function SceneCard({
  scene,
  assets: a,
  globalStyle,
  globalRatio,
  globalVideoRes,
  styleByScene,
  ratioByScene,
  resByScene,
  autoRunning,
  videosLocked,
  onGenerateImage,
  onGenerateVideo,
  onGenerateAudio,
  onUploadImage,
  onUploadAudio,
  onUpdateScene,
  onStyleChange,
  onRatioChange,
  onResChange,
  onDownload,
}: SceneCardProps) {
  const busy = a.imageStatus === 'loading' || a.videoStatus === 'loading' || a.audioStatus === 'loading';
  return (
    <article id={`scene-card-${scene.id}`} className="scene-card rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs font-medium tracking-widest text-primary">
            SCENE {String(scene.id).padStart(2, '0')}
          </span>
          <span className="text-xs text-muted-foreground">{scene.title}</span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">{scene.duration}s</span>
      </div>

      {/* 画面区 */}
      <div
        className={cn(
          'relative m-3 mb-2 overflow-hidden rounded-md border border-border bg-black',
          globalRatio === '9:16' ? 'aspect-[9/16] max-h-72' : 'aspect-video',
          a.imageStatus === 'loading' && 'scanlines',
        )}
      >
        {a.videoUrl ? (
          <video src={a.videoUrl} controls className="h-full w-full object-contain" />
        ) : a.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.imageUrl} alt={scene.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/50">
            {a.imageStatus === 'loading' ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-[#4FD1C5]" />
                <span className="font-mono text-[10px] tracking-widest text-[#4FD1C5]">RENDERING</span>
              </>
            ) : (
              <>
                <ImageIcon className="h-5 w-5" />
                <span className="font-mono text-[10px] tracking-widest">NO FRAME</span>
              </>
            )}
          </div>
        )}
        {a.videoStatus === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 scanlines">
            <Loader2 className="h-5 w-5 animate-spin text-[#4FD1C5]" />
            <span className="font-mono text-[10px] tracking-widest text-[#4FD1C5]">
              SHOOTING · 约5-10分钟
            </span>
          </div>
        )}
      </div>

      {/* 生成区 */}
      <div className="space-y-1.5 px-4 pb-2">
        <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted-foreground">
          <Play className="h-3 w-3" />
          生成区
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || autoRunning}
            onClick={() => onGenerateImage(scene)}
            className="h-7 flex-1 gap-1.5 border-border bg-transparent text-xs hover:border-primary/50 hover:text-primary"
          >
            <Lamp status={a.imageStatus} />
            <RefreshCw className={cn('h-3 w-3', a.imageStatus === 'loading' && 'animate-spin')} />
            重出此镜画面
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!a.imageUrl || a.videoStatus === 'loading' || autoRunning || videosLocked}
            onClick={() => onGenerateVideo(scene)}
            title={videosLocked ? '先在上方画布确认全部画面，再开始拍摄' : undefined}
            className="h-7 flex-1 gap-1.5 border-border bg-transparent text-xs hover:border-primary/50 hover:text-primary"
          >
            <Lamp status={a.videoStatus} />
            {videosLocked ? (
              <Lock className="h-3 w-3" />
            ) : (
              <RefreshCw className={cn('h-3 w-3', a.videoStatus === 'loading' && 'animate-spin')} />
            )}
            重出此镜视频
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || autoRunning}
            onClick={() => onUploadImage(scene.id)}
            className="h-7 flex-1 gap-1.5 border-dashed border-border bg-transparent text-xs hover:border-[#4FD1C5]/50 hover:text-[#4FD1C5]"
          >
            <Upload className="h-3 w-3" />
            上传图片替换此镜
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!a.imageUrl}
            onClick={() => a.imageUrl && onDownload(a.imageUrl, `scene-${String(scene.id).padStart(2, '0')}.jpg`)}
            title="下载此镜画面"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-primary"
          >
            <Download className="h-3 w-3" />
            图
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!a.videoUrl}
            onClick={() => a.videoUrl && onDownload(a.videoUrl, `scene-${String(scene.id).padStart(2, '0')}.mp4`)}
            title="下载此镜视频"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-primary"
          >
            <Download className="h-3 w-3" />
            片
          </Button>
        </div>
        {(a.imageError || a.videoError) && (
          <span className="block truncate text-[10px] text-destructive">
            {a.imageError || a.videoError}
          </span>
        )}
      </div>

      {/* 音频区：本镜旁白配音，可单独生成/试听/替换 */}
      <div className="space-y-1.5 border-t border-border px-4 py-2">
        <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted-foreground">
          <Mic className="h-3 w-3" />
          音频区 · 本镜配音
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!scene.narration.trim() || a.audioStatus === 'loading' || autoRunning}
            onClick={() => onGenerateAudio(scene)}
            className="h-7 flex-1 gap-1.5 border-border bg-transparent text-xs hover:border-primary/50 hover:text-primary"
          >
            <Lamp status={a.audioStatus} />
            <RefreshCw className={cn('h-3 w-3', a.audioStatus === 'loading' && 'animate-spin')} />
            {a.audioUrl ? '重出此镜配音' : '生成此镜配音'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={a.audioStatus === 'loading' || autoRunning}
            onClick={() => onUploadAudio(scene.id)}
            title="上传本地音频替换此镜配音"
            className="h-7 gap-1.5 border-dashed border-border bg-transparent px-2 text-xs hover:border-[#4FD1C5]/50 hover:text-[#4FD1C5]"
          >
            <Upload className="h-3 w-3" />
            替换
          </Button>
        </div>
        {a.audioUrl && <audio src={a.audioUrl} controls className="h-8 w-full" />}
        {a.audioError && <span className="block truncate text-[10px] text-destructive">{a.audioError}</span>}
      </div>

      {/* 修改区：本镜参数与文案（改动后点上方「重出」生效） */}
      <div className="flex items-center gap-1.5 border-t border-border px-4 pt-2 font-mono text-[10px] tracking-widest text-muted-foreground">
        <Wand2 className="h-3 w-3" />
        修改区
      </div>

      {/* 本镜镜头参数 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border px-4 py-2">
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground">本镜风格</label>
        <select
          value={styleByScene || ''}
          onChange={(e) => onStyleChange(scene.id, e.target.value)}
          className="h-6 rounded border border-input bg-background px-1 text-[11px] outline-none focus:border-primary/50"
        >
          <option value="">跟随全局（{globalStyle}）</option>
          {STYLES.filter((s) => s !== globalStyle).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground">画幅</label>
        <select
          value={ratioByScene || ''}
          onChange={(e) => onRatioChange(scene.id, e.target.value as '16:9' | '9:16')}
          className="h-6 rounded border border-input bg-background px-1 text-[11px] outline-none focus:border-primary/50"
        >
          <option value="">跟随全局（{globalRatio}）</option>
          <option value="16:9">16:9 横屏</option>
          <option value="9:16">9:16 竖屏</option>
        </select>
        <label className="font-mono text-[10px] tracking-widest text-muted-foreground">分辨率</label>
        <select
          value={resByScene || ''}
          onChange={(e) => onResChange(scene.id, e.target.value as '480p' | '720p' | '1080p')}
          className="h-6 rounded border border-input bg-background px-1 text-[11px] outline-none focus:border-primary/50"
        >
          <option value="">跟随全局（{globalVideoRes}）</option>
          <option value="480p">480p</option>
          <option value="720p">720p</option>
          <option value="1080p">1080p</option>
        </select>
      </div>

      {/* 文案编辑 */}
      <div className="space-y-2 border-t border-border px-4 py-3">
        <div>
          <label className="mb-1 block font-mono text-[10px] tracking-widest text-muted-foreground">
            画面提示词
          </label>
          <textarea
            value={scene.visualPrompt}
            onChange={(e) => onUpdateScene(scene.id, { visualPrompt: e.target.value })}
            rows={3}
            className="w-full resize-none rounded border border-input bg-background px-2 py-1.5 text-xs leading-relaxed outline-none focus:border-primary/50"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] tracking-widest text-muted-foreground">
            旁白（修改后点音频区「重出此镜配音」生效）
          </label>
          <textarea
            value={scene.narration}
            onChange={(e) => onUpdateScene(scene.id, { narration: e.target.value })}
            rows={2}
            className="w-full resize-none rounded border border-input bg-background px-2 py-1.5 text-xs leading-relaxed outline-none focus:border-primary/50"
          />
        </div>
      </div>
    </article>
  );
}
