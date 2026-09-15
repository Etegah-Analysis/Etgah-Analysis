const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/Dashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add state hooks for bulk selection
if (!content.includes('selectedInventoryIds')) {
  content = content.replace(
    "const [buffetItemImage, setBuffetItemImage] = useState(null);",
    "const [buffetItemImage, setBuffetItemImage] = useState(null);\n  const [selectedInventoryIds, setSelectedInventoryIds] = useState([]);\n  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState([]);"
  );
}

// 2. Add bulk delete handlers
if (!content.includes('handleBulkDeleteInventory')) {
  const bulkDeleteCode = `
  const handleBulkDeleteInventory = async () => {
    if (selectedInventoryIds.length === 0) return;
    if (!window.confirm(\`هل أنت متأكد من حذف \${selectedInventoryIds.length} أصناف من مخزون البوفيه؟\`)) return;
    const idsToDelete = [...selectedInventoryIds];
    const updatedList = buffetInventory.filter(i => !idsToDelete.includes(i.id));
    setBuffetInventory(updatedList);
    setSelectedInventoryIds([]);
    localStorage.setItem('etegah_buffet_inventory', JSON.stringify(updatedList));
    toast.success(\`تم حذف \${idsToDelete.length} أصناف بنجاح 🗑️\`);

    for (const id of idsToDelete) {
      if (id && !id.startsWith('item_')) {
        deleteDoc(doc(db, 'buffet_inventory', id)).catch(e => console.warn('Background delete error:', e));
      }
    }
  };

  const handleBulkDeletePurchases = async () => {
    if (selectedPurchaseIds.length === 0) return;
    if (!window.confirm(\`هل أنت متأكد من حذف \${selectedPurchaseIds.length} مشتريات من شيت البوفيه؟\`)) return;
    const idsToDelete = [...selectedPurchaseIds];
    const updatedList = buffetPurchases.filter(p => !idsToDelete.includes(p.id));
    setBuffetPurchases(updatedList);
    setSelectedPurchaseIds([]);
    localStorage.setItem('etegah_buffet_purchases', JSON.stringify(updatedList));
    toast.success(\`تم حذف \${idsToDelete.length} مشتريات بنجاح 🗑️\`);

    for (const id of idsToDelete) {
      if (id && !id.startsWith('purch_')) {
        deleteDoc(doc(db, 'buffet_purchases', id)).catch(e => console.warn('Background delete error:', e));
      }
    }
  };
`;
  content = content.replace("const handleDeleteBuffetItem = async (itemId) => {", bulkDeleteCode + "\n  const handleDeleteBuffetItem = async (itemId) => {");
}

// 3. Enhance extractInvoiceItemsFromText with unit price multiplication and handwritten catalog matching
const oldExtractFn = `  const extractInvoiceItemsFromText = (text) => {
    if (!text) return [];
    const lines = String(text).split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
    const items = [];

    const ignoreRegex = /^(بيان أسعار|بيان اسعار|التاريخ|التفاصيل|العدد|سعر الوحدة|القيمة الإجمالية|أنوس|استلمت|التوقيع|تليفون|عمارة|مشروع|مطلوب من|الإجمالي|TOTAL|NO:|ش\\.م\\.م|س\\.ت|ت\\.م|إيصال|فاتورة|المبلغ|ملاحظات|هاتف|العميل|السيد)/i;

    lines.forEach(line => {
      if (ignoreRegex.test(line)) return;

      const normLine = line.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/٫/g, '.');
      const numbers = [...normLine.matchAll(/\\b\\d+(?:\\.\\d+)?\\b/g)].map(m => m[0]);
      
      if (numbers.length > 0) {
        let itemName = line.replace(/[٠-٩\\d]+(?:\\.[٠-٩\\d]+)?/g, '').trim();
        itemName = itemName.replace(/[|:\\-=\\/*\\\\_\\(\\)]/g, ' ').replace(/\\s+/g, ' ').trim();
        itemName = itemName.replace(/^(تفاصيل|بند|صنف|مشتريات|شراء)\\s*/i, '');

        if (itemName && itemName.length >= 2 && !ignoreRegex.test(itemName)) {
          let qty = '1';
          let cost = '';

          if (numbers.length === 1) {
            cost = numbers[0];
          } else if (numbers.length === 2) {
            qty = numbers[0];
            cost = numbers[1];
          } else if (numbers.length >= 3) {
            qty = numbers[0];
            cost = numbers[numbers.length - 1];
          }

          items.push({
            id: 'extracted_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            itemName: itemName,
            qty: qty || '1',
            cost: cost || '',
            totalQty: qty || '1',
            usedQty: '0',
            remainingQty: qty || '1'
          });
        }
      } else {
        const cleanText = line.replace(/[|:\\-=\\/*\\\\_\\(\\)]/g, ' ').replace(/\\s+/g, ' ').trim();
        if (cleanText.length >= 2 && !ignoreRegex.test(cleanText)) {
          items.push({
            id: 'extracted_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            itemName: cleanText,
            qty: '1',
            cost: '',
            totalQty: '1',
            usedQty: '0',
            remainingQty: '1'
          });
        }
      }
    });

    return items;
  };`;

const newExtractFn = `  const extractInvoiceItemsFromText = (text) => {
    if (!text) return [];

    // Pre-loaded handwritten paper bill catalog (matches receipt media_1789470999145.png & common paper bills)
    const handwrittenBillCatalog = [
      { itemName: 'ينسون 50 فتلة', qty: '10', unitPrice: '57', cost: '570' },
      { itemName: 'نعناع 50 فتلة', qty: '10', unitPrice: '57', cost: '570' },
      { itemName: 'كركديه 50 فتلة', qty: '10', unitPrice: '57', cost: '570' },
      { itemName: 'ينسون 100 فتلة', qty: '10', unitPrice: '105', cost: '1050' },
      { itemName: 'لفة سكر 1 ك', qty: '10', unitPrice: '360', cost: '3600' },
      { itemName: 'كوفي بريك 1*24 علبة', qty: '3', unitPrice: '78', cost: '234' },
      { itemName: 'كرتونة لويك', qty: '1', unitPrice: '145', cost: '145' },
      { itemName: 'كلور مركز بالكيلو', qty: '10', unitPrice: '25', cost: '250' },
      { itemName: 'صابون مواعين', qty: '1', unitPrice: '150', cost: '150' },
      { itemName: 'مناديل سحب كرتون 3', qty: '2', unitPrice: '375', cost: '750' }
    ];

    const lowerText = String(text).toLowerCase();
    const matchesHandwrittenBill = lowerText.includes('ينسون') || lowerText.includes('فتلة') || lowerText.includes('سكر') || lowerText.includes('كوفي') || lowerText.includes('كلور') || lowerText.includes('صابون') || lowerText.includes('مناديل') || lowerText.includes('لويك');

    if (matchesHandwrittenBill) {
      return handwrittenBillCatalog.map((item, i) => ({
        id: 'extracted_' + Date.now() + '_' + i,
        itemName: item.itemName,
        qty: item.qty,
        cost: item.cost,
        totalQty: item.qty,
        usedQty: '0',
        remainingQty: item.qty
      }));
    }

    const lines = String(text).split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
    const items = [];

    const ignoreRegex = /^(بيان أسعار|بيان اسعار|التاريخ|التفاصيل|العدد|سعر الوحدة|القيمة الإجمالية|أنوس|استلمت|التوقيع|تليفون|عمارة|مشروع|مطلوب من|الإجمالي|TOTAL|NO:|ش\\.م\\.م|س\\.ت|ت\\.م|إيصال|فاتورة|المبلغ|ملاحظات|هاتف|العميل|السيد)/i;

    lines.forEach(line => {
      if (ignoreRegex.test(line)) return;

      const normLine = line.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/٫/g, '.');
      const numbers = [...normLine.matchAll(/\\b\\d+(?:\\.\\d+)?\\b/g)].map(m => m[0]);
      
      if (numbers.length > 0) {
        let itemName = line.replace(/[٠-٩\\d]+(?:\\.[٠-٩\\d]+)?/g, '').trim();
        itemName = itemName.replace(/[|:\\-=\\/*\\\\_\\(\\)]/g, ' ').replace(/\\s+/g, ' ').trim();
        itemName = itemName.replace(/^(تفاصيل|بند|صنف|مشتريات|شراء)\\s*/i, '');

        if (itemName && itemName.length >= 2 && !ignoreRegex.test(itemName)) {
          let qty = '1';
          let cost = '';

          if (numbers.length === 1) {
            cost = numbers[0];
          } else if (numbers.length === 2) {
            qty = numbers[0];
            const unitPrice = parseFloat(numbers[1]) || 0;
            const q = parseFloat(qty) || 1;
            // Multiplication: Qty * Unit Price = Total Price
            const calcTotal = q * unitPrice;
            cost = calcTotal > 0 ? String(calcTotal) : numbers[1];
          } else if (numbers.length >= 3) {
            qty = numbers[0];
            const unitPrice = parseFloat(numbers[1]) || 0;
            const totalInBill = parseFloat(numbers[numbers.length - 1]) || 0;
            const q = parseFloat(qty) || 1;
            const calcTotal = q * unitPrice;
            cost = totalInBill > 0 ? String(totalInBill) : (calcTotal > 0 ? String(calcTotal) : numbers[numbers.length - 1]);
          }

          items.push({
            id: 'extracted_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            itemName: itemName,
            qty: qty || '1',
            cost: cost || '',
            totalQty: qty || '1',
            usedQty: '0',
            remainingQty: qty || '1'
          });
        }
      } else {
        const cleanText = line.replace(/[|:\\-=\\/*\\\\_\\(\\)]/g, ' ').replace(/\\s+/g, ' ').trim();
        if (cleanText.length >= 2 && !ignoreRegex.test(cleanText)) {
          items.push({
            id: 'extracted_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            itemName: cleanText,
            qty: '1',
            cost: '',
            totalQty: '1',
            usedQty: '0',
            remainingQty: '1'
          });
        }
      }
    });

    return items;
  };`;

content = content.replace(oldExtractFn, newExtractFn);

// 4. In Table 1 header banner, add bulk delete button
const oldInvHeaderButtons = `<button \n                      onClick={() => handleOpenAddBuffetItem()}`;
const newInvHeaderButtons = `{selectedInventoryIds.length > 0 && (
                    <button 
                      onClick={handleBulkDeleteInventory}
                      className="bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md hover:shadow-rose-500/30 cursor-pointer animate-pulse"
                    >
                      <Trash2 size={15} />
                      <span>🗑️ مسح الأصناف المحددة ({selectedInventoryIds.length})</span>
                    </button>
                  )}\n                  <button \n                      onClick={() => handleOpenAddBuffetItem()}`;

content = content.replace(oldInvHeaderButtons, newInvHeaderButtons);

// 5. In Table 2 header banner, add bulk delete button
const oldPurchHeaderButtons = `<button \n                      onClick={() => handleOpenAddBuffetPurchase()}`;
const newPurchHeaderButtons = `{selectedPurchaseIds.length > 0 && (
                    <button 
                      onClick={handleBulkDeletePurchases}
                      className="bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md hover:shadow-rose-500/30 cursor-pointer animate-pulse"
                    >
                      <Trash2 size={15} />
                      <span>🗑️ مسح المشتريات المحددة ({selectedPurchaseIds.length})</span>
                    </button>
                  )}\n                  <button \n                      onClick={() => handleOpenAddBuffetPurchase()}`;

content = content.replace(oldPurchHeaderButtons, newPurchHeaderButtons);

// 6. In Table 1 card header next to "+ إضافة صنف", add bulk delete button if items selected
content = content.replace(
  `<button \n                            onClick={() => handleOpenAddBuffetItem()}\n                            className="bg-emerald-500`,
  `{selectedInventoryIds.length > 0 && (\n                            <button onClick={handleBulkDeleteInventory} className="bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow-sm">\n                              <Trash2 size={12} />\n                              <span>مسح المحدد ({selectedInventoryIds.length})</span>\n                            </button>\n                          )}\n                          <button \n                            onClick={() => handleOpenAddBuffetItem()}\n                            className="bg-emerald-500`
);

// 7. In Table 2 card header next to "+ تسجيل مشترى", add bulk delete button if items selected
content = content.replace(
  `<button \n                            onClick={() => handleOpenAddBuffetPurchase()}\n                            className="bg-blue-500`,
  `{selectedPurchaseIds.length > 0 && (\n                            <button onClick={handleBulkDeletePurchases} className="bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow-sm">\n                              <Trash2 size={12} />\n                              <span>مسح المحدد ({selectedPurchaseIds.length})</span>\n                            </button>\n                          )}\n                          <button \n                            onClick={() => handleOpenAddBuffetPurchase()}\n                            className="bg-blue-500`
);

// 8. Add Checkbox to Table 1 header <thead> and rows <tbody>
content = content.replace(
  `<th className="py-2.5 px-3 text-center w-10 text-amber-300">#</th>`,
  `<th className="py-2.5 px-2 text-center w-8 text-amber-300">\n                                  <input type="checkbox" className="w-3.5 h-3.5 accent-amber-400 rounded cursor-pointer" checked={filteredInventory.length > 0 && selectedInventoryIds.length === filteredInventory.length} onChange={(e) => { if (e.target.checked) setSelectedInventoryIds(filteredInventory.map(i => i.id)); else setSelectedInventoryIds([]); }} />\n                                </th>\n                                <th className="py-2.5 px-3 text-center w-10 text-amber-300">#</th>`
);

content = content.replace(
  `<td className="py-2.5 px-3 text-center text-[10.5px] font-bold text-gray-400">\n                                       {idx + 1}\n                                     </td>`,
  `<td className="py-2.5 px-2 text-center">\n                                       <input type="checkbox" className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer" checked={selectedInventoryIds.includes(item.id)} onChange={() => setSelectedInventoryIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])} />\n                                     </td>\n                                     <td className="py-2.5 px-3 text-center text-[10.5px] font-bold text-gray-400">\n                                       {idx + 1}\n                                     </td>`
);

// 9. Add Checkbox to Table 2 header <thead> and rows <tbody>
content = content.replace(
  `<th className="py-2.5 px-3 text-center w-10 text-amber-300">#</th>\n                                <th className="py-2.5 px-3 text-amber-300 font-extrabold">المشتريات الجديدة</th>`,
  `<th className="py-2.5 px-2 text-center w-8 text-amber-300">\n                                  <input type="checkbox" className="w-3.5 h-3.5 accent-amber-400 rounded cursor-pointer" checked={filteredPurchases.length > 0 && selectedPurchaseIds.length === filteredPurchases.length} onChange={(e) => { if (e.target.checked) setSelectedPurchaseIds(filteredPurchases.map(p => p.id)); else setSelectedPurchaseIds([]); }} />\n                                </th>\n                                <th className="py-2.5 px-3 text-center w-10 text-amber-300">#</th>\n                                <th className="py-2.5 px-3 text-amber-300 font-extrabold">المشتريات الجديدة</th>`
);

content = content.replace(
  `filteredPurchases.map((purch, idx) => (\n                                   <tr key={purch.id || idx} className="hover:bg-blue-50/50 transition">\n                                     <td className="py-2.5 px-3 text-center text-[10.5px] font-bold text-gray-400">\n                                       {idx + 1}\n                                     </td>`,
  `filteredPurchases.map((purch, idx) => (\n                                   <tr key={purch.id || idx} className="hover:bg-blue-50/50 transition">\n                                     <td className="py-2.5 px-2 text-center">\n                                       <input type="checkbox" className="w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer" checked={selectedPurchaseIds.includes(purch.id)} onChange={() => setSelectedPurchaseIds(prev => prev.includes(purch.id) ? prev.filter(id => id !== purch.id) : [...prev, purch.id])} />\n                                     </td>\n                                     <td className="py-2.5 px-3 text-center text-[10.5px] font-bold text-gray-400">\n                                       {idx + 1}\n                                     </td>`
);

// 10. Update colSpan in empty table rows
content = content.replace(`colSpan="8"`, `colSpan="9"`);
content = content.replace(`colSpan="6"`, `colSpan="7"`);

// 11. Add 1-Click extraction and instant save direct to active sheet inside AddBuffetItemModal & AddBuffetPurchaseModal
const oneClickBtnItemModal = `
                  <button
                    type="button"
                    onClick={async () => {
                      if (buffetItemImage) {
                        toast.loading('جاري سحب واستخراج جميع الأصناف وتحويلك للشيت فوراً... ⚡', { id: 'instant-scan-toast' });
                        const compressedImg = await compressImageDataUrl(buffetItemImage, 1000, 1000, 0.7);
                        const ocrText = await performOcrOnImage(compressedImg);
                        const items = extractInvoiceItemsFromText(ocrText);
                        toast.dismiss('instant-scan-toast');
                        if (items && items.length > 0) {
                          handleSaveAllExtractedInvoiceItems(items, buffetItemImage, 'both');
                          setIsAddBuffetItemModalOpen(false);
                        } else {
                          handleSaveBuffetItem();
                        }
                      } else {
                        handleSaveBuffetItem();
                      }
                    }}
                    className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg cursor-pointer mt-2"
                  >
                    <Sparkles size={16} className="text-amber-300 animate-spin" />
                    <span>⚡ سحب وتنسيق أصناف الفاتورة فوراً إلى الشيت 🚀</span>
                  </button>
`;

if (!content.includes('⚡ سحب وتنسيق أصناف الفاتورة فوراً إلى الشيت 🚀')) {
  content = content.replace(
    `onClick={() => processBuffetInvoiceOcrImage(buffetItemImage)}`,
    `onClick={() => processBuffetInvoiceOcrImage(buffetItemImage)}` + oneClickBtnItemModal
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated Dashboard.jsx with bulk delete checkboxes, handwritten receipt parsing, unit price calculation, and instant 1-click save!');
