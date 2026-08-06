/**
 * src/lib/openai.ts
 *
 * Cliente OpenAI para el Copiloto de Objeciones.
 * Genera 2-3 respuestas estratégicas ante objeciones de prospectos (precio, tiempo, competencia, otro).
 */
import OpenAI from "openai";
import {
  objectionResponseSchema,
  type ObjectionResponseInput,
} from "@/types/schemas";
import type { ProfileRow, ProspectRow, AuditRow, ObjectionType } from "@/types/database.types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

interface GenerateObjectionParams {
  profile: ProfileRow;
  prospect: ProspectRow;
  audit?: AuditRow | null;
  objectionText: string;
  objectionType?: ObjectionType | null;
}

export async function generateObjectionResponses({
  profile,
  prospect,
  audit,
  objectionText,
  objectionType,
}: GenerateObjectionParams): Promise<ObjectionResponseInput> {
  const ventajasStr = Array.isArray(profile.ventajas)
    ? (profile.ventajas as string[]).join(", ")
    : "Servicios de desarrollo y marketing digital";

  const puntosDolorStr = audit && Array.isArray(audit.puntos_dolor)
    ? (audit.puntos_dolor as string[]).join("; ")
    : "Sin auditoría previa";

  const systemPrompt = `Eres un asesor de ventas B2B experto en manejo de objeciones en español para agencias digitales en Latinoamérica.
El vendedor (Sector: ${profile.sector ?? "Marketing y Software"}, Ventajas: ${ventajasStr}) le escribió a la empresa "${prospect.nombre_empresa}" y la empresa respondió con la siguiente objeción:

"${objectionText}"

${objectionType ? `Categoría de objeción indicada por el vendedor: ${objectionType}` : "Clasifica tú mismo la categoría principal de la objeción."}

Contexto del prospecto:
- Puntos de dolor de su presencia digital: ${puntosDolorStr}
- Resumen IA previo: ${audit?.resumen_ia ?? "No disponible"}

Instrucciones:
1. Genera de 2 a 3 respuestas estratégicas y distintas entre sí para responder a esta objeción.
2. Cada respuesta debe tener un "enfoque" claro (ej: "Enfoque en Retorno de Inversión", "Filtro de interés + Llamada breve", "Reencuadre como Auditoría Complementaria").
3. Si la objeción es de PRECIO: Enfócate en ROI, valor estratégico y costo de inacción.
4. Si la objeción es de TIEMPO ("mándame información por correo"): Genera un mensaje directo para filtrar interés real o agendar llamada corta de 5 min.
5. Si la objeción es de COMPETENCIA ("ya tengo proveedor"): Posiciónate como segunda opinión o auditoría complementaria sin desacreditar al actual.
6. Cada mensaje debe estar listo para copiar y enviar (en tono directo, humano, sin sonar a plantilla ni acartonado).

Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
{
  "respuestas": [
    {
      "enfoque": "<título corto del enfoque estratégico>",
      "texto": "<mensaje listo para enviar>"
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Genera las respuestas para: "${objectionText}"` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const rawJson = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(rawJson);
  const validated = objectionResponseSchema.parse(parsed);

  return validated;
}
