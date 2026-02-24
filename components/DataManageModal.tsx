import React, { useRef, useState } from 'react';
import { X, Download, Upload, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { exportData, importData, ImportMode } from '../services/dataService';

interface DataManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

type Status = 'idle' | 'exporting' | 'importing' | 'done-export' | 'done-import' | 'error';

const DataManageModal: React.FC<DataManageModalProps> = ({ isOpen, onClose, onImportSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setStatus('idle');
    setMessage('');
    onClose();
  };

  const handleExport = async () => {
    setStatus('exporting');
    try {
      await exportData();
      setStatus('done-export');
      setMessage('备份文件已下载到本地，请妥善保存！');
    } catch {
      setStatus('error');
      setMessage('导出失败，请重试');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // reset for re-select
    e.target.value = '';

    setStatus('importing');
    setMessage('');

    const result = await importData(file, importMode);

    if (result.success) {
      setStatus('done-import');
      setMessage(`导入成功！共导入 ${result.weekCount} 周的数据。页面将刷新以加载新数据。`);
      setTimeout(() => {
        onImportSuccess();
        handleClose();
      }, 2000);
    } else {
      setStatus('error');
      setMessage(result.error ?? '导入失败');
    }
  };

  const isLoading = status === 'exporting' || status === 'importing';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-stone-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="font-sans text-lg font-semibold text-stone-800">数据备份 &amp; 迁移</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 transition-colors"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Warning Banner */}
          <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 leading-relaxed">
              本插件数据存储在<strong>浏览器本地</strong>。卸载插件、清除浏览器数据或换设备时，数据将永久丢失。
              <strong>请定期导出备份！</strong>
            </p>
          </div>

          {/* Export Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-stone-700">导出备份</h3>
            <p className="text-xs text-stone-500">将所有周数据（图片 + 标签 + 笔记）打包为 JSON 文件下载到本地。</p>
            <button
              type="button"
              onClick={handleExport}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-800 text-white rounded-xl hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {status === 'exporting' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {status === 'exporting' ? '导出中…' : '导出全部数据'}
            </button>
          </div>

          <div className="border-t border-stone-100" />

          {/* Import Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-stone-700">导入备份</h3>
            <p className="text-xs text-stone-500">选择之前导出的 JSON 备份文件来恢复数据。</p>

            {/* Import Mode */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="merge"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="accent-stone-700"
                />
                <span className="text-sm text-stone-700">合并（保留本地，导入文件覆盖同周）</span>
              </label>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  value="replace"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="accent-stone-700"
                />
                <span className="text-sm text-stone-700">完全替换（清空本地数据后导入）</span>
              </label>
            </div>

            {importMode === 'replace' && (
              <div className="flex gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">完全替换会删除所有当前本地数据，操作不可撤销！</p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-stone-300 text-stone-700 rounded-xl hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {status === 'importing' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              {status === 'importing' ? '导入中…' : '选择备份文件'}
            </button>
          </div>

          {/* Feedback */}
          {(status === 'done-export' || status === 'done-import') && (
            <div className="flex gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-800">{message}</p>
            </div>
          )}
          {status === 'error' && (
            <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataManageModal;
