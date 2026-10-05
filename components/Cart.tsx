import React, { useState, useMemo } from 'react';
import { pdf } from '@react-pdf/renderer';
import { PrintLayout } from './PrintLayout';
import { CartItem, Product } from '../types';
import { PRODUCTS, OPTIONAL_ITEMS } from '../constants';

interface CartProps {
  items: CartItem[];
  onManualAdd: (item: { productId: string; quantity: number }) => void;
  onRemoveManual: (productId: string) => void;
  onHideItem?: (productId: string) => void;
  customOrderNumber?: string;
  onUpdateOrderNumber?: (val: string) => void;
}

export const Cart: React.FC<CartProps> = ({ items, onManualAdd, onRemoveManual, onHideItem, customOrderNumber, onUpdateOrderNumber }) => {
  // Sort products alphabetically for the dropdown
  const sortedProducts = useMemo(() => {
    return [...PRODUCTS].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedManualId, setSelectedManualId] = useState(sortedProducts[0].id);
  const [manualQty, setManualQty] = useState(1);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return sortedProducts.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.id.toLowerCase().includes(term)
    );
  }, [sortedProducts, searchTerm]);

  const totalModules = items.reduce((sum, item) => sum + (item.dinModules ? item.dinModules * item.quantity : 0), 0);
  const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      
      const blob = await pdf(<PrintLayout items={items} customOrderNumber={customOrderNumber} />).toBlob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `ectoControl_configurator_${customOrderNumber || 'new'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Произошла ошибка при создании PDF файла.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleOrder = () => {
    const cartIds: string[] = [];
    items.forEach(item => {
      if (item.cartId) {
        for (let i = 0; i < item.quantity; i++) {
          cartIds.push(item.cartId);
        }
      }
    });
    
    if (cartIds.length > 0) {
      const url = `https://ectocontrol.ru/cart/?add=${cartIds.join(',')}`;
      window.open(url, '_blank');
    } else {
      alert('В корзине нет товаров для заказа через сайт.');
    }
  };

  const handleAdd = () => {
    onManualAdd({ productId: selectedManualId, quantity: manualQty });
    setIsModalOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 relative h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-ecto-dark flex items-center">
        Ваш комплект
        <input 
          type="text" 
          maxLength={5}
          value={customOrderNumber || ''}
          onChange={(e) => onUpdateOrderNumber?.(e.target.value.replace(/\D/g, ''))}
          className="ml-2 w-14 bg-transparent border-none outline-none text-transparent focus:text-ecto-dark hover:text-ecto-dark/30 transition-colors text-sm font-normal placeholder-transparent selection:bg-ecto-gold/20"
          placeholder="№"
        />
      </h2>
      
      <div className="flex-grow overflow-y-auto max-h-[calc(60vh-100px)] pr-2 space-y-4 custom-scrollbar">
        {items.length === 0 && <p className="text-gray-400 text-sm text-center py-8">Корзина пуста</p>}
        {items.map((item, idx) => (
          <div key={item.id + idx} className="flex justify-between items-start text-sm border-b border-gray-50 pb-3 gap-3 last:border-0 group">
             <div className="w-12 h-12 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden border border-gray-100 flex items-center justify-center">
               {item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> : <div className="text-gray-300 text-xs">Нет фото</div>}
             </div>
             <div className="flex-grow">
                <div className="font-semibold text-ecto-dark leading-tight mb-1">
                  {item.name}
                  {OPTIONAL_ITEMS.includes(item.id) && !item.isManual && (
                    <div className="text-gray-400 font-normal italic mt-1 text-xs">(рекомендуется)</div>
                  )}
                </div>
                <div className="text-[10px] text-gray-400 mb-1 uppercase tracking-wide">Арт: {item.id}</div>
                <div className="text-sm font-bold text-ecto-gold">
                  {item.price.toLocaleString('ru-RU')} ₽
                  {item.quantity > 1 && (
                    <span className="ml-1 font-normal text-gray-400 text-xs">
                      x {item.quantity}
                    </span>
                  )}
                </div>
             </div>
             <div className="flex flex-col items-end gap-1">
                <div className="flex-shrink-0 font-bold bg-gray-100 text-ecto-dark px-2 py-1 rounded text-xs whitespace-nowrap text-center min-w-[48px]">
                    {item.quantity} шт
                </div>
                {item.isManual && (
                  <button 
                    onClick={() => onRemoveManual(item.id)}
                    className="text-red-300 hover:text-red-500 transition-colors p-1"
                    title="Удалить"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                )}
             </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex justify-between items-end mb-1">
          <span className="text-gray-500 font-medium">Итого:</span>
          <span className="text-2xl font-bold text-ecto-dark">{totalPrice.toLocaleString('ru-RU')} ₽</span>
        </div>
        
        {totalModules > 0 && (
          <div className="text-xs text-gray-400 mb-6 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            Места на DIN-рейке: ~{Math.ceil(totalModules)} модулей
          </div>
        )}

        <div className="flex flex-col gap-3 no-print">
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="flex items-center justify-center px-4 py-3 border border-gray-200 rounded-xl font-semibold text-ecto-dark hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50"
            >
              {isGeneratingPDF ? (
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-ecto-dark" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              )}
              {isGeneratingPDF ? 'PDF...' : 'Скачать PDF'}
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center px-4 py-3 bg-white border border-ecto-gold text-ecto-gold rounded-xl font-bold hover:bg-ecto-gold/5 transition-all"
            >
              + Добавить
            </button>
          </div>
          <button 
            onClick={handleOrder}
            className="flex items-center justify-center px-4 py-3 bg-ecto-gold text-white rounded-xl font-bold hover:bg-[#e6aa00] shadow-lg shadow-yellow-100 transition-all"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            Заказать
          </button>
        </div>
      </div>

      {/* Manual Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 no-print">
          <div className="bg-white p-6 rounded-2xl max-w-2xl w-full m-4 shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-ecto-dark">Добавить оборудование</h3>
            
            <label className="block text-sm font-medium text-gray-500 mb-1">Поиск и выбор товара</label>
            <div className="relative mb-4">
              <input 
                type="text"
                placeholder="Начните вводить название или артикул..."
                className="w-full border border-gray-200 rounded-t-lg p-3 bg-gray-50 text-ecto-dark focus:outline-none focus:ring-2 focus:ring-ecto-gold/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="border-x border-b border-gray-200 rounded-b-lg max-h-60 overflow-y-auto bg-white custom-scrollbar">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map(p => (
                    <div 
                      key={p.id}
                      onClick={() => {
                        setSelectedManualId(p.id);
                        setSearchTerm(`${p.name} (${p.id})`);
                      }}
                      className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors whitespace-nowrap overflow-hidden text-ellipsis ${selectedManualId === p.id ? 'bg-ecto-gold/10 text-ecto-gold font-bold' : 'text-ecto-dark'}`}
                      title={`${p.name} (${p.id})`}
                    >
                      {p.name} <span className="text-gray-400 font-normal">({p.id})</span>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-gray-400 text-center">Товары не найдены</div>
                )}
              </div>
            </div>

            <label className="block text-sm font-medium text-gray-500 mb-1">Количество</label>
            <input 
              type="number" 
              min="1" 
              className="w-full border border-gray-200 rounded-lg p-3 mb-6 bg-gray-50 text-ecto-dark focus:outline-none focus:ring-2 focus:ring-ecto-gold/50"
              value={manualQty}
              onChange={(e) => setManualQty(parseInt(e.target.value) || 1)}
            />

            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setSearchTerm('');
                }}
                className="px-5 py-2 text-gray-500 hover:text-ecto-dark font-medium transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={handleAdd}
                className="px-5 py-2 bg-ecto-gold text-white font-bold rounded-lg hover:bg-[#e6aa00] transition-colors"
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};