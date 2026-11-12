import { cn } from '@/lib/utils';
import type { AssetStatus } from '@/lib/types';

/** 状态指示灯：待机(灰) / 生成中(青呼吸) / 完成(琥珀金) / 失败(红) */
export function Lamp({ status, className }: { status: AssetStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        status === 'idle' && 'bg-muted-foreground/40',
        status === 'loading' && 'bg-[#4FD1C5] text-[#4FD1C5] lamp-loading',
        status === 'done' && 'bg-primary text-primary shadow-[0_0_8px_2px]',
        status === 'error' && 'bg-destructive',
        className,
      )}
    />
  );
}

export function StepNode({ label, status }: { label: string; status: AssetStatus }) {
  return (
    <div className="flex items-center gap-2">
      <Lamp status={status} />
      <span
        className={cn(
          'font-mono text-xs tracking-widest',
          status === 'done' ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </div>
  );
}
