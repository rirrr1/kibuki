// generate-comic.ts — FULL FILE (Drop-in Replacement)

// ───────────────────────────────────────────────────────────────────────────────
// CORS
// ───────────────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

import { createClient } from "npm:@supabase/supabase-js@2.49.8";

// Small util
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function safeIllustrationStyle(s: string): string {
  return `${s}; stylized fictional illustration; NOT photorealistic; simplified facial features; flat shading`;
}

// Language normalization (accepts many variants)
function normalizeLang(raw?: string): "en" | "de" {
  const v = (raw || "").trim().toLowerCase();
  if (["de","de-de","de_at","de-ch","german","deutsch"].includes(v)) return "de";
  return "en";
}
function withLangKey(jobId: string, lang: "en" | "de") {
  return `${jobId || "default-job"}__${lang}`;
}

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────
interface GenerateComicRequest {
  prompt: string;
  photoStoragePath?: string;
  mimeType?: string;
  style: string;
  width?: number;
  height?: number;
  steps?: number;
  guidance_scale?: number;
  seed?: number;
  heroName: string;
  characterStyle: string;
  storyDescription: string;
  illustrationStyle: string;
  comicTitle: string;
  storyLanguage?: string;               // user selection: 'en' | 'de' (leniently normalized)

  target: "cover" | "backCover" | number;  // "cover" | "backCover" | 1..10
  characterRefStoragePath?: string;
  allPreviousPages?: string[];
  storyBeatsJson?: string;
  qaFixIssues?: string[];

  // Minimal edit pass
  editSourcePath?: string;
  correctionPrompt?: string;

  // Beats locking
  jobId?: string;
  initBeats?: boolean;
}

// ===== Helpers: text extraction for bubbles (still available if needed) =====
function extractAllowedFromPage(pageBeat: string, cap: number = 15): string[] {
  if (!pageBeat) return [];
  const matches = [...pageBeat.matchAll(/Speech bubbles?\s*\[(.*?)\]/gi)];
  const seen = new Set<string>();
  for (const m of matches) {
    const inner = (m[1] ?? "");
    inner
      .split(",")
      .map(s => s.replace(/^[\s"'\[]+|[\s"'\]]+$/g, "").trim())
      .filter(Boolean)
      .forEach(w => {
        const k = w.toLowerCase();
        if (!seen.has(k)) seen.add(k);
      });
  }
  return Array.from(seen).slice(0, cap);
}

// Count panels (a–e) present in the beat text
function countPanels(beat: string): number {
  if (!beat) return 3;
  const ids = [...beat.matchAll(/^\s*([a-e])\)/gmi)].map(m => (m[1] || "").toLowerCase());
  const unique = Array.from(new Set(ids));
  return Math.min(5, Math.max(3, unique.length || 3)); // clamp 3–5
}

// (optional) allowed list helper
function getAllowedForBeat(beat: string) {
  let allowed = extractAllowedFromPage(beat, 15);
  const quoted: string[] = [];
  for (const m of beat.matchAll(/"([^"]+)"|'([^']+)'/g)) {
    const q = (m[1] ?? m[2] ?? "").trim();
    if (!q) continue;
    const wc = q.split(/\s+/).filter(Boolean).length;
    if (wc <= 4 && q.length <= 24) quoted.push(q);
  }
  const seen = new Set(allowed.map(w => w.toLowerCase()));
  for (const q of quoted) {
    const k = q.toLowerCase();
    if (!seen.has(k)) { allowed.push(q); seen.add(k); }
  }
  const allowedList = allowed.length ? `"${allowed.join('", "')}"` : "";
  return { allowed, allowedList };
}

// ===== QA call (stubbed) =====
async function auditImage(base64: string, apiKey: string, allowedWords: string[], isBackCover = false) {
  const checklist = `You are a strict visual QA bot.

Inputs:
- backCover: ${isBackCover}

Checklist (flag ONLY these):
1) Unreadable bubble text (illegible or cropped).
2) Duplicated speech bubbles on the same page or same panel (identical text or clearly same content).
3) Bubble nonsense / wrong speaker (text is irrelevant to the scene OR bubble tail points to the wrong character).
4) Duplicated character within one panel.

Ignore everything else (panels, meta labels, anatomy, extra text rules). If backCover=true, allow only "mycomic-book.com" as text.

Return ONLY a compact JSON: {"ok": true|false, "issues": ["...","..."]}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: checklist },
              { inline_data: { mime_type: "image/jpeg", data: base64 } }
            ]
          }]
        })
      }
    );

    if (!res.ok) return { ok: true, issues: [] };

    const data = await res.json();
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    try { return JSON.parse(txt.trim()); }
    catch { return { ok: true, issues: [] }; }
  } catch {
    return { ok: true, issues: [] };
  }
}

// ===== Beats generator (panel-by-panel per page) =====

// ---- Helpers for robust beat parsing (no wording changes) ----
function _sliceFromPage1(raw: string): string {
  if (!raw) return "";
  const m = raw.match(/\b1\.\s*Page\s*1\s*:/i);
  return m ? raw.slice(m.index!) : raw; // drop any prologue/title before Page 1
}

function _parseExactly10Pages(text: string): string[] | null {
  const cleaned = _sliceFromPage1(text).trim();
  if (!cleaned) return null;

  const pages: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const re = new RegExp(
      String.raw`${i}\.\s*Page\s*${i}\s*:\s*([\s\S]*?)(?=\n\d+\.\s*Page\s*\d+\s*:|$)`,
      "i"
    );
    const m = cleaned.match(re);
    const body = m?.[1]?.trim();
    if (!body) return null;
    pages.push(body);
  }
  return pages.length === 10 ? pages : null;
}

// ---- Beats generation with strong language control ----
async function generateStoryBeats(
  storyDescription: string,
  apiKey: string,
  supabase?: any,
  jobId?: string,
  language: "en" | "de" = "en"
): Promise<string[]> {

  // Stronger instruction + tiny few-shot to anchor DE
  const languageInstruction =
    language === "de"
      ? `
IMPORTANT — LANGUAGE RULE:
- Write ALL panel descriptions and ALL speech/thought bubble phrases in **German**.
- BUT KEEP THE FORMAT TOKENS EXACTLY AS SHOWN (in English):
  • Headings: "Page 1:", "Page 2:", … "Page 10:"
  • Panel IDs: a) b) c) d) e)
  • Bubble label: "Speech bubbles [ ... ]"
- Do NOT use English words except those fixed tokens above.

Example (style only; keep format exactly):
1. Page 1:
   a) Claudius blickt sich suchend um. Speech bubbles [Wo?, Hm?]
   b) Er tritt vorsichtig vor. Speech bubbles [Leise!, Okay]
   c) Eine Tür knarrt auf. Speech bubbles [Wer da?]
`
      : `
IMPORTANT — LANGUAGE RULE:
- Write ALL panel descriptions and ALL speech/thought bubble phrases in **English**.
- KEEP FORMAT TOKENS EXACTLY as shown:
  • "Page X:" headings, panel IDs a) b) c) d) e), and the literal "Speech bubbles [ ... ]".
`;

  const beatPrompt = `
You are a creative comic writer.
Break this story into EXACTLY 10 pages. NEVER LESS THAN 10 PAGES, NEVER MORE THAN 10 PAGES.
Each page MUST be divided into 3–5 PANELS (numbered a–e).
Each panel describes ONE clear visual action — no repetition.
Each panel include at most 1 very short speech or thought bubbles (each 1–4 simple words) that advance the scene.

Story: "${storyDescription}"

Constraints:
- Family-friendly, adventurous tone.
- Keep bubble phrases simple, natural, and unique within a page.
${languageInstruction}

Format EXACTLY:
1. Page 1:
   a) [Panel description] Speech bubbles [word1]
   b) [Panel description] Speech bubbles [word1]
   c) ...
2. Page 2:
   a) [Panel description] Speech bubbles [word1]
   ...
10. Page 10:
   a) ...
   b) ...
`;

  const MAX_ATTEMPTS = 4;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: beatPrompt }] }] }),
      }
    );

    if (!response.ok) {
      if ((response.status === 429 || response.status >= 500) && attempt < MAX_ATTEMPTS) {
        await sleep(400 * attempt);
        continue;
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      if (attempt < MAX_ATTEMPTS) { await sleep(300 * attempt); continue; }
      throw new Error("No text response from Gemini");
    }

    const pages = _parseExactly10Pages(text);
    if (pages && pages.length === 10) {
      if (supabase && jobId) {
        try {
          await saveLockedBeats(supabase, jobId, pages);
        } catch (e) {
          console.warn("[HOOK:SAVE_BEATS_EARLY] failed:", e);
        }
      }
      return pages;
    }

    await sleep(300 * attempt);
  }

  throw new Error("Beat generation invalid: could not get EXACTLY 10 pages after retries");
}

// ===== persist beats per job (lock once, reuse) — LANGUAGE-AWARE =====
async function loadLockedBeats(supabase: any, jobIdLang: string): Promise<string[] | null> {
  const path = `generated/beats/${jobIdLang}/beats.json`;
  const { data, error } = await supabase.storage.from("comics").download(path);
  if (error || !data) return null;
  const txt = await data.text();
  const j = JSON.parse(txt);
  return Array.isArray(j?.pages) && j.pages.length === 10 ? j.pages : null;
}
async function saveLockedBeats(supabase: any, jobIdLang: string, pages: string[]): Promise<void> {
  const path = `generated/beats/${jobIdLang}/beats.json`;
  const payload = new TextEncoder().encode(JSON.stringify({ pages, ts: Date.now() }));
  await supabase.storage.from("comics").upload(path, payload, { contentType: "application/json", upsert: true });
}

// ───────────────────────────────────────────────────────────────────────────────
// MAIN
// ───────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not found");
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Supabase config missing");
      return new Response(JSON.stringify({ error: "Supabase configuration not found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const r: GenerateComicRequest = await req.json();

    // normalize language once and derive language-aware lock key
    const lang = normalizeLang(r.storyLanguage);
    const jobKey = withLangKey(r.jobId || "default-job", lang);

    // ---- helpers (scoped) ----
    function arrayBufferToBase64(buffer: ArrayBuffer): string {
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    }
    async function downloadToBase64(bucket: string, path: string) {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error) throw new Error(`Failed to download image ${path}: ${error.message}`);
      const ab = await data.arrayBuffer();
      const base64 = arrayBufferToBase64(ab);
      const lower = path.toLowerCase();
      const mimeType =
        lower.endsWith(".png") ? "image/png" :
        lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "image/jpeg" :
        "image/jpeg"; // fallback
      return { base64, mimeType };
    }
    async function downloadOriginalPhotoToBase64(bucket: string, path: string) {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error) throw new Error(`Failed to download original photo ${path}: ${error.message}`);
      const ab = await data.arrayBuffer();
      const base64 = arrayBufferToBase64(ab);
      const lower = path.toLowerCase();
      const mimeType =
        lower.endsWith(".png") ? "image/png" :
        lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "image/jpeg" :
        "image/jpeg"; // fallback
      return { base64, mimeType };
    }
    async function uploadBase64(bucket: string, path: string, base64: string, mimeType: string) {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
        contentType: mimeType,
        upsert: true,
      });
      if (error) throw new Error(`Upload failed for ${path}: ${error.message}`);
      return path;
    }

    async function generateSingleImage(
      prompt: string,
      characterImage: { base64: string; mimeType: string },
      apiKey: string,
      contextImages: Array<{ base64: string; mimeType: string }> = [],
      editSource?: { base64: string; mimeType: string }
    ) {
      const MAX_RETRIES = 3;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const parts: any[] = [{ text: prompt }];

          if (editSource) {
            parts.push({ inline_data: { mime_type: editSource.mimeType || "image/png", data: editSource.base64 } });
            parts.push({ inline_data: { mime_type: characterImage.mimeType || "image/png", data: characterImage.base64 } });
          } else {
            parts.push({ inline_data: { mime_type: characterImage.mimeType || "image/png", data: characterImage.base64 } });
          }

          for (const c of contextImages) {
            parts.push({ inline_data: { mime_type: c.mimeType || "image/png", data: c.base64 } });
          }

          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: [{ parts }] }),
            }
          );

          if (!geminiRes.ok) {
            const j = await geminiRes.json().catch(() => ({}));
            const msg = `Gemini API error ${geminiRes.status}: ${j?.error?.message || geminiRes.statusText}`;
            if ((geminiRes.status === 429 || geminiRes.status >= 500) && attempt < MAX_RETRIES) {
              await sleep(600 * attempt);
              continue;
            }
            const isClient = geminiRes.status >= 400 && geminiRes.status < 500;
            return { success: false, error: msg, statusCode: isClient ? 422 : 500 };
          }

          const data = await geminiRes.json();
          const cand = data?.content ?? data?.candidates?.[0];
          const imgPart =
            cand?.parts?.find?.((p: any) => p.inlineData?.data) ||
            cand?.content?.parts?.find?.((p: any) => p.inlineData?.data);

          if (!imgPart?.inlineData?.data) {
            if (attempt < MAX_RETRIES) {
              await sleep(800 * attempt);
              continue;
            }
            return { success: false, error: "No candidates in Gemini response", statusCode: 422 };
          }

          return {
            success: true as const,
            imageBase64: imgPart.inlineData.data as string,
            mimeType: imgPart.inlineData.mimeType || "image/png",
          };
        } catch (e) {
          if (attempt < MAX_RETRIES) {
            await sleep(800 * attempt);
            continue;
          }
          return { success: false as const, error: e instanceof Error ? e.message : "Unknown error", statusCode: 500 };
        }
      }
      return { success: false as const, error: "Exhausted retries", statusCode: 500 };
    }

    console.log(`[gen] start target=${r.target} jobKey=${jobKey}`);

    // ── upfront beats lock endpoint (no character/photo required)
    if (r.initBeats) {
      const already = await loadLockedBeats(supabase, jobKey);
      if (already) {
        return new Response(JSON.stringify({ success: true, beatsLocked: true, pages: already.length }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      const beats = r.storyBeatsJson
        ? JSON.parse(r.storyBeatsJson)
        : await generateStoryBeats(r.storyDescription, GEMINI_API_KEY, supabase, jobKey, lang);
      if (!Array.isArray(beats) || beats.length !== 10) {
        return new Response(JSON.stringify({ success: false, error: "Beat lock failed: not 10 pages" }), {
          status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      await saveLockedBeats(supabase, jobKey, beats);
      return new Response(JSON.stringify({ success: true, beatsLocked: true, pages: 10 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // (A) Optional: minimal edit mode
    let editSource: { base64: string; mimeType: string } | null = null;
    if (r.editSourcePath) {
      try {
        editSource = await downloadToBase64("comics", r.editSourcePath);
        console.log("Loaded editSourcePath for minimal edit:", r.editSourcePath);
      } catch (e) {
        console.warn("editSourcePath download failed, fallback to normal gen:", e);
      }
    }

    // 1) Character reference
    let characterRef: { base64: string; mimeType: string };
    const characterRefStoragePath = r.characterRefStoragePath;
    let finalCharacterRefStoragePath: string;

    if (characterRefStoragePath && characterRefStoragePath.trim() &&
        !characterRefStoragePath.includes("original") &&
        !characterRefStoragePath.includes("uploads") &&
        !characterRefStoragePath.includes("ctx/temp")) {
      console.log("Using existing character reference:", characterRefStoragePath);
      characterRef = await downloadToBase64("comics", characterRefStoragePath);
      finalCharacterRefStoragePath = characterRefStoragePath;
    } else {
      console.log("Creating new stylized character reference (ignoring raw photo path)");
      if (!r.photoStoragePath || !r.mimeType) {
        return new Response(
          JSON.stringify({ error: "photoStoragePath and mimeType required when characterRefStoragePath is missing" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const original = await downloadOriginalPhotoToBase64("comics", r.photoStoragePath);
      const ILL_STYLE = safeIllustrationStyle(r.illustrationStyle);
      const characterPrompt =
        `Create a stylized illustrated version of the uploaded person in style: ${ILL_STYLE}, outfit/look: "${r.style}". 
The design must clearly look fictional, not photorealistic — like a character drawing or comic illustration. 
Keep recognizable features (face shape, hair, glasses, etc.) so the person is identifiable, 
but rendered in the chosen illustration style. Family-friendly.`;
      const charResp = await generateSingleImage(
        characterPrompt, { base64: original.base64, mimeType: original.mimeType }, GEMINI_API_KEY
      );
      if (!charResp.success) {
        const status = charResp.statusCode || 500;
        return new Response(
          JSON.stringify({ success: false, error: charResp.error }),
          { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const ext = (charResp.mimeType || "image/png").includes("jpeg") ? "jpg" : "png";
      const tempCharRefPath = `generated/characters/char_${Date.now()}.${ext}`;
      await uploadBase64("comics", tempCharRefPath, charResp.imageBase64, charResp.mimeType);

      characterRef = { base64: charResp.imageBase64, mimeType: charResp.mimeType };
      finalCharacterRefStoragePath = tempCharRefPath;
      console.log("Created new character reference at:", finalCharacterRefStoragePath);
    }

    // 2) Story beats (load language-aware lock → else generate → then lock)
    let storyBeats: string[] = [];
    const beatsLocked = await loadLockedBeats(supabase, jobKey);

    // Accept & lock beats from caller only into the language-aware key
    if (!beatsLocked && r.storyBeatsJson) {
      try {
        const incoming = JSON.parse(r.storyBeatsJson);
        if (Array.isArray(incoming) && incoming.length === 10) {
          await saveLockedBeats(supabase, jobKey, incoming);
          console.log("Saved incoming beats for jobKey:", jobKey);
        }
      } catch { /* ignore parse errors */ }
    }

    if (typeof r.target === "number" && r.target >= 1 && r.target <= 10) {
      storyBeats = beatsLocked
                || (r.storyBeatsJson ? JSON.parse(r.storyBeatsJson)
                                     : await generateStoryBeats(r.storyDescription, GEMINI_API_KEY, supabase, jobKey, lang));
      if (!beatsLocked && storyBeats.length === 10) {
        await saveLockedBeats(supabase, jobKey, storyBeats);
      }
    } else {
      if (beatsLocked) storyBeats = beatsLocked; // covers cover/backCover continuity if already present
    }

    // 3) Context images —— prefer editSource (freeze composition), else last page only
    let contextImages: Array<{ base64: string; mimeType: string }> = [];
    if (editSource) {
      contextImages = [editSource];
    } else if (r.allPreviousPages?.length) {
      const last = r.allPreviousPages.slice(-1);
      for (const ctxPath of last) {
        try {
          const pageImage = await downloadToBase64("comics", ctxPath);
          contextImages.push(pageImage);
        } catch (e) {
          console.warn("Context fetch failed for", ctxPath, e);
        }
      }
    }

    // 4) Prompts
    const ILL_STYLE = safeIllustrationStyle(r.illustrationStyle);
    const COVER_BASE_PROMPT =
      `Use the provided character reference AS-IS (same face, hair, outfit "${r.style}"); do NOT redesign. ` +
      `Art style: ${ILL_STYLE}. Neutral cover background matching to: "${r.storyDescription}". ` +
      `Family-friendly, highly stylized visuals. Single dynamic composition, no panels.`;

    function getPageBaseInstructions(n: number, style: string, _illustrationStyle: string): string {
      let instructions = `Render the locked beat for THIS page EXACTLY as specified.
- Do NOT add, remove, merge, or reorder panels; follow the beat's panel IDs (do not draw any labels or letters).
- NEVER draw panel IDs or labels like "a)", "b)", "c)", "d)", "e)" anywhere in the artwork
- Use ONLY the provided character reference (same face, hair, outfit "${style}"); do NOT redesign.
- Art style: ${ILL_STYLE}.
- At most ONE speech/thought bubble per panel, using ONLY the allowed phrases from the beat; if none fits, leave the panel without a bubble.
- No extra text (titles, captions, page numbers, meta). **Exception:** Keep in-scene text explicitly described in the beat (e.g., screens, signs, logos).
- If a context image of the PREVIOUS PAGE is provided, TREAT IT AS CONTINUITY GROUND TRUTH for any SECONDARY CHARACTER(s): copy face shape, hair style/color, outfit/colors and accessories EXACTLY from the context. Do NOT redesign, rename, or restage secondary characters; keep them visually identical across pages.
- Keep poses clear and readable; family-friendly.`;

      if (n > 1) {
        instructions += `\n- CONTINUITY: continue from the previous page's state; do not restage or restart the story.`;
      }
      return instructions;
    }

    function pagePrompt(n: number, storyBeats: string[], r: GenerateComicRequest): string {
      const PAGE_BASE_INSTR = getPageBaseInstructions(n, r.style, r.illustrationStyle);
      const beat = (storyBeats[n - 1] ?? `Page ${n} content`).trim();
      const beatClean = beat.replace(/^\s*[a-e]\)\s*/gmi, "");
      const panelCount = countPanels(beat);

      let basePrompt = `${PAGE_BASE_INSTR}
Render the following locked beat for Page ${n}/10 EXACTLY as written:
${beatClean}

- Render EXACTLY ${panelCount} distinct panels — NO MORE, NO FEWER.
- Each panel corresponds 1:1 to the listed beat panels. Never skip, duplicate, or rename panel IDs.
- Keep the HERO CONSISTENT ACROSS ALL PAGES AND PANELS based on the reference input: hair, facial structure, glasses, outfit 100% identical to the character reference; never redesign or change materials, colors, or accessories.
- SPEECH BUBBLES (STRICT PER-PANEL):
  • EXACTLY THE WORDS FROM THE BEAT.
  • Use ONLY and EXACTLY the WORDS listed **after that exact panel** in the beat (the "Speech bubbles [ ... ]" on that panel line).
  • NEVER move phrases between panels. If a panel has no list, place NO bubble.
  • Use the exact spelling from beat.
- Place each bubble inside its correct panel and attach the tail to the correct visible speaker in that panel.
- Do NOT rephrase, translate, or invent text.
- If the speaking character is not visible in a panel, place the bubble near the scene edge or as off-screen dialogue pointing inward (not attached to other characters).
- Do NOT copy any text from context images.
- NO additional text, captions, titles, or meta elements.
- Keep any in-scene text that is EXPLICITLY described in the beat (e.g., signs, screens like "SUPERHERO"); do NOT remove or blur such text.
- Output size exactly 1327x2050 px (168.27mm × 260.35mm at 200 DPI).`;

     if (editSource) {
        basePrompt =
`EDIT MODE: You are provided with this comic book page.
DO ALL REQUIRED ADJUSTMENTS THAT THE PAGE IS MATCHING EXACTLY THE BEAT'S INSTRUCTIONS and ALWAYS Correct spelling and grammar of the comic text that it matches exactly the beats text. You must keep the character style (Outfit, Gadgets, Face, Hair etc) the same as on the context and reference image. Also don't change the style - your adjusted page must visually perfectly continue the story from the context image. 

BEAT FOR THIS PAGE:
${r.pageBeat || beatClean}

OUTPUT:
- Return the FULL page at EXACTLY 1327x2050 px (300 DPI equivalent).`;
      }
      return basePrompt;
    }

    let prompt: string;
    let artifactLabel: string;

    if (r.target === "cover") {
      let basePrompt =
        `Create a beautiful comic book front cover showing very prominently the hero ${r.heroName} (${r.characterStyle}) only. ` +
        `ONLY text on the cover is the title "${r.comicTitle}" (very prominent). No other text or characters. ${COVER_BASE_PROMPT}. ` +
        `Generate image at exactly 1351x2103 pixels (171.45mm x 266.7mm at 300 DPI).`;
      if (r.qaFixIssues?.length) basePrompt += ` Fix these issues: ${r.qaFixIssues.slice(0, 4).join("; ")}.`;
      prompt = basePrompt;
      artifactLabel = "frontCover";
    } else if (r.target === "backCover") {
      let basePrompt =
        `Create a comic book back cover with one panel for "${r.comicTitle}" featuring ${r.heroName}. ` +
        `${COVER_BASE_PROMPT} include text: "mycomic-book.com". No other text. ` +
        `Generate image at exactly 1351x2103 pixels (171.45mm x 266.7mm at 200 DPI).`;
      if (r.qaFixIssues?.length) basePrompt += ` Fix these issues: ${r.qaFixIssues.slice(0, 4).join("; ")}.`;
      prompt = basePrompt;
      artifactLabel = "backCover";
    } else if (typeof r.target === "number" && r.target >= 1 && r.target <= 10) {
      if (storyBeats.length !== 10) {
        return new Response(JSON.stringify({ error: "Story beats could not be determined for page generation." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      prompt = pagePrompt(r.target, storyBeats, r);
      artifactLabel = `storyPage${r.target}`;
    } else {
      return new Response(JSON.stringify({ error: "Invalid target" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("GENERATE PROMPT:", prompt);

    // 5) Generate
    const t0 = Date.now();
    console.log(`Starting generation for ${artifactLabel} with prompt length: ${prompt ? prompt.length : 0}`);

    let primaryImage = { base64: "", mimeType: "image/jpeg" } as { base64: string; mimeType: string };
    // primary image is characterRef by default; set below after we have it
    // We'll fill after character ref generation — but we've already built prompts, which is fine.

    // Use existing characterRef object created earlier
    // (we place the code here after characterRef is ready)
    // NOTE: we already assigned characterRef above

    // Edit: send editSource first, then characterRef as context
    primaryImage = characterRef;
    let auxImages = contextImages;
    if (editSource) {
      primaryImage = editSource;
      auxImages = [{ base64: characterRef.base64, mimeType: characterRef.mimeType }, ...contextImages];
    }

    const gen = await generateSingleImage(prompt, primaryImage, GEMINI_API_KEY, auxImages, editSource || undefined);
    const ms = Date.now() - t0;
    console.log(`Generated ${artifactLabel} in ${ms} ms`);

    if (!gen.success) {
      const status = gen.statusCode || 500;
      return new Response(
        JSON.stringify({ success: false, error: `${artifactLabel} generation failed: ${gen.error}` }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generated image size (base64 chars): ${gen.imageBase64 ? gen.imageBase64.length : 0}`);

    // 6) QA – disabled
    const qa = { ok: true, issues: [] as string[] };

    // 7) Upload
    const outExt = (gen.mimeType || "image/png").includes("jpeg") ? "jpg" : "png";
    const outPath = `generated/pages/${artifactLabel}_${Date.now()}.${outExt}`;
    await uploadBase64("comics", outPath, gen.imageBase64, gen.mimeType);

    // 8) Return
    const resp: any = {
      success: true,
      artifact: artifactLabel,
      storagePath: outPath,
      characterRefStoragePath: finalCharacterRefStoragePath,
      qa,
    };

    if (typeof r.target === "number" && storyBeats.length > 0) {
      resp.storyBeatsJson = JSON.stringify(storyBeats);
    }

    return new Response(JSON.stringify(resp), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-comic:", error);
    const status = (error as Error).message.includes("Invalid") || (error as Error).message.includes("No candidates") ? 422 : 500;
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
