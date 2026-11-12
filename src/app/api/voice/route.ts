import { NextRequest, NextResponse } from 'next/server';
import { TTSClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const { text, speaker } = (await request.json()) as {
      text: string;
      speaker?: string;
    };

    if (!text) {
      return NextResponse.json({ error: '缺少配音文案' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new TTSClient(config, customHeaders);

    const response = await client.synthesize({
      uid: 'cineflow-user',
      text,
      speaker: speaker || 'zh_male_dayi_saturn_bigtts',
      audioFormat: 'mp3',
      sampleRate: 44100,
    });

    return NextResponse.json({
      audioUrl: response.audioUri,
      audioSize: response.audioSize,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '配音生成失败';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
