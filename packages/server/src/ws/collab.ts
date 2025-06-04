import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';

interface Client {
  ws: WebSocket;
  clientId: string;
  roomId?: string;
  username?: string;
}

const rooms = new Map<string, Set<Client>>();
const clients = new Map<WebSocket, Client>();

// Debounced save: roomId:fileId -> timer
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function broadcast(roomId: string, payload: object, exclude?: WebSocket) {
  const room = rooms.get(roomId);
  if (!room) return;
  const msg = JSON.stringify(payload);
  for (const client of room) {
    if (client.ws !== exclude && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
    }
  }
}

function debounceFileSave(roomId: string, fileId: string, content: string) {
  const key = `${roomId}:${fileId}`;
  if (saveTimers.has(key)) clearTimeout(saveTimers.get(key)!);
  saveTimers.set(key, setTimeout(() => {
    db.prepare('UPDATE files SET content = ?, updated_at = unixepoch() WHERE id = ? AND room_id = ?')
      .run(content, fileId, roomId);
    saveTimers.delete(key);
  }, 2000));
}

export function setupCollabWS(wss: WebSocketServer) {
  wss.on('connection', (ws) => {
    const client: Client = { ws, clientId: uuidv4() };
    clients.set(ws, client);
    ws.send(JSON.stringify({ type: 'connected', clientId: client.clientId }));

    ws.on('message', (raw) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      switch (msg.type) {
        case 'join': {
          const { roomId, username } = msg;
          client.roomId = roomId;
          client.username = username;
          if (!rooms.has(roomId)) rooms.set(roomId, new Set());
          rooms.get(roomId)!.add(client);
          // Send current users list
          const users = [...rooms.get(roomId)!].map(c => ({ clientId: c.clientId, username: c.username }));
          broadcast(roomId, { type: 'users', users });
          break;
        }
        case 'edit': {
          const { roomId, fileId, delta, fullContent } = msg;
          if (!roomId) return;
          broadcast(roomId, { type: 'edit', fileId, delta, clientId: client.clientId }, ws);
          if (fileId && fullContent !== undefined) {
            debounceFileSave(roomId, fileId, fullContent);
          }
          break;
        }
        case 'cursor': {
          const { roomId, position, fileId } = msg;
          if (!roomId) return;
          broadcast(roomId, { type: 'cursor', clientId: client.clientId, username: client.username, position, fileId }, ws);
          break;
        }
      }
    });

    ws.on('close', () => {
      const { roomId, clientId } = client;
      if (roomId && rooms.has(roomId)) {
        rooms.get(roomId)!.delete(client);
        if (rooms.get(roomId)!.size === 0) rooms.delete(roomId);
        else {
          const users = [...rooms.get(roomId)!].map(c => ({ clientId: c.clientId, username: c.username }));
          broadcast(roomId, { type: 'users', users });
          broadcast(roomId, { type: 'cursor_leave', clientId });
        }
      }
      clients.delete(ws);
    });
  });
}
