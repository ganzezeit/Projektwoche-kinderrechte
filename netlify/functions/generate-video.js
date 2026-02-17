exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  const startTime = Date.now();
  const log = (msg) => console.log(`[${Date.now() - startTime}ms] ${msg}`);

  try {
    const { prompt, model } = JSON.parse(event.body);
    const selectedModel = model || 'schnell';
    log('Start - model: ' + selectedModel + ', prompt: ' + prompt?.slice(0, 50));

    if (!prompt || prompt.trim().length < 3) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt too short' }) };
    }

    if (!process.env.CLAUDE_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server config error', details: 'CLAUDE_API_KEY not configured' }) };
    }
    if (!process.env.REPLICATE_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server config error', details: 'REPLICATE_API_KEY not configured' }) };
    }

    // Step 1 + 2: Safety check AND prompt enhancement in PARALLEL
    log('Starting Claude calls (parallel)');
    const [safetyCheck, enhanceResponse] = await Promise.all([
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 100,
          messages: [{
            role: 'user',
            content: 'You are a content safety filter for a children\'s educational art app (ages 11-15) at a German primary school.\n\nIMPORTANT: Prompts will usually be in GERMAN. Common German words are NOT inappropriate:\n- "Kinder" = children, "Menschen" = people, "Bild" = picture/image\n- "Mädchen" = girl, "Junge" = boy, "Frau" = woman, "Mann" = man\n- "Stadt" = city, "Haus" = house, "Wald" = forest\n- These are normal, innocent words. Do NOT flag them.\n\nOnly flag content that is genuinely harmful: explicit violence/gore, weapons used to harm, drugs, sexual/pornographic content, horror/extreme fear, hate speech, or content promoting discrimination.\n\nALLOW: People (children, adults, families), animals, nature, cities, countries, cultures, flags, food, buildings, art, abstract designs, fantasy creatures, educational content, historical topics, landscapes, portraits.\n\nReply ONLY "SAFE" or "UNSAFE: reason".\n\nPrompt: "' + prompt + '"'
          }]
        })
      }),
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: 'You are an expert prompt engineer for AI VIDEO generation. Enhance this video prompt for maximum quality.\n\nThe prompt may be in German or other languages - translate and enhance to English.\n\nRULES:\n- AVOID cultural stereotypes. Show modern, diverse, realistic scenes.\n- Add specific motion descriptions: camera movements (pan, zoom, dolly), subject motion (walking, flying, flowing), environmental motion (wind, water, clouds).\n- Add cinematic details: lighting (golden hour, neon, ambient), atmosphere (foggy, clear, dreamy), composition.\n- Include quality boosters: "cinematic", "smooth motion", "high quality", "detailed".\n- Keep child-friendly at all times.\n- Focus on MOVEMENT and SCENE DYNAMICS since this is for video.\n\nOriginal prompt: "' + prompt + '"\n\nReply with ONLY the enhanced prompt in English, max 100 words. No explanations.'
          }]
        })
      })
    ]);

    log('Claude responses received');

    // Check safety
    if (!safetyCheck.ok) {
      const errText = await safetyCheck.text();
      log('Safety HTTP error: ' + safetyCheck.status);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Safety check failed', details: 'Claude ' + safetyCheck.status + ': ' + errText.slice(0, 200) }) };
    }
    const safetyResult = await safetyCheck.json();
    if (!safetyResult.content || !safetyResult.content[0]) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Safety check failed', details: 'Unexpected response' }) };
    }
    const safetyText = safetyResult.content[0].text;
    log('Safety: ' + safetyText);
    if (safetyText.startsWith('UNSAFE')) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'unsafe', message: safetyText }) };
    }

    // Enhanced prompt (fallback to original)
    let enhancedPrompt = prompt;
    if (enhanceResponse.ok) {
      const enhanceResult = await enhanceResponse.json();
      if (enhanceResult.content && enhanceResult.content[0]) {
        enhancedPrompt = enhanceResult.content[0].text;
      }
    }
    log('Enhanced: ' + enhancedPrompt.slice(0, 100));

    // Step 3: Start video generation
    const apiKey = process.env.REPLICATE_API_KEY;
    let replicateUrl, replicateBody;

    if (selectedModel === 'quality') {
      // Kling 2.5 Turbo Pro - higher quality
      replicateUrl = 'https://api.replicate.com/v1/models/kwaivgi/kling-v2.5-turbo-pro/predictions';
      replicateBody = {
        input: {
          prompt: enhancedPrompt,
          duration: 5,
          aspect_ratio: '16:9',
          negative_prompt: 'blur, distort, low quality, watermark, text',
          cfg_scale: 0.5
        }
      };
    } else {
      // Wan 2.1 T2V - fast and cheap
      replicateUrl = 'https://api.replicate.com/v1/models/wavespeedai/wan-2.1-t2v-480p/predictions';
      replicateBody = {
        input: {
          prompt: enhancedPrompt,
          guide_scale: 5,
          max_area: '832x480',
          num_frames: 81,
          shift: 3,
          steps: 4
        }
      };
    }

    log('Starting Replicate video prediction: ' + selectedModel);
    const response = await fetch(replicateUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(replicateBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      log('Replicate start error ' + response.status + ': ' + errText.slice(0, 300));
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Replicate API error', details: errText.slice(0, 200) }) };
    }

    const prediction = await response.json();
    log('Prediction started: ' + prediction.id + ' status: ' + prediction.status);

    // Check if completed immediately (unlikely for video)
    if (prediction.status === 'succeeded' && prediction.output) {
      const output = prediction.output;
      let videoUrl;
      if (typeof output === 'string') videoUrl = output;
      else if (Array.isArray(output)) videoUrl = output[0];
      else if (output.url) videoUrl = output.url;

      if (videoUrl) {
        log('Instant success: ' + videoUrl.slice(0, 80));
        return { statusCode: 200, headers, body: JSON.stringify({ videoUrl, enhancedPrompt, originalPrompt: prompt }) };
      }
    }

    // Return poll URL for client-side polling
    if (prediction.urls?.get) {
      log('Returning poll URL for async completion');
      return { statusCode: 200, headers, body: JSON.stringify({
        status: 'processing',
        pollUrl: prediction.urls.get,
        enhancedPrompt,
        originalPrompt: prompt,
      })};
    }

    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Unexpected response', details: JSON.stringify(prediction).slice(0, 200) }) };

  } catch (err) {
    console.log('CATCH:', err.message, err.stack);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Function error', details: err.message }) };
  }
};
