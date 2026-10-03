export function readFile(
  file: File,
  mode: 'text' | 'dataUrl',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('文件内容无法读取'));
    reader.onerror = () => reject(new Error('文件读取失败'));
    if (mode === 'text') reader.readAsText(file);
    else reader.readAsDataURL(file);
  });
}
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
