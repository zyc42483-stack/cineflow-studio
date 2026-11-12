'use client';

import { useRef } from 'react';
import {
  AlertCircle,
  Film,
  ImagePlus,
  Link2,
  Loader2,
  Play,
  ScanSearch,
  Sparkles,
  Upload,
  User,
  Wand2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { STYLES, VOICES } from '@/lib/studio-constants';
import type { AssetStatus, ImitateInputType } from '@/lib/types';

export interface RefMedia {
  url: string;
  type: 'image' | 'video';
}

/* ---------- 共享小控件 ---------- */

function StylePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STYLES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={cn(
            'rounded border px-2.5 py-1 text-xs transition-colors',
            value === s
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function SceneCountAndRatio({
  sceneCount,
  onSceneCount,
  ratio,
  onRatio,
}: {
  sceneCount: number;
  onSceneCount: (n: number) => void;
  ratio: '16:9' | '9:16';
  onRatio: (r: '16:9' | '9:16') => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div>
        <label className="mb-1.5 block font-mono text-[10px] tracking-widest text-muted-foreground">
          分镜数
        </label>
        <select
          value={sceneCount}
          onChange={(e) => onSceneCount(Number(e.target.value))}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/60"
        >
          {[2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map((n) => (
            <option key={n} value={n}>
              {n} 个分镜
            </option>
          ))}
        </select>
        {sceneCount > 6 && (
          <p className="mt-1 font-mono text-[10px] leading-relaxed text-amber-500/80">
            每镜视频约 5-10 分钟，{sceneCount} 镜预计 {Math.round((sceneCount * 7) / 60)} 小时+
          </p>
        )}
      </div>
      <div>
        <label className="mb-1.5 block font-mono text-[10px] tracking-widest text-muted-foreground">
          画幅
        </label>
        <select
          value={ratio}
          onChange={(e) => onRatio(e.target.value as '16:9' | '9:16')}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/60"
        >
          <option value="16:9">16:9 横屏</option>
          <option value="9:16">9:16 竖屏</option>
        </select>
      </div>
    </div>
  );
}

function VoicePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <>
      <label className="mb-1.5 mt-4 block font-mono text-[10px] tracking-widest text-muted-foreground">
        旁白音色
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/60"
      >
        {VOICES.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    </>
  );
}

function PanelError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="mt-3 flex items-start gap-1.5 text-xs text-destructive">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
}

/** 视频同步配乐开关：默认关闭以保证出片速度 */
function AudioToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 accent-[#E8B04B]"
      />
      <span>
        视频同步配乐 / 环境音
        <span className="mt-0.5 block text-[10px] text-muted-foreground/70">
          氛围更好，但每镜会慢 2-3 分钟；追求速度保持关闭
        </span>
      </span>
    </label>
  );
}

function ActionButtons({
  scriptPhase,
  autoRunning,
  canRun,
  onRunAuto,
  onGenerateScript,
  scriptLabel,
}: {
  scriptPhase: AssetStatus;
  autoRunning: boolean;
  canRun: boolean;
  onRunAuto: () => void;
  onGenerateScript: () => void;
  scriptLabel: string;
}) {
  return (
    <div className="mt-5 space-y-2">
      <Button
        onClick={onRunAuto}
        disabled={autoRunning || !canRun}
        className="w-full bg-primary font-medium text-primary-foreground hover:bg-primary/90"
      >
        {autoRunning ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            片场运转中…
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" />
            一键全自动成片
          </>
        )}
      </Button>
      <Button
        variant="outline"
        onClick={onGenerateScript}
        disabled={autoRunning || scriptPhase === 'loading' || !canRun}
        className="w-full border-border bg-transparent hover:border-primary/50 hover:bg-accent"
      >
        {scriptPhase === 'loading' ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Wand2 className="mr-2 h-4 w-4" />
        )}
        {scriptLabel}
      </Button>
    </div>
  );
}

/* ---------- 创意端口面板 ---------- */

export interface CreativePanelProps {
  topic: string;
  setTopic: (v: string) => void;
  style: string;
  setStyle: (v: string) => void;
  sceneCount: number;
  setSceneCount: (n: number) => void;
  ratio: '16:9' | '9:16';
  setRatio: (r: '16:9' | '9:16') => void;
  imageRes: '2K' | '4K';
  setImageRes: (r: '2K' | '4K') => void;
  videoRes: '480p' | '720p' | '1080p';
  setVideoRes: (r: '480p' | '720p' | '1080p') => void;
  /** 视频同步配乐/环境音开关（开启显著变慢） */
  withAudio: boolean;
  setWithAudio: (v: boolean) => void;
  speaker: string;
  setSpeaker: (v: string) => void;
  /** 拆解用参考素材（照片/视频） */
  creativeRefs: RefMedia[];
  refUploading: boolean;
  onUploadRef: (file: File) => void;
  onRemoveRef: (url: string) => void;
  /** 全局风格/主体参考图（进入生图链路） */
  refImageUrl: string;
  refImageUploading: boolean;
  refImageError: string;
  onUploadRefImage: (file: File) => void;
  onClearRefImage: () => void;
  scriptPhase: AssetStatus;
  scriptError: string;
  autoRunning: boolean;
  onGenerateDirect: () => void;
  onGenerateFromRef: () => void;
  onRunAuto: () => void;
}

export function CreativePanel(props: CreativePanelProps) {
  const {
    topic,
    setTopic,
    style,
    setStyle,
    sceneCount,
    setSceneCount,
    ratio,
    setRatio,
    imageRes,
    setImageRes,
    videoRes,
    setVideoRes,
    withAudio,
    setWithAudio,
    speaker,
    setSpeaker,
    creativeRefs,
    refUploading,
    onUploadRef,
    onRemoveRef,
    refImageUrl,
    refImageUploading,
    refImageError,
    onUploadRefImage,
    onClearRefImage,
    scriptPhase,
    scriptError,
    autoRunning,
    onGenerateDirect,
    onGenerateFromRef,
    onRunAuto,
  } = props;

  const refInputRef = useRef<HTMLInputElement>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);
  const hasRefs = creativeRefs.length > 0;

  return (
    <div>
      <label className="mb-1.5 block font-mono text-[10px] tracking-widest text-muted-foreground">
        故事诉求
      </label>
      <textarea
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="例：一个城市守夜人在午夜时分，发现整栋大楼的灯光开始按某种规律闪烁……"
        rows={4}
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 focus:border-primary/60"
      />

      {/* 参考素材拆解（可选） */}
      <label className="mb-1.5 mt-4 block font-mono text-[10px] tracking-widest text-muted-foreground">
        参考照片 / 视频（可选，AI 拆解后融入分镜）
      </label>
      <input
        ref={refInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUploadRef(f);
          e.target.value = '';
        }}
      />
      <div className="flex flex-wrap gap-2">
        {creativeRefs.map((m) => (
          <div
            key={m.url}
            className="relative h-16 w-24 overflow-hidden rounded-md border border-border"
          >
            {m.type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt="参考素材" className="h-full w-full object-cover" />
            ) : (
              <video src={m.url} className="h-full w-full object-cover" muted />
            )}
            <button
              type="button"
              onClick={() => onRemoveRef(m.url)}
              className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white hover:bg-destructive"
              title="移除素材"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
        {creativeRefs.length < 6 && (
          <button
            type="button"
            onClick={() => refInputRef.current?.click()}
            disabled={refUploading}
            className="flex h-16 w-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary disabled:opacity-50"
          >
            {refUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            <span className="font-mono text-[9px] tracking-widest">
              {refUploading ? '上传中' : '上传素材'}
            </span>
          </button>
        )}
      </div>
      {hasRefs && (
        <Button
          variant="outline"
          size="sm"
          onClick={onGenerateFromRef}
          disabled={autoRunning || scriptPhase === 'loading'}
          className="mt-2 w-full border-[#4FD1C5]/40 bg-transparent text-xs text-[#4FD1C5] hover:border-[#4FD1C5]/70 hover:bg-[#4FD1C5]/10"
        >
          {scriptPhase === 'loading' ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ScanSearch className="mr-1.5 h-3.5 w-3.5" />
          )}
          拆解参考素材生成分镜脚本
        </Button>
      )}

      <label className="mb-1.5 mt-4 block font-mono text-[10px] tracking-widest text-muted-foreground">
        视觉风格
      </label>
      <StylePicker value={style} onChange={setStyle} />

      <SceneCountAndRatio
        sceneCount={sceneCount}
        onSceneCount={setSceneCount}
        ratio={ratio}
        onRatio={setRatio}
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block font-mono text-[10px] tracking-widest text-muted-foreground">
            画面分辨率
          </label>
          <select
            value={imageRes}
            onChange={(e) => setImageRes(e.target.value as '2K' | '4K')}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/60"
          >
            <option value="2K">2K（2560px）</option>
            <option value="4K">4K（3840px）</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block font-mono text-[10px] tracking-widest text-muted-foreground">
            视频分辨率
          </label>
          <select
            value={videoRes}
            onChange={(e) => setVideoRes(e.target.value as '480p' | '720p' | '1080p')}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/60"
          >
            <option value="480p">480p 快速</option>
            <option value="720p">720p 标准</option>
            <option value="1080p">1080p 高清</option>
          </select>
        </div>
      </div>

      <AudioToggle checked={withAudio} onChange={setWithAudio} />

      <VoicePicker value={speaker} onChange={setSpeaker} />

      {/* 全局风格/主体参考图（生图链路） */}
      <label className="mb-1.5 mt-4 block font-mono text-[10px] tracking-widest text-muted-foreground">
        风格 / 主体参考图（可选，直接影响画面生成）
      </label>
      <input
        ref={refImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUploadRefImage(f);
          e.target.value = '';
        }}
      />
      {refImageUrl ? (
        <div className="relative overflow-hidden rounded-md border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={refImageUrl} alt="参考图片" className="h-24 w-full object-cover" />
          <button
            type="button"
            onClick={onClearRefImage}
            className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-destructive"
            title="移除参考图片"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => refImageInputRef.current?.click()}
          disabled={refImageUploading}
          className="w-full border-dashed border-border bg-transparent hover:border-primary/50"
        >
          {refImageUploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="mr-2 h-4 w-4" />
          )}
          {refImageUploading ? '上传中…' : '上传图片作为风格/主体参考'}
        </Button>
      )}
      {refImageError && <p className="mt-1 text-xs text-destructive">{refImageError}</p>}

      <ActionButtons
        scriptPhase={scriptPhase}
        autoRunning={autoRunning}
        canRun={Boolean(topic.trim())}
        onRunAuto={onRunAuto}
        onGenerateScript={onGenerateDirect}
        scriptLabel={hasRefs ? '仅按诉求生成脚本（不用参考素材）' : '仅生成分镜脚本'}
      />
      <PanelError message={scriptError} />
    </div>
  );
}

/* ---------- 模仿端口面板 ---------- */

export interface ImitatePanelProps {
  inputType: ImitateInputType;
  setInputType: (t: ImitateInputType) => void;
  imitateFile: RefMedia | null;
  fileUploading: boolean;
  onUploadFile: (file: File) => void;
  onClearFile: () => void;
  link: string;
  setLink: (v: string) => void;
  linkAnalysis: string;
  linkAnalyzing: boolean;
  onAnalyzeLink: () => void;
  protagonistUrl: string;
  protagonistUploading: boolean;
  onUploadProtagonist: (file: File) => void;
  onClearProtagonist: () => void;
  detail: string;
  setDetail: (v: string) => void;
  /** 视频同步配乐/环境音开关（开启显著变慢） */
  withAudio: boolean;
  setWithAudio: (v: boolean) => void;
  speaker: string;
  setSpeaker: (v: string) => void;
  style: string;
  setStyle: (v: string) => void;
  sceneCount: number;
  setSceneCount: (n: number) => void;
  ratio: '16:9' | '9:16';
  setRatio: (r: '16:9' | '9:16') => void;
  scriptPhase: AssetStatus;
  scriptError: string;
  autoRunning: boolean;
  canGenerate: boolean;
  onGenerateScript: () => void;
  onRunAuto: () => void;
}

export function ImitatePanel(props: ImitatePanelProps) {
  const {
    inputType,
    setInputType,
    imitateFile,
    fileUploading,
    onUploadFile,
    onClearFile,
    link,
    setLink,
    linkAnalysis,
    linkAnalyzing,
    onAnalyzeLink,
    protagonistUrl,
    protagonistUploading,
    onUploadProtagonist,
    onClearProtagonist,
    detail,
    setDetail,
    withAudio,
    setWithAudio,
    speaker,
    setSpeaker,
    style,
    setStyle,
    sceneCount,
    setSceneCount,
    ratio,
    setRatio,
    scriptPhase,
    scriptError,
    autoRunning,
    canGenerate,
    onGenerateScript,
    onRunAuto,
  } = props;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const protagonistInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      {/* 输入方式切换 */}
      <div className="grid grid-cols-2 gap-1 rounded-md border border-border p-1">
        <button
          type="button"
          onClick={() => setInputType('upload')}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded px-2 py-1.5 font-mono text-[11px] tracking-widest transition-colors',
            inputType === 'upload'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Upload className="h-3.5 w-3.5" />
          上传素材模仿
        </button>
        <button
          type="button"
          onClick={() => setInputType('link')}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded px-2 py-1.5 font-mono text-[11px] tracking-widest transition-colors',
            inputType === 'link'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Link2 className="h-3.5 w-3.5" />
          链接识别模仿
        </button>
      </div>

      {/* 上传素材模仿 */}
      {inputType === 'upload' && (
        <div className="mt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUploadFile(f);
              e.target.value = '';
            }}
          />
          {imitateFile ? (
            <div className="relative overflow-hidden rounded-md border border-border">
              {imitateFile.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imitateFile.url} alt="模仿对象" className="max-h-40 w-full object-cover" />
              ) : (
                <video src={imitateFile.url} controls className="max-h-40 w-full bg-black object-contain" />
              )}
              <button
                type="button"
                onClick={onClearFile}
                className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-destructive"
                title="移除素材"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="flex items-center gap-1.5 border-t border-border px-2.5 py-1.5 font-mono text-[10px] tracking-widest text-[#4FD1C5]">
                <Film className="h-3 w-3" />
                模仿对象已就绪，生成脚本时将深度拆解
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={fileUploading}
              className="w-full border-dashed border-border bg-transparent hover:border-primary/50"
            >
              {fileUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {fileUploading ? '上传中…' : '上传要模仿的图片或视频'}
            </Button>
          )}
        </div>
      )}

      {/* 链接识别模仿 */}
      {inputType === 'link' && (
        <div className="mt-3 space-y-2">
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="粘贴 mp4 视频直链，如 https://…/video.mp4"
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 font-mono text-xs outline-none placeholder:font-sans placeholder:text-muted-foreground/50 focus:border-primary/60"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={onAnalyzeLink}
            disabled={linkAnalyzing || !/^https?:\/\//.test(link.trim())}
            className="w-full border-[#4FD1C5]/40 bg-transparent text-xs text-[#4FD1C5] hover:border-[#4FD1C5]/70 hover:bg-[#4FD1C5]/10"
          >
            {linkAnalyzing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <ScanSearch className="mr-1.5 h-3.5 w-3.5" />
            )}
            {linkAnalyzing ? '识别分析中…' : '识别分析视频'}
          </Button>
          {linkAnalysis && (
            <div className="max-h-44 overflow-y-auto rounded-md border border-border bg-background px-3 py-2">
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
                {linkAnalysis}
                {linkAnalyzing && <span className="text-[#4FD1C5]">▌</span>}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* 主角上传 */}
      <label className="mb-1.5 mt-4 block font-mono text-[10px] tracking-widest text-muted-foreground">
        主角形象（可选，上传后全片主角保持一致）
      </label>
      <input
        ref={protagonistInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUploadProtagonist(f);
          e.target.value = '';
        }}
      />
      {protagonistUrl ? (
        <div className="relative overflow-hidden rounded-md border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={protagonistUrl} alt="主角形象" className="h-24 w-full object-cover" />
          <button
            type="button"
            onClick={onClearProtagonist}
            className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-destructive"
            title="移除主角"
          >
            <X className="h-3 w-3" />
          </button>
          <div className="flex items-center gap-1.5 border-t border-border px-2.5 py-1.5 font-mono text-[10px] tracking-widest text-[#4FD1C5]">
            <User className="h-3 w-3" />
            主角已锁定，生图时作为形象参考
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => protagonistInputRef.current?.click()}
          disabled={protagonistUploading}
          className="w-full border-dashed border-border bg-transparent hover:border-primary/50"
        >
          {protagonistUploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <User className="mr-2 h-4 w-4" />
          )}
          {protagonistUploading ? '上传中…' : '上传主角照片/形象图'}
        </Button>
      )}

      {/* 细节补充 */}
      <label className="mb-1.5 mt-4 block font-mono text-[10px] tracking-widest text-muted-foreground">
        细节补充（可选）
      </label>
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="例：主角换成一只柴犬；整体节奏放慢；结尾加一个回眸镜头……"
        rows={2}
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 focus:border-primary/60"
      />

      <VoicePicker value={speaker} onChange={setSpeaker} />

      <AudioToggle checked={withAudio} onChange={setWithAudio} />

      <label className="mb-1.5 mt-4 block font-mono text-[10px] tracking-widest text-muted-foreground">
        视觉风格
      </label>
      <StylePicker value={style} onChange={setStyle} />

      <SceneCountAndRatio
        sceneCount={sceneCount}
        onSceneCount={setSceneCount}
        ratio={ratio}
        onRatio={setRatio}
      />

      <div className="mt-3 flex items-start gap-1.5 rounded-md border border-border bg-background/60 px-3 py-2">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          生成脚本后，流程与创意端口一致：画布整改画面 → 确认拍摄 → 逐镜修改 → 合成成片。
        </p>
      </div>

      <ActionButtons
        scriptPhase={scriptPhase}
        autoRunning={autoRunning}
        canRun={canGenerate}
        onRunAuto={onRunAuto}
        onGenerateScript={onGenerateScript}
        scriptLabel="生成模仿分镜脚本"
      />
      <PanelError message={scriptError} />
    </div>
  );
}
