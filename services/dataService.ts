import { get, set } from 'idb-keyval';

const STORAGE_KEY = 'designlog_v1_data';
const EXPORT_VERSION = '1.0';

export interface ExportPackage {
  version: string;
  exportedAt: string;
  appName: string;
  data: Record<string, unknown>;
}

/** 导出全部数据为 JSON 文件并触发下载 */
export async function exportData(): Promise<void> {
  const data = await get(STORAGE_KEY);

  const pkg: ExportPackage = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    appName: 'designlog',
    data: data ?? {},
  };

  const json = JSON.stringify(pkg, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `designlog-backup-${dateStr}.json`;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ImportMode = 'merge' | 'replace';

export interface ImportResult {
  success: boolean;
  weekCount: number;
  error?: string;
}

/** 从 JSON 文件导入数据 */
export async function importData(file: File, mode: ImportMode): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const pkg = JSON.parse(text) as Partial<ExportPackage>;

        if (pkg.appName !== 'designlog') {
          resolve({ success: false, weekCount: 0, error: '文件格式不正确，请选择由本应用导出的备份文件' });
          return;
        }

        if (!pkg.data || typeof pkg.data !== 'object') {
          resolve({ success: false, weekCount: 0, error: '备份文件数据为空或格式有误' });
          return;
        }

        const incoming = pkg.data as Record<string, unknown>;
        const weekCount = Object.keys(incoming).length;

        if (mode === 'replace') {
          await set(STORAGE_KEY, incoming);
        } else {
          // merge: 新数据优先（导入的覆盖本地同 weekId 的）
          const existing = (await get(STORAGE_KEY)) as Record<string, unknown> ?? {};
          await set(STORAGE_KEY, { ...existing, ...incoming });
        }

        resolve({ success: true, weekCount });
      } catch {
        resolve({ success: false, weekCount: 0, error: '解析文件失败，请确认文件未被损坏' });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, weekCount: 0, error: '读取文件失败' });
    };

    reader.readAsText(file);
  });
}
