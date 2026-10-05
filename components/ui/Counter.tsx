import React, { useState, useEffect } from 'react';

interface CounterProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  label?: string;
}

export const Counter: React.FC<CounterProps> = ({ value, onChange, min = 0, max = 100, label }) => {
  const [localValue, setLocalValue] = useState<string>(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    
    if (val !== '') {
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
        onChange(Math.min(max, Math.max(min, num)));
      }
    }
  };

  const handleBlur = () => {
    if (localValue === '') {
      onChange(min);
      setLocalValue(min.toString());
    } else {
      const num = parseInt(localValue, 10);
      if (isNaN(num) || num < min) {
        onChange(min);
        setLocalValue(min.toString());
      } else if (num > max) {
        onChange(max);
        setLocalValue(max.toString());
      }
    }
  };

  return (
    <div className="flex items-center space-x-1 sm:space-x-3">
      <button 
        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center border border-gray-200 rounded-full hover:bg-gray-50 bg-white text-ecto-dark font-medium shadow-sm transition-colors"
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        -
      </button>
      <input 
        type="number"
        value={localValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        className="w-8 sm:w-12 text-center font-bold text-base sm:text-lg text-ecto-dark bg-transparent border-none outline-none p-0 m-0 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button 
        className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center border border-gray-200 rounded-full hover:bg-gray-50 bg-white text-ecto-dark font-medium shadow-sm transition-colors"
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
};