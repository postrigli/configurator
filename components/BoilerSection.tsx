import React from 'react';
import { BOILER_BRANDS } from '../constants';
import { AppState, ConnectionType } from '../types';
import { Helper } from './ui/Helper';
import { CustomSelect } from './ui/CustomSelect';

interface BoilerSectionProps {
  baseUnitId?: 'ec01v40' | 'ec01105';
  backupBoiler?: boolean;
  boilerPump?: boolean;
  boilers: AppState['boilers'];
  outdoorSensor: boolean;
  onUpdate: (updates: Partial<AppState>) => void;
}

export const BoilerSection: React.FC<BoilerSectionProps> = ({ 
  baseUnitId, 
  backupBoiler = false, 
  boilerPump = false, 
  boilers, 
  outdoorSensor, 
  onUpdate 
}) => {
  const isStart = baseUnitId === 'ec01105';
  
  const handleAddBoiler = () => {
    if (boilers.length < (isStart ? 1 : 5)) {
      onUpdate({ boilers: [...boilers, { brand: '', model: '', id: Date.now().toString() }] });
    }
  };

  const handleUpdateBoiler = (index: number, field: 'brand' | 'model', value: string) => {
    const newBoilers = [...boilers];
    newBoilers[index] = { ...newBoilers[index], [field]: value };
    
    // Reset model if brand changes
    if (field === 'brand') {
      newBoilers[index].model = '';
    }

    // Determine Connection Type if model changes
    if (field === 'model') {
       const brandObj = BOILER_BRANDS.find(b => b.name === newBoilers[index].brand);
       const modelObj = brandObj?.models.find(m => m.name === value);
       if (modelObj) {
         // We inject type into the state object for logic processing
         (newBoilers[index] as any).type = modelObj.connectionType;
       }
    }

    onUpdate({ boilers: newBoilers });
  };

  const handleRemoveBoiler = (index: number) => {
    const newBoilers = boilers.filter((_, i) => i !== index);
    onUpdate({ boilers: newBoilers });
  };

  return (
    <div className="bg-white rounded-2xl p-4 md:p-8 shadow-sm border border-gray-100 mb-8">
      <h3 className="text-xl font-bold uppercase mb-6 text-ecto-dark">
        {isStart ? 'Оборудование котельной' : 'Источник тепла'}
      </h3>
      
      <div className="space-y-6">
        <label className="font-bold block text-sm md:text-base text-ecto-lightgray uppercase tracking-wider">Котел</label>
        
        {boilers.map((boiler, index) => {
           const brandObj = BOILER_BRANDS.find(b => b.name === boiler.brand);
           
           const brandOptions = BOILER_BRANDS.map(b => ({
             value: b.name === '------------------------------' ? 'SEPARATOR' : b.name,
             label: b.name,
             disabled: b.models.length === 0 && b.name !== '------------------------------'
           }));

           return (
            <div key={boiler.id} className="bg-gray-50 p-4 md:p-6 rounded-xl border border-gray-100 transition-all hover:shadow-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div>
                  <label className="block text-xs font-bold text-ecto-lightgray mb-2">Марка</label>
                  <CustomSelect
                    value={boiler.brand}
                    onChange={(val) => handleUpdateBoiler(index, 'brand', val)}
                    options={brandOptions}
                    placeholder="Выберите марку"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-ecto-lightgray mb-2">Модель</label>
                  <CustomSelect
                    value={boiler.model}
                    onChange={(val) => handleUpdateBoiler(index, 'model', val)}
                    options={brandObj?.models.map(m => ({ value: m.name, label: m.name })) || []}
                    placeholder="Выберите модель"
                    disabled={!boiler.brand || brandObj?.models.length === 0}
                  />
                </div>
              </div>

              {isStart && boiler.model && (() => {
                const connectionType = (boiler as any).type as ConnectionType;
                
                const isDigitalBus = [
                  ConnectionType.OPENTHERM,
                  ConnectionType.EBUS,
                  ConnectionType.NAVIEN,
                  ConnectionType.RINNAI,
                  ConnectionType.BSB
                ].includes(connectionType);

                const isRelay = [
                  ConnectionType.RELAY,
                  ConnectionType.CONTACTOR
                ].includes(connectionType);

                if (isDigitalBus) {
                  return (
                    <div className="mt-4 text-xs text-green-600 bg-green-50 px-3 py-2.5 rounded-xl border border-green-100 font-medium font-sans">
                      <span>Подключение к встроенной цифровой шине (внешний адаптер не требуется)</span>
                    </div>
                  );
                } else if (isRelay) {
                  return (
                    <div className="mt-4 text-xs text-green-600 bg-green-50 px-3 py-2.5 rounded-xl border border-green-100 font-medium font-sans">
                      <span>Подключение к встроенному реле Start v.1.0</span>
                    </div>
                  );
                } else if (connectionType) {
                  return (
                    <div className="mt-4 text-xs text-amber-600 bg-amber-50 px-3 py-2.5 rounded-xl border border-amber-100 font-medium font-sans">
                      <span>Подключение через внешний адаптер цифровой шины</span>
                    </div>
                  );
                }
                return null;
              })()}

              {index > 0 && (
                <button 
                  onClick={() => handleRemoveBoiler(index)}
                  className="text-red-500 text-xs mt-4 hover:underline font-medium"
                >
                  Удалить котел
                </button>
              )}
            </div>
           );
        })}

        {boilers.length < (isStart ? 1 : 5) ? (
          <button 
            onClick={handleAddBoiler}
            className="flex items-center text-sm font-bold text-ecto-blue hover:text-ecto-gold transition-colors mt-2"
          >
            <div className="w-6 h-6 border-2 border-current flex items-center justify-center mr-2 rounded-full text-lg leading-none pb-0.5">+</div>
            ДОБАВИТЬ КОТЕЛ
          </button>
        ) : null}

        {isStart && (
          <>
            <div className="flex justify-between items-center py-4 border-t border-gray-100 mt-4">
              <label className="text-sm md:text-base font-medium text-ecto-dark flex items-center cursor-pointer select-none">
                Подключение резервного котла
                <Helper text="ectoControl Start v.1.0 поддерживает подключение только одного основного котла. Активируйте этот пункт, если нужно подключить запуск резервного котла при остановке основного." />
              </label>
              <label className="cursor-pointer flex-shrink-0">
                <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${backupBoiler ? 'bg-ecto-gold' : 'bg-gray-200'}`}>
                   <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${backupBoiler ? 'translate-x-6' : ''}`}></div>
                </div>
                <input type="checkbox" className="hidden" checked={backupBoiler} onChange={(e) => onUpdate({ backupBoiler: e.target.checked })} />
              </label>
            </div>

            <div className="flex justify-between items-center py-4 border-t border-gray-100 mt-4">
              <label className="text-sm md:text-base font-medium text-ecto-dark flex items-center cursor-pointer select-none">
                Насос загрузки бойлера
                <Helper text="Если в системе предусмотрен отдельный насос для бойлера (ГВС), этот пункт добавит его управление и датчик температуры для бойлера." />
              </label>
              <label className="cursor-pointer flex-shrink-0">
                <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out ${boilerPump ? 'bg-ecto-gold' : 'bg-gray-200'}`}>
                   <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${boilerPump ? 'translate-x-6' : ''}`}></div>
                </div>
                <input type="checkbox" className="hidden" checked={boilerPump} onChange={(e) => onUpdate({ boilerPump: e.target.checked })} />
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
