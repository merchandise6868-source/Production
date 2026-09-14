import React from 'react';

/**
 * Xử lý sự kiện di chuyển giữa các ô nhập liệu bằng 4 phím mũi tên (Up, Down, Left, Right)
 * Giúp trải nghiệm nhập liệu ma trận siêu tốc giống hệt Microsoft Excel.
 */
export const handleCellArrowNavigation = (
  e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
  containerRef?: React.RefObject<HTMLElement | null>
) => {
  const target = e.target as HTMLInputElement;
  if (!target) return;

  const key = e.key;
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
    return;
  }

  const root = containerRef?.current || target.closest('table') || document;
  const rowIdxStr = target.getAttribute('data-row-idx');
  const colKey = target.getAttribute('data-col-key');

  if (rowIdxStr === null) return;
  const rIdx = parseInt(rowIdxStr, 10);

  // Điều hướng DỌC (Lên / Xuống cùng cột)
  if (key === 'ArrowUp') {
    e.preventDefault();
    const prevInput = root.querySelector(
      `[data-row-idx="${rIdx - 1}"][data-col-key="${colKey}"]`
    ) as HTMLElement | null;
    if (prevInput) {
      prevInput.focus();
      if ('select' in prevInput && typeof (prevInput as any).select === 'function') {
        (prevInput as HTMLInputElement).select();
      }
    }
    return;
  }

  if (key === 'ArrowDown') {
    e.preventDefault();
    const nextInput = root.querySelector(
      `[data-row-idx="${rIdx + 1}"][data-col-key="${colKey}"]`
    ) as HTMLElement | null;
    if (nextInput) {
      nextInput.focus();
      if ('select' in nextInput && typeof (nextInput as any).select === 'function') {
        (nextInput as HTMLInputElement).select();
      }
    }
    return;
  }

  // Điều hướng NGANG (Trái / Phải trong dòng hoặc qua ô kế tiếp)
  const isText = target.tagName === 'INPUT' && target.type !== 'number';
  const atStart = !isText || target.selectionStart === 0;
  const atEnd = !isText || target.selectionEnd === target.value.length;

  if (key === 'ArrowLeft' && atStart) {
    const allRowInputs = Array.from(
      root.querySelectorAll(`[data-row-idx="${rIdx}"]`)
    ) as HTMLElement[];
    const currIdx = allRowInputs.indexOf(target);
    if (currIdx > 0) {
      e.preventDefault();
      const prev = allRowInputs[currIdx - 1];
      prev.focus();
      if ('select' in prev && typeof (prev as any).select === 'function') {
        (prev as HTMLInputElement).select();
      }
    }
    return;
  }

  if (key === 'ArrowRight' && atEnd) {
    const allRowInputs = Array.from(
      root.querySelectorAll(`[data-row-idx="${rIdx}"]`)
    ) as HTMLElement[];
    const currIdx = allRowInputs.indexOf(target);
    if (currIdx >= 0 && currIdx < allRowInputs.length - 1) {
      e.preventDefault();
      const next = allRowInputs[currIdx + 1];
      next.focus();
      if ('select' in next && typeof (next as any).select === 'function') {
        (next as HTMLInputElement).select();
      }
    }
    return;
  }
};