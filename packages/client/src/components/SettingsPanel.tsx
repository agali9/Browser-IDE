import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: Props) {
  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-80 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-mono font-bold text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 text-xs font-mono">
          <label className="flex items-center justify-between text-gray-300">
            AI Completions
            <input type="checkbox" defaultChecked className="accent-purple-500" />
          </label>
          <label className="flex items-center justify-between text-gray-300">
            Vim Keybindings
            <input type="checkbox" className="accent-purple-500" />
          </label>
          <div className="flex items-center justify-between text-gray-300">
            Font Size
            <input
              type="number"
              defaultValue={14}
              min={10}
              max={24}
              className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-white text-center focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center justify-between text-gray-300">
            Tab Size
            <select className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-white focus:outline-none">
              <option>2</option>
              <option>4</option>
            </select>
          </div>
        </div>

        <p className="mt-5 text-gray-600 text-xs">
          Settings are applied to the current session.
        </p>
      </div>
    </div>
  );
}
