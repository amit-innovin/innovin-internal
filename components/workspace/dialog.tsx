"use client";
import { useRef } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

export function StudioDialog({ title, description, children, onClose, className = "" }: { title: string; description: string; children: React.ReactNode; onClose: () => void; className?: string }) {
  const opener = useRef(typeof document === "undefined" ? null : document.activeElement as HTMLElement | null);
  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="studio-modal-overlay" /><Dialog.Content aria-label={title} onCloseAutoFocus={event => { event.preventDefault(); if (opener.current?.isConnected) opener.current.focus({ preventScroll: true }); }} className={`studio-modal ${className}`}><div className="flex items-center justify-between gap-4"><Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title><Dialog.Close className="studio-icon-button" aria-label="Close dialog"><X size={18} /></Dialog.Close></div><Dialog.Description className="mt-2 mb-6 text-sm text-muted-foreground">{description}</Dialog.Description>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
