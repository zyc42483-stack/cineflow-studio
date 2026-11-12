import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export const maxDuration = 120;

const SYSTEM_PROMPT = `你是一位顶级短视频导演兼摄影指导，精通 Seedance 视频生成模型的提示词工程（七段式实战框架）。用户给你故事梗概，你拆解为可直接拍摄的分镜脚本。

输出要求（极其重要）：
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
① 风格块：全片统一的固定前缀（质感+色彩倾向+颗粒，如"电影感写实，冷蓝暖黄对比色调，细腻胶片颗粒"），每个分镜一字不差地复用；
② 镜头：景别+机位+唯一一个运镜，精确术语（缓慢推近/低角度跟拍/手持微晃/固定机位/环绕/升降）；
③ 空间：场景布局与主体位置（"热饮柜在画面右侧，男子站在柜前左侧三分之一处"）；
④ 主体：外观/穿着/材质/颜色等可被镜头捕捉的具体特征；
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

export async function POST(request: NextRequest) {
  const { topic, sceneCount, style } = (await request.json()) as {
    topic: string;
    sceneCount: number;
    style: string;
  };

  if (!topic || typeof topic !== 'string') {
    return new Response(JSON.stringify({ error: '缺少创意主题' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  const count = Math.min(Math.max(sceneCount || 4, 2), 20);
  const userPrompt = `故事梗概：${topic}\n视觉风格：${style || '电影感写实'}\n请拆解为 ${count} 个分镜，每个分镜的 visualPrompt 严格按七段式框架输出（130-230字），第1镜前2秒必须有钩子。`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const llmStream = client.stream(
          [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
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
        controller.enqueue(
          encoder.encode(`\n__ERROR__${message}`),
        );
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
