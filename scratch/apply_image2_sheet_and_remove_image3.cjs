const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/Dashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove the paste box from Image 3 inside AddBuffetItemModal
const itemPasteBoxRegex = /<label className="block text-xs font-bold text-emerald-300 mb-1">📋 مكان للصق نص أو صورة \/ سكرين شوت للصنف \(اختياري\)<\/label>[\s\S]*?<\/div>\s*<\/div>/;
if (itemPasteBoxRegex.test(content)) {
  content = content.replace(itemPasteBoxRegex, '');
  console.log('Removed paste box from AddBuffetItemModal');
}

// 2. Remove the paste box from Image 3 inside AddBuffetPurchaseModal
const purchPasteBoxRegex = /<label className="block text-xs font-bold text-blue-300 mb-1">📋 مكان للصق نص أو صورة \/ سكرين شوت للمشتريات \(اختياري\)<\/label>[\s\S]*?<\/div>\s*<\/div>/;
if (purchPasteBoxRegex.test(content)) {
  content = content.replace(purchPasteBoxRegex, '');
  console.log('Removed paste box from AddBuffetPurchaseModal');
}

// Also check alternative labels for paste box
content = content.replace(/<label className="block text-xs font-bold text-emerald-300 mb-1">📋 مكان للصق نص أو صورة[\s\S]*?<\/div>\s*<\/div>/g, '');
content = content.replace(/<label className="block text-xs font-bold text-blue-300 mb-1">📋 مكان للصق نص أو صورة[\s\S]*?<\/div>\s*<\/div>/g, '');

// 3. Replace the entire Buffet tab section with the clean single table view from Image 2
const oldBuffetTabStart = "{activeTab === 'buffet_inventory' && (isAdmin || (hasPermission(currentEmpUser, 'show_card_buffet') && hasPermission(currentEmpUser, 'canViewBuffet'))) && (() => {";
const oldBuffetTabEnd = "{/* ========================================================================= */}\n        {/* DEDICATED PAYROLL & ATTENDANCE TAB";

const startIndex = content.indexOf(oldBuffetTabStart);
const endIndex = content.indexOf(oldBuffetTabEnd);

if (startIndex !== -1 && endIndex !== -1) {
  const newBuffetSection = `{activeTab === 'buffet_inventory' && (isAdmin || (hasPermission(currentEmpUser, 'show_card_buffet') && hasPermission(currentEmpUser, 'canViewBuffet'))) && (() => {
          const q = buffetSearch.trim().toLowerCase();
          const filteredInventory = buffetInventory.filter(item => {
            if (!q) return true;
            return (item.itemName || '').toLowerCase().includes(q) || (item.notes || '').toLowerCase().includes(q);
          });

          return (
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-amber-500/30 overflow-hidden mb-8" onClick={(e) => e.stopPropagation()}>
              {/* Header Banner */}
              <div className="px-6 py-4 border-b border-purple-500/20 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="p-2.5 bg-amber-500/20 rounded-xl border border-amber-400/40">
                    <span className="text-2xl">☕</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-amber-300 flex items-center gap-2">
                      <span>☕ مصروفات ومحتويات البوفيه</span>
                      <span className="bg-amber-500/30 text-amber-300 border border-amber-400/40 text-xs px-2.5 py-0.5 rounded-full font-bold" dir="ltr">
                        {buffetInventory.length} صنف مسجل
                      </span>
                    </h2>
                    <p className="text-xs text-amber-200/80 mt-0.5">
                      متابعة محتويات ومخزون البوفيه، تسجيل المشتريات والمصروفات الجديدة
                    </p>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedInventoryIds.length > 0 && (isAdmin || hasPermission(currentEmpUser, 'canDeleteBuffet')) && (
                    <button 
                      onClick={handleBulkDeleteInventory}
                      className="bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md hover:shadow-rose-500/30 cursor-pointer animate-pulse"
                    >
                      <Trash2 size={15} />
                      <span>🗑️ مسح الأصناف المحددة ({selectedInventoryIds.length})</span>
                    </button>
                  )}

                  {(isAdmin || hasPermission(currentEmpUser, 'canAddBuffet')) && (
                    <button 
                      onClick={() => handleOpenAddBuffetItem()}
                      className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md hover:shadow-emerald-500/30 cursor-pointer"
                    >
                      <Plus size={15} />
                      <span>+ إضافة صنف للبوفيه 📦</span>
                    </button>
                  )}

                  {(isAdmin || hasPermission(currentEmpUser, 'canExportBuffet')) && (
                    <button 
                      onClick={handleExportBuffetPdf}
                      className="bg-red-700 hover:bg-red-600 text-white px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-1 shadow-sm cursor-pointer"
                      title="تحميل شيت البوفيه بصيغة PDF"
                    >
                      <Download size={14} />
                      <span>تحميل PDF 📄</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Search Bar */}
              <div className="p-4 bg-purple-950/10 border-b border-purple-500/10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
                  <div className="relative w-full">
                    <Search className="absolute right-3 top-2.5 text-gray-400" size={14} />
                    <input
                      type="text"
                      placeholder="بحث في أصناف البوفيه..."
                      value={buffetSearch}
                      onChange={(e) => setBuffetSearch(e.target.value)}
                      className="w-full bg-white border border-amber-300 rounded-xl pr-9 pl-3 py-1.5 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Main Content Area: Single Table Matching Image 2 */}
              <div className="p-4">
                <div className="w-full bg-white rounded-2xl border border-emerald-500/30 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex justify-between items-center border-b border-emerald-600/40">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📦</span>
                      <span className="font-black text-xs sm:text-sm text-emerald-100">محتويات ومخزون البوفيه (المستهلك والرصيد)</span>
                      <span className="bg-emerald-950/60 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                        {filteredInventory.length} صنف
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedInventoryIds.length > 0 && (
                        <button onClick={handleBulkDeleteInventory} className="bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow-sm">
                          <Trash2 size={12} />
                          <span>مسح المحدد ({selectedInventoryIds.length})</span>
                        </button>
                      )}
                      <button 
                        onClick={() => handleOpenAddBuffetItem()}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow-sm"
                      >
                        <Plus size={13} />
                        <span>إضافة صنف</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 text-amber-300 uppercase font-black border-b border-amber-500/30 text-[11px] sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-2 text-center w-8 text-amber-300">
                            <input type="checkbox" className="w-3.5 h-3.5 accent-amber-400 rounded cursor-pointer" checked={filteredInventory.length > 0 && selectedInventoryIds.length === filteredInventory.length} onChange={(e) => { if (e.target.checked) setSelectedInventoryIds(filteredInventory.map(i => i.id)); else setSelectedInventoryIds([]); }} />
                          </th>
                          <th className="py-2.5 px-3 text-center w-10 text-amber-300">#</th>
                          <th className="py-2.5 px-3 text-amber-300 font-extrabold">الصنف</th>
                          <th className="py-2.5 px-3 text-center text-amber-300 font-bold">العدد</th>
                          <th className="py-2.5 px-3 text-center text-emerald-300 font-extrabold bg-emerald-950/50 border-x border-emerald-500/30">السعر (ج.م)</th>
                          <th className="py-2.5 px-3 text-center text-amber-300 font-bold bg-amber-950/30">المستخدم</th>
                          <th className="py-2.5 px-3 text-center text-amber-300 font-bold bg-emerald-950/40">المتبقي</th>
                          <th className="py-2.5 px-3 text-amber-300">ملحوظات</th>
                          <th className="py-2.5 px-3 text-center w-20 text-amber-300">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 text-gray-800 font-medium">
                        {filteredInventory.length === 0 ? (
                          <tr>
                            <td colSpan="9" className="text-center py-8 text-gray-500 font-bold">
                              لا توجد أصناف مطابقة للبحث
                            </td>
                          </tr>
                        ) : (
                          filteredInventory.map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-emerald-50/50 transition">
                              <td className="py-2.5 px-2 text-center">
                                <input type="checkbox" className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer" checked={selectedInventoryIds.includes(item.id)} onChange={() => setSelectedInventoryIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])} />
                              </td>
                              <td className="py-2.5 px-3 text-center text-[10.5px] font-bold text-gray-400">
                                {idx + 1}
                              </td>
                              <td className="py-2.5 px-3 font-extrabold text-gray-900">
                                {item.itemName}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-indigo-700">
                                <span className="inline-block px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 font-mono">
                                  {item.totalQty || '-'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-black text-emerald-800 bg-emerald-50/70 border-x border-emerald-200 font-mono">
                                {item.cost || item.itemPrice ? \`\${Number(item.cost || item.itemPrice).toLocaleString()} ج.م\` : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-rose-700 bg-rose-50/40">
                                <span className="inline-block px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 font-mono">
                                  {item.usedQty || '-'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-black text-emerald-800 bg-emerald-50/40">
                                <span className="inline-block px-2 py-0.5 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold">
                                  {item.remainingQty || '-'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-xs text-gray-600 max-w-[180px] truncate" title={item.notes}>
                                {item.notes || <span className="text-gray-300">—</span>}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {(isAdmin || hasPermission(currentEmpUser, 'canAddBuffet')) && (
                                    <button
                                      onClick={() => handleOpenAddBuffetItem(item)}
                                      className="p-1 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                                      title="تعديل بيانات الصنف"
                                    >
                                      <Edit size={13} />
                                    </button>
                                  )}
                                  {(isAdmin || hasPermission(currentEmpUser, 'canDeleteBuffet')) && (
                                    <button
                                      onClick={() => handleDeleteBuffetItem(item.id)}
                                      className="p-1 text-rose-600 hover:bg-rose-100 rounded-lg transition"
                                      title="حذف الصنف"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}\n\n\n        `;

  content = content.slice(0, startIndex) + newBuffetSection + content.slice(endIndex);
  console.log('Successfully replaced Buffet tab with single Image 2 table layout!');
} else {
  console.error('Could not locate start or end markers for Buffet section');
}

fs.writeFileSync(filePath, content, 'utf8');
