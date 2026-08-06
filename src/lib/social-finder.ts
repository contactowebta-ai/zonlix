/**
 * src/lib/social-finder.ts
 *
 * Módulo de búsqueda secundaria para localizar páginas de Facebook e Instagram
 * de un prospecto usando Firecrawl Search API y validación asistida por Gemini.
 */
import { callGeminiWithTimeout } from "@/lib/gemini";

const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1";
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

export interface SocialLinksResult {
  facebook_url: string | null;
  instagram_url: string | null;
}

/**
 * Busca las redes sociales (Facebook / Instagram) de una empresa en Google/Firecrawl.
 */
export async function findSocialMedia(
  businessName: string,
  city?: string | null
): Promise<SocialLinksResult> {
  const result: SocialLinksResult = {
    facebook_url: null,
    instagram_url: null,
  };

  if (!businessName || !businessName.trim()) {
    return result;
  }

  const cleanCity = (city || "").trim();
  const query = `"${businessName.trim()}" ${cleanCity ? `"${cleanCity}"` : ""} site:facebook.com OR site:instagram.com`;

  try {
    let searchItems: { title?: string; url: string; description?: string }[] = [];

    // 1. Petición a la API de Búsqueda de Firecrawl
    if (FIRECRAWL_API_KEY) {
      const response = await fetch(`${FIRECRAWL_BASE_URL}/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          limit: 5,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        if (json.success && Array.isArray(json.data)) {
          searchItems = json.data.map((item: any) => ({
            title: item.title,
            url: item.url || item.link,
            description: item.description || item.snippet,
          }));
        }
      }
    }

    // 2. Extraer candidatos de Facebook e Instagram
    let fbCandidate: string | null = null;
    let igCandidate: string | null = null;
    let snippetsText = "";

    for (const item of searchItems) {
      const url = item.url || "";
      if (!fbCandidate && (url.includes("facebook.com/") || url.includes("fb.com/"))) {
        fbCandidate = url;
        snippetsText += `- Facebook: ${url} (${item.title || ""} - ${item.description || ""})\n`;
      }
      if (!igCandidate && url.includes("instagram.com/")) {
        igCandidate = url;
        snippetsText += `- Instagram: ${url} (${item.title || ""} - ${item.description || ""})\n`;
      }
    }

    // Si no se halló ningún candidato
    if (!fbCandidate && !igCandidate) {
      return result;
    }

    // 3. Verificación con Gemini para confirmar que coincide con la empresa
    const validationPrompt = `Eres un auditor de datos comercial.
Evalúa si los siguientes enlaces de redes sociales encontrados corresponden a la empresa "${businessName}"${cleanCity ? ` en "${cleanCity}"` : ""}.

Resultados de búsqueda:
${snippetsText}

Instrucciones:
- Si la URL corresponde al negocio, inclúyela en el JSON.
- Si parece ser de otra empresa diferente o genérica, devuelve null.

Devuelve ÚNICAMENTE el siguiente JSON:
{
  "facebook_url": <string con la URL o null>,
  "instagram_url": <string con la URL o null>
}`;

    try {
      const rawText = await callGeminiWithTimeout(validationPrompt, 8_000);
      const cleanJson = rawText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const parsed = JSON.parse(cleanJson);
      return {
        facebook_url: typeof parsed.facebook_url === "string" ? parsed.facebook_url : fbCandidate,
        instagram_url: typeof parsed.instagram_url === "string" ? parsed.instagram_url : igCandidate,
      };
    } catch {
      // Fallback a los candidatos encontrados si Gemini no responde a tiempo
      return {
        facebook_url: fbCandidate,
        instagram_url: igCandidate,
      };
    }
  } catch (err) {
    console.warn(`[findSocialMedia] Error buscando redes sociales para ${businessName}:`, err);
    return result;
  }
}
