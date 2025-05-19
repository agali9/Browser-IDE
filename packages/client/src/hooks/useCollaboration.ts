import { useEffect, useRef, useCallback } from 'react';
import { useEditor } from '../context/EditorContext';
import * as monaco from 'monaco-editor';

const WS_URL = `ws://${window.location.host}/ws`;

export type RemoteCursorDecorPayload = {
  clientId: string;
  line: number;
  col: number;
  username: string;
  color: string;
};

export function useCollaboration(
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>,
  cursorDecorRef?: React.MutableRefObject<{
    onDecor?: (p: RemoteCursorDecorPayload) => void;
    onLeave?: (clientId: string) => void;
  }>
) {
  const {
    roomId,
    activeFileId,
    setRemoteUsers,
    addTerminalLine,
    mergeRemoteCursor,
    removeRemoteCursor,
    remoteUsers,
  } = useEditor();
  const ws = useRef<WebSocket | null>(null);
  const activeFileIdRef = useRef(activeFileId);
  const effectCleanupRef = useRef<{ cancelled: boolean } | null>(null);
  const remoteUsersRef = useRef(remoteUsers);
  const clientId = useRef<string>('');
  const isApplying = useRef(false);

  activeFileIdRef.current = activeFileId;
  remoteUsersRef.current = remoteUsers;

  const sendMessage = useCallback((msg: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    if (!roomId || !token) return;

    const lifecycle = { cancelled: false };
    effectCleanupRef.current = lifecycle;

    const existing = ws.current;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)
    ) {
      existing.close();
      ws.current = null;
    }

    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => {
      if (lifecycle.cancelled) return;
      sendMessage({ type: 'join', roomId, username });
      addTerminalLine({ type: 'info', text: `Connected to room ${roomId}`, ts: Date.now() });
    };

    socket.onmessage = (e) => {
      if (lifecycle.cancelled) return;
      const msg = JSON.parse(e.data);
      const fileId = activeFileIdRef.current;
      switch (msg.type) {
        case 'connected':
          clientId.current = msg.clientId;
          break;
        case 'users':
          setRemoteUsers(msg.users.filter((u: any) => u.clientId !== clientId.current));
          break;
        case 'edit': {
          if (msg.fileId !== fileId) break;
          const editor = editorRef.current;
          if (!editor || isApplying.current) break;
          isApplying.current = true;
          editor.executeEdits('remote', [msg.delta]);
          isApplying.current = false;
          break;
        }
        case 'cursor': {
          if (msg.fileId !== fileId) break;
          const ru = remoteUsersRef.current.find((u) => u.clientId === msg.clientId);
          const color = ru?.color ?? '#a78bfa';
          mergeRemoteCursor(msg.clientId, {
            line: msg.position.line,
            col: msg.position.col,
            username: msg.username ?? 'User',
            color,
          });
          cursorDecorRef?.current?.onDecor?.({
            clientId: msg.clientId,
            line: msg.position.line,
            col: msg.position.col,
            username: msg.username ?? 'User',
            color,
          });
          break;
        }
        case 'cursor_leave':
          removeRemoteCursor(msg.clientId);
          cursorDecorRef?.current?.onLeave?.(msg.clientId);
          break;
      }
    };

    socket.onclose = () => {
      if (lifecycle.cancelled) return;
      addTerminalLine({ type: 'info', text: 'Disconnected from collaboration server', ts: Date.now() });
    };

    return () => {
      lifecycle.cancelled = true;
      if (effectCleanupRef.current === lifecycle) {
        effectCleanupRef.current = null;
      }
      socket.close();
      if (ws.current === socket) {
        ws.current = null;
      }
    };
  }, [roomId, addTerminalLine, sendMessage, setRemoteUsers, mergeRemoteCursor, removeRemoteCursor]);

  const sendEdit = useCallback((delta: monaco.editor.IIdentifiedSingleEditOperation, fullContent: string) => {
    if (!isApplying.current) {
      sendMessage({ type: 'edit', roomId, fileId: activeFileId, delta, fullContent });
    }
  }, [roomId, activeFileId, sendMessage]);

  const sendCursor = useCallback((position: { line: number; col: number }) => {
    sendMessage({ type: 'cursor', roomId, fileId: activeFileId, position });
  }, [roomId, activeFileId, sendMessage]);

  return { sendEdit, sendCursor };
}
