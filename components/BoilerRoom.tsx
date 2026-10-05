import React from 'react';
import { AppState } from '../types';
import { Counter } from './ui/Counter';
import { Helper } from './ui/Helper';

interface BoilerRoomProps {
  state: AppState;
  onUpdate: (updates: Partial<AppState>) => void;
}

export const BoilerRoom: React.FC<BoilerRoomProps> = ({ state, onUpdate }) => {
  return (
    <div className="bg-white rounded-2xl p-4 md:p-8 shadow-sm border border-gray-100 mb-8">
      <h3 className="text-xl font-bold uppercase mb-6 text-ecto-dark">Оборудование котельной</h3>
      
      <div className="space-y-8">
        <div className={`flex justify-between items-center py-2 border-b border-gray-50 last:border-0 ${state.baseUnitId === 'ec01105' ? 'opacity-50' : ''}`}>
          <label className="text-sm md:text-base font-medium text-ecto-dark max-w-[70%]">
            Количество насосов отопления<br/><span className="text-xs md:text-sm font-normal text-ecto-lightgray">(кроме бойлера)</span>
            {state.baseUnitId === 'ec01105' && (
              <span className="block text-red-500 text-xs font-semibold mt-1">Не поддерживается со Start v.1.0</span>
            )}
          </label>
          <div className="flex-shrink-0">
            <Counter 
              value={state.baseUnitId === 'ec01105' ? 0 : state.heatingPumps} 
              onChange={(v) => state.baseUnitId !== 'ec01105' && onUpdate({ heatingPumps: v })} 
              max={20} 
            />
          </div>
        </div>

        <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
          <label className="text-sm md:text-base font-medium text-ecto-dark flex items-center">
            Насос загрузки бойлера
            <Helper text="Если в системе предусмотрен отдельный насос для бойлера (ГВС), этот пункт добавит его управление и датчик температуры для бойлера." />
          </label>
          <label className="cursor-pointer flex-shrink-0">
            <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${state.boilerPump ? 'bg-ecto-gold' : 'bg-gray-200'}`}>
               <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${state.boilerPump ? 'translate-x-6' : ''}`}></div>
            </div>
            <input type="checkbox" className="hidden" checked={state.boilerPump} onChange={(e) => onUpdate({ boilerPump: e.target.checked })} />
          </label>
        </div>

        <div className={`flex justify-between items-center py-2 border-b border-gray-50 last:border-0 ${state.baseUnitId === 'ec01105' ? 'opacity-50' : ''}`}>
          <label className="text-sm md:text-base font-medium text-ecto-dark flex flex-col">
            <span className="flex items-center">
              Насос рециркуляции
              <Helper text="Насос, который работает в системе ГВС, чтобы при открытии крана/душа сразу шла горячая вода." />
            </span>
            {state.baseUnitId === 'ec01105' && (
              <span className="block text-red-500 text-xs font-semibold mt-1">Не поддерживается со Start v.1.0</span>
            )}
          </label>
          <label className={`cursor-pointer flex-shrink-0 ${state.baseUnitId === 'ec01105' ? 'pointer-events-none' : ''}`}>
            <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${(state.baseUnitId !== 'ec01105' && state.recirculationPump) ? 'bg-ecto-gold' : 'bg-gray-200'}`}>
               <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${(state.baseUnitId !== 'ec01105' && state.recirculationPump) ? 'translate-x-6' : ''}`}></div>
            </div>
            <input 
              type="checkbox" 
              className="hidden" 
              checked={state.baseUnitId !== 'ec01105' && state.recirculationPump} 
              onChange={(e) => state.baseUnitId !== 'ec01105' && onUpdate({ recirculationPump: e.target.checked })} 
            />
          </label>
        </div>

        <div className={`flex justify-between items-center py-2 border-b border-gray-50 last:border-0 ${state.baseUnitId === 'ec01105' ? 'opacity-50' : ''}`}>
          <label className="text-sm md:text-base font-medium text-ecto-dark max-w-[70%]">
            Количество сервоприводов на<br/>3-ходовых клапанах
            <Helper text="Сервоприводы, которые устанавливаются на смесительные узлы (например, для теплого пола) и регулируют температуру теплоносителя, подмешивая остывшую обратку к горячей подаче." />
            {state.baseUnitId === 'ec01105' && (
              <span className="block text-red-500 text-xs font-semibold mt-1">Не поддерживается со Start v.1.0</span>
            )}
          </label>
          <div className="flex-shrink-0">
            <Counter 
              value={state.baseUnitId === 'ec01105' ? 0 : state.mixingValves} 
              onChange={(v) => state.baseUnitId !== 'ec01105' && onUpdate({ mixingValves: v })} 
              max={20} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};