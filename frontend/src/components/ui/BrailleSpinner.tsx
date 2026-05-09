import { useEffect, useState } from 'react';
import spinners from 'unicode-animations';
import type { BrailleSpinnerName } from 'unicode-animations';

type SpinnerAnimation = Extract<BrailleSpinnerName, 'rain' | 'pulse' | 'sparkle' | 'orbit'>;

interface Props {
  animation?: SpinnerAnimation;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
} as const;

export default function BrailleSpinner({ animation = 'pulse', size = 'md', label, className }: Props) {
  const spinner = spinners[animation];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % spinner.frames.length);
    }, spinner.interval);
    return () => clearInterval(id);
  }, [spinner]);

  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${className ?? ''}`}>
      <span className={`inline-block font-mono ${sizeClasses[size]}`} aria-label="Loading">
        {spinner.frames[frame]}
      </span>
      {label && <span className="text-sm text-white/30">{label}</span>}
    </div>
  );
}
