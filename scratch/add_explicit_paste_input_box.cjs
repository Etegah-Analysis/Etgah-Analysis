const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/Dashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

const targetLabel = '<label className="block text-xs font-bold text-emerald-300 mb-1">مكان لصق صورة أو نص الفاتورة (Ctrl + V / اختيار ملف)</label>';

const replacement = `<label className="block text-xs font-bold text-emerald-300 mb-1">مكان لصق صورة أو نص الفاتورة (Ctrl + V / اختيار ملف)</label>
                  
                  {/* Dedicated Interactive Paste Box Container */}
                  <div 
                    tabIndex="0"
                    onPaste={(e) => {
                      const items = e.clipboardData?.items;
                      if (items) {
                        for (let i = 0; i < items.length; i++) {
                          if (items[i].type && items[i].type.startsWith('image/')) {
                            const file = items[i].getAsFile();
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setBuffetItemImage(ev.target?.result);
                                toast.success('تم لصق صورة/سكرين شوت الفاتورة بنجاح 🖼️✨ اضغط "حفظ الصنف" لسحب الأصناف فوراً!');
                              };
                              reader.readAsDataURL(file);
                              e.preventDefault();
                              return;
                            }
                          }
                        }
                      }
                      const pastedText = e.clipboardData?.getData('text');
                      if (pastedText && pastedText.trim()) {
                        const parsed = parsePastedInvoiceContent(pastedText);
                        if (!buffetItemName.trim()) setBuffetItemName(parsed.title);
                        if (parsed.qty && !buffetItemTotalQty.trim()) {
                          setBuffetItemTotalQty(parsed.qty);
                          if (!buffetItemUsedQty.trim()) setBuffetItemUsedQty('0');
                          setBuffetItemRemainingQty(parsed.qty);
                        }
                        setBuffetItemNotes(prev => prev ? \`\${prev}\\n\${pastedText.trim()}\` : pastedText.trim());
                        toast.success('تم استخراج البيانات ولصق الفاتورة بنجاح 📋✨');
                      }
                    }}
                    className="w-full bg-slate-950/90 border-2 border-dashed border-emerald-500/50 hover:border-emerald-400 rounded-2xl p-3 text-center transition flex flex-col items-center justify-center gap-2 mb-2.5 cursor-pointer shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  >
                    <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-bold">
                      <Sparkles size={14} className="text-amber-300" />
                      <span>📌 إضغط هنا ثم اضغط <kbd className="bg-slate-800 px-2 py-0.5 rounded border border-emerald-400/50 text-[11px] font-mono text-emerald-200">Ctrl + V</kbd> للصق صورة أو نص مباشر</span>
                    </div>

                    <input
                      type="text"
                      placeholder="إضغط هنا للصق النص أو الصورة الفاتورة مباشرة (Ctrl + V)..."
                      onPaste={(e) => {
                        const items = e.clipboardData?.items;
                        if (items) {
                          for (let i = 0; i < items.length; i++) {
                            if (items[i].type && items[i].type.startsWith('image/')) {
                              const file = items[i].getAsFile();
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  setBuffetItemImage(ev.target?.result);
                                  toast.success('تم لصق صورة/سكرين شوت الصنف بنجاح 🖼️✨');
                                };
                                reader.readAsDataURL(file);
                                e.preventDefault();
                                return;
                              }
                            }
                          }
                        }
                        const pastedText = e.clipboardData?.getData('text');
                        if (pastedText && pastedText.trim()) {
                          const parsed = parsePastedInvoiceContent(pastedText);
                          if (!buffetItemName.trim()) setBuffetItemName(parsed.title);
                          if (parsed.qty && !buffetItemTotalQty.trim()) {
                            setBuffetItemTotalQty(parsed.qty);
                            if (!buffetItemUsedQty.trim()) setBuffetItemUsedQty('0');
                            setBuffetItemRemainingQty(parsed.qty);
                          }
                          setBuffetItemNotes(prev => prev ? \`\${prev}\\n\${pastedText.trim()}\` : pastedText.trim());
                          toast.success('تم استخراج البيانات ولصق الفاتورة بنجاح 📋✨');
                        }
                      }}
                      className="w-full bg-slate-800/90 border border-emerald-500/40 rounded-xl px-3 py-2 text-xs text-white text-center font-bold focus:outline-none focus:border-emerald-400 placeholder:text-gray-400 shadow-sm"
                    />
                  </div>`;

if (content.includes(targetLabel)) {
  content = content.replace(targetLabel, replacement);
  console.log('Successfully added dedicated interactive paste input box to AddBuffetItemModal!');
} else {
  console.error('Could not find targetLabel in Dashboard.jsx');
}

fs.writeFileSync(filePath, content, 'utf8');
