import React from 'react';
import { AppState } from '../types';
import { Counter } from './ui/Counter';
import { Helper } from './ui/Helper';

interface ZoningProps {
  state: AppState;
  onUpdate: (updates: Partial<AppState>) => void;
}

export const Zoning: React.FC<ZoningProps> = ({ state, onUpdate }) => {
  return (
    <div className="bg-white rounded-2xl p-4 md:p-8 shadow-sm border border-gray-100 mb-8">
      <h3 className="text-xl font-bold uppercase mb-6 text-ecto-dark">Зональное управление и датчики</h3>
      <div className="space-y-8">
        <div className={`flex justify-between items-center py-2 border-b border-gray-50 ${state.baseUnitId === 'ec01105' ? 'opacity-50' : ''}`}>
          <label className="text-sm md:text-base font-medium text-ecto-dark max-w-[70%]">
            Сколько всего зон/помещений нужно управлять по <span className="whitespace-nowrap">отдельности<Helper text="Общее количество помещений с раздельной регулировкой температуры. Несколько контуров в пределах одного помещения открываются вместе. Если в помещении одновременно используются радиаторы и теплый пол, отметьте это в следующем пункте." /></span>
            {state.baseUnitId === 'ec01105' && (
              <span className="block text-red-500 text-xs font-semibold mt-1">Не поддерживается со Start v.1.0</span>
            )}
          </label>
          <div className="flex-shrink-0">
            <Counter 
              value={state.baseUnitId === 'ec01105' ? 0 : state.zones} 
              onChange={(v) => state.baseUnitId !== 'ec01105' && onUpdate({ zones: v })} 
              max={64} 
            />
          </div>
        </div>
        <div className={`flex justify-between items-center py-2 border-b border-gray-50 ${state.baseUnitId === 'ec01105' ? 'opacity-50' : ''}`}>
          <label className="text-sm md:text-base font-medium text-ecto-dark max-w-[70%]">
            Сколько из этих зон имеют одновременно:<br/>и теплый пол и <span className="whitespace-nowrap">радиаторы<Helper text="В этом пункте укажите количество помещений в которых есть два разных источника тепла: радиаторы и теплый пол." /></span>
            {state.baseUnitId === 'ec01105' && (
              <span className="block text-red-500 text-xs font-semibold mt-1">Не поддерживается со Start v.1.0</span>
            )}
          </label>
          <div className="flex-shrink-0">
            <Counter 
              value={state.baseUnitId === 'ec01105' ? 0 : state.zonesWithTwoSources} 
              onChange={(v) => state.baseUnitId !== 'ec01105' && onUpdate({ zonesWithTwoSources: v })} 
              max={state.zones} 
            />
          </div>
        </div>
        <div className={`flex justify-between items-center py-2 border-b border-gray-50 ${state.baseUnitId === 'ec01105' ? 'opacity-50' : ''}`}>
          <label className="text-sm md:text-base font-medium text-ecto-dark max-w-[70%]">
            Добавить сервоприводы<br/>для коллектора/<span className="whitespace-nowrap">гребёнки<Helper text="Этот пункт добавляет в список товаров стандартные сервоприводы для коллектора: нормально-закрытые, 230В, резьба M30x1.5." /></span>
            {state.baseUnitId === 'ec01105' && (
              <span className="block text-red-500 text-xs font-semibold mt-1">Не поддерживается со Start v.1.0</span>
            )}
          </label>
          <div className="flex-shrink-0">
            <Counter 
              value={state.baseUnitId === 'ec01105' ? 0 : state.manifoldServos} 
              onChange={(v) => state.baseUnitId !== 'ec01105' && onUpdate({ manifoldServos: v })} 
              max={64} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};
