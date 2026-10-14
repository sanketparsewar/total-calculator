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
  if (process.env.GOOGLE_VISION_API_KEY) {
    return { id: 'google_vision', name: 'Google Cloud Vision OCR' };
  }
  if (process.env.OPENAI_API_KEY) {
    return { id: 'openai_vision', name: 'OpenAI GPT-4o-mini Vision' };
  }
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
