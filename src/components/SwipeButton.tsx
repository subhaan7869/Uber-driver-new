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
  const dragXRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const [completed, setCompleted] = useState(false);
  const completedRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const maxDragRef = useRef(0);

  const thumbWidth = 56;

  const getMaxDrag = () => {
    if (!trackRef.current) return 220;
    return Math.max(trackRef.current.clientWidth - thumbWidth - 8, 120);
  };

  const updateDrag = (next: number) => {
    dragXRef.current = next;
    setDragX(next);
  };

  const triggerComplete = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    isDraggingRef.current = false;
    activePointerIdRef.current = null;
    setIsDragging(false);
    setCompleted(true);
    updateDrag(getMaxDrag());
    setTimeout(() => {
      onComplete();
      completedRef.current = false;
      setCompleted(false);
      updateDrag(0);
    }, 240);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (completedRef.current) return;
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable
    }
    activePointerIdRef.current = e.pointerId;
    maxDragRef.current = getMaxDrag();
    startXRef.current = e.clientX - dragXRef.current;
    isDraggingRef.current = true;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || completedRef.current) return;
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
    e.stopPropagation();
    const maxDrag = maxDragRef.current || getMaxDrag();
    const nextX = Math.max(0, Math.min(e.clientX - startXRef.current, maxDrag));
    updateDrag(nextX);

    if (nextX >= maxDrag * 0.92) {
      triggerComplete();
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || completedRef.current) return;
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
    activePointerIdRef.current = null;
    isDraggingRef.current = false;
    setIsDragging(false);

    const maxDrag = maxDragRef.current || getMaxDrag();
    if (dragXRef.current >= maxDrag * 0.62) {
      triggerComplete();
    } else {
      updateDrag(0);
    }
  };

  const progress = Math.min(dragX / Math.max(maxDragRef.current || 220, 1), 1);

  return (
    <div
      ref={trackRef}
      style={{ touchAction: 'none', overscrollBehaviorX: 'contain' }}
      className="relative w-full h-14 bg-[#EEEEEE] dark:bg-white/10 rounded-xl overflow-hidden select-none touch-none flex items-center justify-center border border-black/5 dark:border-white/10"
    >
      {/* Progress subtle fill */}
      <div
        className={`absolute inset-y-0 left-0 pointer-events-none transition-opacity ${
          variant === 'green' ? 'bg-[#05944F]/20' : 'bg-black/10 dark:bg-white/15'
        }`}
        style={{ width: `${dragX + thumbWidth + 4}px` }}
      />

      {/* Centered Label */}
      <span
        className="text-[16px] font-semibold tracking-tight text-black dark:text-white pointer-events-none transition-opacity pl-10 pr-6 truncate"
        style={{ opacity: Math.max(0.15, 1 - progress * 1.2) }}
      >
        {label}
      </span>

      {/* Draggable Thumb */}
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
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{
          touchAction: 'none',
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? 'none' : 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className={`absolute left-1 top-1 bottom-1 w-14 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing shadow-sm touch-none select-none ${
          variant === 'green' ? 'bg-[#05944F] text-white' : 'bg-black text-white'
        }`}
      >
        {completed ? (
          <Check className="w-5 h-5 stroke-[2.5]" />
        ) : (
          <ArrowRight className="w-5 h-5 stroke-[2.2]" />
        )}
      </div>

      {/* Quick tap assist on right end for tablet/mouse users who prefer a single tap */}
      <button
        type="button"
        onClick={triggerComplete}
        aria-label={`Confirm ${label}`}
        title="Tap to confirm"
        className="absolute right-0 top-0 bottom-0 w-16 opacity-0 cursor-pointer"
      />
    </div>
  );
};
