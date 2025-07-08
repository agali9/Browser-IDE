import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';
import { verifyJWT } from './auth';

export const aiRouter = Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const LRU_MAX = 20;
const cache = new Map<string, string>();
function lruSet(k: string, v: string) {
  if (cache.size >= LRU_MAX) cache.delete(cache.keys().next().value!);
  cache.set(k, v);
}

const SYSTEM =
  'You are an expert code completion assistant. Given code and cursor position, suggest 1-3 completions. Respond ONLY with valid JSON (no markdown, no backticks): {"suggestions": [{"text": "...", "explanation": "..."}]}';

aiRouter.post('/complete', verifyJWT, async (req: Request, res: Response) => {
  const { code, cursorLine, cursorCol } = req.body as {
    code?: string;
    cursorLine?: number;
    cursorCol?: number;
  };
  if (!code) return res.status(400).json({ error: 'No code' });

  const line = cursorLine ?? 1;
  const col = cursorCol ?? 1;

  const hash = crypto.createHash('sha256').update(`${code}${line}${col}`).digest('hex');
  if (cache.has(hash)) {
    return res.json(JSON.parse(cache.get(hash)!));
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  (res as Response & { flushHeaders?: () => void }).flushHeaders?.();

  const lines = code.split('\n');
  const idx = Math.max(0, line - 1);
  const start = Math.max(0, idx - 25);
  const end = Math.min(lines.length, idx + 25);
  const context = lines.slice(start, end).join('\n');

  const prompt = `${SYSTEM}\n\nCursor: line ${line}, col ${col}\n\nCode:\n${context}`;

  let accumulated = '';

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      const delta = chunk.text();
      accumulated += delta;
      res.write('data: ' + JSON.stringify({ delta }) + '\n\n');
    }

    try {
      const stripped = accumulated.replace(/```/g, '').trim();
      JSON.parse(stripped);
      lruSet(hash, stripped);
    } catch {
      /* not valid JSON */
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.write('data: ' + JSON.stringify({ error: message }) + '\n\n');
    res.end();
  }
});
