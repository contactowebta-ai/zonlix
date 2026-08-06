"use client";

import React, { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, PhoneCall } from "lucide-react";
import { marcarComoContactado } from "@/app/actions/prospects.actions";
import { buildWhatsAppUrl } from "@/lib/utils";
import { validatePhoneType } from "@/lib/phone";
import { toast } from "sonner";
import type { ProspectRow } from "@/types/database.types";

interface WhatsAppButtonProps {
  prospect: ProspectRow;
  message?: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary";
}

export function WhatsAppButton({
  prospect,
  message = "Hola, vi la presencia digital de tu negocio y me gustaría comentarte algo importante.",
  className = "",
  size = "sm",
  variant = "default",
}: WhatsAppButtonProps) {
  const [isPending, startTransition] = useTransition();

  const phone = prospect.whatsapp || prospect.telefono;

  if (!phone) {
    return (
      <Button variant="outline" size={size} disabled className={`opacity-60 cursor-not-allowed ${className}`}>
        <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
        Sin número
      </Button>
    );
  }

  // Normalizar número: si no empieza con código de país (+), anteponer +52
  let rawPhone = phone.trim();
  if (!rawPhone.startsWith("+")) {
    // Si no empieza con +, asumir código de país México +52 (configurable)
    rawPhone = `52${rawPhone.replace(/\D/g, "")}`;
  }

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.preventDefault();

    startTransition(async () => {
      // 1. Siempre marcar como contactado antes de abrir la pestaña
      const result = await marcarComoContactado(prospect.id);
      if (!result.success) {
        toast.error(result.error ?? "No se pudo actualizar el estado a contactado");
      }

      // 2. Construir la URL e abrir en nueva ventana
      const waUrl = buildWhatsAppUrl(rawPhone, message);
      window.open(waUrl, "_blank", "noopener,noreferrer");
    });
  };

  const phoneType = validatePhoneType(phone);

  if (phoneType === 'LANDLINE' || phoneType === 'UNVERIFIED' || phoneType === 'UNKNOWN') {
    const handleCallClick = (e: React.MouseEvent) => {
      e.preventDefault();
      startTransition(async () => {
        const result = await marcarComoContactado(prospect.id);
        if (!result.success) {
          toast.error(result.error ?? "No se pudo actualizar el estado a contactado");
        }
        window.location.href = `tel:${rawPhone}`;
      });
    };

    return (
      <Button
        variant={variant}
        size={size}
        onClick={handleCallClick}
        disabled={isPending}
        className={`bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm transition-all ${className?.replace('bg-emerald-500/10', 'bg-blue-500/10')?.replace('text-emerald-600', 'text-blue-600')?.replace('dark:text-emerald-400', 'dark:text-blue-400')}`}
      >
        <PhoneCall className="w-3.5 h-3.5 mr-1.5" />
        {isPending ? "Llamando..." : "Llamar"}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleWhatsAppClick}
      disabled={isPending}
      className={`bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition-all ${className}`}
    >
      <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
      {isPending ? "Abriendo..." : "WhatsApp"}
    </Button>
  );
}
