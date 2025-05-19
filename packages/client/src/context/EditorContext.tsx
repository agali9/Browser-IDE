import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface IFile {
  id: string;
  name: string;
  language: string;
  content: string;
}

export interface TerminalLine {
  type: 'stdout' | 'stderr' | 'info' | 'error';
  text: string;
  ts: number;
}

export interface AISuggestion {
  text: string;
  explanation: string;
}

export interface RemoteUser {
  clientId: string;
  username: string;
  color: string;
}

export interface RemoteCursorPresence {
  line: number;
  col: number;
  username: string;
  color: string;
}

interface EditorContextValue {
  roomId: string | null;
  setRoomId: (id: string) => void;
  files: IFile[];
  setFiles: (files: IFile[]) => void;
  activeFileId: string | null;
  setActiveFileId: (id: string) => void;
  activeFile: IFile | null;
  updateFileContent: (id: string, content: string) => void;
  terminalLines: TerminalLine[];
  addTerminalLine: (line: TerminalLine) => void;
  clearTerminal: () => void;
  aiSuggestions: AISuggestion[];
  setAiSuggestions: (s: AISuggestion[]) => void;
  aiLoading: boolean;
  setAiLoading: (v: boolean) => void;
  remoteUsers: RemoteUser[];
  setRemoteUsers: (users: RemoteUser[]) => void;
  remoteCursorPresence: Record<string, RemoteCursorPresence>;
  mergeRemoteCursor: (clientId: string, presence: RemoteCursorPresence) => void;
  removeRemoteCursor: (clientId: string) => void;
  clearRemoteCursorPresence: () => void;
}

const USER_COLORS = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f472b6'];

const EditorContext = createContext<EditorContextValue>(null!);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [files, setFiles] = useState<IFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [remoteUsers, setRemoteUsersRaw] = useState<RemoteUser[]>([]);
  const [remoteCursorPresence, setRemoteCursorPresence] = useState<Record<string, RemoteCursorPresence>>({});
  const colorMap = useRef<Map<string, string>>(new Map());

  const activeFile = files.find(f => f.id === activeFileId) ?? null;

  const updateFileContent = useCallback((id: string, content: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, content } : f));
  }, []);

  const addTerminalLine = useCallback((line: TerminalLine) => {
    setTerminalLines(prev => [...prev.slice(-499), line]);
  }, []);

  const clearTerminal = useCallback(() => setTerminalLines([]), []);

  const setRemoteUsers = useCallback((users: { clientId: string; username: string }[]) => {
    setRemoteUsersRaw(users.map(u => {
      if (!colorMap.current.has(u.clientId)) {
        colorMap.current.set(u.clientId, USER_COLORS[colorMap.current.size % USER_COLORS.length]);
      }
      return { ...u, color: colorMap.current.get(u.clientId)! };
    }));
  }, []);

  const mergeRemoteCursor = useCallback((clientId: string, presence: RemoteCursorPresence) => {
    setRemoteCursorPresence(prev => ({ ...prev, [clientId]: presence }));
  }, []);

  const removeRemoteCursor = useCallback((clientId: string) => {
    setRemoteCursorPresence(prev => {
      if (!(clientId in prev)) return prev;
      const next = { ...prev };
      delete next[clientId];
      return next;
    });
  }, []);

  const clearRemoteCursorPresence = useCallback(() => {
    setRemoteCursorPresence({});
  }, []);

  return (
    <EditorContext.Provider value={{
      roomId, setRoomId, files, setFiles, activeFileId, setActiveFileId,
      activeFile, updateFileContent, terminalLines, addTerminalLine, clearTerminal,
      aiSuggestions, setAiSuggestions, aiLoading, setAiLoading, remoteUsers, setRemoteUsers,
      remoteCursorPresence, mergeRemoteCursor, removeRemoteCursor, clearRemoteCursorPresence,
    }}>
      {children}
    </EditorContext.Provider>
  );
}

export const useEditor = () => useContext(EditorContext);
