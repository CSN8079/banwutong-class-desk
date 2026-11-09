import { Capacitor } from '@capacitor/core';

declare global {
  interface Window {
    classDesk?: {
      saveFile: (payload: { filename: string; base64: string }) => Promise<{ canceled: boolean; path?: string }>;
    };
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      resolve(value.slice(value.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function downloadInBrowser(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function sanitizeFileName(filename: string): string {
  const withoutControlCharacters = Array.from(filename)
    .map((character) => character.charCodeAt(0) < 32 ? '-' : character)
    .join('');
  const safe = withoutControlCharacters
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return safe || '班务通导出文件';
}

export async function saveFile(
  filename: string,
  content: Blob | string,
  mimeType = 'text/plain;charset=utf-8',
): Promise<void> {
  filename = sanitizeFileName(filename);
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  if (window.classDesk) {
    const base64 = await blobToBase64(blob);
    await window.classDesk.saveFile({ filename, base64 });
    return;
  }

  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const base64 = await blobToBase64(blob);
    const result = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title: filename,
      text: '班务通导出文件',
      url: result.uri,
    });
    return;
  }

  downloadInBrowser(blob, filename);
}
