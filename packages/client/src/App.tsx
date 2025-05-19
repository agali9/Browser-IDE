import { useState, useEffect } from 'react';
import { EditorProvider } from './context/EditorContext';
import { IDELayout } from './components/IDELayout';
import { AuthModal } from './components/AuthModal';

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }, [token]);

  const handleAuth = (t: string, username: string) => {
    localStorage.setItem('username', username);
    setToken(t);
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken(null);
  };

  return (
    <EditorProvider>
      {!token
        ? <AuthModal onAuth={handleAuth} />
        : <IDELayout onLogout={handleLogout} />
      }
    </EditorProvider>
  );
}
