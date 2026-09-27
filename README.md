# AI Product Description Generator

A Cloudflare Worker that generates ecommerce product descriptions using Workers AI (Llama 3.2 3B).

## Features

- Three lengths: short, medium, long
- Four styles: professional, friendly, luxury, playful
- Five platform formats: generic, Amazon, Shopify, Etsy, social
- Runs on Cloudflare Workers AI — no API keys
- Built-in rate limiting (30 requests/min per IP)
- Text is not stored or logged
- Multi-language interface (EN + ZH)

## Setup

```bash
npm install
npx wrangler login
npx wrangler deploy
```

## Routes

Add to `tool-proxy`:
- `toolara.dev/ai-product-description-generator/*`
- `www.toolara.dev/ai-product-description-generator/*`

## License

MIT
