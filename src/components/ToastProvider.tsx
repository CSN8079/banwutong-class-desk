import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastContext, type ToastTone } from './toast-context';

interface ToastMessage { id: number; message: string; tone: ToastTone }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random();
    setMessages((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setMessages((current) => current.filter((item) => item.id !== id));
    }, 3000);
  }, []);
  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {messages.map((item) => (
          <div className={`toast toast-${item.tone}`} key={item.id}>
            {item.tone === 'success'
              ? <CheckCircle2 size={18} />
              : item.tone === 'error'
                ? <AlertTriangle size={18} />
                : <Info size={18} />}
            <span>{item.message}</span>
            <button
              className="icon-button toast-close"
              aria-label="关闭提示"
              onClick={() => setMessages((current) => current.filter((entry) => entry.id !== item.id))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
