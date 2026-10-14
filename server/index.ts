import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Determine available cloud OCR provider from environment variables
function getActiveCloudProvider(): { id: string; name: string } | null {
  // 1. Google Gemini Flash (100% FREE at https://aistudio.google.com/app/apikey)
  if (process.env.GEMINI_API_KEY) {
    return { id: 'gemini_vision', name: 'Google Gemini Flash (Free Tier)' };
  }
  // 2. OpenRouter (Free tier at https://openrouter.ai/keys)
  if (process.env.OPENROUTER_API_KEY) {
    return { id: 'openrouter_vision', name: 'OpenRouter Free Vision' };
  }
  // 3. Groq Vision (100% FREE at https://console.groq.com/keys)
  if (process.env.GROQ_API_KEY) {
    return { id: 'groq_vision', name: 'Groq Llama 3.2 Vision (Free Tier)' };
  }
  // 4. Google Cloud Vision OCR (Free tier: 1000/mo)
  if (process.env.GOOGLE_VISION_API_KEY) {
    return { id: 'google_vision', name: 'Google Cloud Vision OCR' };
  }
  // 5. OpenAI Vision
  if (process.env.OPENAI_API_KEY) {
    return { id: 'openai_vision', name: 'OpenAI GPT-4o-mini Vision' };
  }
  // 6. Azure Computer Vision
  if (process.env.AZURE_VISION_KEY && process.env.AZURE_VISION_ENDPOINT) {
    return { id: 'azure_vision', name: 'Azure Computer Vision Read API' };
  }
  return null;
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/ocr/status', (_req: Request, res: Response) => {
  const provider = getActiveCloudProvider();
  if (provider) {
    res.json({
      available: true,
      provider: provider.name,
      id: provider.id,
      message: `Active provider: ${provider.name}`,
    });
  } else {
    res.json({
      available: false,
      provider: 'none',
      message:
        'No cloud OCR API keys detected in server environment. Set GOOGLE_VISION_API_KEY, OPENAI_API_KEY, or AZURE_VISION_KEY in .env to enable neural cloud handwriting OCR.',
    });
  }
});

app.post('/api/ocr/recognize', async (req: Request, res: Response) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request body' });
    }

    const provider = getActiveCloudProvider();
    if (!provider) {
      return res.status(428).json({
        error: 'NO_CLOUD_KEYS_CONFIGURED',
        message:
          'No cloud OCR keys configured on the server. Please set GOOGLE_VISION_API_KEY, OPENAI_API_KEY, or AZURE_VISION_KEY in server/.env, or use the local OCR provider.',
      });
    }

    // Strip data URI prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // 1. Google Gemini Flash (100% Free at https://aistudio.google.com/app/apikey)
    if (provider.id === 'gemini_vision' || req.body.apiKey) {
      const apiKey = req.body.apiKey || process.env.GEMINI_API_KEY;
      const visionPrompt = `Analyze this receipt or bill image.
Identify ONLY the individual line-item prices located in the rightmost column, stacked vertically one below another.
Strict Exclusions:
- Ignore dates, bill/serial numbers, invoice IDs at the top.
- Ignore quantities (e.g. 1k, 2kg, 2NO, 50G, 500gm).
- Ignore unit rates (if a separate "Rate" or "Price/Unit" column exists to the left of the final "Amount" column).
- Ignore existing handwritten or printed subtotals, grand totals, advances, or deposits at the very bottom of the document.
Return a strict JSON object with an "items" array in the following format:
{
  "items": [
    {
      "value": 125.00,
      "box_2d": [ymin, xmin, ymax, xmax]
    }
  ]
}
Where coordinates in box_2d are integers normalized from 0 to 1000 (ymin, xmin, ymax, xmax).`;

      const candidateModels = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];
      let lastErrText = '';
      let parsedResponse: any = null;

      for (const model of candidateModels) {
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: visionPrompt },
                      {
                        inlineData: {
                          mimeType: 'image/jpeg',
                          data: base64Data,
                        },
                      },
                    ],
                  },
                ],
                generationConfig: {
                  responseMimeType: 'application/json',
                },
              }),
            }
          );

          if (!geminiRes.ok) {
            lastErrText = await geminiRes.text();
            continue; // Try next fallback model
          }

          const gData = await geminiRes.json();
          const content = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          parsedResponse = JSON.parse(content || '{}');
          break; // Succeeded!
        } catch (err: any) {
          lastErrText = err.message;
        }
      }

      if (!parsedResponse) {
        return res.status(502).json({ error: 'Gemini Vision API error', details: lastErrText });
      }

      const rawItems = parsedResponse.items || [];
      const lines = rawItems.map((item: any) => {
        const val = typeof item.value === 'number' ? item.value : parseFloat(item.value) || 0;
        const box = Array.isArray(item.box_2d) && item.box_2d.length === 4
          ? item.box_2d
          : [0, 600, 50, 950];

        const ymin = Math.max(0, Math.min(1, box[0] / 1000));
        const xmin = Math.max(0, Math.min(1, box[1] / 1000));
        const ymax = Math.max(0, Math.min(1, box[2] / 1000));
        const xmax = Math.max(0, Math.min(1, box[3] / 1000));

        return {
          text: val.toFixed(2),
          value: val,
          confidence: 0.96,
          box_2d: box,
          bbox: {
            x: xmin,
            y: ymin,
            width: Math.max(0.02, xmax - xmin),
            height: Math.max(0.015, ymax - ymin),
          },
        };
      });

      return res.json({ items: rawItems, lines, rawText: JSON.stringify(rawItems) });
    }

    // 2. OpenRouter Vision (Free tier at https://openrouter.ai/keys)
    if (provider.id === 'openrouter_vision') {
      const apiKey = process.env.OPENROUTER_API_KEY;
      const oRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-lite-001',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze this handwritten bill. Return a JSON object with a "lines" array. Each item must have: "text" (string containing the line text or number), "confidence" (number 0.0 to 1.0), and "bbox": { "x": number, "y": number, "width": number, "height": number } as normalized fractions from 0.0 to 1.0. Focus on the rightmost amount column.',
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/jpeg;base64,${base64Data}` },
                },
              ],
            },
          ],
        }),
      });

      if (!oRes.ok) {
        const errText = await oRes.text();
        return res.status(oRes.status).json({ error: 'OpenRouter Vision API error', details: errText });
      }

      const oData = await oRes.json();
      const content = oData.choices?.[0]?.message?.content;
      const parsed = JSON.parse(content || '{}');
      return res.json({ lines: parsed.lines || [], rawText: content || '' });
    }

    // 2. Groq Vision (100% Free at https://console.groq.com/keys)
    if (provider.id === 'groq_vision') {
      const apiKey = process.env.GROQ_API_KEY;
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.2-11b-vision-preview',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze this handwritten bill. Return a JSON object with a "lines" array. Each item must have: "text" (string containing the line text or number), "confidence" (number 0.0 to 1.0), and "bbox": { "x": number, "y": number, "width": number, "height": number } as normalized fractions from 0.0 to 1.0 representing position in the image. Focus especially on the rightmost amount column and bill amounts.',
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/jpeg;base64,${base64Data}` },
                },
              ],
            },
          ],
        }),
      });

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        return res.status(groqRes.status).json({ error: 'Groq Vision API error', details: errText });
      }

      const groqData = await groqRes.json();
      const content = groqData.choices?.[0]?.message?.content;
      const parsed = JSON.parse(content || '{}');
      return res.json({ lines: parsed.lines || [], rawText: '' });
    }

    // 3. Google Cloud Vision OCR
    if (provider.id === 'google_vision') {
      const apiKey = process.env.GOOGLE_VISION_API_KEY;
      const gRes = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [
              {
                image: { content: base64Data },
                features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
              },
            ],
          }),
        }
      );

      if (!gRes.ok) {
        const errText = await gRes.text();
        return res.status(gRes.status).json({ error: 'Google Vision API error', details: errText });
      }

      const gData = await gRes.json();
      const annotation = gData.responses?.[0]?.fullTextAnnotation;
      const rawText = annotation?.text || '';

      const lines: any[] = [];
      const pages = annotation?.pages || [];

      for (const page of pages) {
        const pWidth = page.width || 1;
        const pHeight = page.height || 1;

        for (const block of page.blocks || []) {
          for (const paragraph of block.paragraphs || []) {
            let lineText = '';
            let minX = 1, minY = 1, maxX = 0, maxY = 0;

            for (const word of paragraph.words || []) {
              const wordStr = (word.symbols || []).map((s: any) => s.text).join('');
              lineText += (lineText ? ' ' : '') + wordStr;

              const vertices = word.boundingBox?.vertices || [];
              for (const v of vertices) {
                const nx = (v.x ?? 0) / pWidth;
                const ny = (v.y ?? 0) / pHeight;
                minX = Math.min(minX, nx);
                minY = Math.min(minY, ny);
                maxX = Math.max(maxX, nx);
                maxY = Math.max(maxY, ny);
              }
            }

            if (lineText.trim()) {
              lines.push({
                text: lineText.trim(),
                confidence: paragraph.confidence || 0.9,
                bbox: {
                  x: Math.max(0, minX),
                  y: Math.max(0, minY),
                  width: Math.min(1, Math.max(0.01, maxX - minX)),
                  height: Math.min(1, Math.max(0.01, maxY - minY)),
                },
              });
            }
          }
        }
      }

      return res.json({ lines, rawText });
    }

    if (provider.id === 'openai_vision') {
      const apiKey = process.env.OPENAI_API_KEY;
      const oRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze this handwritten bill. Return a JSON object with a "lines" array. Each item must have: "text" (string containing the line text or number), "confidence" (number 0.0 to 1.0), and "bbox": { "x": number, "y": number, "width": number, "height": number } as normalized fractions from 0.0 to 1.0 representing position in the image. Focus especially on the rightmost amount column and bill amounts.',
                },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/jpeg;base64,${base64Data}`, detail: 'high' },
                },
              ],
            },
          ],
        }),
      });

      if (!oRes.ok) {
        const errText = await oRes.text();
        return res.status(oRes.status).json({ error: 'OpenAI Vision API error', details: errText });
      }

      const oData = await oRes.json();
      const content = oData.choices?.[0]?.message?.content;
      const parsed = JSON.parse(content || '{}');
      return res.json({ lines: parsed.lines || [], rawText: '' });
    }

    // Default error if provider unhandled
    return res.status(500).json({ error: 'Provider configuration unsupported' });
  } catch (error: any) {
    console.error('OCR recognize error:', error);
    res.status(500).json({ error: error.message || 'Server error processing OCR' });
  }
});

app.listen(PORT, () => {
  const provider = getActiveCloudProvider();
  console.log(`Live Bill Scanner OCR backend running on port ${PORT}`);
  console.log(`Active OCR Provider: ${provider ? provider.name : 'Local Fallback (No cloud keys)'}`);
});
