import React, { useRef, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';

interface SwipeButtonProps {
  label: string;
  onComplete: () => void;
  variant?: 'default' | 'green';
}

export const SwipeButton: React.FC<SwipeButtonProps> = ({
  label,
  onComplete,
  variant = 'default',
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [completed, setCompleted] = useState(false);
  const startXRef = useRef(0);
  const maxDragRef = useRef(0);

  const thumbWidth = 56;

  const getMaxDrag = () => {
    if (!trackRef.current) return 220;
    return Math.max(trackRef.current.clientWidth - thumbWidth - 8, 120);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (completed) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX - dragX;
    maxDragRef.current = getMaxDrag();
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || completed) return;
    const nextX = Math.max(0, Math.min(e.clientX - startXRef.current, maxDragRef.current));
    setDragX(nextX);
  };

  const triggerComplete = () => {
    setCompleted(true);
    setDragX(getMaxDrag());
    setTimeout(() => {
      onComplete();
      setCompleted(false);
      setDragX(0);
    }, 240);
  };

  const handlePointerUp = () => {
    if (!isDragging || completed) return;
    setIsDragging(false);
    const maxDrag = maxDragRef.current || getMaxDrag();
    if (dragX >= maxDrag * 0.72) {
      triggerComplete();
    } else {
      setDragX(0);
    }
  };

  const progress = Math.min(dragX / Math.max(maxDragRef.current || 220, 1), 1);

  return (
    <div
      ref={trackRef}
      className="relative w-full h-14 bg-[#EEEEEE] rounded-xl overflow-hidden select-none flex items-center justify-center border border-black/5"
    >
      {/* Progress subtle fill */}
      <div
        className={`absolute inset-y-0 left-0 transition-opacity ${
          variant === 'green' ? 'bg-[#05944F]/15' : 'bg-black/10'
        }`}
        style={{ width: `${dragX + thumbWidth + 4}px` }}
      />

      {/* Centered Label */}
      <span
        className="text-[16px] font-semibold tracking-tight text-black pointer-events-none transition-opacity"
        style={{ opacity: Math.max(0.15, 1 - progress * 1.2) }}
      >
        {label}
      </span>

      {/* Draggable Black Thumb */}
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            triggerComplete();
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? 'none' : 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className={`absolute left-1 top-1 bottom-1 w-14 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing shadow-sm ${
          variant === 'green' ? 'bg-[#05944F] text-white' : 'bg-black text-white'
        }`}
      >
        {completed ? <Check className="w-5 h-5 stroke-[2.5]" /> : <ArrowRight className="w-5 h-5 stroke-[2.2]" />}
      </div>

      {/* Quick tap assist on right end for mouse users who prefer a single tap */}
      <button
        type="button"
        onClick={triggerComplete}
        aria-label={`Confirm ${label}`}
        title="Click to swipe"
        className="absolute right-0 top-0 bottom-0 w-16 opacity-0 cursor-pointer"
      />
    </div>
  );
};
