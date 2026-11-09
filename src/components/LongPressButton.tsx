import { useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

interface LongPressButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  onLongPress: () => void;
  delay?: number;
}

export function LongPressButton({ children, onLongPress, delay = 650, onClick, ...props }: LongPressButtonProps) {
  const timerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);

  const cancelTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = () => {
    cancelTimer();
    longPressedRef.current = false;
    timerRef.current = window.setTimeout(() => {
      longPressedRef.current = true;
      timerRef.current = null;
      onLongPress();
    }, delay);
  };

  return (
    <button
      {...props}
      onPointerDown={(event) => {
        props.onPointerDown?.(event);
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        startTimer();
      }}
      onPointerUp={(event) => {
        props.onPointerUp?.(event);
        cancelTimer();
      }}
      onPointerLeave={(event) => {
        props.onPointerLeave?.(event);
        cancelTimer();
      }}
      onPointerCancel={(event) => {
        props.onPointerCancel?.(event);
        cancelTimer();
      }}
      onContextMenu={(event) => {
        props.onContextMenu?.(event);
        event.preventDefault();
        if (!longPressedRef.current) {
          cancelTimer();
          longPressedRef.current = true;
          onLongPress();
        }
      }}
      onClick={(event) => {
        if (longPressedRef.current) {
          event.preventDefault();
          event.stopPropagation();
          longPressedRef.current = false;
          return;
        }
        onClick?.(event);
      }}
    >
      {children}
    </button>
  );
}
