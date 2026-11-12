import { NextRequest, NextResponse } from 'next/server';
import {
  VideoGenerationClient,
  Config,
  HeaderUtils,
  Content,
} from 'coze-coding-dev-sdk';

export const maxDuration = 600;

export async function POST(request: NextRequest) {
  try {
    const { prompt, imageUrl, duration, ratio, musicStyle, referenceVideoUrl, resolution, withAudio } =
      (await request.json()) as {
        prompt: string;
        imageUrl?: string;
        duration?: number;
        ratio?: string;
        musicStyle?: string;
        referenceVideoUrl?: string;
        resolution?: string;
        withAudio?: boolean;
      };

    if (!prompt) {
      return NextResponse.json({ error: '缺少视频提示词' }, { status: 400 });
    }

    const refVideo =
      typeof referenceVideoUrl === 'string' && /^https?:\/\//.test(referenceVideoUrl)
        ? referenceVideoUrl
        : null;

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config({ timeout: 570000 });
    const client = new VideoGenerationClient(config, customHeaders);

    // 同步生成配乐/环境音会显著拉长生成时间，默认关闭，仅在前端开启 withAudio 时启用
    const wantAudio = withAudio === true;

    const fullPrompt = wantAudio && musicStyle
      ? `${prompt}。声音层：${musicStyle}（环境声与配乐分层呈现，画面无对白）`
      : prompt;

    // 有参考视频时走「全能参考」模式：参考视频学习运镜/节奏/风格，分镜图降级为参考图
    // （SDK 约束：reference_video 不可与 first_frame 混用）
    const content: Content[] = [];
    if (refVideo) {
      const refPrompt = imageUrl
        ? `以图片1为主体画面，借鉴视频1的运镜、节奏与画面风格进行拍摄。${fullPrompt}`
        : `借鉴视频1的运镜、节奏与画面风格进行拍摄。${fullPrompt}`;
      content.push({ type: 'text', text: refPrompt });
      if (imageUrl) {
        content.push({
          type: 'image_url',
          image_url: { url: imageUrl },
          role: 'reference_image',
        });
      }
      content.push({
        type: 'video_url',
        video_url: { url: refVideo },
        role: 'reference_video',
      });
    } else {
      content.push({ type: 'text', text: fullPrompt });
      if (imageUrl) {
        content.unshift({
          type: 'image_url',
          image_url: { url: imageUrl },
          role: 'first_frame',
        });
      }
    }

    const validRatio = ratio === '9:16' ? '9:16' : '16:9';
    const validDuration = Math.min(Math.max(duration || 5, 4), 8);
    const validResolution =
      resolution === '480p' || resolution === '1080p' ? resolution : '720p';

    const response = await client.videoGeneration(content, {
      model: 'doubao-seedance-2-0-260128',
      duration: validDuration,
      ratio: validRatio,
      resolution: validResolution,
      generateAudio: wantAudio,
      watermark: false,
    });

    if (response.videoUrl) {
      return NextResponse.json({
        videoUrl: response.videoUrl,
        lastFrameUrl: response.lastFrameUrl || null,
      });
    }
    return NextResponse.json(
      { error: response.response.error_message || '视频生成失败' },
      { status: 500 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '视频生成失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
