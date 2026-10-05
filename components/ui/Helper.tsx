import React, { useState, useEffect, useRef } from 'react';

interface HelperProps {
  text: string;
  image?: string;
}

export const Helper: React.FC<HelperProps> = ({ text, image }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const helperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (helperRef.current && !helperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && tooltipRef.current && helperRef.current) {
      const helperRect = helperRef.current.getBoundingClientRect();
      const tooltipWidth = tooltipRef.current.offsetWidth;
      const viewportWidth = document.documentElement.clientWidth;
      
      const naturalCenter = helperRect.left + helperRect.width / 2;
      const naturalLeft = naturalCenter - tooltipWidth / 2;
      const naturalRight = naturalCenter + tooltipWidth / 2;
      
      let shift = 0;
      if (naturalRight > viewportWidth - 16) {
        shift = (viewportWidth - 16) - naturalRight;
      } else if (naturalLeft < 16) {
        shift = 16 - naturalLeft;
      }
      setOffset(shift);
    } else {
      setOffset(0);
    }
  }, [isOpen]);

  return (
    <span 
      className="relative inline-flex items-center justify-center ml-2 align-middle cursor-pointer"
      ref={helperRef}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(!isOpen);
      }}
    >
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-xs font-bold hover:bg-ecto-gold hover:text-white transition-colors shadow-sm">
        ?
      </span>
      {isOpen && (
        <div 
          ref={tooltipRef}
          className="absolute z-50 bottom-full mb-2 w-max max-w-[280px] md:max-w-[320px] p-4 bg-white text-sm text-gray-700 rounded-xl shadow-2xl border border-gray-100 text-left leading-relaxed font-normal normal-case tracking-normal"
          style={{ 
            left: `calc(50% + ${offset}px)`, 
            transform: 'translateX(-50%)' 
          }}
        >
          {image && <img src={image} alt="helper" className="w-full h-auto mb-3 rounded-lg object-cover" />}
          <div className="whitespace-pre-wrap">{text}</div>
          <div 
            className="absolute top-full -mt-px border-8 border-transparent border-t-white drop-shadow-sm"
            style={{ 
              left: `calc(50% - ${offset}px)`, 
              transform: 'translateX(-50%)' 
            }}
          ></div>
        </div>
      )}
    </span>
  );
};
