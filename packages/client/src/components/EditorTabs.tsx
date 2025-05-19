import { X } from 'lucide-react';
import { useEditor } from '../context/EditorContext';

export function EditorTabs() {
  const { files, activeFileId, setActiveFileId, setFiles } = useEditor();
  const openFiles = files; // All files are "open" for simplicity; refine as needed

  const closeFile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const remaining = files.filter(f => f.id !== id);
    setFiles(remaining);
    if (activeFileId === id) {
      setActiveFileId(remaining[remaining.length - 1]?.id ?? null);
    }
  };

  return (
    <div className="flex items-center bg-gray-900 border-b border-gray-800 overflow-x-auto flex-shrink-0 h-9">
      {openFiles.map(file => (
        <div
          key={file.id}
          onClick={() => setActiveFileId(file.id)}
          className={`flex items-center gap-2 px-3 h-full text-xs cursor-pointer border-r border-gray-800 flex-shrink-0 transition-colors ${
            activeFileId === file.id
              ? 'bg-gray-950 text-white border-t-2 border-t-emerald-500'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
          }`}
        >
          <span>{file.name}</span>
          <button
            onClick={e => closeFile(e, file.id)}
            className="hover:text-red-400 transition-colors opacity-60 hover:opacity-100"
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}
