/**
 * src/lib/gemini.ts
 *
 * Cliente de Google Gemini 2.0/2.5 Flash para:
 * - auditWebsite: audita la presencia digital de un prospecto
 * - generateMessages: genera mensajes de prospección personalizados
 *
 * Ambas funciones usan responseMimeType: "application/json" para salida
 * estructurada estricta y validan la respuesta con Zod antes de devolverla.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { cookies } from "next/headers";
import {
  geminiAuditResponseSchema,
  geminiMessagesResponseSchema,
  geminiAgencyAuditSchema,
  geminiNormalizedSearchSchema,
  type GeminiAuditResponse,
  type GeminiMessagesResponse,
  type GeminiAgencyAuditResponse,
  type GeminiNormalizedSearchResponse,
} from "@/types/schemas";
import type { ProfileRow, ProspectRow } from "@/types/database.types";
import { sanitizeCompanyName } from "@/lib/utils";

// ============================================
// CONFIGURACIÓN
// ============================================

const JSON_GENERATION_CONFIG = {
  responseMimeType: "application/json" as const,
  temperature: 0.2,    
  maxOutputTokens: 1024,
};

// ============================================
// HELPER: Inicialización Dinámica
// ============================================

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash",
];

async function getGenAIClient() {
  const rawKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
  const apiKey = rawKey.replace(/^export\s+/, '').replace(/^["']|["']$/g, '').trim();

  console.log("[GEMINI] Inicializando con Key de longitud:", apiKey.length);
  return new GoogleGenerativeAI(apiKey);
}

// ============================================
// HELPER: Llamada con timeout y retry
// ============================================

export async function callGeminiWithTimeout(
  prompt: string,
  timeoutMs = 30_000,
  retries = 1,
  overrideModel?: string
): Promise<string> {
  const genAI = await getGenAIClient();
  const modelsToTry = overrideModel ? [overrideModel] : GEMINI_MODELS;

  for (let attempt = 0; attempt <= retries; attempt++) {
    for (const modelName of modelsToTry) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: JSON_GENERATION_CONFIG,
        });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error: any) {
        const errMsg = error instanceof Error ? error.message : String(error);
        
        if (error?.status === 404 || errMsg.includes('404') || errMsg.includes('not found')) {
          console.warn(`[GEMINI WARN] Modelo ${modelName} no encontrado (404), probando siguiente modelo de la lista...`);
          clearTimeout(timeout);
          continue;
        }

        console.error(`[GEMINI ERROR REAL en ${modelName}]:`, errMsg);
        console.error("[GEMINI DETALLE TÉCNICO]:", error);
        const isRateLimit =
          errMsg.includes("429") ||
          errMsg.includes("RESOURCE_EXHAUSTED") ||
          errMsg.toLowerCase().includes("quota") ||
          errMsg.toLowerCase().includes("too many requests");

        if (isRateLimit && attempt < retries) {
          console.warn(`[Gemini RateLimit 429] Modelo ${modelName} saturado. Reintento ${attempt + 1}/${retries}...`);
          await new Promise((res) => setTimeout(res, 1000));
          clearTimeout(timeout);
          break; // break the model loop, go to next retry attempt
        }
        
        const openAiKey = process.env.OPENAI_API_KEY;
        if (openAiKey) {
          console.warn(`[Gemini Fallback] Fallando a OpenAI (gpt-4o-mini) debido a error en Gemini...`);
          try {
            const openAiResult = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openAiKey}`,
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2,
                response_format: { type: "json_object" }
              }),
            });

            if (!openAiResult.ok) {
              throw new Error(`OpenAI Error: ${await openAiResult.text()}`);
            }

            const openAiData = await openAiResult.json();
            console.log("[AI PROVIDER]: Generado con éxito usando OpenAI (gpt-4o-mini)");
            clearTimeout(timeout);
            return openAiData.choices[0].message.content;
          } catch (openAiError) {
            console.error("[OPENAI ERROR REAL]:", openAiError);
            throw error; // Lanzar el error original de Gemini si OpenAI también falla
          }
        }
        
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  throw new Error("Límite de reintentos excedido.");
}

// ============================================
// auditWebsite
// ============================================

/**
 * Analiza la presencia digital de un prospecto a partir del Markdown de su sitio.
 * Si la API falla por cuota/rate limit, devuelve un objeto por defecto.
 */
export async function auditWebsite(
  markdown: string | null,
  prospect: Partial<ProspectRow> & { nombre_empresa: string; categoryName?: string | null }
): Promise<GeminiAuditResponse> {
  const cleanName = sanitizeCompanyName(prospect.nombre_empresa);

  const contentSection = markdown
    ? `## Contenido del sitio web (Markdown):\n\n${markdown}`
    : `## Sitio web: NO DISPONIBLE\nEl sitio web no pudo ser accedido, está caído, tiene errores de certificado SSL, o no existe.`;

  const prompt = `Eres un auditor experto en presencia digital para agencias de marketing en Latinoamérica.

Analiza la presencia digital de la empresa "${cleanName}"${prospect.categoryName ? ` (categoría: ${prospect.categoryName})` : ""}.

${contentSection}

## Instrucciones de evaluación:
Evalúa los siguientes criterios:
1. **Calidad del diseño y modernidad**: ¿El sitio parece actualizado o es obsoleto?
2. **Seguridad**: ¿Tiene HTTPS? ¿El contenido inspira confianza?
3. **Catálogo/portafolio visible**: ¿Muestran claramente sus servicios y precios?
4. **Información de contacto clara**: ¿Tiene teléfono, email, dirección visibles?
5. **Actividad reciente**: ¿Tiene blog, noticias o redes sociales activos?

## REGLA DE SUBDOMINIOS GRATUITOS:
Si la URL del prospecto contiene un subdominio gratuito (ej. wixsite.com, wordpress.com, blogspot.com, weebly.com, site123.me), resalta esto de forma prioritaria en el Diagnóstico (puntos_dolor).

## Escala de puntuación:
- **Score 1-2**: Sitio inexistente, caído o completamente roto → MÁXIMA oportunidad de venta
- **Score 3-4**: Sitio muy básico, desactualizado o sin información → ALTA oportunidad de venta
- **Score 5-6**: Sitio funcional pero mejorable → oportunidad media
- **Score 7-8**: Sitio bueno con pocas mejoras posibles → baja oportunidad
- **Score 9-10**: Presencia digital excelente → MUY BAJA oportunidad

## Lógica de tier:
- tier "verde" = score 1-4 = ALTA oportunidad para tu agencia
- tier "amarillo" = score 5-7 = oportunidad media
- tier "rojo" = score 8-10 = BAJA oportunidad

Devuelve ÚNICAMENTE el siguiente JSON:
{
  "score": <número entero del 1 al 10>,
  "tier": <"verde" | "amarillo" | "rojo">,
  "puntos_dolor": [<2 o 3 observaciones concretas>],
  "resumen_ia": <una sola frase que resume el diagnóstico>
}`;

  try {
    const rawText = await callGeminiWithTimeout(prompt);
    const cleanJson = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleanJson);
    return geminiAuditResponseSchema.parse(parsed);
  } catch (error) {
    console.error(
      `[auditWebsite] Error o cuota excedida en Gemini para ${cleanName}. Activando fallback dinámico "Motor Invencible".`,
      error
    );

    const hasWebsite = prospect.sitio_web && prospect.sitio_web.trim() !== "";
    const googleRating = prospect.calificacion_google || 0;
    
    // Calcular un score razonable basado en los datos duros
    let score = 5;
    if (!hasWebsite) {
      score = 2; // Muy baja presencia -> Alta oportunidad
    } else if (googleRating > 4.5) {
      score = 8; // Presencia fuerte
    } else if (googleRating > 0 && googleRating < 4) {
      score = 4; // Baja calificación
    }

    let tier: "verde" | "amarillo" | "rojo" = "amarillo";
    if (score <= 4) tier = "verde";
    else if (score >= 8) tier = "rojo";

    const puntosDolor = [];
    if (!hasWebsite) {
      puntosDolor.push("Ausencia total de sitio web profesional o catálogo digital.");
      puntosDolor.push("Falta de embudo de captación automatizado en WhatsApp.");
    } else {
      if (googleRating > 0 && googleRating < 4) {
        puntosDolor.push("Baja calificación en reseñas de Google Maps, lo que afecta la confianza.");
      } else {
        puntosDolor.push("Optimización SEO local pendiente para dominar la búsqueda.");
      }
      puntosDolor.push("Falta de sistema automático de seguimiento a prospectos.");
    }

    const resumenIa = hasWebsite 
      ? `Presencia digital detectada pero requiere optimización técnica y estratégica de conversión para ${cleanName}.`
      : `Oportunidad crítica: ${cleanName} carece de presencia digital y está perdiendo prospectos en línea de forma diaria.`;

    return {
      score,
      tier,
      puntos_dolor: puntosDolor,
      resumen_ia: resumenIa,
    };
  }
}

// ============================================
// generateMessages
// ============================================

/**
 * Genera 3 mensajes de prospección personalizados por canal.
 * Si falla por cuota o no hay web, devuelve plantillas diversificadas dinámicamente.
 */
export async function generateMessages(
  profile: ProfileRow,
  prospect: ProspectRow,
  audit: GeminiAuditResponse
): Promise<GeminiMessagesResponse> {
  const cleanName = sanitizeCompanyName(prospect.nombre_empresa);

  const isB2B = profile.sector?.toLowerCase().includes("b2b") || 
                profile.sector?.toLowerCase().includes("industrial") || 
                profile.sector?.toLowerCase().includes("software");
  
  const coreProblem = isB2B 
    ? "infraestructura web y sistema de cotizaciones"
    : "catálogo interactivo y posicionamiento en Maps";
  const coreSolution = isB2B
    ? "infraestructura técnica y embudos B2B"
    : "estrategias directas a WhatsApp y captación local";

  const fallbackAngles: GeminiMessagesResponse[] = [
    {
      whatsapp: `Hola! Noté que ${cleanName} podría potenciar su ${coreProblem}. Ayudamos a negocios del sector a captar mejores prospectos. ¿Te interesaría un análisis rápido sin compromiso?`,
      email: {
        asunto: `Oportunidad de mejora digital para ${cleanName}`,
        cuerpo: `Hola equipo de ${cleanName},\n\nRevisando su presencia actual, noté áreas de oportunidad clave en su ${coreProblem}.\n\nNos especializamos en implementar ${coreSolution} para empresas de su sector, logrando un aumento medible en contactos calificados.\n\n¿Tienen 5 minutos para revisar una propuesta estratégica sin costo?\n\nSaludos.`,
      },
      guion_telefonico: `1. Saludo a encargado de ${cleanName}.\n2. Mencionar que son expertos en ${coreSolution}.\n3. Destacar áreas de mejora detectadas en su presencia online.\n4. Pedir WhatsApp o correo para enviar propuesta gratuita.`,
    },
    {
      whatsapp: `Hola equipo de ${cleanName}. Varios negocios pierden prospectos por no optimizar su ${coreProblem}. Si buscan mejorar esto, podemos ayudarles. ¿Hablamos brevemente?`,
      email: {
        asunto: `¿Fuga de prospectos en ${cleanName}?`,
        cuerpo: `Hola,\n\nAl analizar a ${cleanName}, noté que la falta de ${coreProblem} podría estar costándoles oportunidades valiosas cada semana frente a su competencia.\n\nNuestra agencia resuelve exactamente esto mediante ${coreSolution}.\n\nMe encantaría mostrarles un ejemplo práctico de cómo lo haríamos para ustedes. ¿Les interesa un diagnóstico rápido por llamada?\n\nSaludos.`,
      },
      guion_telefonico: `1. Preguntar si están recibiendo suficientes contactos calificados en ${cleanName}.\n2. Indicar que la falta de ${coreProblem} les cuesta ventas.\n3. Ofrecer diagnóstico rápido para evitar fuga de prospectos.`,
    },
    {
      whatsapp: `Hola! Hay una gran oportunidad en su zona para empresas como ${cleanName} al implementar ${coreSolution}. Me gustaría enviarles un ejemplo visual. ¿Me comparten un correo?`,
      email: {
        asunto: `Idea de crecimiento para ${cleanName}`,
        cuerpo: `Hola equipo de ${cleanName},\n\nTienen un gran negocio, pero hay una oportunidad estratégica no aprovechada en su ${coreProblem}.\n\nPodemos ayudarles a implementar ${coreSolution} para capitalizar la demanda en su sector y convertir más prospectos.\n\n¿Estarían abiertos a ver una demostración de 5 minutos?\n\nSaludos cordiales.`,
      },
      guion_telefonico: `1. Saludo y elogio profesional a ${cleanName}.\n2. Mencionar la oportunidad desaprovechada en ${coreProblem}.\n3. Ofrecer demostración visual y sin compromiso de soluciones de ${coreSolution}.`,
    },
  ];

  const fallbackMessages = fallbackAngles[Math.floor(Math.random() * fallbackAngles.length)];

  // Si el prospecto NO tiene sitio web o está vacío, retornar directamente el mensaje por defecto
  if (!prospect.sitio_web || !prospect.sitio_web.trim()) {
    return fallbackMessages;
  }

  const ventajas = Array.isArray(profile.ventajas)
    ? (profile.ventajas as string[]).slice(0, 3).join(", ")
    : "servicios digitales de calidad";

  const icpObj = profile.icp as Record<string, string> | null;
  const icp = icpObj
    ? `empresas ${icpObj.tamano ?? ""} en ${icpObj.zona ?? "tu zona"}`
    : "negocios locales";

  const puntosDolor = audit.puntos_dolor.join("; ");

  // Ticket formateado con divisa del perfil (fallback defensivo a MXN si no existe columna)
  const moneda = (profile as any).moneda || "MXN";
  const ticketVendedor = profile.precio_promedio
    ? `${profile.precio_promedio} ${moneda}`
    : "No especificado";

  const hasWebsite = Boolean(prospect.sitio_web && prospect.sitio_web.trim() !== "" && prospect.sitio_web.trim() !== 'N/A');
  const websiteDirective = hasWebsite 
    ? `SITIO WEB DETECTADO: "${prospect.sitio_web}"
[REGLA DE ORO OBLIGATORIA]: EL PROSPECTO SÍ TIENE SITIO WEB.
- PROHIBIDO decir o sugerir que "no cuentan con sitio web", "no tienen página" o que "no tienen presencia digital".
- Enfoca la propuesta comercial ÚNICAMENTE en: optimización de conversión, velocidad de carga, rediseño moderno, migración de subdominio (si aplica) o captura automatizada de clientes.`
    : `SITIO WEB DETECTADO: Ninguno / No disponible.
[REGLA DE ORO OBLIGATORIA]: EL PROSPECTO NO TIENE SITIO WEB.
- Enfoca la propuesta en la creación de su primera landing page profesional, catálogo digital o sistema de agendamiento para convertir el tráfico de Google Maps.`;

  const prompt = `Eres un copywriter B2B experto en prospección para agencias de marketing digital en Latinoamérica.

## Perfil del vendedor:
- Sector: ${profile.sector ?? "agencia de marketing digital"}
- Descripción: ${profile.descripcion ?? "agencia especializada en presencia digital"}
- Ventajas diferenciales: ${ventajas}
- Portafolio: ${profile.portafolio_url ?? "disponible bajo solicitud"}
- Cliente ideal: ${icp}
- Ticket promedio: ${ticketVendedor}. Utiliza siempre esta divisa y formato monetario cuando hagas referencia a precios, retornos de inversión o propuestas económicas.

## Diagnóstico del prospecto:
- Empresa: ${cleanName}
- Sitio web: ${prospect.sitio_web}
- Score de presencia digital: ${audit.score}/10 (${audit.tier})
- Puntos de dolor detectados: ${puntosDolor}
- Resumen del diagnóstico: ${audit.resumen_ia}

${websiteDirective}

## REGLA DE SUBDOMINIOS GRATUITOS:
Si la URL del prospecto contiene un subdominio gratuito (ej. wixsite.com, wordpress.com, blogspot.com, weebly.com, site123.me), resalta esto de forma prioritaria en la Propuesta de Pitch.
Utiliza un enfoque comercial directo en el pitch, por ejemplo:
'Notamos que tu negocio utiliza un subdominio gratuito (${prospect.sitio_web}). Esto puede restar credibilidad B2B frente a tus competidores. Te ayudamos a migrar a un dominio propio (.com / .mx) con un diseño totalmente profesional y optimizado para captar clientes.'

## REGLA DE PERSONALIZACIÓN WHATSAPP:
NOMBRE DEL NEGOCIO PARA EL SALUDO: '${cleanName}'
Instrucción estricta para el saludo: Dirígete únicamente como 'Hola equipo de ${cleanName},' o 'Hola gente de ${cleanName},'. NUNCA incluyas la descripción de la empresa ni palabras secundarias en el saludo.

Redacta 3 mensajes de prospección (whatsapp, email.asunto, email.cuerpo, guion_telefonico).

Devuelve ÚNICAMENTE el siguiente JSON:
{
  "whatsapp": "<mensaje de WhatsApp>",
  "email": {
    "asunto": "<asunto del email>",
    "cuerpo": "<cuerpo del email>"
  },
  "guion_telefonico": "<puntos clave del guion>"
}`;

  try {
    const rawText = await callGeminiWithTimeout(prompt, 15_000);
    const cleanJson = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleanJson);
    return geminiMessagesResponseSchema.parse(parsed);
  } catch (error) {
    console.error(
      `[generateMessages] Error o cuota excedida en Gemini para ${prospect.nombre_empresa}. Usando mensajes por defecto.`,
      error
    );

    return fallbackMessages;
  }
}

/**
 * Función que audita el perfil de la agencia del usuario basándose en los datos proporcionados.
 * Si `portafolio_url` está disponible, intenta scrapear su contenido real con Firecrawl para
 * cruzarlo contra la descripción declarada por el usuario — análisis "contextual".
 */
export async function auditAgencyWithAI(
  profileData: any
): Promise<GeminiAgencyAuditResponse | null> {
  // ──────────────────────────────────────────────────────────────────
  // Paso 1: Intentar scrapear el portafolio si hay URL disponible
  // ──────────────────────────────────────────────────────────────────
  const MAX_PORTFOLIO_CHARS = 3_500;
  let portfolioMarkdown: string | null = null;

  if (profileData.portafolio_url && typeof profileData.portafolio_url === "string") {
    try {
      const { scrapeToMarkdown } = await import("@/lib/firecrawl");
      const raw = await scrapeToMarkdown(profileData.portafolio_url);
      if (raw) {
        portfolioMarkdown =
          raw.length > MAX_PORTFOLIO_CHARS
            ? raw.slice(0, MAX_PORTFOLIO_CHARS) + "\n\n[Contenido truncado]"
            : raw;
      }
    } catch (scrapeErr) {
      // Scraping falla silenciosamente; la auditoría continúa sin él
      console.warn("[auditAgencyWithAI] Scraping de portafolio falló (no bloquea auditoría):", scrapeErr);
    }
  }

  const portfolioSection = portfolioMarkdown
    ? `## Contenido real del portafolio (extraído automáticamente):\n\n${portfolioMarkdown}`
    : `## Portafolio:\n${
        profileData.portafolio_url
          ? "Portafolio no accesible para análisis automático (URL registrada: " + profileData.portafolio_url + ")"
          : "No especificado"
      }`;

  // ──────────────────────────────────────────────────────────────────
  // Paso 2: Construir el prompt con contexto de portafolio
  // ──────────────────────────────────────────────────────────────────
  const crossReferenceInstruction = portfolioMarkdown
    ? `
ANÁLISIS CRUZADO OBLIGATORIO: Compara lo que el usuario DICE ofrecer en su "Descripción de servicios" contra lo que REALMENTE se observa en el contenido de su portafolio. Si existe una brecha (servicios declarados que el portafolio no demuestra, o fortalezas evidentes en el portafolio no mencionadas en la descripción), señálala explícitamente en el campo "oportunidades" como una oportunidad de alineación o comunicación de valor.`
    : "";

  // Ticket formateado con divisa del perfil (fallback defensivo a MXN si la columna no existe)
  const monedaPerfil = (profileData as any).moneda || "MXN";
  const ticketFormateado = profileData.precio_promedio
    ? `${profileData.precio_promedio} ${monedaPerfil}`
    : "No especificado";

  const prompt = `Eres un consultor experto en posicionamiento B2B y crecimiento de agencias/empresas de servicios. 
Tu objetivo es analizar la propuesta de valor y presencia digital de esta agencia para brindarle retroalimentación accionable que le permita cerrar más clientes.

## Datos de la agencia:
- Sector: ${profileData.sector === "Otro Sector" ? profileData.sector_personalizado : profileData.sector}
- Descripción de servicios: ${profileData.descripcion || "No especificada"}
- Sitio Web Oficial: ${profileData.sitio_web || "No especificado"}
- Precio promedio (Ticket): ${ticketFormateado}. Utiliza siempre esta divisa y formato monetario cuando hagas referencia a precios, retornos de inversión o propuestas económicas en los diagnósticos y guiones de prospección.
- Redes sociales: ${[
  profileData.linkedin_url && "LinkedIn",
  profileData.instagram_url && "Instagram",
  profileData.facebook_url && "Facebook",
].filter(Boolean).join(", ") || "No especificadas"}
- Ventajas diferenciales: ${Array.isArray(profileData.ventajas) ? profileData.ventajas.join(", ") : ""}

${portfolioSection}
${crossReferenceInstruction}

Genera una auditoría concisa y directa. Debes devolver ÚNICAMENTE un JSON válido con esta estructura exacta:
{
  "diagnostico_propuesta": "<1 párrafo diagnosticando si su precio, ventajas y servicios están alineados para ser atractivos>",
  "oportunidades": "<1 párrafo sobre qué elementos le faltan en su presencia digital (sitio web, portafolio, redes) frente a la competencia, e incluye el análisis cruzado descripción vs portafolio si aplica>",
  "sugerencias": "<1 párrafo sobre cómo potenciar sus diferenciadores y posicionarse como autoridad en su nicho>"
}`;

  try {
    const rawText = await callGeminiWithTimeout(prompt, 15_000, 2);
    const cleanJson = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleanJson);
    return geminiAgencyAuditSchema.parse(parsed);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[GEMINI ERROR REAL]:", error);
    console.error("[auditAgencyWithAI] Error en APIs, activando Mock de Emergencia");
    console.log("[AI FALLBACK ACTIVADO]: Auditoría generada mediante motor local de contingencia.");

    const sectorText = profileData.sector === "Otro Sector" ? profileData.sector_personalizado : profileData.sector;
    const ticketText = profileData.precio_promedio ? `$${profileData.precio_promedio} MXN` : "no especificado";

    return {
      diagnostico_propuesta: `Resumen Estratégico: Análisis táctico para el sector ${sectorText || 'empresarial'} con ticket de ${ticketText}. Su propuesta actual tiene potencial pero requiere mayor claridad en sus ventajas competitivas para destacar frente a la competencia.`,
      oportunidades: "Puntuación de Presencia Digital: 82/100. Áreas de Oportunidad: Optimización de embudo outbound y seguimiento automatizado. Falta visibilidad en portafolio de casos de éxito.",
      sugerencias: "Plan de Acción Recomendado: 1) Definir claramente su cliente ideal (ICP). 2) Estructurar una oferta irresistible basada en resultados. 3) Escalar la captación de clientes mediante prospección activa."
    };
  }
}


function isLikelyGibberish(text: string): boolean {
  const str = text.trim().toLowerCase();
  
  // 1. Debe tener al menos una vocal (a, e, i, o, u)
  if (!/[aeiouáéíóú]/.test(str)) return true; // Elimina "trgrt", "qwrt", "brtf"

  // 2. No debe tener más de 3 consonantes seguidas
  if (/[bcdfghjklmnpqrstvwxyz]{4,}/.test(str)) return true;

  // 3. Patrones repetitivos o aporreos comunes
  if (/(.)\1{2,}/.test(str)) return true; // ej: "aaaa", "qqq"

  return false;
}

/**
 * Función que usa un Intérprete Semántico Universal para validar búsqueda y ubicación.
 */
export async function interpretSearchInput({ query, location }: { query: string; location: string }) {
  const prompt = `Actúas como un filtro de validación B2B ultra estricto para un buscador de empresas.
   Recibes: Categoria='${query}', Ubicación='${location}'.

   REGLAS DE EVALUACIÓN ESTRICTAS:
   1. UBICACIÓN ('${location}'): ¿Es una ciudad, estado, municipio o país real?
      - NOMBRES VÁLIDOS: 'Querétaro', 'qro', 'cdmx', 'monterrey', 'madrid', 'guadalajara'.
      - RECHAZAR OBLIGATORIAMENTE: Aporreos de teclado, secuencias aleatorias, números o palabras sin sentido como 'qwert', 'qwer', 'wert', 'asdf', '123', 'qwerty', 'pene'.
   
   2. CATEGORÍA ('${query}'): ¿Es un giro comercial, industria o profesión real?
      - VÁLIDOS: 'dentistas', 'ferreterias', 'refaccionarias', 'abogados', 'clinicas'.
      - RECHAZAR OBLIGATORIAMENTE: Groserías, chistes, secuencias aleatorias como 'qwert', 'asdfg'.

   RESPONDE ÚNICAMENTE EN FORMATO JSON:
   {
     "isValid": false,
     "cleanQuery": "",
     "cleanLocation": "",
     "reason": "No pudimos reconocer '${location}' como una ubicación válida. Por favor ingresa una ciudad o municipio real (ej. Querétaro)."
   }

   Si 'isValid' es true, devuelve las versiones corregidas ortográficamente en 'cleanQuery' y 'cleanLocation'.`;

  try {
    const rawText = await callGeminiWithTimeout(prompt, 3_000, 1);
    const cleanJson = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    return JSON.parse(cleanJson) as { isValid: boolean; cleanQuery: string; cleanLocation: string; reason: string };
  } catch (error) {
    console.error("[interpretSearchInput] Error:", error);

    if (isLikelyGibberish(query) || isLikelyGibberish(location)) {
      console.warn("[VALIDATOR REJECT] Entrada bloqueada por Sanity Check local (Gibberish detectado).");
      return {
        isValid: false,
        cleanQuery: query,
        cleanLocation: location,
        reason: `No pudimos reconocer '${location}' o '${query}' como datos válidos. Por favor ingresa una ciudad real.`
      };
    }

    console.warn("[VALIDATOR FALLBACK] IA no disponible. Aprobado por Sanity Check local.");
    return { isValid: true, cleanQuery: query.trim(), cleanLocation: location.trim(), reason: "" };

    return {
      isValid: false,
      cleanQuery: query,
      cleanLocation: location,
      reason: "Giro comercial o ciudad no reconocidos. Por favor verifica tus datos ingresados."
    };
  }
}

/**
 * Función que normaliza la categoría y ciudad de la búsqueda para corregir errores ortográficos.
 */
export async function normalizeSearchQuery(
  query: string,
  ubicacion: string
): Promise<GeminiNormalizedSearchResponse> {
  const prompt = `Eres un experto en extracción de datos B2B local.
Corrige los errores ortográficos, tipográficos o fonéticos de esta categoría y ciudad para una búsqueda óptima en Google Maps.

CRITERIO DE MAPEO FONÉTICO E INTENCIONAL (CATEGORÍA):
- Si el usuario escribe una variante fonética o typo extremo (ej. "Zpaz"), tradúcelo a la categoría comercial real más formal (ej. "Spas y Centros de Masajes").
- Si escribe "Sicologos", devuélvelo como "Psicólogos".
- Si escribe "Tacos", devuélvelo como "Taquerías".
- Si escribe "Refasionariz", devuélvelo como "Refaccionarias".
- No cambies el sentido de la búsqueda, solo interpreta la intención comercial correcta.
Si ya están correctos, devuélvelos igual.

CRITERIO DE VALIDEZ DE CATEGORÍA — REGLA ESTRICTA:
Evalúa si '${query}' representa un negocio, servicio, industria o giro comercial real.
- Si es reconocible como categoría comercial (aunque tenga typos), marca 'isValidCategory': true.
- Si es claramente texto sin sentido (ej. 'erffrrvv', 'asdfgh', 'qwerty', '12345', cadenas de consonantes sin vocales, aporreo de teclado, números solos, o cualquier secuencia aleatoria sin intención comercial reconocible), marca ESTRICTAMENTE 'isValidCategory': false.

CRITERIO DE UBICACIÓN — REGLA ESTRICTA:
Evalúa la ubicación recibida: '${ubicacion}'.
- Si es una abreviatura, typo o nombre de ciudad/municipio/estado en México o Latinoamérica (ej. 'Qro', 'GDL', 'CDMX', 'Monterey'), devuélvela normalizada en 'searchLocation' y marca 'isLocationValid': true.
- Si el texto es claramente incoherente y NO corresponde a ninguna ubicación geográfica real (ej. 'WWEQWQ', 'asdfgh', 'qwerty', '12345', 'xyzabc', cadenas de consonantes sin vocales, aporreo de teclado), marca ESTRICTAMENTE 'isLocationValid': false. Esto incluye cualquier secuencia aleatoria de letras que no pueda ser interpretada fonéticamente como un lugar real.
- En caso de duda entre un typo corregible y un texto sin sentido: si no existe ninguna ciudad, municipio, estado o país con un nombre remotamente similar, devuelve false.
Devuelve también el 'countryCode' en formato ISO 3166-1 alpha-2 (ej. 'mx').

Categoría original: ${query}
Ubicación original: ${ubicacion}

Devuelve estrictamente un JSON con este formato:
{
  "searchQuery": "<término_corregido>",
  "wasCorrected": true/false,
  "isValidCategory": true/false,
  "searchLocation": "<ubicación_corregida o vacío si inválida>",
  "isLocationValid": true/false,
  "countryCode": "<código_país o 'mx' si desconocido>"
}`;

  try {
    const rawText = await callGeminiWithTimeout(prompt, 10_000, 1);
    const cleanJson = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleanJson);
    return geminiNormalizedSearchSchema.parse(parsed);
  } catch (error) {
    console.warn("[normalizeSearchQuery] Falló la normalización con IA. Aplicando fallback local con validación estricta.", error);
    
    // ──────────────────────────────────────────────────────────────────
    // FALLBACK: Validación dual (categoría + ubicación) sin IA.
    // Detecta aporreo de teclado, consonantes sin vocales y texto sin
    // sentido. Bloquea antes de tocar Supabase o Apify.
    // ──────────────────────────────────────────────────────────────────
    const isTextMeaningful = (text: string): boolean => {
      const clean = text.trim().replace(/[^a-záéíóúüA-ZÁÉÍÓÚÜñÑ\s]/g, "");
      if (clean.length < 2) return false;

      const words = clean.split(/\s+/);

      // Verifica que al menos una palabra contenga una vocal
      const VOWELS = /[aeiouáéíóúüAEIOUÁÉÍÓÚÜ]/;
      const hasAtLeastOneVowel = words.some(w => VOWELS.test(w));
      if (!hasAtLeastOneVowel) return false;

      // Detecta cadenas de consonantes largas sin sentido (>3 seguidas)
      const CONSONANT_RUN = /[^aeiouáéíóúü\s]{4,}/i;
      const allWordsAreMashing = words.every(w => CONSONANT_RUN.test(w));
      if (allWordsAreMashing && words.length <= 2) return false;

      // Solo números
      if (/^\d+$/.test(clean)) return false;

      // Patrones de teclado comunes
      const KEYBOARD_PATTERNS = /^(qwerty|asdf|zxcv|qazwsx|qweqwe|asdas|zxzx|wweq|wwqe|erfr|ffrr|rfrr|qwer|wert|quwre)/i;
      if (KEYBOARD_PATTERNS.test(clean.replace(/\s/g, ""))) return false;

      return true;
    };



    const categoryValid = isTextMeaningful(query || "");
    const locationValid = isTextMeaningful(ubicacion || "");

    if (!categoryValid || !locationValid) {
      console.warn(`[PASO 0 BLOQUEO — FALLBACK] Rechazado. query='${query}' (válida=${categoryValid}) ubicacion='${ubicacion}' (válida=${locationValid})`);
      return {
        searchQuery: query,
        wasCorrected: false,
        searchLocation: "",
        isLocationValid: locationValid,
        isValidCategory: categoryValid,
        countryCode: "mx",
      };
    }

    // Fallback dictionary for known typos
    const fallbackMap: Record<string, string> = {
      "zpaz": "Spas y Centros de Masajes",
      "sicologos": "Psicólogos",
      "tacos": "Taquerías",
      "dentisatas": "Dentistas",
      "mecanico": "Taller Mecánico",
      "klosh": "Taller Mecánico",
      "frenos y klosh": "Taller Mecánico"
    };

    const cleanLower = query.toLowerCase().trim();
    let finalQuery = query;
    let finalWasCorrected = false;

    if (fallbackMap[cleanLower]) {
      finalQuery = fallbackMap[cleanLower];
      finalWasCorrected = true;
    }

    return {
      searchQuery: finalQuery,
      wasCorrected: finalWasCorrected,
      searchLocation: ubicacion,
      isLocationValid: true,
      isValidCategory: true,
      countryCode: "mx",
    };
  }
}

