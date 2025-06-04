import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { verifyJWT } from './auth';

export const roomsRouter = Router();

const STARTER_FILES = [
  { name: 'index.ts', language: 'typescript', content: `// Welcome to Browser IDE!\nconsole.log("Hello, world!");\n` },
  { name: 'README.md', language: 'markdown', content: `# My Project\n\nEdit files on the left. Run code with the Run button.\n` },
];

roomsRouter.post('/', verifyJWT, (req: Request, res: Response) => {
  const user = (req as any).user;
  const id = uuidv4();
  const name = req.body.name || `Room ${id.slice(0, 6)}`;
  db.prepare('INSERT INTO rooms (id, name, owner_id) VALUES (?, ?, ?)').run(id, name, user.userId);
  for (const f of STARTER_FILES) {
    db.prepare('INSERT INTO files (id, room_id, name, language, content) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), id, f.name, f.language, f.content);
  }
  const files = db.prepare('SELECT * FROM files WHERE room_id = ?').all(id);
  res.json({ id, name, files });
});

roomsRouter.get('/:id', verifyJWT, (req: Request, res: Response) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id) as any;
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const files = db.prepare('SELECT * FROM files WHERE room_id = ?').all(req.params.id);
  res.json({ ...room, files });
});

roomsRouter.get('/:id/files', verifyJWT, (req: Request, res: Response) => {
  const files = db.prepare('SELECT * FROM files WHERE room_id = ?').all(req.params.id);
  res.json(files);
});

roomsRouter.put('/:id/files/:fileId', verifyJWT, (req: Request, res: Response) => {
  const { content } = req.body;
  db.prepare('UPDATE files SET content = ?, updated_at = unixepoch() WHERE id = ? AND room_id = ?')
    .run(content, req.params.fileId, req.params.id);
  res.json({ ok: true });
});
