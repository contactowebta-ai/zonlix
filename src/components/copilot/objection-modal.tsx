"use client";

import React, { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Copy, Check, MessageSquare, Bot, AlertCircle } from "lucide-react";
import { generateObjectionOptions } from "@/app/actions/objections.actions";
import { WhatsAppButton } from "@/components/prospects/whatsapp-button";
import { toast } from "sonner";
import type { ProspectRow, ObjectionType } from "@/types";

interface ObjectionModalProps {
  prospect: ProspectRow;
  trigger?: React.ReactElement;
}


export function ObjectionModal({ prospect, trigger }: ObjectionModalProps) {
  const [open, setOpen] = useState(false);
  const [objectionText, setObjectionText] = useState("");
  const [objectionType, setObjectionType] = useState<string>("auto");
  const [isPending, startTransition] = useTransition();

  const [responses, setResponses] = useState<Array<{ enfoque: string; texto: string }>>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();

    if (!objectionText.trim()) {
      toast.error("Por favor pega la respuesta u objeción del prospecto");
      return;
    }

    startTransition(async () => {
      const typeParam = objectionType === "auto" ? null : (objectionType as ObjectionType);
      const result = await generateObjectionOptions(prospect.id, objectionText, typeParam);

      if (result.success && result.data) {
        setResponses(result.data.respuestas);
        toast.success("Respuestas estratégicas generadas con éxito");
      } else {
        toast.error(result.error ?? "No se pudieron generar las respuestas");
      }
    });
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
              <Bot className="w-4 h-4 text-primary" />
              Registrar respuesta del prospecto (Copiloto)
            </Button>
          )
        }
      />

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-border bg-card/95 backdrop-blur-md shadow-2xl rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Copiloto IA de Objeciones</span>
          </div>
          <DialogTitle className="text-xl font-bold">
            Manejo de Objeciones: {prospect.nombre_empresa}
          </DialogTitle>
          <DialogDescription>
            Pega el mensaje que te envió el prospecto. La IA analizará la objeción y te sugerirá 2 o 3 respuestas estratégicas personalizadas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleGenerate} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="objectionText">Respuesta del prospecto *</Label>
            <Textarea
              id="objectionText"
              placeholder='Ej. "Está muy caro", "Mándame info por correo", "Ya tenemos una agencia trabajando con nosotros"'
              rows={3}
              value={objectionText}
              onChange={(e) => setObjectionText(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="objectionType">Tipo de objeción (Opcional - La IA lo inferirá si no lo seleccionas)</Label>
            <Select value={objectionType} onValueChange={(val) => setObjectionType(val ?? "auto")} disabled={isPending}>

              <SelectTrigger id="objectionType">
                <SelectValue placeholder="Autodetectar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Autodetectar con IA</SelectItem>
                <SelectItem value="precio">Precio / Presupuesto</SelectItem>
                <SelectItem value="tiempo">Tiempo / Mándame información</SelectItem>
                <SelectItem value="competencia">Ya tienen proveedor / competencia</SelectItem>
                <SelectItem value="otro">Otro tipo de objeción</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            disabled={isPending || !objectionText.trim()}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            {isPending ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                Analizando respuesta con GPT-4o...
              </>
            ) : (
              <>
                <Bot className="w-4 h-4 mr-2" />
                Generar Respuestas Sugeridas
              </>
            )}
          </Button>
        </form>

        {/* Lista de Respuestas Generadas */}
        {responses.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-border mt-4">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              Respuestas Sugeridas por el Copiloto
            </h4>

            <div className="space-y-3">
              {responses.map((item, index) => (
                <Card key={index} className="border-border bg-muted/20 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
                  <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs font-semibold text-primary">
                      {item.enfoque}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(item.texto, index)}
                        className="h-7 px-2 text-xs"
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 mr-1" />
                            Copiar
                          </>
                        )}
                      </Button>
                      <WhatsAppButton prospect={prospect} message={item.texto} size="sm" />
                    </div>
                  </CardHeader>
                  <CardContent className="py-2 px-4 pb-4">
                    <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                      {item.texto}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
