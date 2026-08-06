/**
 * src/lib/firecrawl.ts
 *
 * Cliente de Firecrawl para convertir sitios web a Markdown limpio.
 * Usa fetch nativo contra la API v1 de Firecrawl.
 *
 * - scrapeToMarkdown: intenta scrapear una URL y devuelve el markdown.
 *   Si falla (sitio caído, certificado inválido, timeout) devuelve null
 *   en vez de lanzar excepción — null es en sí mismo un "punto de dolor"
 *   que se pasa a Gemini.
 */

const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1";
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY!;

// Máximo de caracteres del markdown antes de truncar para controlar tokens de Gemini
const MAX_MARKDOWN_CHARS = 8_000;

interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    metadata?: {
      title?: string;
      statusCode?: number;
    };
  };
  error?: string;
}

/**
 * Convierte una URL a Markdown limpio usando Firecrawl.
 *
 * @returns El markdown truncado a MAX_MARKDOWN_CHARS, o null si el scraping falla.
 */
export async function scrapeToMarkdown(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        // Excluir elementos que añaden ruido
        excludeTags: ["nav", "footer", "header", "script", "style"],
      }),
    });

    if (!response.ok) {
      // HTTP 4xx/5xx → sitio inaccesible o bloqueado → null (punto de dolor)
      console.warn(
        `[Firecrawl] HTTP ${response.status} para ${url} — marcando como sitio inaccesible`
      );
      return null;
    }

    const json = (await response.json()) as FirecrawlScrapeResponse;

    if (!json.success || !json.data?.markdown) {
      console.warn(
        `[Firecrawl] Sin markdown para ${url}:`,
        json.error ?? "respuesta vacía"
      );
      return null;
    }

    const markdown = json.data.markdown.trim();

    // Truncar para controlar costo de tokens en Gemini
    if (markdown.length > MAX_MARKDOWN_CHARS) {
      return markdown.slice(0, MAX_MARKDOWN_CHARS) + "\n\n[Contenido truncado]";
    }

    return markdown || null;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        console.warn(`[Firecrawl] Timeout (15s) para ${url}`);
      } else {
        console.warn(`[Firecrawl] Error para ${url}:`, error.message);
      }
    }
    // Cualquier error de red o timeout → null (punto de dolor)
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
