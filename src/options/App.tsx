import React, { useState, useEffect } from 'react'
import { IoSettingsOutline, IoSaveOutline, IoCheckmarkCircleOutline } from 'react-icons/io5'

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [modelName, setModelName] = useState('gemini-3-flash-preview')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    chrome.storage.local.get(['geminiApiKey', 'customSystemPrompt', 'geminiModelName'], (result: { [key: string]: any }) => {
      if (result.geminiApiKey) {
        setApiKey(result.geminiApiKey as string)
      }
      if (result.customSystemPrompt) {
        setSystemPrompt(result.customSystemPrompt as string)
      }
      if (result.geminiModelName) {
        setModelName(result.geminiModelName as string)
      }
    })
  }, [])

  const handleSave = () => {
    chrome.storage.local.set({ 
      geminiApiKey: apiKey,
      customSystemPrompt: systemPrompt,
      geminiModelName: modelName
    }, () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-8 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
            <IoSettingsOutline size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
            <p className="text-sm text-slate-500">Configure your assistant and API access</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 block">
              Gemini API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key here..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-900"
            />
            <p className="text-xs text-slate-400 mt-2">
              You can get your API key from the <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Google AI Studio</a>.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 block">
              Gemini Model Name
            </label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g., gemini-3-flash-preview"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-900"
            />
            <p className="text-xs text-slate-400 mt-2">
              Specify the model to use for design operations.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 block">
              Custom System Prompt
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Leave empty to use the default prompt..."
              rows={8}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-900 font-mono text-xs leading-relaxed"
            />
            <p className="text-xs text-slate-400 mt-2">
              Define how Gemini should behave and the rules it must follow. 
            </p>
          </div>

          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-200"
          >
            {saved ? (
              <>
                <IoCheckmarkCircleOutline size={20} />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <IoSaveOutline size={20} />
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
