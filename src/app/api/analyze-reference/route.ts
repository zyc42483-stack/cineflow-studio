import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export const maxDuration = 300;

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'high' | 'low' } }
  | { type: 'video_url'; video_url: { url: string; fps?: number | null } };

const SCRIPT_JSON_SPEC = `输出要求（极其重要）：
1. 只输出一个合法的 JSON 对象，不要输出任何其他文字、解释或 markdown 代码块标记。
2. JSON 结构如下：
{
  "title": "短片标题（10字以内）",
  "musicStyle": "配乐风格描述（20字以内）",
  "scenes": [
    {
      "id": 1,
      "title": "分镜小标题（6字以内）",
      "visualPrompt": "视频分镜提示词（写法见下）",
      "narration": "该分镜的旁白文案，口语化、有感染力，15-40字",
      "duration": 5
    }
  ]
}
3. duration 取值 4-8 秒。
4. 各分镜叙事连贯：开场建立场景 → 中段推进 → 结尾升华。

visualPrompt 写法（七段式实战框架，130-230字，按此顺序组织）：
① 风格块：全片统一的固定前缀（质感+色彩倾向+颗粒），每个分镜一字不差地复用；模仿场景下风格块须提炼自参考素材的色调与质感；
② 镜头：景别+机位+唯一一个运镜，精确术语（缓慢推近/低角度跟拍/手持微晃/固定机位/环绕/升降），贴近参考素材的镜头语言；
③ 空间：场景布局与主体位置（"热饮柜在画面右侧，男子站在柜前左侧三分之一处"）；
④ 主体：外观/穿着/材质/颜色等可被镜头捕捉的具体特征（若有主角形象参考，围绕其特征精确描述）；
⑤ 动作链：具体肌肉动作按时间顺序（起始姿态→细节小动作如指尖停顿、耳朵轻颤、呼吸起伏→结束姿态），有先后顺序和快慢节奏；
⑥ 神态：面部肌肉的具体变化（"眉心挤出两道竖纹、视线从货架移向腕表、嘴角抿起"）；
⑦ 光影氛围：光源方向与色温、地面/玻璃反光、空气中漂浮的尘埃或雨丝、背景虚化。

实战铁律（必须遵守，违反即重写）：
- 动作写肌肉动作，禁止情绪词：写"两下点头、一个耸肩、喉结滚动"，不写"他很开心/很紧张"；
- 一条分镜只给一个运镜；想换运镜就拆到下一镜；
- 全部用肯定句描述，禁止"不要/避免/没有"（模型会把否定词读成肯定）；
- 第1镜的前2秒必须有"钩子"：开场即动态或冲突（动作进行中、突发变化），禁止缓慢空镜开场；
- 运镜用精确术语，禁止"唯美的/电影感的运镜"这类空泛形容词；
- 主角外观、关键道具、光源色温在所有分镜间保持一致。

【示例】
差的写法（禁止）："深夜天台，一只猫蹲着看城市灯光，冷蓝色调。"
好的写法（照这个标准写）："电影感写实，冷蓝暖黄对比色调，细腻胶片颗粒。中景手持微晃缓慢推近：深夜十一点老式居民楼天台，头顶冷白路灯在湿漉漉的水泥地面投下反光。一只橘色虎斑猫蹲坐天台边缘（画面右侧三分之一处），尾巴缓缓绕到前爪旁收拢，它低头盯着楼下车流光轨，耳朵忽然轻颤一下，随即抬头望向远处亮着暖黄灯光的窗户，瞳孔微微放大，鼻尖随呼吸轻轻翕动。夜风拂过背毛泛起细微波纹，光柱里尘埃缓慢流转。背景虚化万家灯火。"

旁白 narration：口语化、有感染力，15-40字；与 visualPrompt 严格分离，声音层面只写进 narration 和 musicStyle。`;

const IMITATE_SYSTEM = `你是一位专业的短视频导演兼分镜师。用户会提供参考素材（视频/图片/拉片分析报告），你需要深度拆解参考素材的镜头语言、节奏、色调与叙事结构，创作一个「同风格、同镜头语言」的全新分镜脚本。

模仿要求：
1. 镜头语言（景别、运镜、转场）尽量贴近参考素材
2. 色调光影、配乐风格与参考素材保持一致
3. 若用户上传了主角形象图片，分镜画面提示词中必须围绕该主角的外观特征展开描述，保证全片主角一致
4. 若用户补充了细节要求，必须融入脚本
5. 故事内容可以是全新的，但"拍法"要像参考素材

${SCRIPT_JSON_SPEC}`;

const CREATIVE_SYSTEM = `你是一位专业的短视频导演兼分镜师。用户会给你一个故事诉求，并可能附上参考照片/视频作为视觉或叙事参考。你需要先拆解参考素材的关键视觉特征（主体、场景、色调、氛围），再将其融入分镜脚本创作。

要求：
1. 参考素材中的主体/场景特征应在分镜画面提示词中被具体描述
2. 若用户上传了主角形象图片，分镜画面提示词中必须围绕该主角的外观特征展开描述，保证全片主角一致
3. 叙事以用户诉求为主线，参考素材服务于视觉呈现

${SCRIPT_JSON_SPEC}`;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    mode?: 'creative' | 'imitate';
    topic?: string;
    detail?: string;
    linkAnalysis?: string;
    imageUrls?: string[];
    videoUrl?: string;
    protagonistUrl?: string;
    sceneCount?: number;
    style?: string;
  };

  const mode = body.mode === 'imitate' ? 'imitate' : 'creative';
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 6)
    : [];
  const videoUrl =
    typeof body.videoUrl === 'string' && /^https?:\/\//.test(body.videoUrl)
      ? body.videoUrl
      : null;
  const protagonistUrl =
    typeof body.protagonistUrl === 'string' && /^https?:\/\//.test(body.protagonistUrl)
      ? body.protagonistUrl
      : null;

  const hasRef = imageUrls.length > 0 || !!videoUrl || !!body.linkAnalysis;
  if (!body.topic?.trim() && !hasRef) {
    return new Response(JSON.stringify({ error: '请提供故事诉求或参考素材' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const count = Math.min(Math.max(body.sceneCount || 4, 2), 20);
  const style = body.style || '电影感写实';

  const textParts: string[] = [];
  if (body.topic?.trim()) textParts.push(`故事诉求：${body.topic.trim()}`);
  if (body.linkAnalysis) textParts.push(`参考视频拉片分析：\n${body.linkAnalysis}`);
  if (videoUrl) textParts.push('附件视频为参考模仿对象，请拆解其镜头语言。');
  if (imageUrls.length > 0) textParts.push(`附件 ${imageUrls.length} 张图片为视觉参考素材。`);
  if (protagonistUrl) textParts.push('最后一张附件图片是「主角形象」，全片分镜必须围绕该主角展开。');
  if (body.detail?.trim()) textParts.push(`细节要求：${body.detail.trim()}`);
  textParts.push(
    `视觉风格基调：${style}\n请拆解为 ${count} 个分镜，每个分镜的 visualPrompt 严格按七段式框架输出（130-230字），第1镜前2秒必须有钩子。`,
  );

  const content: ContentPart[] = [{ type: 'text', text: textParts.join('\n\n') }];
  imageUrls.forEach((url) => {
    content.push({ type: 'image_url', image_url: { url, detail: 'high' } });
  });
  if (videoUrl) {
    content.push({ type: 'video_url', video_url: { url: videoUrl, fps: 1 } });
  }
  if (protagonistUrl) {
    content.push({ type: 'image_url', image_url: { url: protagonistUrl, detail: 'high' } });
  }

  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const config = new Config({ timeout: 280000 });
  const client = new LLMClient(config, customHeaders);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const llmStream = client.stream(
          [
            { role: 'system', content: mode === 'imitate' ? IMITATE_SYSTEM : CREATIVE_SYSTEM },
            { role: 'user', content },
          ],
          { model: 'doubao-seed-2-0-pro-260215', temperature: 0.8 },
        );
        for await (const chunk of llmStream) {
          if (chunk.content) {
            controller.enqueue(encoder.encode(chunk.content.toString()));
          }
        }
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : '脚本生成失败';
        controller.enqueue(encoder.encode(`\n__ERROR__${message}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Transfer-Encoding': 'chunked',
    },
  });
}
