import React, { useState, useEffect } from 'react';
import { AppState, CartItem } from './types';
import { calculateCart } from './logic';
import { BoilerSection } from './components/BoilerSection';
import { BoilerRoom } from './components/BoilerRoom';
import { Zoning } from './components/Zoning';
import { TemperatureSensors } from './components/TemperatureSensors';
import { Safety } from './components/Safety';
import { Cart } from './components/Cart';
import { PrintLayout } from './components/PrintLayout';

const getInitialState = (): AppState => ({
  baseUnitId: 'ec01v40',
  backupBoiler: false,
  boilers: [{ brand: '', model: '', id: 'init-1' }],
  outdoorSensor: false,
  heatingPumps: 0,
  boilerPump: false,
  recirculationPump: false,
  mixingValves: 0,
  manifoldServos: 0,
  zones: 0,
  zonesWithTwoSources: 0,
  wiredSensors: 0,
  wirelessRadioSensors: 0,
  wirelessSensors: 0,
  wiredThermostats: 0,
  wirelessThermostats: 0,
  ownThermostats: 0,
  floorSensors: 0,
  ntcFloorSensors: 0,
  gasSensors: 0,
  coSensors: 0,
  pressureSensors: 0,
  wiredSmokeSensors: 0,
  wirelessSmokeSensors: 0,
  wiredLeakSensors: 0,
  wirelessLeakSensors: 0,
  wirelessLeakSensorsLora: 0,
  wiredMotionSensors: 0,
  wirelessMotionSensors: 0,
  wiredSirens: 0,
  combinedSirens: 0,
  wirelessKeyfobs: 0,
  neptun12: 0,
  neptun34: 0,
  neptun1: 0,
  manualItems: [],
  hiddenItems: [],
  customOrderNumber: ''
});

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(getInitialState());
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);

  // Recalculate logic whenever state changes
  useEffect(() => {
    try {
      const items = calculateCart(state);
      setCartItems(items);
    } catch (e) {
      console.error("Logic error", e);
    }
  }, [state]);

  const handleUpdate = (updates: Partial<AppState>) => {
    const nextState = { ...state, ...updates };

    if (nextState.baseUnitId === 'ec01105') {
      try {
        const nextCart = calculateCart(nextState);

        // DOP units count: excludes base unit
        const dopCount = nextCart
          .filter(item => item.consumesPort?.type === 'DOP' && item.id !== 'ec01105' && item.id !== 'ec01v40')
          .reduce((sum, item) => sum + item.quantity, 0);

        if (dopCount > 32) {
          setShowWarningModal(true);
          return;
        }

        // LORA units count: excludes base unit
        const loraCount = nextCart
          .filter(item => item.consumesPort?.type === 'LORA' && item.id !== 'ec01105' && item.id !== 'ec01v40')
          .reduce((sum, item) => sum + item.quantity, 0);

        if (loraCount > 32) {
          setShowWarningModal(true);
          return;
        }

        // Thermostats limit: ec01080 (wireless) and ec01091 (wired)
        if (nextState.wiredThermostats + nextState.wirelessThermostats > 1) {
          setShowWarningModal(true);
          return;
        }

        // Neptun actuators limit: total of 3 max
        if (nextState.neptun12 + nextState.neptun34 + nextState.neptun1 > 3) {
          setShowWarningModal(true);
          return;
        }

        // CONTACT port usage limit check for Start (ec01105)
        const contactUsage = 
          nextState.ownThermostats +
          nextState.pressureSensors * 2 +
          nextState.wiredSmokeSensors +
          nextState.wiredLeakSensors +
          nextState.wiredMotionSensors;

        const manualContactUsage = nextCart
          .filter(item => item.isManual && item.consumesPort?.type === 'CONTACT')
          .reduce((sum, item) => sum + (item.consumesPort?.amount || 0) * item.quantity, 0);

        const totalContactUsage = contactUsage + manualContactUsage;

        if (totalContactUsage > 9) {
          setShowWarningModal(true);
          return;
        }
      } catch (e) {
        console.error("Validation error", e);
      }
    }

    setState(nextState);
  };

  const handleBaseUnitChange = (unitId: 'ec01v40' | 'ec01105') => {
    if (unitId === 'ec01105') {
      setState(prev => ({
        ...prev,
        baseUnitId: 'ec01105',
        boilers: prev.boilers.slice(0, 1),
        wirelessRadioSensors: 0,
        coSensors: 0,
        wirelessSmokeSensors: 0,
        wirelessLeakSensors: 0,
        wirelessMotionSensors: 0,
        wirelessKeyfobs: 0,
        wirelessLeakSensorsLora: 0,
        wirelessThermostats: 0,
        wiredThermostats: 0,
        mixingValves: 0,
        heatingPumps: 0,
        recirculationPump: false,
        zones: 0,
        zonesWithTwoSources: 0,
        manifoldServos: 0,
        ntcFloorSensors: 0,
        gasSensors: 0
      }));
    } else {
      setState(prev => ({
        ...prev,
        baseUnitId: 'ec01v40',
        backupBoiler: false
      }));
    }
  };

  const handleManualAdd = (item: { productId: string; quantity: number }) => {
    const existing = state.manualItems.find(i => i.productId === item.productId);
    let newManualItems;
    if (existing) {
      newManualItems = state.manualItems.map(i =>
        i.productId === item.productId ? { ...i, quantity: i.quantity + item.quantity } : i
      );
    } else {
      newManualItems = [...state.manualItems, item];
    }
    handleUpdate({ manualItems: newManualItems });
  };

  const handleRemoveManual = (productId: string) => {
    const newManualItems = state.manualItems.filter(i => i.productId !== productId);
    handleUpdate({ manualItems: newManualItems });
  };

  const handleHideItem = (productId: string) => {
    handleUpdate({ hiddenItems: [...(state.hiddenItems || []), productId] });
  };

  const confirmReset = () => {
    setState(getInitialState());
    setShowResetModal(false);
  };

  return (
    <>
      <div className="min-h-screen flex flex-col font-sans print:hidden bg-[#F9FAFB] text-ecto-dark selection:bg-ecto-gold/20">
        {/* Header */}
        <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 py-4 px-4 md:px-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative md:sticky md:top-0 z-20 shadow-sm no-print">
          <div className="text-gray-500 font-medium text-sm md:text-base flex flex-wrap items-center gap-2">
            <a href="https://ectocontrol.ru/" className="hover:text-ecto-gold underline underline-offset-4 decoration-1">Главная</a>
            <span className="text-gray-400">—</span>
            <a href="https://ectocontrol.ru/ready-made-solutions" className="hover:text-ecto-gold underline underline-offset-4 decoration-1">Продукция</a>
            <span className="text-gray-400">—</span>
            <span className="text-gray-400">Конфигуратор</span>
          </div>
          <button onClick={() => setShowResetModal(true)} className="px-6 py-2 border border-ecto-lightgray rounded-full font-bold text-ecto-dark text-sm md:text-base hover:bg-ecto-dark hover:text-white transition-all w-full sm:w-auto">СБРОСИТЬ</button>
        </header>

        <main className="flex-grow p-4 md:p-8 max-w-[1440px] mx-auto w-full">

          <div className="flex flex-col lg:flex-row gap-8">

            {/* Main Configurator Area */}
            <div className="flex-grow lg:w-2/3">
               {/* Control Unit Model Selection */}
               <div className="bg-white rounded-2xl p-4 md:p-8 shadow-sm border border-gray-100 mb-8 transition-all hover:shadow-md">
                 <h3 className="text-xl font-bold uppercase mb-4 text-ecto-dark">Выбор системы управления</h3>
                 <p className="text-sm text-gray-500 mb-6">Выберите базовый блок ectoControl под ваши задачи:</p>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div
                     onClick={() => handleBaseUnitChange('ec01v40')}
                     className={`cursor-pointer p-5 rounded-xl border-2 transition-all flex flex-col justify-between ${
                       state.baseUnitId !== 'ec01105'
                         ? 'border border-amber-500 bg-amber-500/[0.03] shadow-md shadow-amber-100/50'
                         : 'border-gray-100 hover:border-gray-200 bg-white'
                     }`}
                   >
                     <div>
                       <div className="flex justify-between items-start gap-3 mb-3">
                         <h4 className="font-bold text-ecto-dark text-xl sm:text-2xl leading-snug">ectoControl v.4.0</h4>
                         <img 
                           src="/download/images_resized/ec01v40.jpg" 
                           alt="ectoControl v.4.0" 
                           className="w-20 h-20 sm:w-24 sm:h-24 object-contain flex-shrink-0 mix-blend-multiply"
                         />
                       </div>
                       <p className="text-gray-500 text-xs leading-relaxed mb-4">
                         Максимальные возможности: управляет каскадом котлов и многоконтурным отоплением, режим охраны, раздельные зоны для перекрытия протечки, расширяемая архитектура.
                       </p>
                     </div>
                     <span className="font-bold text-lg text-ecto-dark">18 900 ₽</span>
                   </div>

                   <div
                     onClick={() => handleBaseUnitChange('ec01105')}
                     className={`cursor-pointer p-5 rounded-xl border-2 transition-all flex flex-col justify-between ${
                       state.baseUnitId === 'ec01105'
                         ? 'border border-amber-500 bg-amber-500/[0.03] shadow-md shadow-amber-100/50'
                         : 'border-gray-100 hover:border-gray-200 bg-white'
                     }`}
                   >
                     <div>
                       <div className="flex justify-between items-start gap-3 mb-3">
                         <h4 className="font-bold text-ecto-dark text-xl sm:text-2xl leading-snug">ectoControl Start v.1.0</h4>
                         <img 
                           src="/download/images_resized/ec01105.jpg" 
                           alt="ectoControl Start v.1.0" 
                           className="w-20 h-20 sm:w-24 sm:h-24 object-contain flex-shrink-0 mix-blend-multiply"
                         />
                       </div>
                       <p className="text-gray-500 text-xs leading-relaxed mb-4">
                         Умное  управление котлом и бойлером для небольшого дома, встроенные цифровая шина для котлов и радиомодуль LoRa, простая настройка.
                       </p>
                     </div>
                     <span className="font-bold text-lg text-ecto-dark">15 900 ₽</span>
                   </div>
                 </div>
               </div>

               <BoilerSection
                 baseUnitId={state.baseUnitId || 'ec01v40'}
                 backupBoiler={state.backupBoiler || false}
                 boilerPump={state.boilerPump || false}
                 boilers={state.boilers}
                 outdoorSensor={state.outdoorSensor}
                 onUpdate={handleUpdate}
               />
               {state.baseUnitId !== 'ec01105' && (
                 <BoilerRoom state={state} onUpdate={handleUpdate} />
               )}
               {state.baseUnitId !== 'ec01105' && (
                 <Zoning state={state} onUpdate={handleUpdate} />
               )}
               <TemperatureSensors state={state} onUpdate={handleUpdate} />
               <Safety state={state} onUpdate={handleUpdate} />
            </div>

            {/* Cart Sidebar */}
            <div className="lg:w-1/3 relative z-10">
              <div className="sticky top-24 print-only-relative">
                <Cart
                  items={cartItems}
                  onManualAdd={handleManualAdd}
                  onRemoveManual={handleRemoveManual}
                  onHideItem={handleHideItem}
                  customOrderNumber={state.customOrderNumber}
                  onUpdateOrderNumber={(val) => handleUpdate({ customOrderNumber: val })}
                />
              </div>
            </div>

          </div>
        </main>

        <footer className="p-8 text-center text-gray-400 text-sm no-print">
           {/* Footer content removed */}
        </footer>

        {/* Reset Confirmation Modal */}
        {showResetModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 no-print">
             <div className="bg-white p-8 rounded-2xl max-w-sm w-full m-4 shadow-2xl text-center transform transition-all scale-100 border border-gray-100">
               <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                 <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
               </div>
               <h3 className="text-xl font-bold mb-2 text-ecto-dark">Вы уверены?</h3>
               <p className="text-gray-500 mb-8 text-sm">
                 Это действие полностью очистит корзину и сбросит все настройки конфигуратора до исходного состояния.
               </p>
               <div className="flex gap-3 justify-center">
                 <button
                   onClick={() => setShowResetModal(false)}
                   className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                 >
                   Нет
                 </button>
                 <button
                   onClick={confirmReset}
                   className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                 >
                   Да, сбросить
                 </button>
               </div>
             </div>
          </div>
        )}

        {/* Port/Device Limit Exceeded Warning Modal */}
        {showWarningModal && (
          <div
            onClick={() => setShowWarningModal(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 no-print"
          >
             <div
               onClick={(e) => e.stopPropagation()}
               className="bg-white p-8 rounded-2xl max-w-sm w-full m-4 shadow-2xl text-center transform transition-all scale-100 border border-gray-100"
             >
               <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                 <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                 </svg>
               </div>
               <h3 className="text-xl font-bold mb-4 text-ecto-dark">Внимание!</h3>
               <p className="text-gray-500 mb-8 text-sm leading-relaxed">
                 Достигнуто максимальное значение для этого типа датчиков.
               </p>
               <div className="flex justify-center">
                 <button
                   onClick={() => setShowWarningModal(false)}
                   className="w-full px-6 py-2.5 bg-black hover:bg-gray-800 text-white font-bold rounded-xl transition-colors shadow-lg"
                 >
                   ОК
                 </button>
               </div>
             </div>
          </div>
        )}
      </div>
    </>
  );
};

export default App;