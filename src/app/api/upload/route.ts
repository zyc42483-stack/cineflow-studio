import { NextRequest, NextResponse } from 'next/server';
import { S3Storage } from 'coze-coding-dev-sdk';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '缺少上传文件' }, { status: 400 });
    }
    if (file.size > 200 * 1024 * 1024) {
      return NextResponse.json({ error: '文件不能超过 200MB' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = (file.name || 'image.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });
    const key = await storage.uploadFile({
      fileContent: buffer,
      fileName: `uploads/${safeName}`,
      contentType: file.type || 'image/jpeg',
    });
    const url = await storage.generatePresignedUrl({ key, expireTime: 2592000 });
    return NextResponse.json({ url });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '上传失败';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
