// Style-specific enhancement instructions for Claude
const STYLE_PROMPTS = {
  'Illustration': 'digital illustration style with clean lines, vibrant colors, detailed shading, professional book illustration quality',
  'Foto': 'photorealistic style, natural lighting, sharp focus, high resolution photograph, DSLR quality',
  'Cartoon': 'cartoon style with bold outlines, exaggerated features, bright saturated colors, playful and fun',
  'Aquarell': 'watercolor painting style with soft edges, flowing color transitions, visible brush strokes, delicate washes',
  'Pixel Art': 'pixel art style with crisp pixels, limited color palette, retro 16-bit aesthetic, clean pixel placement',
  '3D': '3D rendered style with smooth surfaces, realistic materials, volumetric lighting, Pixar-quality rendering',
  'Anime': 'anime/manga style with large expressive eyes, dynamic poses, vibrant colors, Japanese animation aesthetic',
  '\u00D6lgem\u00E4lde': 'oil painting style with rich textures, layered brushstrokes, classical composition, museum-quality fine art',
  'Comic': 'comic book style with bold ink lines, halftone dots, dynamic panels, superhero comic aesthetic',
  'Skizze': 'pencil sketch style with detailed linework, cross-hatching, artistic shading, hand-drawn quality',
};

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
    const { prompt, style, aspectRatio, model } = JSON.parse(event.body);
    const selectedModel = model || 'quality';
    log('Start - model: ' + selectedModel + ', style: ' + style + ', prompt: ' + prompt?.slice(0, 50));

    if (!prompt || prompt.trim().length < 3) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt too short' }) };
    }

    if (!process.env.CLAUDE_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server config error', details: 'CLAUDE_API_KEY not configured' }) };
    }
    if (!process.env.REPLICATE_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server config error', details: 'REPLICATE_API_KEY not configured' }) };
    }

    // Get style-specific enhancement instruction
    const styleInstruction = STYLE_PROMPTS[style] || STYLE_PROMPTS['Illustration'];

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
            content: 'You are a content safety filter for a children\'s educational art app (ages 11-15) at a German primary school.\n\nIMPORTANT: Prompts will usually be in GERMAN. Common German words are NOT inappropriate:\n- "Kinder" = children, "Menschen" = people, "Bild" = picture/image\n- "M\u00E4dchen" = girl, "Junge" = boy, "Frau" = woman, "Mann" = man\n- "Stadt" = city, "Haus" = house, "Wald" = forest\n- These are normal, innocent words. Do NOT flag them.\n\nOnly flag content that is genuinely harmful: explicit violence/gore, weapons used to harm, drugs, sexual/pornographic content, horror/extreme fear, hate speech, or content promoting discrimination.\n\nALLOW: People (children, adults, families), animals, nature, cities, countries, cultures, flags, food, buildings, art, abstract designs, fantasy creatures, educational content, historical topics, landscapes, portraits.\n\nReply ONLY "SAFE" or "UNSAFE: reason".\n\nPrompt: "' + prompt + '"'
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
            content: 'You are an expert prompt engineer for AI image generation. Enhance this image prompt for maximum quality.\n\nThe prompt may be in German or other languages - translate and enhance to English.\n\nTARGET STYLE: ' + styleInstruction + '\n\nRULES:\n- AVOID cultural stereotypes. Show modern, diverse, realistic scenes.\n- African/Asian countries: include modern cities, schools, technology. NOT only traditional clothes and villages.\n- European countries: show diverse populations. NOT only stereotypical appearances.\n- Add specific artistic details: lighting (golden hour, studio, ambient), composition (rule of thirds, centered, dynamic angle), textures, atmosphere.\n- Include quality boosters: "highly detailed", "professional", "masterpiece", "8k resolution".\n- For the specified style, include style-specific keywords that produce the best results.\n- Keep child-friendly at all times.\n\nOriginal prompt: "' + prompt + '"\n\nReply with ONLY the enhanced prompt in English, max 150 words. No explanations.'
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

    // Step 3: Start image generation (NO waiting - returns immediately)
    const apiKey = process.env.REPLICATE_API_KEY;
    let replicateUrl, replicateBody;

    if (selectedModel === 'schnell') {
      replicateUrl = 'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions';
      replicateBody = {
        input: {
          prompt: enhancedPrompt,
          num_outputs: 1,
          aspect_ratio: aspectRatio || '1:1',
          output_format: 'png',
          output_quality: 90,
          go_fast: true
        }
      };
    } else {
      // quality (flux-1.1-pro)
      replicateUrl = 'https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions';
      replicateBody = {
        input: {
          prompt: enhancedPrompt,
          aspect_ratio: aspectRatio || '1:1',
          output_format: 'png',
          output_quality: 90,
          safety_tolerance: 5
        }
      };
    }

    log('Starting Replicate prediction: ' + selectedModel);
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

    // Check if completed immediately (very fast models)
    if (prediction.status === 'succeeded' && prediction.output) {
      const output = prediction.output;
      let imageUrl;
      if (Array.isArray(output)) imageUrl = output[0];
      else if (typeof output === 'string') imageUrl = output;
      else if (output.url) imageUrl = output.url;
      else if (output.images && output.images[0]) imageUrl = output.images[0].url || output.images[0];

      if (imageUrl) {
        log('Instant success: ' + imageUrl.slice(0, 80));
        return { statusCode: 200, headers, body: JSON.stringify({ imageUrl, enhancedPrompt, originalPrompt: prompt }) };
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
