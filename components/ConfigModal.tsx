import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getUserConfig, setUserConfig, clearConfigCache } from '../services/configStore';
import { APP_CONFIG } from '../config';

const D = APP_CONFIG.CEREBRAS;

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose }) => {
  const [apiUrlDirect, setApiUrlDirect] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [prompt, setPrompt] = useState(D.PROMPT);
  const [temperature, setTemperature] = useState(String(D.TEMPERATURE));
  const [topP, setTopP] = useState(String(D.TOP_P));
  const [maxTokens, setMaxTokens] = useState(String(D.MAX_TOKENS));
  const [stream, setStream] = useState(D.STREAM);
  const [thinking, setThinking] = useState(D.CHAT_TEMPLATE_KWARGS.thinking);
  const [maxTerms, setMaxTerms] = useState(String(D.MAX_TERMS));
  const [saving, setSaving] = useState(false);
  const [loadDone, setLoadDone] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadDone(false);
    getUserConfig().then((user) => {
      if (cancelled) return;
      setApiUrlDirect(user.apiUrlDirect ?? '');
      setApiKey(user.apiKey ?? '');
      setModel(user.model ?? '');
      setPrompt(user.prompt?.trim() ? user.prompt : D.PROMPT);
      setTemperature(user.temperature !== undefined ? String(user.temperature) : String(D.TEMPERATURE));
      setTopP(user.topP !== undefined ? String(user.topP) : String(D.TOP_P));
      setMaxTokens(user.maxTokens !== undefined ? String(user.maxTokens) : String(D.MAX_TOKENS));
      setStream(user.stream !== undefined ? user.stream : D.STREAM);
      setThinking(user.thinking !== undefined ? user.thinking : D.CHAT_TEMPLATE_KWARGS.thinking);
      setMaxTerms(user.maxTerms !== undefined ? String(user.maxTerms) : String(D.MAX_TERMS));
      setLoadDone(true);
    });
    return () => { cancelled = true; };
  }, [isOpen]);

  const handleSave = async () => {
    const temp = Number(temperature);
    const top = Number(topP);
    const maxT = Number(maxTokens);
    const maxTr = Number(maxTerms);
    if (Number.isNaN(temp) || Number.isNaN(top) || Number.isNaN(maxT) || Number.isNaN(maxTr)) {
      alert('请填写有效的数字（Temperature / Top P / Max Tokens / Max Terms）');
      return;
    }
    setSaving(true);
    try {
      await setUserConfig({
        apiUrlDirect: apiUrlDirect.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
        model: model.trim() || undefined,
        prompt: prompt.trim() || D.PROMPT,
        temperature: temp,
        topP: top,
        maxTokens: maxT,
        stream,
        thinking,
        maxTerms: maxTr,
      });
      clearConfigCache();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    setApiUrlDirect('');
    setApiKey('');
    setModel('');
    setPrompt(D.PROMPT);
    setTemperature(String(D.TEMPERATURE));
    setTopP(String(D.TOP_P));
    setMaxTokens(String(D.MAX_TOKENS));
    setStream(D.STREAM);
    setThinking(D.CHAT_TEMPLATE_KWARGS.thinking);
    setMaxTerms(String(D.MAX_TERMS));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col border border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="font-sans text-lg font-semibold text-stone-800">API 配置</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="text-xs text-stone-500 hover:text-stone-700"
            >
              恢复全部默认
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 transition-colors"
              aria-label="关闭"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {!loadDone ? (
            <p className="text-stone-500 text-sm">加载中…</p>
          ) : (
            <>
              <div>
                <label className="block font-sans text-sm font-medium text-stone-700 mb-1">API URL（插件直连）</label>
                <input
                  type="url"
                  value={apiUrlDirect}
                  onChange={(e) => setApiUrlDirect(e.target.value)}
                  placeholder="https://integrate.api.nvidia.com/v1/chat/completions"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:border-stone-400 text-sm"
                />
              </div>
              <div>
                <label className="block font-sans text-sm font-medium text-stone-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="nvapi-xxx 或你的 API Key"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:border-stone-400"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block font-sans text-sm font-medium text-stone-700 mb-1">Model</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="例如 moonshotai/kimi-k2.5"
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:border-stone-400"
                />
              </div>
              <div>
                <label className="block font-sans text-sm font-medium text-stone-700 mb-1">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  placeholder={D.PROMPT}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:border-stone-400 resize-y text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-sans text-sm font-medium text-stone-700 mb-1">Temperature</label>
                  <input
                    type="text"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                </div>
                <div>
                  <label className="block font-sans text-sm font-medium text-stone-700 mb-1">Top P</label>
                  <input
                    type="text"
                    value={topP}
                    onChange={(e) => setTopP(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-sans text-sm font-medium text-stone-700 mb-1">Max Tokens</label>
                  <input
                    type="text"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                </div>
                <div>
                  <label className="block font-sans text-sm font-medium text-stone-700 mb-1">Max Terms</label>
                  <input
                    type="text"
                    value={maxTerms}
                    onChange={(e) => setMaxTerms(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stream}
                    onChange={(e) => setStream(e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  <span className="text-sm text-stone-700">Stream</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={thinking}
                    onChange={(e) => setThinking(e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  <span className="text-sm text-stone-700">Thinking (chat_template_kwargs)</span>
                </label>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-stone-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !loadDone}
            className="px-4 py-2 bg-stone-800 text-white rounded-lg hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigModal;
