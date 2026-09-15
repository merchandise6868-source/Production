import React, { useState, useRef, useEffect, useMemo } from 'react';
import { PurchaseOrder } from '../../types';

interface SearchablePoSelectProps {
  value: string;
  onChange: (val: string) => void;
  onSelectPo?: (po: PurchaseOrder) => void;
  pos?: PurchaseOrder[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  rowIdx?: number;
  colKey?: string;
}

export const SearchablePoSelect: React.FC<SearchablePoSelectProps> = ({
  value,
  onChange,
  onSelectPo,
  pos = [],
  placeholder = 'Nhập/chọn PO...',
  className = '',
  disabled = false,
  onKeyDown,
  rowIdx,
  colKey = 'poNumber',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lọc PO phù hợp khi gõ bất kỳ ký tự nào
  const safePos = pos || [];
  const filteredPOs = useMemo(() => {
    if (!value || !value.trim()) {
      return safePos;
    }
    const q = value.trim().toLowerCase();
    return safePos.filter(
      (p) =>
        (p.poNumber && p.poNumber.toLowerCase().includes(q)) ||
        (p.style && p.style.toLowerCase().includes(q))
    );
  }, [safePos, value]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (po: PurchaseOrder) => {
    onChange(po.poNumber);
    if (onSelectPo) {
      onSelectPo(po);
    }
    setIsOpen(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setHighlightedIndex((prev) => (prev < filteredPOs.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredPOs.length - 1));
        return;
      }
      if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < filteredPOs.length) {
        e.preventDefault();
        e.stopPropagation();
        handleSelect(filteredPOs[highlightedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        return;
      }
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <div ref={containerRef} className='relative w-full'>
      <input
        ref={inputRef}
        type='text'
        disabled={disabled}
        value={value}
        data-row-idx={rowIdx}
        data-col-key={colKey}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onFocus={() => {
          setIsOpen(true);
          setHighlightedIndex(-1);
        }}
        onKeyDown={handleInputKeyDown}
        className={className}
      />

      {isOpen && !disabled && filteredPOs.length > 0 && (
        <div className='absolute left-0 top-full mt-1 w-56 max-h-52 overflow-y-auto bg-white border border-sky-300 rounded-lg shadow-xl z-50 py-1 text-xs'>
          <div className='px-2 py-1 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100 bg-slate-50 flex justify-between items-center'>
            <span>Gợi ý mã PO ({filteredPOs.length})</span>
            <span className='text-[9px] text-sky-600 font-normal'>Gõ ký tự để lọc</span>
          </div>
          {filteredPOs.map((po, idx) => {
            const isHighlighted = idx === highlightedIndex;
            const isSelected = po.poNumber.toUpperCase() === value.toUpperCase();

            return (
              <div
                key={po.id || po.poNumber}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onClick={() => handleSelect(po)}
                className={`px-2.5 py-1.5 cursor-pointer flex items-center justify-between transition-colors ${
                  isHighlighted ? 'bg-sky-50 text-sky-900' : isSelected ? 'bg-sky-100/60 font-semibold' : 'hover:bg-slate-50'
                }`}
              >
                <div>
                  <span className='font-mono font-bold text-sky-700'>{po.poNumber}</span>
                  {po.style && (
                    <span className='text-[11px] text-slate-500 ml-1.5 truncate max-w-[120px] inline-block align-bottom'>
                      ({po.style})
                    </span>
                  )}
                </div>
                {po.targetQty > 0 && (
                  <span className='text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600'>
                    {po.targetQty} {po.unit || 'đôi'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};