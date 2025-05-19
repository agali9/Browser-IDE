import { useState } from 'react';
import { Terminal } from 'lucide-react';

interface Props {
  onAuth: (token: string, username: string) => void;
}

export function AuthModal({ onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auth failed');
      onAuth(data.token, data.username);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-lg p-8">
        <div className="flex items-center gap-3 mb-8">
          <Terminal className="text-emerald-400" size={28} />
          <span className="text-white text-xl font-mono font-bold tracking-tight">browser-ide</span>
        </div>

        <div className="flex gap-2 mb-6">
          {(['login', 'register'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-1.5 text-sm rounded font-mono transition-colors ${
                mode === m
                  ? 'bg-emerald-500 text-black'
                  : 'text-gray-400 hover:text-white border border-gray-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <input
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
            placeholder="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          <input
            type="password"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
            placeholder="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={loading || !username || !password}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-mono font-semibold py-2 rounded transition-colors"
          >
            {loading ? 'connecting...' : mode === 'login' ? '→ sign in' : '→ create account'}
          </button>
        </div>
      </div>
    </div>
  );
}
