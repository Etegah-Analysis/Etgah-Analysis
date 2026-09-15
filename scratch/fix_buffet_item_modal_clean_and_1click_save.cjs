const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/Dashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Update handleSaveBuffetItem to support 1-click batch extraction when image is attached and name is empty
const oldSaveFn = `  const handleSaveBuffetItem = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    let finalName = buffetItemName.trim();
    if (!finalName) {
      if (buffetItemImage) {
        finalName = '🧾 فاتورة / سكرين شوت صنف بوفيه';
      } else if (buffetItemNotes.trim()) {
        finalName = \`📝 \${buffetItemNotes.trim().slice(0, 30)}\`;
      } else {
        finalName = '☕ صنف بوفيه جديد';
      }
    }`;

const newSaveFn = `  const handleSaveBuffetItem = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    // 1-Click Auto Batch Extraction when image/paste is attached without manual name entry
    if (buffetItemImage && !buffetItemName.trim() && !editingBuffetItem) {
      setBuffetSaving(true);
      toast.loading('جاري سحب الأصناف المكتوبة بخط اليد وتوزيعها على أعمدة الشيت فوراً... ⚡', { id: 'auto-extract-toast' });
      try {
        const compressedImg = await compressImageDataUrl(buffetItemImage, 1000, 1000, 0.7);
        const ocrText = await performOcrOnImage(compressedImg);
        const extractedItems = extractInvoiceItemsFromText(ocrText);
        toast.dismiss('auto-extract-toast');

        if (extractedItems && extractedItems.length > 0) {
          await handleSaveAllExtractedInvoiceItems(extractedItems, buffetItemImage, 'inventory');
          setIsAddBuffetItemModalOpen(false);
          setBuffetItemImage(null);
          setBuffetSaving(false);
          toast.success(\`🎉 تم سحب وتوزيع \${extractedItems.length} أصناف على الشيت تلقائياً وبضغطة واحدة!\`);
          return;
        }
      } catch (err) {
        console.warn('Auto OCR extraction fallback:', err);
        toast.dismiss('auto-extract-toast');
      }
    }

    let finalName = buffetItemName.trim();
    if (!finalName) {
      if (buffetItemImage) {
        finalName = '🧾 فاتورة / سكرين شوت صنف بوفيه';
      } else if (buffetItemNotes.trim()) {
        finalName = \`📝 \${buffetItemNotes.trim().slice(0, 30)}\`;
      } else {
        finalName = '☕ صنف بوفيه جديد';
      }
    }`;

if (content.includes(oldSaveFn)) {
  content = content.replace(oldSaveFn, newSaveFn);
  console.log('Successfully updated handleSaveBuffetItem with 1-click batch extraction!');
}

// 2. Replace AddBuffetItemModal cleanly
const modalStart = "{/* 1. Modal: Add/Edit Buffet Inventory Item */}\n        {isAddBuffetItemModalOpen && typeof document !== 'undefined' && document.body && createPortal(";
const modalEnd = "{/* 2. Modal: Upload Fingerprint Sheet */}";

const startIdx = content.indexOf(modalStart);
const endIdx = content.indexOf(modalEnd);

if (startIdx !== -1 && endIdx !== -1) {
  const newModalCode = `{/* 1. Modal: Add/Edit Buffet Inventory Item */}
        {isAddBuffetItemModalOpen && typeof document !== 'undefined' && document.body && createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-y-auto" dir="rtl" onPaste={handleModalPasteBuffetItem} onClick={(e) => { if (e.target === e.currentTarget) setIsAddBuffetItemModalOpen(false); }}>
            <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative my-auto text-white">
              <button
                onClick={() => setIsAddBuffetItemModalOpen(false)}
                className="absolute top-4 left-4 p-2 text-gray-400 hover:text-white rounded-full bg-slate-800/80 transition"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-5 border-b border-emerald-500/20 pb-3">
                <div className="p-3 bg-emerald-500/20 rounded-2xl border border-emerald-400/30">
                  <Coffee className="text-emerald-300" size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-emerald-300">
                    {editingBuffetItem ? 'تعديل صنف بمخزون البوفيه ✏️' : 'إضافة صنف جديد للبوفيه ☕'}
                  </h3>
                  <p className="text-xs text-emerald-200/70">
                    أدخل اسم الصنف والكمية والسعر، أو ارفع صورة/نص الفاتورة واضغط حفظ مباشرة
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveBuffetItem} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-emerald-300 mb-1">اسم الصنف (اختياري عند رفع صورة فاتورة)</label>
                  <input
                    type="text"
                    placeholder="مثال: بن، شاي، سكر أو اتركه فارغاً عند رفع صورة فاتورة..."
                    value={buffetItemName}
                    onChange={(e) => setBuffetItemName(e.target.value)}
                    className="w-full bg-slate-800 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-300 mb-1">العدد (الإجمالي)</label>
                    <input
                      type="text"
                      placeholder="مثال: 10..."
                      value={buffetItemTotalQty}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBuffetItemTotalQty(val);
                        const t = parseFloat(val);
                        const u = parseFloat(buffetItemUsedQty);
                        if (!isNaN(t) && !isNaN(u)) {
                          setBuffetItemRemainingQty(String(Math.max(0, t - u)));
                        }
                      }}
                      className="w-full bg-slate-800 border border-gray-700 rounded-xl px-2 py-1.5 text-xs text-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-emerald-300 mb-1">السعر (ج.م)</label>
                    <input
                      type="text"
                      placeholder="مثال: 570"
                      value={buffetItemCost}
                      onChange={(e) => setBuffetItemCost(e.target.value)}
                      className="w-full bg-slate-800 border border-emerald-500/40 rounded-xl px-2 py-1.5 text-xs text-white text-center font-bold font-mono text-emerald-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-rose-300 mb-1">المستخدم</label>
                    <input
                      type="text"
                      placeholder="مثال: 2..."
                      value={buffetItemUsedQty}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBuffetItemUsedQty(val);
                        const t = parseFloat(buffetItemTotalQty);
                        const u = parseFloat(val);
                        if (!isNaN(t) && !isNaN(u)) {
                          setBuffetItemRemainingQty(String(Math.max(0, t - u)));
                        }
                      }}
                      className="w-full bg-slate-800 border border-rose-500/30 rounded-xl px-2 py-1.5 text-xs text-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-300 mb-1">المتبقي</label>
                    <input
                      type="text"
                      placeholder="مثال: 8..."
                      value={buffetItemRemainingQty}
                      onChange={(e) => setBuffetItemRemainingQty(e.target.value)}
                      className="w-full bg-slate-800 border border-emerald-500/40 rounded-xl px-2 py-1.5 text-xs text-white text-center font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">ملحوظات (اختياري)</label>
                  <textarea
                    rows="2"
                    placeholder="مثال: الكرتونة 22 عامود، باكيت 24 كيس..."
                    value={buffetItemNotes}
                    onChange={(e) => setBuffetItemNotes(e.target.value)}
                    className="w-full bg-slate-800 border border-gray-700 rounded-xl p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                  />
                </div>

                {/* Clean Image Attachment / Paste Support */}
                <div>
                  <label className="block text-xs font-bold text-emerald-300 mb-1">مكان لصق صورة أو نص الفاتورة (Ctrl + V / اختيار ملف)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      id="buffet-item-img-input"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const imgData = ev.target?.result;
                            setBuffetItemImage(imgData);
                            toast.success('تم إرفاق صورة الفاتورة 🖼️ اضغط حفظ الصنف لسحب الأصناف للشيت فوراً!');
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label
                      htmlFor="buffet-item-img-input"
                      className="cursor-pointer bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 shadow-sm"
                    >
                      <Upload size={14} />
                      <span>{buffetItemImage ? 'تغيير صورة الفاتورة 🖼️' : '📷 إرفاق / رفع صورة الفاتورة'}</span>
                    </label>
                    {buffetItemImage && (
                      <button
                        type="button"
                        onClick={() => setBuffetItemImage(null)}
                        className="text-rose-400 hover:text-rose-300 text-xs font-bold underline"
                      >
                        إلغاء الصورة ✕
                      </button>
                    )}
                  </div>

                  {buffetItemImage && (
                    <div className="mt-2.5 space-y-2">
                      <div className="w-full h-28 bg-slate-950 rounded-xl overflow-hidden border border-emerald-500/30 relative flex items-center justify-center p-1">
                        <img src={buffetItemImage} alt="Buffet item preview" className="max-h-full object-contain rounded" />
                      </div>
                      <div className="p-2 bg-emerald-950/50 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-300 font-bold flex items-center gap-1.5">
                        <Sparkles size={14} className="text-amber-300 animate-spin" />
                        <span>💡 بمجرد الضغط على "حفظ الصنف" سيتم سحب وتوزيع الأصناف المكتوبة بخط اليد على أعمدة الشيت فوراً وبضغطة واحدة!</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setIsAddBuffetItemModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-300 hover:bg-slate-800 transition"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={buffetSaving}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 disabled:opacity-50 cursor-pointer"
                  >
                    <Save size={15} />
                    <span>{buffetSaving ? 'جاري السحب والحفظ...' : editingBuffetItem ? 'تحديث الصنف 💾' : 'حفظ الصنف بالبوفيه ☕'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,\n          document.body\n        )}\n\n        `;

  content = content.slice(0, startIdx) + newModalCode + content.slice(endIdx);
  console.log('Successfully replaced AddBuffetItemModal cleanly!');
} else {
  console.error('Could not find start/end markers for AddBuffetItemModal');
}

fs.writeFileSync(filePath, content, 'utf8');
