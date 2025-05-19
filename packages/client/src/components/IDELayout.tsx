import { useEffect, useState } from 'react';
import { Share2, LogOut, Settings, Terminal as TermIcon } from 'lucide-react';
import { useEditor } from '../context/EditorContext';
import { FileTree } from './FileTree';
import { EditorTabs } from './EditorTabs';
import { MonacoEditorPane } from './MonacoEditorPane';
import { TerminalOutput } from './TerminalOutput';
import { AIPanel } from './AIPanel';
import { SettingsPanel } from './SettingsPanel';

interface Props {
  onLogout: () => void;
}

export function IDELayout({ onLogout }: Props) {
  const { setRoomId, setFiles, setActiveFileId, addTerminalLine, remoteUsers } = useEditor();
  const [showSettings, setShowSettings] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [terminalOpen, setTerminalOpen] = useState(true);

  useEffect(() => {
    const initRoom = async () => {
      const token = localStorage.getItem('token')!;
      const params = new URLSearchParams(window.location.search);
      const existingRoomId = params.get('room');

      if (existingRoomId) {
        // Join existing room
        const res = await fetch(`/api/rooms/${existingRoomId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setRoomId(data.id);
          setRoomName(data.name);
          setFiles(data.files);
          setActiveFileId(data.files[0]?.id ?? null);
          addTerminalLine({ type: 'info', text: `Joined room: ${data.name}`, ts: Date.now() });
          return;
        }
      }

      // Create new room
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: `Room ${Math.random().toString(36).slice(2, 7)}` }),
      });
      const data = await res.json();
      setRoomId(data.id);
      setRoomName(data.name);
      setFiles(data.files);
      setActiveFileId(data.files[0]?.id ?? null);
      window.history.replaceState({}, '', `?room=${data.id}`);
      addTerminalLine({ type: 'info', text: `Created room: ${data.name}`, ts: Date.now() });
    };

    initRoom().catch(console.error);
  }, []);

  const shareRoom = () => {
    navigator.clipboard.writeText(window.location.href);
    addTerminalLine({ type: 'info', text: '✓ Room URL copied to clipboard', ts: Date.now() });
  };

  const username = localStorage.getItem('username') ?? 'user';

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden font-mono">
      {/* Top Navbar */}
      <div className="h-10 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-4 flex-shrink-0">
        <div className="flex items-center gap-2 text-emerald-400">
          <TermIcon size={16} />
          <span className="text-sm font-bold tracking-tight">browser-ide</span>
        </div>
        <div className="w-px h-4 bg-gray-700" />
        <span className="text-gray-400 text-xs">{roomName}</span>

        <div className="flex-1" />

        {/* Remote users */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title={username} />
          {remoteUsers.map(u => (
            <div
              key={u.clientId}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: u.color }}
              title={u.username}
            />
          ))}
          <span className="text-gray-500 text-xs ml-1">{1 + remoteUsers.length} online</span>
        </div>

        <button onClick={shareRoom} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-800">
          <Share2 size={13} />
          share
        </button>
        <button onClick={() => setShowSettings(s => !s)} className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors">
          <Settings size={15} />
        </button>
        <button onClick={onLogout} className="text-gray-400 hover:text-red-400 p-1 rounded hover:bg-gray-800 transition-colors">
          <LogOut size={15} />
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* File tree */}
        <div className="w-48 flex-shrink-0 bg-gray-900 border-r border-gray-800 overflow-y-auto">
          <FileTree />
        </div>

        {/* Center: editor + terminal */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <EditorTabs />
          <div className="flex-1 overflow-hidden">
            <MonacoEditorPane />
          </div>
          {terminalOpen && (
            <div className="h-48 flex-shrink-0 border-t border-gray-800">
              <TerminalOutput onClose={() => setTerminalOpen(false)} />
            </div>
          )}
          {!terminalOpen && (
            <button
              onClick={() => setTerminalOpen(true)}
              className="h-6 bg-gray-900 border-t border-gray-800 text-xs text-gray-500 hover:text-white w-full text-left px-3 transition-colors"
            >
              ▲ terminal
            </button>
          )}
        </div>

        {/* AI Panel */}
        <div className="w-72 flex-shrink-0 border-l border-gray-800">
          <AIPanel />
        </div>
      </div>

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
