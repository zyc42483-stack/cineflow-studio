export interface Scene {
  id: number;
  title: string;
  visualPrompt: string;
  narration: string;
  duration: number;
}

export interface ScriptResult {
  title: string;
  musicStyle: string;
  scenes: Scene[];
}

export type AssetStatus = 'idle' | 'loading' | 'done' | 'error';

export interface SceneAssets {
  imageUrl?: string;
  imageStatus: AssetStatus;
  imageError?: string;
  videoUrl?: string;
  videoStatus: AssetStatus;
  videoError?: string;
  /** 逐镜旁白配音 */
  audioUrl?: string;
  audioStatus: AssetStatus;
  audioError?: string;
}

/** 工作室模式：creative=创意端口（从诉求出发），imitate=模仿端口（从参考素材/链接出发） */
export type StudioMode = 'creative' | 'imitate';

/** 模仿端口的输入方式：upload=上传图片/视频模仿，link=mp4 链接识别模仿 */
export type ImitateInputType = 'upload' | 'link';
