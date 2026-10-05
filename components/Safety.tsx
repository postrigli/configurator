import React from 'react';
import { AppState } from '../types';
import { Counter } from './ui/Counter';
import { Helper } from './ui/Helper';

interface SafetyProps {
  state: AppState;
  onUpdate: (updates: Partial<AppState>) => void;
}

export const Safety: React.FC<SafetyProps> = ({ state, onUpdate }) => {
  const isStart = state.baseUnitId === 'ec01105';

  return (
    <div className="bg-white rounded-2xl p-4 md:p-8 shadow-sm border border-gray-100 mb-8">
      <h3 className="text-xl font-bold uppercase mb-6 text-ecto-dark">Безопасность</h3>

      {isStart ? (
        /* Simplified view for Start block */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {/* Sensors Sub-section */}
          <div className="flex flex-col justify-start space-y-4">
            <label className="font-bold block text-sm md:text-base text-ecto-lightgray uppercase tracking-wider">Датчики</label>
            
            <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm md:text-base font-medium pr-2">Дымовой проводной</span>
              <div className="flex-shrink-0">
                <Counter value={state.wiredSmokeSensors} onChange={(v) => onUpdate({ wiredSmokeSensors: v })} max={32} />
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm md:text-base font-medium pr-2 flex items-center">
                Манометр
                <Helper text="Контактный манометр для контроля давления в системе отопления или водоснабжения. С ним ectoControl оповестит о низком или высоком давлении." />
              </span>
              <div className="flex-shrink-0">
                <Counter value={state.pressureSensors} onChange={(v) => onUpdate({ pressureSensors: v })} max={32} />
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm md:text-base font-medium pr-2">Протечки проводной</span>
              <div className="flex-shrink-0">
                <Counter value={state.wiredLeakSensors} onChange={(v) => onUpdate({ wiredLeakSensors: v })} max={32} />
              </div>
            </div>
          </div>

          {/* Neptun Servo Valves Sub-section */}
          <div className="flex flex-col justify-start">
            <div className="font-bold block mb-4 text-sm md:text-base text-ecto-lightgray uppercase tracking-wider flex flex-col items-start">
              <span className="uppercase flex items-center">
                Сервоприводы Neptun
                <Helper text="Шаровые краны с электроприводом для автоматического перекрытия воды при обнаружении протечки." />
              </span>
              <span className="text-[10px] text-ecto-lightgray font-semibold leading-none mt-1.5 normal-case">только одна зона, при аварии приводы закрываются одновременно</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm md:text-base font-medium pr-2">Кран 1/2"</span>
              <div className="flex-shrink-0">
                <Counter 
                  value={state.neptun12} 
                  onChange={(v) => onUpdate({ neptun12: v })} 
                  max={64} 
                />
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm md:text-base font-medium pr-2">Кран 3/4"</span>
              <div className="flex-shrink-0">
                <Counter 
                  value={state.neptun34} 
                  onChange={(v) => onUpdate({ neptun34: v })} 
                  max={64} 
                />
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm md:text-base font-medium pr-2">Кран 1"</span>
              <div className="flex-shrink-0">
                <Counter 
                  value={state.neptun1} 
                  onChange={(v) => onUpdate({ neptun1: v })} 
                  max={64} 
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Regular full view for ectoControl v.4.0 */
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12 mb-8">
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <label className="text-sm md:text-base font-medium text-ecto-dark flex flex-col items-start pr-2">
                <span className="flex items-center">
                  Датчик утечки газа
                  <Helper text="Датчик утечки природного газа: метана, пропана/бутана. Устанавливается в котельной, на кухне или в других местах, где есть газовое оборудование." />
                </span>
              </label>
              <div className="flex-shrink-0">
                <Counter 
                  value={state.gasSensors} 
                  onChange={(v) => onUpdate({ gasSensors: v })} 
                  max={32} 
                />
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <label className="text-sm md:text-base font-medium text-ecto-dark flex items-center pr-2">
                Датчик угарного газа
                <Helper text="Датчик угарного газа (CO). Угарный газ не имеет цвета и запаха, поэтому датчик необходим для безопасности при использовании котлов, каминов и печей." />
              </label>
              <div className="flex-shrink-0">
                <Counter 
                  value={state.coSensors} 
                  onChange={(v) => onUpdate({ coSensors: v })} 
                  max={32} 
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
             <div className="space-y-4">
                <label className="font-bold block text-sm md:text-base text-ecto-lightgray uppercase tracking-wider">Пожарные датчики</label>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-sm md:text-base font-medium pr-2">Проводной</span>
                    <div className="flex-shrink-0"><Counter value={state.wiredSmokeSensors} onChange={(v) => onUpdate({ wiredSmokeSensors: v })} max={32} /></div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-sm md:text-base font-medium pr-2 flex flex-col items-start">
                      <span>Беспроводной</span>
                    </span>
                    <div className="flex-shrink-0">
                      <Counter 
                        value={state.wirelessSmokeSensors} 
                        onChange={(v) => onUpdate({ wirelessSmokeSensors: v })} 
                        max={32} 
                      />
                    </div>
                </div>
             </div>

             <div className="flex flex-col justify-start">
                <label className="font-bold block mb-4 text-sm md:text-base text-ecto-lightgray uppercase tracking-wider flex items-center">
                  Контроль давления
                </label>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-sm md:text-base font-medium pr-2 flex items-center">
                      Манометр
                      <Helper text="Контактный манометр для контроля давления в системе отопления или водоснабжения. С ним ectoControl оповестит о низком или высоком давлении." />
                    </span>
                    <div className="flex-shrink-0"><Counter value={state.pressureSensors} onChange={(v) => onUpdate({ pressureSensors: v })} max={32} /></div>
                </div>
             </div>
          </div>

          <div className="mt-10 pt-8 border-t border-gray-100">
            <label className="font-bold block mb-6 text-ecto-dark text-base md:text-lg">Контроль протечки воды</label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                 <div className="flex flex-col justify-start">
                   <h4 className="font-bold block mb-4 text-sm md:text-base uppercase text-ecto-lightgray tracking-wider">Датчики</h4>
                   <div className="flex justify-between items-center py-2 border-b border-gray-50">
                     <span className="text-sm md:text-base font-medium pr-2">Проводной</span>
                     <div className="flex-shrink-0"><Counter value={state.wiredLeakSensors} onChange={(v) => onUpdate({ wiredLeakSensors: v })} max={32} /></div>
                   </div>
                   <div className="flex justify-between items-center py-2 border-b border-gray-50">
                     <span className="text-sm md:text-base font-medium pr-2 flex flex-col items-start text-left">
                       <span>Беспроводной</span>
                     </span>
                     <div className="flex-shrink-0">
                       <Counter 
                         value={state.wirelessLeakSensors} 
                         onChange={(v) => onUpdate({ wirelessLeakSensors: v })} 
                         max={32} 
                       />
                     </div>
                   </div>
                   <div className="flex justify-between items-center py-2 border-b border-gray-50">
                     <span className="text-sm md:text-base font-medium pr-2 flex flex-col items-start text-left">
                       <span className="flex items-center">
                         LoRa
                         <Helper text="Беспроводные датчики протечки с увеличенным радиусом действия. Подходят для больших домов или удаленных построек." />
                       </span>
                     </span>
                     <div className="flex-shrink-0">
                       <Counter 
                         value={state.wirelessLeakSensorsLora} 
                         onChange={(v) => onUpdate({ wirelessLeakSensorsLora: v })} 
                         max={32} 
                       />
                     </div>
                   </div>
                 </div>

                  <div className="flex flex-col justify-start">
                    <div className="font-bold block mb-4 text-sm md:text-base text-ecto-lightgray tracking-wider flex flex-col items-start">
                      <span className="uppercase flex items-center">
                        Сервоприводы Neptun
                        <Helper text="Шаровые краны с электроприводом для автоматического перекрытия воды при обнаружении протечки." />
                      </span>
                    </div>
                   <div className="flex justify-between items-center py-2 border-b border-gray-50">
                     <span className="text-sm md:text-base font-medium pr-2">Кран 1/2"</span>
                     <div className="flex-shrink-0">
                       <Counter 
                         value={state.neptun12} 
                         onChange={(v) => onUpdate({ neptun12: v })} 
                         max={64} 
                       />
                     </div>
                   </div>
                   <div className="flex justify-between items-center py-2 border-b border-gray-50">
                     <span className="text-sm md:text-base font-medium pr-2">Кран 3/4"</span>
                     <div className="flex-shrink-0">
                       <Counter 
                         value={state.neptun34} 
                         onChange={(v) => onUpdate({ neptun34: v })} 
                         max={64} 
                       />
                     </div>
                   </div>
                   <div className="flex justify-between items-center py-2 border-b border-gray-50">
                     <span className="text-sm md:text-base font-medium pr-2">Кран 1"</span>
                     <div className="flex-shrink-0">
                       <Counter 
                         value={state.neptun1} 
                         onChange={(v) => onUpdate({ neptun1: v })} 
                         max={64} 
                       />
                     </div>
                   </div>
                  </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
