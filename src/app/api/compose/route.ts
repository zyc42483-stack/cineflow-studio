import { NextRequest, NextResponse } from 'next/server';
import { VideoEditClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export const maxDuration = 300;

const TRANSITIONS = ['1182376', '1182356', '1182375', '1182360', '1182358'];

export async function POST(request: NextRequest) {
  try {
    const { videoUrls, narrationUrl, sceneAudios } = (await request.json()) as {
      videoUrls: string[];
      narrationUrl?: string;
      /** 与 videoUrls 等长的逐镜音频数组，空位用 null 占位 */
      sceneAudios?: (string | null)[];
    };

    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json({ error: '缺少视频片段' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config({ timeout: 280000 });
    const client = new VideoEditClient(config, customHeaders);

    let clips = videoUrls;

    // Step 1: 逐镜混音（每镜视频先与自己的旁白混音，保留画面原声/配乐）
    const perScene =
      Array.isArray(sceneAudios) && sceneAudios.length === videoUrls.length
        ? sceneAudios
        : null;
    if (perScene && perScene.some((a) => typeof a === 'string' && a)) {
      const mixed: string[] = [];
      // 分批并行（每批 4 个），避免并发过高
      for (let i = 0; i < clips.length; i += 4) {
        const batch = clips.slice(i, i + 4);
        const results = await Promise.all(
          batch.map(async (clipUrl, j) => {
            const audio = perScene[i + j];
            if (!audio) return clipUrl;
            const res = await client.compileVideoAudio(clipUrl, audio, {
              isAudioReserve: true,
            });
            return res.url;
          }),
        );
        mixed.push(...results);
      }
      clips = mixed;
    }

    // Step 2: 拼接所有分镜视频（带转场）
    let currentUrl: string;
    if (clips.length === 1) {
      currentUrl = clips[0];
    } else {
      const transitions = clips
        .slice(0, -1)
        .map((_, i) => TRANSITIONS[i % TRANSITIONS.length]);
      const concatRes = await client.concatVideos(clips, { transitions });
      currentUrl = concatRes.url;
    }

    // Step 3: 兼容旧模式——整片叠加一条旁白音轨（逐镜音频已处理时跳过）
    if (narrationUrl && !perScene) {
      const compiled = await client.compileVideoAudio(currentUrl, narrationUrl, {
        isAudioReserve: true,
      });
      currentUrl = compiled.url;
    }

    return NextResponse.json({ finalUrl: currentUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : '成片合成失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
