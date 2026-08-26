import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: string, duration?: number) => void;
  error: (title: string, message?: string, duration?: number) => void;
  warning: (title: string, message?: string, duration?: number) => void;
  info: (title: string, message?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string, duration = 4000) => {
      const id = Math.random().toString(36).substring(2, 9) + Date.now();
      const newToast: Toast = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (title: string, message?: string, duration?: number) =>
      showToast('success', title, message, duration),
    [showToast]
  );

  const error = useCallback(
    (title: string, message?: string, duration?: number) =>
      showToast('error', title, message, duration || 5000),
    [showToast]
  );

  const warning = useCallback(
    (title: string, message?: string, duration?: number) =>
      showToast('warning', title, message, duration || 4500),
    [showToast]
  );

  const info = useCallback(
    (title: string, message?: string, duration?: number) =>
      showToast('info', title, message, duration),
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{ toasts, showToast, removeToast, success, error, warning, info }}
    >
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => {
          const IconComponent =
            toast.type === 'success'
              ? CheckCircle2
              : toast.type === 'error'
              ? AlertCircle
              : toast.type === 'warning'
              ? AlertTriangle
              : Info;

          return (
            <div key={toast.id} className={`toast-card toast-${toast.type} animate-slide-in`}>
              <div className="toast-icon-wrapper">
                <IconComponent size={20} className="toast-icon" />
              </div>
              <div className="toast-content">
                <strong className="toast-title">{toast.title}</strong>
                {toast.message && <p className="toast-msg">{toast.message}</p>}
              </div>
              <button
                className="toast-close"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>

      <style>{`
        .toast-container {
          position: fixed;
          top: 1.5rem;
          right: 1.5rem;
          z-index: 99999;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          max-width: 420px;
          width: calc(100vw - 3rem);
          pointer-events: none;
        }

        .toast-card {
          pointer-events: auto;
          display: flex;
          align-items: flex-start;
          gap: 0.85rem;
          padding: 1rem 1.15rem;
          border-radius: 14px;
          background: rgba(18, 20, 29, 0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.08);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          color: #f1f5f9;
        }

        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }

        .animate-slide-in {
          animation: toastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .toast-success {
          border-left: 4px solid #10b981;
          box-shadow: 0 10px 30px -5px rgba(16, 185, 129, 0.15), 0 0 0 1px rgba(16, 185, 129, 0.2);
        }
        .toast-success .toast-icon {
          color: #10b981;
        }

        .toast-error {
          border-left: 4px solid #ef4444;
          box-shadow: 0 10px 30px -5px rgba(239, 68, 68, 0.15), 0 0 0 1px rgba(239, 68, 68, 0.2);
        }
        .toast-error .toast-icon {
          color: #ef4444;
        }

        .toast-warning {
          border-left: 4px solid #f59e0b;
          box-shadow: 0 10px 30px -5px rgba(245, 158, 11, 0.15), 0 0 0 1px rgba(245, 158, 11, 0.2);
        }
        .toast-warning .toast-icon {
          color: #f59e0b;
        }

        .toast-info {
          border-left: 4px solid #6366f1;
          box-shadow: 0 10px 30px -5px rgba(99, 102, 241, 0.15), 0 0 0 1px rgba(99, 102, 241, 0.2);
        }
        .toast-info .toast-icon {
          color: #818cf8;
        }

        .toast-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 1px;
          flex-shrink: 0;
        }

        .toast-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          min-width: 0;
        }

        .toast-title {
          font-size: 0.92rem;
          font-weight: 600;
          line-height: 1.3;
          color: #f8fafc;
        }

        .toast-msg {
          font-size: 0.82rem;
          color: #94a3b8;
          line-height: 1.4;
          margin: 0;
          word-break: break-word;
        }

        .toast-close {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 2px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }

        .toast-close:hover {
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.08);
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
