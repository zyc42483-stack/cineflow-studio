import { NextRequest, NextResponse } from 'next/server';
import { ImageGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export const maxDuration = 180;

export async function POST(request: NextRequest) {
  try {
    const { prompt, ratio, resolution, referenceImageUrl } = (await request.json()) as {
      prompt: string;
      ratio?: string;
      resolution?: string;
      referenceImageUrl?: string;
    };

    if (!prompt) {
      return NextResponse.json({ error: '缺少画面提示词' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new ImageGenerationClient(config, customHeaders);

    const is4K = resolution === '4K';
    const size =
      ratio === '9:16'
        ? is4K
          ? '2160x3840'
          : '1440x2560'
        : is4K
          ? '3840x2160'
          : '2560x1440';

    const response = await client.generate({
      prompt,
      size,
      watermark: false,
      ...(referenceImageUrl ? { image: referenceImageUrl } : {}),
    });

    const helper = client.getResponseHelper(response);
    if (helper.success && helper.imageUrls.length > 0) {
      return NextResponse.json({ imageUrl: helper.imageUrls[0] });
    }
    return NextResponse.json(
      { error: helper.errorMessages.join('; ') || '图片生成失败' },
      { status: 500 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '图片生成失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
