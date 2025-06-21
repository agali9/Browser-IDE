import { Router, Request, Response } from 'express';
import { verifyJWT } from './auth';
import { runInSandbox } from '../execution/runner';

export const executeRouter = Router();

executeRouter.post('/', verifyJWT, async (req: Request, res: Response) => {
  const { code, language = 'javascript' } = req.body;
  if (!code) return res.status(400).json({ error: 'No code provided' });
  try {
    const result = await runInSandbox(code, language);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
