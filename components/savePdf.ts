// Сохранение готового PDF.
// На телефоне (iPhone, Android) — системное меню «Поделиться» с файлом: так Telegram, почта и «Файлы»
// получают правильное имя и расширение .pdf (Safari на iPhone при скачивании blob-ссылки имя теряет).
// На компьютере — обычное скачивание.

export const isMobileDevice = (): boolean =>
  typeof navigator !== 'undefined' && (
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPad в режиме «как компьютер»
  );

export const makePdfFile = (blob: Blob, fileName: string): File => new File([blob], fileName, { type: 'application/pdf' });

const canShareFile = (file: File): boolean => {
  try { return !!navigator.share && !!navigator.canShare && navigator.canShare({ files: [file] }); } catch { return false; }
};

export const downloadFile = (file: File) => {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // ссылку не убираем сразу: на iPhone сохранение иногда начинается позже нажатия
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/** Вызывать прямо из обработчика нажатия (без await перед ним). */
export const shareFile = (file: File) => navigator.share({ files: [file], title: file.name });

/**
 * 'shared' / 'cancelled' — меню «Поделиться» открылось; 'downloaded' — обычное скачивание;
 * 'needs-tap' — браузер не дал открыть меню после долгой генерации: нужно ещё одно нажатие пользователя.
 */
export const savePdf = async (file: File): Promise<'shared' | 'cancelled' | 'downloaded' | 'needs-tap'> => {
  if (isMobileDevice() && canShareFile(file)) {
    try {
      await shareFile(file);
      return 'shared';
    } catch (e) {
      const name = (e as Error)?.name;
      if (name === 'AbortError') return 'cancelled';
      if (name === 'NotAllowedError') return 'needs-tap';
    }
  }
  downloadFile(file);
  return 'downloaded';
};

/** Имя файла только латиницей: кириллица в имени на iPhone и в мессенджерах иногда теряется. */
export const pdfName = (base: string, orderNumber?: string) =>
  `${base}_${(orderNumber || '').replace(/[^0-9A-Za-z_-]/g, '') || 'new'}.pdf`;
