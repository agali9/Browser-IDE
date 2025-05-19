import { useCallback, useRef } from 'react';
import { useEditor } from '../context/EditorContext';

const DEBOUNCE_MS = 800;

export function useAICompletions() {
  const { activeFile, setAiSuggestions, setAiLoading } = useEditor();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const controller = useRef<AbortController>();

  const requestCompletions = useCallback((code: string, cursorLine: number, cursorCol: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const token = localStorage.getItem('token');
      if (!token || !activeFile) return;

      controller.current?.abort();
      controller.current = new AbortController();
      setAiLoading(true);
      setAiSuggestions([]);

      try {
        const res = await fetch('/api/ai/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ code, language: activeFile.language, cursorLine, cursorCol }),
          signal: controller.current.signal,
        });

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          for (const line of text.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const { delta } = JSON.parse(data);
              if (delta) accumulated += delta;
              // Try partial parse
              const clean = accumulated.replace(/```json|```/g, '').trim();
              const parsed = JSON.parse(clean);
              if (parsed.suggestions) setAiSuggestions(parsed.suggestions);
            } catch {}
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error('[AI]', err);
      } finally {
        setAiLoading(false);
      }
    }, DEBOUNCE_MS);
  }, [activeFile, setAiSuggestions, setAiLoading]);

  return { requestCompletions };
}
