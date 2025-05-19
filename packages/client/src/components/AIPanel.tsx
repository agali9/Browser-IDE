import { Sparkles, Check, ChevronRight } from 'lucide-react';
import { useEditor } from '../context/EditorContext';

export function AIPanel() {
  const { aiSuggestions, aiLoading, setAiSuggestions } = useEditor();

  const acceptSuggestion = (text: string) => {
    // Dispatch a custom event that MonacoEditorPane can listen to for insertion
    window.dispatchEvent(new CustomEvent('ai:accept', { detail: { text } }));
    setAiSuggestions([]);
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="flex items-center gap-2 px-3 h-9 border-b border-gray-800 flex-shrink-0">
        <Sparkles size={14} className="text-purple-400" />
        <span className="text-xs text-gray-400 uppercase tracking-wider">AI Completions</span>
        {aiLoading && (
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!aiLoading && aiSuggestions.length === 0 && (
          <p className="text-gray-600 text-xs leading-5">
            Suggestions appear as you type. Stop typing for ~1s to trigger completions.
          </p>
        )}

        {aiSuggestions.map((s, i) => (
          <div key={i} className="border border-gray-700 rounded-md overflow-hidden hover:border-purple-500/50 transition-colors group">
            <div className="bg-gray-800 px-3 py-2">
              <pre className="text-xs text-gray-200 whitespace-pre-wrap font-mono leading-5 max-h-32 overflow-y-auto">{s.text}</pre>
            </div>
            {s.explanation && (
              <div className="px-3 py-1.5 bg-gray-900 text-xs text-gray-500 border-t border-gray-700">
                <ChevronRight size={10} className="inline mr-1" />
                {s.explanation}
              </div>
            )}
            <button
              onClick={() => acceptSuggestion(s.text)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-purple-600/20 border-t border-gray-700 transition-colors"
            >
              <Check size={11} />
              Accept {i === 0 ? '(Tab)' : ''}
            </button>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-gray-800 text-xs text-gray-600">
        Powered by Gemini 1.5 Flash
      </div>
    </div>
  );
}
