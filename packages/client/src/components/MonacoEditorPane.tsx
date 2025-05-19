import { useRef, useEffect, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useEditor } from '../context/EditorContext';
import { useCollaboration } from '../hooks/useCollaboration';
import { useAICompletions } from '../hooks/useAICompletions';

const SAVE_DEBOUNCE_MS = 2000;

function safeCssId(clientId: string): string {
  return clientId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function MonacoEditorPane() {
  const {
    activeFile,
    updateFileContent,
    roomId,
    activeFileId,
    aiSuggestions,
    setAiSuggestions,
    remoteCursorPresence,
    clearRemoteCursorPresence,
    mergeRemoteCursor,
    remoteUsers,
  } = useEditor();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const remoteDecoIdsByClientRef = useRef<Map<string, string[]>>(new Map());
  const remoteCursorWidgetsRef = useRef<Map<string, monaco.editor.IContentWidget>>(new Map());
  const cursorDecorRef = useRef<{
    onDecor?: (p: {
      clientId: string;
      line: number;
      col: number;
      username: string;
      color: string;
    }) => void;
    onLeave?: (clientId: string) => void;
  }>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const isRemoteEdit = useRef(false);
  const aiSuggestionsRef = useRef(aiSuggestions);
  const setAiSuggestionsRef = useRef(setAiSuggestions);
  const remoteCursorPresenceRef = useRef(remoteCursorPresence);
  const activeFileIdRef = useRef(activeFile?.id);

  cursorDecorRef.current.onDecor = (p) => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    const existingDecos = remoteDecoIdsByClientRef.current.get(p.clientId) ?? [];
    const prevWidget = remoteCursorWidgetsRef.current.get(p.clientId);
    if (prevWidget) {
      editor.removeContentWidget(prevWidget);
      remoteCursorWidgetsRef.current.delete(p.clientId);
    }

    const line = Math.min(Math.max(1, p.line), model.getLineCount());
    const maxCol = model.getLineMaxColumn(line);
    const col = Math.min(Math.max(1, p.col), maxCol);
    const cssId = safeCssId(p.clientId);
    const className = 'remote-cursor-' + cssId;

    const newIds = editor.deltaDecorations(existingDecos, [
      {
        range: new monaco.Range(line, col, line, col + 1),
        options: {
          className,
          hoverMessage: { value: p.username },
          zIndex: 1000,
        },
      },
    ]);
    remoteDecoIdsByClientRef.current.set(p.clientId, newIds);

    const domNode = document.createElement('div');
    domNode.textContent = p.username;
    domNode.style.cssText = `
      background: ${p.color};
      color: black;
      font-size: 11px;
      font-weight: bold;
      padding: 1px 6px;
      border-radius: 3px;
      pointer-events: none;
      font-family: monospace;
      white-space: nowrap;
      z-index: 1000;
    `;

    const widget: monaco.editor.IContentWidget = {
      getId: () => 'cursor-label-' + p.clientId,
      getDomNode: () => domNode,
      getPosition: () => ({
        position: { lineNumber: line, column: col },
        preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE],
      }),
    };

    editor.addContentWidget(widget);
    remoteCursorWidgetsRef.current.set(p.clientId, widget);
  };

  cursorDecorRef.current.onLeave = (clientId) => {
    const editor = editorRef.current;
    const w = remoteCursorWidgetsRef.current.get(clientId);
    if (editor && w) {
      editor.removeContentWidget(w);
    }
    remoteCursorWidgetsRef.current.delete(clientId);
    const existing = remoteDecoIdsByClientRef.current.get(clientId) ?? [];
    if (editor && existing.length) {
      editor.deltaDecorations(existing, []);
    }
    remoteDecoIdsByClientRef.current.delete(clientId);
  };

  const { sendEdit, sendCursor } = useCollaboration(editorRef, cursorDecorRef);
  const { requestCompletions } = useAICompletions();

  activeFileIdRef.current = activeFile?.id;
  remoteCursorPresenceRef.current = remoteCursorPresence;
  aiSuggestionsRef.current = aiSuggestions;
  setAiSuggestionsRef.current = setAiSuggestions;

  const saveToServer = useCallback(async (fileId: string, content: string) => {
    const token = localStorage.getItem('token');
    if (!token || !roomId) return;
    await fetch(`/api/rooms/${roomId}/files/${fileId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content }),
    });
  }, [roomId]);

  useEffect(() => {
    const onAccept = (ev: Event) => {
      const e = ev as CustomEvent<{ text?: string }>;
      const text = e.detail?.text;
      const editor = editorRef.current;
      if (!editor || text === undefined || text === '') return;
      const sel = editor.getSelection();
      if (!sel) return;
      editor.executeEdits('ai', [{ range: sel, text, forceMoveMarkers: true }]);
      setAiSuggestionsRef.current([]);
    };
    window.addEventListener('ai:accept', onAccept);
    return () => window.removeEventListener('ai:accept', onAccept);
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      for (const w of remoteCursorWidgetsRef.current.values()) {
        editor.removeContentWidget(w);
      }
      for (const ids of remoteDecoIdsByClientRef.current.values()) {
        if (ids.length) editor.deltaDecorations(ids, []);
      }
    }
    remoteCursorWidgetsRef.current.clear();
    remoteDecoIdsByClientRef.current.clear();
    clearRemoteCursorPresence();
  }, [activeFileId, clearRemoteCursorPresence]);

  useEffect(() => {
    for (const u of remoteUsers) {
      const p = remoteCursorPresenceRef.current[u.clientId];
      if (p && p.color !== u.color) {
        mergeRemoteCursor(u.clientId, { ...p, color: u.color });
      }
    }
  }, [remoteUsers, mergeRemoteCursor]);

  useEffect(() => {
    const styleId = 'remote-cursor-styles';
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = styleId;
      document.head.appendChild(el);
    }
    const rules: string[] = [];
    for (const u of remoteUsers) {
      const id = safeCssId(u.clientId);
      rules.push(
        `.monaco-editor .remote-cursor-${id} {
  background-color: ${u.color};
  opacity: 0.7;
  width: 2px !important;
}`
      );
    }
    el.textContent = rules.join('\n');
  }, [remoteUsers]);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;

    const onTabKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && aiSuggestionsRef.current.length > 0) {
        const suggestController = editor.getContribution('editor.contrib.suggestController') as {
          model?: { state?: number };
        };
        const isOpen = suggestController?.model?.state === 2;
        if (!isOpen) {
          e.preventDefault();
          e.stopPropagation();
          const sel = editor.getSelection();
          if (!sel) return;
          editor.executeEdits('ai', [
            {
              range: sel,
              text: aiSuggestionsRef.current[0].text,
              forceMoveMarkers: true,
            },
          ]);
          setAiSuggestionsRef.current([]);
        }
      }
    };
    const dom = editor.getDomNode();
    dom?.addEventListener('keydown', onTabKeyDown);
    editor.onDidDispose(() => {
      dom?.removeEventListener('keydown', onTabKeyDown);
    });

    editor.onDidChangeModelContent((e) => {
      const content = editor.getValue();
      const fileId = activeFileIdRef.current;
      if (!fileId) return;

      updateFileContent(fileId, content);

      if (!isRemoteEdit.current) {
        for (const change of e.changes) {
          sendEdit(
            {
              range: change.range,
              text: change.text,
            },
            content,
          );
        }
      }

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveToServer(fileId, content), SAVE_DEBOUNCE_MS);

      const position = editor.getPosition();
      if (position) {
        requestCompletions(content, position.lineNumber, position.column);
      }
    });

    editor.onDidChangeCursorPosition((e) => {
      sendCursor({ line: e.position.lineNumber, col: e.position.column });
    });
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activeFile) return;
    const model = editor.getModel();
    if (model && model.getValue() !== activeFile.content) {
      isRemoteEdit.current = true;
      model.setValue(activeFile.content);
      isRemoteEdit.current = false;
    }
  }, [activeFile?.id]);

  if (!activeFile) {
    return (
      <div className="h-full flex items-center justify-center text-gray-600 text-sm">
        No file selected
      </div>
    );
  }

  return (
    <Editor
      height="100%"
      language={activeFile.language === 'markdown' ? 'markdown' : activeFile.language}
      defaultValue={activeFile.content}
      theme="vs-dark"
      onMount={handleMount}
      options={{
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontLigatures: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        padding: { top: 12 },
        lineNumbers: 'on',
        renderWhitespace: 'selection',
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        tabSize: 2,
      }}
    />
  );
}
