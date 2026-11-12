import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CineFlow 片场 | AI 视频创作智能体',
  description:
    '从一个创意出发，自动完成分镜脚本、画面生成、配音配乐与视频合成，一站式产出成片。',
  keywords: ['AI 视频', '文生视频', '图生视频', '分镜脚本', 'TTS 配音', '视频合成'],
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
