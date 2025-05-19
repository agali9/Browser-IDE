import { FileCode, FileText } from 'lucide-react';
import { useEditor } from '../context/EditorContext';

const LANG_ICONS: Record<string, string> = {
  typescript: '🟦',
  javascript: '🟨',
  python: '🐍',
  markdown: '📝',
  bash: '💻',
};

export function FileTree() {
  const { files, activeFileId, setActiveFileId } = useEditor();

  return (
    <div className="py-2">
      <div className="px-3 py-1 text-xs text-gray-500 uppercase tracking-wider">Explorer</div>
      {files.map(file => (
        <button
          key={file.id}
          onClick={() => setActiveFileId(file.id)}
          className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
            activeFileId === file.id
              ? 'bg-gray-800 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <span>{LANG_ICONS[file.language] ?? '📄'}</span>
          <span className="truncate">{file.name}</span>
        </button>
      ))}
    </div>
  );
}
