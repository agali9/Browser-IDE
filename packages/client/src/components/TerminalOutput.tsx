import { useRef, useEffect, useState } from 'react';
import { Play, Trash2, X } from 'lucide-react';
import { useEditor } from '../context/EditorContext';

interface Props {
  onClose: () => void;
}

export function TerminalOutput({ onClose }: Props) {
  const { terminalLines, clearTerminal, addTerminalLine, activeFile, roomId } = useEditor();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLines]);

  const runCode = async () => {
    if (!activeFile || running) return;
    const token = localStorage.getItem('token');
    setRunning(true);
    addTerminalLine({ type: 'info', text: `$ running ${activeFile.name}...`, ts: Date.now() });

    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: activeFile.content, language: activeFile.language }),
      });
      const data = await res.json();
      if (data.stdout) addTerminalLine({ type: 'stdout', text: data.stdout, ts: Date.now() });
      if (data.stderr) addTerminalLine({ type: 'stderr', text: data.stderr, ts: Date.now() });
      addTerminalLine({ type: data.exitCode === 0 ? 'info' : 'error', text: `exit ${data.exitCode} (${data.durationMs}ms)`, ts: Date.now() });
    } catch (e: any) {
      addTerminalLine({ type: 'error', text: `Error: ${e.message}`, ts: Date.now() });
    } finally {
      setRunning(false);
    }
  };

  const lineColor: Record<string, string> = {
    stdout: 'text-gray-200',
    stderr: 'text-red-400',
    info: 'text-emerald-400',
    error: 'text-red-500',
  };

  return (
    <div className="h-full flex flex-col bg-gray-950">
      <div className="flex items-center justify-between px-3 h-7 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 uppercase tracking-wider">Terminal</span>
          <button
            onClick={runCode}
            disabled={running || !activeFile}
            className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-2 py-0.5 rounded transition-colors"
          >
            <Play size={10} />
            {running ? 'running...' : 'Run'}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={clearTerminal} className="text-gray-600 hover:text-gray-400 p-0.5 transition-colors">
            <Trash2 size={12} />
          </button>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400 p-0.5 transition-colors">
            <X size={12} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 text-xs">
        {terminalLines.length === 0 && (
          <p className="text-gray-600">Click Run to execute the active file.</p>
        )}
        {terminalLines.map((line, i) => (
          <div key={i} className={`leading-5 whitespace-pre-wrap ${lineColor[line.type]}`}>
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
