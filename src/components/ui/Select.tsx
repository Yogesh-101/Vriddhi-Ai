import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  darkAuthMode?: boolean;
}

export function CustomSelect({ options, value, onChange, className = '', darkAuthMode = false }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(240, options.length * 36 + 8);
    const top = spaceBelow >= dropdownHeight + 8
      ? rect.bottom + 8
      : rect.top - dropdownHeight - 8;
    setDropdownPos({
      top: Math.max(4, top),
      left: rect.left,
      width: rect.width,
    });
  }, [options.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  const baseBg = darkAuthMode ? 'bg-black' : 'bg-white dark:bg-zinc-900';
  const baseBorder = darkAuthMode ? 'border-zinc-800' : 'border-gray-200 dark:border-zinc-800';
  const hoverBorder = darkAuthMode ? 'hover:border-[#22C55E]' : 'hover:border-[#22C55E]/50';
  const textColor = darkAuthMode ? 'text-white' : 'text-gray-900 dark:text-zinc-100';
  
  const dropdownBg = darkAuthMode ? 'bg-black' : 'bg-white dark:bg-zinc-900';
  const dropdownBorder = darkAuthMode ? 'border-zinc-800' : 'border-gray-200 dark:border-zinc-800';
  const optionHoverBg = darkAuthMode ? 'hover:bg-zinc-900' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50';
  const optionTextColor = darkAuthMode ? 'text-zinc-300' : 'text-gray-700 dark:text-zinc-300';
  const selectedBg = darkAuthMode ? 'bg-[#22C55E]/10' : 'bg-[#22C55E]/10';

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        className={`flex items-center justify-between w-full ${baseBg} border ${baseBorder} text-xs rounded-xl px-4 py-3 cursor-pointer focus:ring-1 focus:ring-[#22C55E] focus:border-[#22C55E] outline-none select-none ${hoverBorder} transition-all duration-200 shadow-sm`}
        onClick={() => setIsOpen(!isOpen)}
        tabIndex={0}
      >
        <span className={`truncate block ${textColor} font-medium`}>{selectedOption?.label}</span>
        <ChevronDown className={`h-4 w-4 ${darkAuthMode ? 'text-zinc-500' : 'text-gray-500'} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
          className={`${dropdownBg} border ${dropdownBorder} rounded-xl shadow-xl py-1 max-h-60 overflow-auto animate-in fade-in slide-in-from-top-2 duration-200`}
        >
          {options.map((option) => (
            <div
              key={option.value}
              className={`flex items-center justify-between px-4 py-2.5 text-xs cursor-pointer transition-colors ${optionHoverBg} ${
                value === option.value ? `${selectedBg} text-[#22C55E] font-bold` : optionTextColor
              }`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              <span className="truncate">{option.label}</span>
              {value === option.value && <Check className="h-4 w-4 shrink-0 text-[#22C55E]" />}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
