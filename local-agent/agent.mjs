#!/usr/bin/env node
/**
 * CineFlow 本地创作智能体
 * 主题 -> 分镜脚本(LLM) -> 分镜画面(生图) -> 视频片段(图生视频, 可借鉴参考视频)
 *      -> 旁白配音(TTS) -> 转场拼接 + 音轨合成 -> 本地 final.mp4
 *
 * 用法:
 *   node agent.mjs "一只猫在深夜城市找回家" --scenes 4 --style 电影感写实 --ratio 16:9
 *   node agent.mjs "主题" --ref https://example.com/good.mp4   # 借鉴优秀视频的运镜/风格
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  LLMClient,
  ImageGenerationClient,
  VideoGenerationClient,
  TTSClient,
  VideoEditClient,
} from 'coze-coding-dev-sdk';

// ---------- 参数解析 ----------
function parseArgs(argv) {
  const opts = {
    topic: '',
    scenes: 4,
    style: '电影感写实',
    ratio: '16:9',
    voice: 'zh_male_dayi_saturn_bigtts',
    ref: '',
    out: './output',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--scenes') opts.scenes = Number(argv[++i]) || 4;
    else if (a === '--style') opts.style = argv[++i] || opts.style;
    else if (a === '--ratio') opts.ratio = argv[++i] === '9:16' ? '9:16' : '16:9';
    else if (a === '--voice') opts.voice = argv[++i] || opts.voice;
    else if (a === '--ref') opts.ref = argv[++i] || '';
    else if (a === '--out') opts.out = argv[++i] || opts.out;
    else if (!a.startsWith('--') && !opts.topic) opts.topic = a;
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.topic) {
  console.log('用法: node agent.mjs "视频主题" [--scenes 4] [--style 电影感写实] [--ratio 16:9] [--voice 音色ID] [--ref 参考视频URL] [--out ./output]');
  process.exit(1);
}

const RATIO_SIZE = { '16:9': '2560x1440', '9:16': '1440x2560' };
const outDir = path.resolve(opts.out);
fs.mkdirSync(outDir, { recursive: true });

const log = (step, msg) => {
  const t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  console.log(`[${t}] [${step}] ${msg}`);
};

// ---------- 第 1 步：LLM 流式生成分镜脚本 ----------
async function genScript() {
  log('脚本', 'LLM 正在创作分镜脚本...');
  const llm = new LLMClient();
  const sys = [
    '你是一位专业短视频导演。根据用户的创意主题，输出一个分镜脚本。',
    `要求：共 ${opts.scenes} 个分镜；每个分镜包含 id(从1开始)、title(4字内)、visualPrompt(给AI生图/视频模型的中文画面描述,80字内,含镜头运动/光影/主体动作)、narration(一句旁白,25字内)、duration(秒,4-8的整数)。`,
    `整体风格：${opts.style}。另外给出 musicStyle（背景音乐风格描述，20字内）。`,
    '只输出纯 JSON，不要输出任何其他内容。格式：{"title":"...","musicStyle":"...","scenes":[{"id":1,"title":"...","visualPrompt":"...","narration":"...","duration":6}]}',
  ].join('\n');

  const stream = llm.stream(
    [
      { role: 'system', content: sys },
      { role: 'user', content: `创意主题：${opts.topic}` },
    ],
    { model: 'doubao-seed-2-0-lite-260215', temperature: 0.8 }
  );

  let raw = '';
  for await (const chunk of stream) {
    if (chunk.content) {
      raw += chunk.content;
      process.stdout.write(chunk.content);
    }
  }
  console.log('\n');

  const cleaned = raw.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('脚本解析失败：未找到 JSON');
  const script = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
    throw new Error('脚本解析失败：scenes 为空');
  }
  fs.writeFileSync(path.join(outDir, 'script.json'), JSON.stringify(script, null, 2));
  log('脚本', `完成：${script.title}，共 ${script.scenes.length} 镜，配乐风格「${script.musicStyle}」`);
  return script;
}

// ---------- 第 2 步：分镜画面 ----------
async function genImages(script) {
  const client = new ImageGenerationClient();
  const size = RATIO_SIZE[opts.ratio];
  const results = await Promise.all(
    script.scenes.map(async (scene) => {
      log('生图', `SCENE ${String(scene.id).padStart(2, '0')} 生成中...`);
      const resp = await client.generate({
        prompt: `${opts.style}风格。${scene.visualPrompt}`,
        size,
        watermark: false,
      });
      const url = resp.data?.[0]?.url;
      if (!url) throw new Error(`SCENE ${scene.id} 生图失败`);
      log('生图', `SCENE ${String(scene.id).padStart(2, '0')} 完成`);
      return { id: scene.id, url };
    })
  );
  return results;
}

// ---------- 第 3 步：旁白配音 ----------
async function genNarration(script) {
  const text = script.scenes.map((s) => s.narration).join('。');
  log('配音', `TTS 合成旁白（${text.length} 字）...`);
  const tts = new TTSClient();
  const result = await tts.synthesize({
    uid: 'cineflow-local',
    text,
    speaker: opts.voice,
    audioFormat: 'mp3',
    sampleRate: 24000,
  });
  if (!result.audioUrl) throw new Error('配音合成失败');
  log('配音', '完成');
  return result.audioUrl;
}

// ---------- 第 4 步：视频片段 ----------
async function genVideos(script, images) {
  const client = new VideoGenerationClient();
  const videos = [];
  for (const scene of script.scenes) {
    const img = images.find((i) => i.id === scene.id);
    log('视频', `SCENE ${String(scene.id).padStart(2, '0')} 生成中（单段约 5-10 分钟）...`);

    const prompt = `${opts.style}风格。${scene.visualPrompt}。配乐风格：${script.musicStyle}`;
    const content = [{ type: 'text', text: prompt }];

    if (opts.ref && /^https?:\/\//.test(opts.ref)) {
      // 全能参考模式：借鉴参考视频的运镜/节奏/风格（不可与首帧图混用）
      content[0].text = `参考视频1的运镜、节奏与画面风格来拍摄。${prompt}`;
      if (img) content.push({ type: 'image_url', image_url: { url: img.url }, role: 'reference_image' });
      content.push({ type: 'video_url', video_url: { url: opts.ref }, role: 'reference_video' });
    } else if (img) {
      content.unshift({ type: 'image_url', image_url: { url: img.url }, role: 'first_frame' });
    }

    const resp = await client.videoGeneration(content, {
      model: 'doubao-seedance-2-0-260128',
      ratio: opts.ratio,
      duration: Math.min(Math.max(Math.round(scene.duration || 6), 4), 10),
      resolution: '1080p',
      generateAudio: true,
      returnLastFrame: false,
    });
    if (!resp.videoUrl) throw new Error(`SCENE ${scene.id} 视频生成失败`);
    log('视频', `SCENE ${String(scene.id).padStart(2, '0')} 完成`);
    videos.push({ id: scene.id, url: resp.videoUrl });
  }
  return videos;
}

// ---------- 第 5 步：成片合成 ----------
async function compose(videos, narrationUrl) {
  const editor = new VideoEditClient();
  const urls = videos.map((v) => v.url);
  log('合成', `拼接 ${urls.length} 段视频（含转场）...`);
  const concat = await editor.concatVideos(urls, ['淡入淡出', '叠化'], '9/16/15', 'idle');
  if (!concat.responseUrl) throw new Error('视频拼接失败');

  let finalUrl = concat.responseUrl;
  if (narrationUrl) {
    log('合成', '混入旁白音轨（保留片段原声配乐）...');
    const merged = await editor.compileVideoAudio(concat.responseUrl, narrationUrl, {
      isAudioReserve: true,
      isLoop: false,
      volume: 1,
    });
    if (merged.responseUrl) finalUrl = merged.responseUrl;
  }
  return finalUrl;
}

// ---------- 下载到本地 ----------
async function download(url, filePath) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`下载失败 HTTP ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(filePath, buf);
  return buf.length;
}

// ---------- 主流程 ----------
async function main() {
  const started = Date.now();
  console.log(`\n=== CineFlow 本地创作智能体 ===`);
  console.log(`主题：${opts.topic} | ${opts.scenes} 镜 | ${opts.style} | ${opts.ratio}${opts.ref ? ' | 借鉴参考视频' : ''}\n`);

  const script = await genScript();
  const images = await genImages(script);
  const narrationUrl = await genNarration(script);
  const videos = await genVideos(script, images);
  const finalUrl = await compose(videos, narrationUrl);

  const finalPath = path.join(outDir, 'final.mp4');
  log('下载', '成片保存到本地...');
  const size = await download(finalUrl, finalPath);

  const mins = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`\n=== 完成 ===`);
  console.log(`成片：${finalPath}（${(size / 1024 / 1024).toFixed(1)} MB）`);
  console.log(`分镜脚本：${path.join(outDir, 'script.json')}`);
  console.log(`总耗时：${mins} 分钟\n`);
}

main().catch((err) => {
  console.error(`\n[失败] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
