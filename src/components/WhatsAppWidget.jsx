import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Sparkles, Headphones } from 'lucide-react';

export default function WhatsAppWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const widgetRef = useRef(null);
  const phoneNumber = '16813223358'; // رقم واتساب منصة اتجاه المعتمد لدى Meta

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target)) {
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

  const openWhatsAppOption = (type) => {
    let text = '';
    if (type === 'details') {
      text = encodeURIComponent('مهتم بالتفاصيل');
    } else if (type === 'support') {
      text = encodeURIComponent('طلب خدمة دعم العملاء');
    }
    window.open(`https://wa.me/${phoneNumber}?text=${text}`, '_blank');
    setIsOpen(false);
  };

  return (
    <div ref={widgetRef} className="fixed bottom-6 left-6 z-50 font-sans" dir="rtl">
      {/* Popover options window */}
      {isOpen && (
        <div className="mb-4 bg-slate-900/95 backdrop-blur-xl border border-white/20 text-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] p-5 w-80 relative animate-fade-in">
          <button 
            onClick={() => setIsOpen(false)} 
            className="absolute top-3 left-3 text-gray-400 hover:text-white transition p-1"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 mb-3">
            <img src="/logo.jpg" alt="Logo" className="w-8 h-8 rounded-full object-cover border border-cyan-400" />
            <div>
              <h4 className="font-bold text-sm text-white">منصة اتجاه التحليل الذكي</h4>
              <p className="text-[11px] text-cyan-300 font-semibold">تواصل مباشر عبر الواتساب ⚡</p>
            </div>
          </div>

          <p className="text-xs text-gray-300 mb-4 bg-white/5 p-2.5 rounded-xl border border-white/10">
            أهلاً بك! يرجى اختيار سبب التواصل لفتح الواتساب بالرسالة الجاهزة:
          </p>

          <div className="space-y-2.5">
            <button
              onClick={() => openWhatsAppOption('details')}
              className="w-full flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] text-xs border border-emerald-400/40 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sparkles size={16} /> 🎯 مهتم بالتفاصيل
              </span>
              <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded-full">رسالة جاهزة</span>
            </button>

            <button
              onClick={() => openWhatsAppOption('support')}
              className="w-full flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] text-xs border border-purple-400/40 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Headphones size={16} /> 🎧 خدمة دعم العملاء
              </span>
              <span className="text-[10px] bg-black/20 px-2 py-0.5 rounded-full">رسالة جاهزة</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black px-4 py-3 rounded-full shadow-[0_8px_25px_rgba(34,197,94,0.5)] border-2 border-green-300 transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
      >
        <MessageCircle size={24} className="animate-bounce" />
        <span className="text-xs tracking-wide">تواصل معنا</span>
      </button>
    </div>
  );
}
