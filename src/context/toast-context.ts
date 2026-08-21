import { createContext, useContext } from "react";

export type ToastTone = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  tone: ToastTone;
}

export interface ToastContextValue {
  toast: (input: { title: string; message?: string; tone?: ToastTone }) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
