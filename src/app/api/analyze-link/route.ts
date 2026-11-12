import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export const maxDuration = 300;

const ANALYZE_PROMPT = `你是一位专业的短视频拉片分析师。请仔细观看用户提供的视频，输出一份可供 AI 模仿复刻的拆解报告，包含以下维度（用中文，条理清晰）：

1. 内容梗概：这个视频讲了什么（50字以内）
2. 场景与主体：每个段落出现的场景、主体（人物/物体）外观特征
3. 镜头语言：景别、运镜方式（推/拉/摇/移/跟/固定）、转场方式
4. 节奏结构：段落划分、每段大致时长、叙事节奏
5. 色调与光影：整体色调、光线氛围
6. 声音风格：配乐类型、情绪走向、是否有旁白及其文案风格
7. 复刻要点：如果要模仿这个视频拍一个新故事，最关键的 3-5 个特征

要求：描述必须具体、视觉化，能直接指导后续的分镜脚本生成与画面生成。不要输出与视频无关的内容。`;

export async function POST(request: NextRequest) {
  const { url } = (await request.json()) as { url: string };

  if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) {
    return new Response(JSON.stringify({ error: '请提供有效的视频链接（http/https）' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
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
            {
              role: 'user',
              content: [
                { type: 'text', text: ANALYZE_PROMPT },
                { type: 'video_url', video_url: { url, fps: 1 } },
              ],
            },
          ],
          { model: 'doubao-seed-2-0-pro-260215', temperature: 0.4 },
        );
        for await (const chunk of llmStream) {
          if (chunk.content) {
            controller.enqueue(encoder.encode(chunk.content.toString()));
          }
        }
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : '链接识别失败';
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
