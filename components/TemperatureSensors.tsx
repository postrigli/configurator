import React from 'react';
import { AppState } from '../types';
import { Counter } from './ui/Counter';
import { Helper } from './ui/Helper';

interface TemperatureSensorsProps {
  state: AppState;
  onUpdate: (updates: Partial<AppState>) => void;
}

export const TemperatureSensors: React.FC<TemperatureSensorsProps> = ({ state, onUpdate }) => {
  return (
    <div className="bg-white rounded-2xl p-4 md:p-8 shadow-sm border border-gray-100 mb-8">
      <h3 className="text-xl font-bold uppercase mb-6 text-ecto-dark">Количество датчиков температуры</h3>
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
           <div className="space-y-4">
             <h4 className="font-bold text-sm md:text-base text-ecto-lightgray uppercase tracking-wider">Датчики</h4>
             <div className="flex justify-between items-center">
               <span className="text-sm md:text-base font-medium pr-2">
                 {state.baseUnitId === 'ec01105' ? 'Датчик температуры воздуха, проводной' : 'Проводной'}
               </span>
               <div className="flex-shrink-0">
                 <Counter value={state.wiredSensors} onChange={(v) => onUpdate({ wiredSensors: v })} />
               </div>
             </div>

             <div className={`flex justify-between items-center ${state.baseUnitId === 'ec01105' ? '' : ''}`}>
               {state.baseUnitId === 'ec01105' ? (
                 <>
                   <span className="text-sm md:text-base font-medium pr-2 text-left">
                     Датчик температуры в гильзе, RS485
                   </span>
                   <div className="flex-shrink-0">
                     <Counter value={state.floorSensors} onChange={(v) => onUpdate({ floorSensors: v })} />
                   </div>
                 </>
               ) : (
                 <>
                   <span className="text-sm md:text-base font-medium pr-2 flex flex-col items-start text-left">
                     <span>Беспроводной</span>
                   </span>
                   <div className="flex-shrink-0">
                     <Counter
                       value={state.wirelessRadioSensors}
                       onChange={(v) => onUpdate({ wirelessRadioSensors: v })}
                     />
                   </div>
                 </>
               )}
             </div>

             <div className="flex justify-between items-center">
               <span className="text-sm md:text-base font-medium pr-2 text-left">
                 {state.baseUnitId === 'ec01105' ? (
                   <>Датчик температуры воздуха, <span className="whitespace-nowrap">LoRa<Helper text="Беспроводные датчики с увеличенным радиусом действия. Отлично подойдут для больших домов с ЖБ-перекрытиями или для размещения датчика в соседнем здании. Дальность связи до 300м (до 100м в зданиях)." /></span></>
                 ) : (
                   <>Беспроводной <span className="whitespace-nowrap">LoRa<Helper text="Беспроводные датчики с увеличенным радиусом действия. Отлично подойдут для больших домов с ЖБ-перекрытиями или для размещения датчика в соседнем здании. Дальность связи до 300м (до 100м в зданиях)." /></span></>
                 )}
               </span>
               <div className="flex-shrink-0">
                 <Counter value={state.wirelessSensors} onChange={(v) => onUpdate({ wirelessSensors: v })} />
               </div>
             </div>
           </div>

           <div className="space-y-4">
             <h4 className="font-bold text-sm md:text-base text-ecto-lightgray uppercase tracking-wider">Термостат</h4>
             <div className="flex justify-between items-center">
               <span className="text-sm md:text-base font-medium pr-2 flex flex-col items-start text-left">
                 <span>Проводной</span>
               </span>
               <div className="flex-shrink-0">
                 <Counter
                   value={state.wiredThermostats}
                    onChange={(v) => {
                      const updates: Partial<AppState> = { wiredThermostats: v };
                      if (state.ntcFloorSensors > v) updates.ntcFloorSensors = v;
                      onUpdate(updates);
                    }}
                    max={64}
                 />
               </div>
             </div>

             <div className="flex justify-between items-center">
               <span className="text-sm md:text-base font-medium pr-2 flex flex-col items-start text-left">
                 <span>Беспроводной</span>
               </span>
               <div className="flex-shrink-0">
                 <Counter
                   value={state.wirelessThermostats}
                    onChange={(v) => {
                      onUpdate({ wirelessThermostats: v });
                    }}
                    max={64}
                 />
               </div>
             </div>
           </div>
        </div>

        {state.baseUnitId !== 'ec01105' && (
          <>
            <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center">
              <span className="text-sm md:text-base font-medium pr-2">
                Датчик температуры пола в стяжке<br/>
                <span className="text-xs md:text-sm font-normal text-ecto-lightgray">(для зон, где нет проводного термостата)</span>
              </span>
              <div className="flex-shrink-0">
                <Counter value={state.floorSensors} onChange={(v) => onUpdate({ floorSensors: v })} />
              </div>
            </div>

            <div className={`mt-4 pt-4 border-t border-gray-100 flex justify-between items-center ${state.baseUnitId === 'ec01105' ? 'opacity-50' : ''}`}>
              <span className="text-sm md:text-base font-medium pr-2 text-left flex flex-col">
                <span>
                  Датчик температуры пола в стяжке, NTC<br/>
                  <span className="text-xs md:text-sm font-normal text-ecto-lightgray">(только для зон с проводным термостатом)</span>
                </span>
                {state.baseUnitId === 'ec01105' && (
                  <span className="block text-red-500 text-xs font-semibold mt-1">Не поддерживается со Start v.1.0</span>
                )}
              </span>
              <div className="flex-shrink-0">
                <Counter
                  value={state.baseUnitId === 'ec01105' ? 0 : state.ntcFloorSensors}
                  onChange={(v) => state.baseUnitId !== 'ec01105' && onUpdate({ ntcFloorSensors: v })}
                  max={state.baseUnitId === 'ec01105' ? 0 : state.wiredThermostats}
                />
              </div>
            </div>
          </>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100">
          <label className="flex items-center cursor-pointer group">
            <div className={`w-6 h-6 border-2 border-gray-300 rounded flex items-center justify-center mr-3 transition-colors group-hover:border-ecto-gold ${state.outdoorSensor ? 'bg-ecto-gold border-ecto-gold text-white' : 'bg-white'}`}>
              {state.outdoorSensor && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <input type="checkbox" className="hidden" checked={state.outdoorSensor} onChange={(e) => onUpdate({ outdoorSensor: e.target.checked })} />
            <span className="text-sm md:text-base font-medium text-ecto-dark group-hover:text-ecto-gold transition-colors">
              Добавить датчик для улицы (ПЗА)
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
