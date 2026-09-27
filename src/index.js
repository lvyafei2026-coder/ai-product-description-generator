export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.includes('/api/') && request.method === 'POST') {
      return handleApi(request, env, url);
    }

    return env.ASSETS.fetch(request);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

async function handleApi(request, env, url) {
  const path = url.pathname.replace(/\/$/, '');

  if (!path.endsWith('/api/generate-description')) {
    return json({ error: 'Not found' }, 404);
  }

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const { success } = await env.AI_RATE_LIMITER.limit({ key: 'product-desc:' + ip });

  if (!success) {
    return json({
      error: 'Too many requests. Please wait a minute and try again.',
      code: 'RATE_LIMITED'
    }, 429);
  }

  return handleGenerate(request, env);
}

const LENGTH_PROMPTS = {
  short: 'Write a short description of 40-60 words. One tight paragraph that hits the main selling point.',
  medium: 'Write a medium description of 100-140 words. One paragraph or two short ones. Cover the main benefit, key features, and a closing line.',
  long: 'Write a detailed description of 200-280 words. Include a hook, a features section (as a short list), and a closing call to action.'
};

const STYLE_PROMPTS = {
  professional: 'Use a professional, brand-safe tone. Clear, confident, and benefit-driven. No hype or exclamation marks.',
  friendly: 'Use a warm, friendly, conversational tone. Sound like a real person recommending a product to a friend.',
  luxury: 'Use a refined, premium tone. Emphasize craftsmanship, materials, and quiet luxury. Avoid superlatives.',
  playful: 'Use a playful, energetic tone. Light humor is welcome. Keep it tasteful and on-brand.'
};

const PLATFORM_PROMPTS = {
  generic: '',
  amazon: 'Format with a bolded benefit headline, then a short paragraph, then a bullet list of 3-5 key features. Optimize for Amazon search — front-load keywords naturally.',
  shopify: 'Format for a Shopify product page. Start with a benefit-driven opening line, follow with 2-3 short paragraphs. End with a short bullet list of specs or features.',
  etsy: 'Format for an Etsy listing. Emphasize handmade, craftsmanship, materials, and story. Etsy buyers care about the maker and the process.',
  social: 'Format as a short social caption: 1-2 sentences max, followed by 3-5 relevant hashtags. Optimize for Instagram or TikTok.'
};

async function handleGenerate(request, env) {
  try {
    const body = await request.json();
    const productName = (body.product_name || '').trim();
    const features = (body.features || '').trim();
    const audience = (body.audience || '').trim();
    const length = body.length || 'medium';
    const style = body.style || 'professional';
    const platform = body.platform || 'generic';

    if (!productName) {
      return json({ error: 'Product name is required.' }, 400);
    }

    if (!features || features.length < 20) {
      return json({ error: 'Please describe the product features (at least 20 characters).' }, 400);
    }

    const MAX_CHARS = 2000;
    const trimmedFeatures = features.length > MAX_CHARS ? features.slice(0, MAX_CHARS) : features;

    const systemPrompt = 'You are an expert ecommerce copywriter. You output ONLY the product description, with no preamble, no explanations, and no placeholder text.';

    let userPrompt = 'Product name: ' + productName + '\n';
    if (audience) userPrompt += 'Target audience: ' + audience + '\n';
    userPrompt += '\nKey features and details:\n' + trimmedFeatures + '\n\n';

    userPrompt += 'Instructions:\n';
    userPrompt += '- ' + (LENGTH_PROMPTS[length] || LENGTH_PROMPTS.medium) + '\n';
    userPrompt += '- ' + (STYLE_PROMPTS[style] || STYLE_PROMPTS.professional) + '\n';

    const platformPrompt = PLATFORM_PROMPTS[platform];
    if (platformPrompt) {
      userPrompt += '- Platform formatting: ' + platformPrompt + '\n';
    }

    userPrompt += '- Do NOT invent features, materials, or specifications not in the provided details.\n';
    userPrompt += '- Do NOT use generic filler like "high-quality" or "premium materials" unless they are specific to the product.\n';
    userPrompt += '\nWrite the product description now.';

    const response = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 800,
      temperature: 0.7
    });

    const output = (response.response || '').trim();

    if (!output) {
      return json({ error: 'Model returned empty output. Please try again.' }, 500);
    }

    return json({ output: output });
  } catch (err) {
    console.error('Generate error:', err);
    return json({ error: 'Processing failed. Please try again in a moment.' }, 500);
  }
}
