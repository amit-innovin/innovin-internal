"use client";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";

export function StudioDialog({ title, description, children, onClose, className = "" }: { title: string; description: string; children: React.ReactNode; onClose: () => void; className?: string }) {
  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Overlay className="studio-modal-overlay" /><Dialog.Content className={`studio-modal ${className}`}><div className="flex items-center justify-between gap-4"><Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title><Dialog.Close className="studio-icon-button" aria-label="Close dialog"><X size={18} /></Dialog.Close></div><Dialog.Description className="mt-2 mb-6 text-sm text-muted-foreground">{description}</Dialog.Description>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
