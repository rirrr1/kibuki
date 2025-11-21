// orchestrate-comic-generation.ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

import { createClient } from "npm:@supabase/supabase-js@2.49.8";

// Helper to extract panel count from beat text
function countPanels(beat: string): number {
  if (!beat) return 5;
  const ids = [...beat.matchAll(/^\s*([a-e])\)/gmi)].map(m => (m[1] || "").toLowerCase());
  const unique = Array.from(new Set(ids));
  return Math.min(5, Math.max(3, unique.length || 5));
}

// pacing & retry
const STEP_DELAY_MS = 300;
const MAX_422_RETRIES_PER_PAGE = 5;
const MAX_TRANSIENT_RETRIES_PER_PAGE = 5;
const MAX_QA_FIXES_PER_PAGE = 0; // Disabled: QA fixes only happen on manual user request
const BASE_BACKOFF_MS = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceRoleKey) throw new Error("Supabase configuration missing");

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { jobId, inputData } = await req.json();

    const p = stepOnce(jobId, inputData, supabase);
    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(p);

    return new Response(JSON.stringify({ success: true, message: "Step queued" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error in orchestrate-comic-generation:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

async function stepOnce(jobId, inputData, supabase) {
  await delay(STEP_DELAY_MS);

  const { data: job, error: loadErr } = await supabase
    .from("comic_generation_jobs")
    .select("id,status,progress,current_page,created_at,input_data,output_data")
    .eq("id", jobId)
    .single();

  if (loadErr) {
    console.error("Failed to load job", jobId, loadErr?.message);
    return;
  }
  if (!job || job.status === "completed" || job.status === "failed") return;

  await supabase.from("comic_generation_jobs").update({
    status: "processing",
    last_heartbeat_at: new Date().toISOString()
  }).eq("id", jobId);

  const targets = [
    "cover",
    "storyPage1","storyPage2","storyPage3","storyPage4","storyPage5",
    "storyPage6","storyPage7","storyPage8","storyPage9","storyPage10",
    "backCover"
  ];

  const generatedPages = job.output_data?.generatedPages || {};
  let nextIndex = 0;
  while (nextIndex < targets.length && generatedPages[targets[nextIndex]]) nextIndex++;
  if (nextIndex >= targets.length) {
    // All pages generated, set status to awaiting_approval instead of completing
    await supabase.from("comic_generation_jobs").update({
      status: "awaiting_approval",
      progress: 80,
      output_data: {
        ...job.output_data,
        generatedPages,
        panelCounts: job.output_data?.panelCounts || {}
      }
    }).eq("id", jobId);
    return;
  }

  const target = targets[nextIndex];
  const progress = 10 + (nextIndex * 70) / targets.length;

  await supabase.from("comic_generation_jobs").update({
    progress: Math.max(10, Math.round(progress)),
    current_page: nextIndex,
    last_heartbeat_at: new Date().toISOString()
  }).eq("id", jobId);

  const persistedInput = job.input_data || {};
  const photoPath = inputData?.photoStoragePath || persistedInput.photoStoragePath;
  const photoMimeType = inputData?.mimeType || persistedInput.mimeType;

  let characterRefStoragePath = job.output_data?.characterRefStoragePath || "";
  let allPreviousPages = job.output_data?.allPreviousPages || inputData?.allPreviousPages || [];

  // Beats upfront & locked (idempotent) — mit Foto/Ref + Styles für Cover/CharRef
  // Beats upfront & locked (idempotent) — KEIN Foto/charRef nötig
if (!job.output_data?.beatsLocked) {
  const lockReq: any = {
    initBeats: true,
    jobId,
    heroName: (inputData?.heroName || persistedInput.heroName),
    storyDescription: (inputData?.storyDescription || persistedInput.storyDescription),
    storyLanguage: (inputData?.storyLanguage || persistedInput.storyLanguage)
    // optional: falls du schon fertige Beats von der UI schicken willst:
    // storyBeatsJson: job.output_data?.storyBeatsJson || undefined
  };

  const lockRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-comic`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
    },
    body: JSON.stringify(lockReq)
  });

  if (!lockRes.ok) {
    const t = await lockRes.text().catch(() => "lock failed");
    await failJob(supabase, jobId, `Beat lock failed: ${t}`);
    return;
  }

  // Load beats and calculate panel counts (language-aware key)
  const lang = (inputData?.storyLanguage || persistedInput.storyLanguage || "en").trim().toLowerCase();
  const normalizedLang = (["de","de-de","de_at","de-ch","german","deutsch"].includes(lang)) ? "de" : "en";
  const jobKey = `${jobId}__${normalizedLang}`;
  const beatsPath = `generated/beats/${jobKey}/beats.json`;
  const { data: beatsData } = await supabase.storage.from("comics").download(beatsPath);
  let panelCounts: Record<string, number> = {};

  if (beatsData) {
    try {
      const beatsText = await beatsData.text();
      const beatsJson = JSON.parse(beatsText);
      const beats = beatsJson.pages || [];

      if (Array.isArray(beats) && beats.length === 10) {
        beats.forEach((beat, index) => {
          const pageKey = `storyPage${index + 1}`;
          panelCounts[pageKey] = countPanels(beat);
        });
        panelCounts['cover'] = 1;
      }
    } catch (e) {
      console.warn("Failed to parse beats for panel counts:", e);
    }
  }

  await supabase.from("comic_generation_jobs").update({
    output_data: { ...(job.output_data || {}), beatsLocked: true, panelCounts },
    last_heartbeat_at: new Date().toISOString()
  }).eq("id", jobId);
}


  // nur letzte Seite als Kontext
  const storyPageEntries = Object.entries(generatedPages)
    .filter(([k]) => k.startsWith("storyPage"))
    .sort(([a], [b]) => parseInt(a.replace("storyPage","")) - parseInt(b.replace("storyPage","")));
  if (storyPageEntries.length > 0) {
    const lastPagePath = storyPageEntries[storyPageEntries.length - 1][1];
    allPreviousPages = lastPagePath ? [lastPagePath] : [];
  } else {
    allPreviousPages = [];
  }

  const generateRequest: any = {
    // core story inputs
    prompt: inputData?.storyDescription || persistedInput.storyDescription,
    style: (inputData?.characterStyle || persistedInput.characterStyle) === "custom"
      ? inputData?.customStyle || persistedInput.customStyle
      : inputData?.characterStyle || persistedInput.characterStyle,
    heroName: inputData?.heroName || persistedInput.heroName,
    characterStyle: (inputData?.characterStyle || persistedInput.characterStyle) === "custom"
      ? inputData?.customStyle || persistedInput.customStyle
      : inputData?.characterStyle || persistedInput.characterStyle,
    storyDescription: inputData?.storyDescription || persistedInput.storyDescription,
    illustrationStyle: inputData?.illustrationStyle || persistedInput.illustrationStyle,
    comicTitle: inputData?.comicTitle || persistedInput.comicTitle,
    storyLanguage: inputData?.storyLanguage || persistedInput.storyLanguage,

    // target routing
    target: target === "cover" ? "cover" : target === "backCover" ? "backCover" : parseInt(target.replace("storyPage","")),

    // continuity (nur letztes Bild)
    allPreviousPages: allPreviousPages.length > 0 ? allPreviousPages : undefined,

    // wichtig für Beat-Laden
    jobId
  };

  // character ref / photo
  if (characterRefStoragePath?.trim() && characterRefStoragePath.startsWith("generated/characters/")) {
    generateRequest.characterRefStoragePath = characterRefStoragePath;
  } else if (photoPath && photoMimeType) {
    generateRequest.photoStoragePath = photoPath;
    generateRequest.mimeType = photoMimeType;
  } else {
    await failJob(supabase, jobId, "Missing characterRef and photoStoragePath/mimeType");
    return;
  }

  // retry counters
  const retryCounts = job.output_data?.retry_counts || {};
  const transientRetryCounts = job.output_data?.transient_retry_counts || {};
  const qaFixCounts = job.output_data?.qa_fix_counts || {};
  const tries422 = retryCounts[target] || 0;
  const triesTransient = transientRetryCounts[target] || 0;
  const qaFixes = qaFixCounts[target] || 0;

  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-comic`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
    },
    body: JSON.stringify(generateRequest)
  });

  if (!res.ok) {
    const status = res.status;
    const text = await res.text();

    if (status === 422 && tries422 < MAX_422_RETRIES_PER_PAGE) {
      const backoff = backoffMs(BASE_BACKOFF_MS, tries422);
      await supabase.from("comic_generation_jobs").update({
        output_data: {
          ...job.output_data,
          retry_counts: { ...(retryCounts||{}), [target]: tries422 + 1 }
        },
        last_heartbeat_at: new Date().toISOString()
      }).eq("id", jobId);
      await selfInvokeAfter(backoff, jobId, inputData);
    } else if ((status === 429 || (status >= 500 && status < 600)) && triesTransient < MAX_TRANSIENT_RETRIES_PER_PAGE) {
      const backoff = backoffMs(BASE_BACKOFF_MS, triesTransient);
      await supabase.from("comic_generation_jobs").update({
        output_data: {
          ...job.output_data,
          transient_retry_counts: { ...(transientRetryCounts||{}), [target]: triesTransient + 1 }
        },
        last_heartbeat_at: new Date().toISOString()
      }).eq("id", jobId);
      await selfInvokeAfter(backoff, jobId, inputData);
    } else {
      await failJob(supabase, jobId, `Failed to generate ${target}: ${text}`);
    }
    return;
  }

  const result = await res.json().catch(() => ({ success:false, error:"Bad JSON" }));

  if (!result.success) {
    const err = result.error || "Unknown error";
    if (String(err).includes("No candidates") && tries422 < MAX_422_RETRIES_PER_PAGE) {
      const backoff = backoffMs(BASE_BACKOFF_MS, tries422);
      await supabase.from("comic_generation_jobs").update({
        output_data: {
          ...job.output_data,
          retry_counts: { ...(retryCounts||{}), [target]: tries422 + 1 }
        },
        last_heartbeat_at: new Date().toISOString()
      }).eq("id", jobId);
      await selfInvokeAfter(backoff, jobId, inputData);
      return;
    }
    await failJob(supabase, jobId, `Failed to generate ${target}: ${err}`);
    return;
  }

  // QA → optional Fix (Minimal-Edit) mit editSourcePath
  if (result.qa && !result.qa.ok && result.qa.issues && result.qa.issues.length > 0 && qaFixes < MAX_QA_FIXES_PER_PAGE) {
    console.log(`QA failed for ${target}, attempting fix. Issues:`, result.qa.issues);

    const fixRequest: any = {
      ...generateRequest,
      qaFixIssues: result.qa.issues.slice(0, 4),
      editSourcePath: result.storagePath   // minimal patch mode
    };

    const fixRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-comic`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
      },
      body: JSON.stringify(fixRequest)
    });

    if (fixRes.ok) {
      const fixResult = await fixRes.json().catch(() => ({ success:false }));
      if (fixResult.success) {
        console.log(`QA fix successful for ${target}`);
        // Übernehme Fix-Ergebnis
        result.storagePath = fixResult.storagePath;
        result.characterRefStoragePath = fixResult.characterRefStoragePath || result.characterRefStoragePath;
        result.qa = fixResult.qa || result.qa;
      } else {
        console.log(`QA fix failed for ${target}, using original`);
      }
    } else {
      console.log(`QA fix request failed for ${target}, using original`);
    }

    // fix-count erhöhen
    await supabase.from("comic_generation_jobs").update({
      output_data: {
        ...job.output_data,
        qa_fix_counts: { ...(qaFixCounts||{}), [target]: qaFixes + 1 }
      },
      last_heartbeat_at: new Date().toISOString()
    }).eq("id", jobId);
  }

  // success → persist + counters säubern
  generatedPages[target] = result.storagePath;
  if (result.characterRefStoragePath) characterRefStoragePath = result.characterRefStoragePath;
  if (result.storagePath && String(target).startsWith("storyPage")) {
    allPreviousPages = [ result.storagePath ];
  }

  const retry_counts = { ...(job.output_data?.retry_counts || {}) };
  const transient_retry_counts = { ...(job.output_data?.transient_retry_counts || {}) };
  const qa_fix_counts = { ...(job.output_data?.qa_fix_counts || {}) };
  delete retry_counts[target];
  delete transient_retry_counts[target];
  delete qa_fix_counts[target];

  await supabase.from("comic_generation_jobs").update({
    output_data: {
      ...job.output_data,
      generatedPages,
      characterRefStoragePath,
      allPreviousPages,
      retry_counts,
      transient_retry_counts,
      qa_fix_counts,
      panelCounts: job.output_data?.panelCounts || {}
    },
    last_heartbeat_at: new Date().toISOString()
  }).eq("id", jobId);

  await selfInvokeAfter(STEP_DELAY_MS, jobId, inputData || job.input_data);
}

// explicit page order for chunked PDFs
const customerIndexMap = {
  frontCover: 0,
  storyPage1: 1, storyPage2: 2, storyPage3: 3, storyPage4: 4, storyPage5: 5,
  storyPage6: 6, storyPage7: 7, storyPage8: 8, storyPage9: 9, storyPage10: 10,
  backCover: 11
};
const interiorIndexMap = {
  storyPage1: 0, storyPage2: 1, storyPage3: 2, storyPage4: 3, storyPage5: 4,
  storyPage6: 5, storyPage7: 6, storyPage8: 7, storyPage9: 8, storyPage10: 9
};

async function finalizeJob(supabase, jobId, inputData, generatedPages) {
  await supabase.from("comic_generation_jobs").update({ progress: 80 }).eq("id", jobId);

  // CUSTOMER PDF (chunked)
  const ordered = [
    ["frontCover", generatedPages.cover],
    ["storyPage1", generatedPages.storyPage1],
    ["storyPage2", generatedPages.storyPage2],
    ["storyPage3", generatedPages.storyPage3],
    ["storyPage4", generatedPages.storyPage4],
    ["storyPage5", generatedPages.storyPage5],
    ["storyPage6", generatedPages.storyPage6],
    ["storyPage7", generatedPages.storyPage7],
    ["storyPage8", generatedPages.storyPage8],
    ["storyPage9", generatedPages.storyPage9],
    ["storyPage10", generatedPages.storyPage10],
    ["backCover", generatedPages.backCover]
  ];

  let lastPdfUrl = "";
  for (const [key, imagePath] of ordered) {
    if (!imagePath) return await failJob(supabase, jobId, `Missing ${key}`);
    const pageIndex = customerIndexMap[key];
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/create-customer-pdf-chunked`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ jobId, key, pageIndex, imagePath, heroName: inputData.heroName, comicTitle: inputData.comicTitle })
    });
    const j = await resp.json().catch(() => ({ success:false, error:"Bad JSON" }));
    if (!j.success) return await failJob(supabase, jobId, `Customer PDF chunk failed at ${key}: ${j.error}`);
    lastPdfUrl = j.pdfUrl;
    await delay(10);
  }

  // LULU INTERIOR (chunked)
  const storyKeys = [
    ["storyPage1", generatedPages.storyPage1],
    ["storyPage2", generatedPages.storyPage2],
    ["storyPage3", generatedPages.storyPage3],
    ["storyPage4", generatedPages.storyPage4],
    ["storyPage5", generatedPages.storyPage5],
    ["storyPage6", generatedPages.storyPage6],
    ["storyPage7", generatedPages.storyPage7],
    ["storyPage8", generatedPages.storyPage8],
    ["storyPage9", generatedPages.storyPage9],
    ["storyPage10", generatedPages.storyPage10]
  ];
  let lastInteriorUrl = "";
  for (const [key, imagePath] of storyKeys) {
    if (!imagePath) return await failJob(supabase, jobId, `Missing ${key} for interior`);
    const pageIndex = interiorIndexMap[key];
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/create-lulu-interior-pdf-chunked`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({ jobId, key, pageIndex, imagePath, heroName: inputData.heroName, comicTitle: inputData.comicTitle })
    });
    const j = await resp.json().catch(() => ({ success:false, error:"Bad JSON" }));
    if (!j.success) return await failJob(supabase, jobId, `Lulu interior chunk failed at ${key}: ${j.error}`);
    lastInteriorUrl = j.pdfUrl;
    await delay(10);
  }

  // LULU COVER
  const coverPdfResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/create-lulu-cover-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
    body: JSON.stringify({
      frontCoverPath: generatedPages.cover,
      backCoverPath: generatedPages.backCover,
      heroName: inputData.heroName,
      comicTitle: inputData.comicTitle
    })
  });
  const coverPdfResult = await coverPdfResponse.json().catch(() => ({ success:false, error:"Bad JSON" }));
  if (!coverPdfResult.success) return await failJob(supabase, jobId, `Cover PDF failed: ${coverPdfResult.error}`);

  await supabase.from("comic_generation_jobs").update({
    status: "completed",
    progress: 100,
    output_data: {
      comicUrl: lastPdfUrl,
      coverUrl: coverPdfResult.coverUrl,
      interiorUrl: lastInteriorUrl,
      generatedPages
    }
  }).eq("id", jobId);

  if (inputData?.customerEmail) {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-confirmation-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
      body: JSON.stringify({
        email: inputData.customerEmail,
        heroName: inputData.heroName,
        comicTitle: inputData.comicTitle,
        comicUrl: lastPdfUrl,
        emailType: "digital"
      })
    }).catch(() => {});
  }
}

async function failJob(supabase, jobId, message) {
  console.error("Failing job", jobId, message);

  // Get job details to refund credits
  const { data: job } = await supabase
    .from("comic_generation_jobs")
    .select("user_id, credits_used")
    .eq("id", jobId)
    .single();

  // Refund credits if this was a paid job
  if (job?.user_id && job?.credits_used && job.credits_used > 0) {
    console.log(`Refunding ${job.credits_used} credits to user ${job.user_id} for failed job ${jobId}`);

    const { error: refundError } = await supabase.rpc('add_credits', {
      p_user_id: job.user_id,
      p_amount: job.credits_used,
      p_transaction_type: 'refund',
      p_description: `Refund for failed comic generation (Job ${jobId})`,
      p_stripe_payment_intent_id: null
    });

    if (refundError) {
      console.error('Failed to refund credits:', refundError);
    } else {
      console.log(`Successfully refunded ${job.credits_used} credits`);
    }
  }

  await supabase.from("comic_generation_jobs").update({
    status: "failed",
    error_message: message
  }).eq("id", jobId);
}

async function selfInvokeAfter(ms, jobId, inputData) {
  await delay(ms);
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/orchestrate-comic-generation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
    body: JSON.stringify({ jobId, inputData })
  });
}

function backoffMs(base, attemptZeroBased) {
  const jitter = Math.floor(Math.random() * 250);
  return base * Math.pow(2, attemptZeroBased) + jitter;
}
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
