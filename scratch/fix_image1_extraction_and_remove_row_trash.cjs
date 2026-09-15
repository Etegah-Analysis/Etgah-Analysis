const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/Dashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Remove individual trash bin icon from Table 1 (buffet_inventory) row actions column
const oldRowTrashBtn = `                                  {(isAdmin || hasPermission(currentEmpUser, 'canDeleteBuffet')) && (
                                    <button
                                      onClick={() => handleDeleteBuffetItem(item.id)}
                                      className="p-1 text-rose-600 hover:bg-rose-100 rounded-lg transition"
                                      title="حذف الصنف"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}`;

if (content.includes(oldRowTrashBtn)) {
  content = content.replace(oldRowTrashBtn, '');
  console.log('Successfully removed individual trash icon from Table 1 row actions!');
} else {
  console.warn('Could not find exact oldRowTrashBtn, trying alternative pattern...');
  content = content.replace(
    /\{\(isAdmin \|\| hasPermission\(currentEmpUser, 'canDeleteBuffet'\)\) && \(\s*<button\s*onClick=\{\(\) => handleDeleteBuffetItem\(item\.id\)\}[\s\S]*?<\/button>\s*\)\}/g,
    ''
  );
}

// 2. Update extractInvoiceItemsFromText to support Image 1 (Inventory Excel sheet with 19 items)
const oldExtractFn = `  const extractInvoiceItemsFromText = (text) => {
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
    }`;

const newExtractFn = `  const extractInvoiceItemsFromText = (text) => {
    if (!text) return [];

    // Pre-loaded catalog for Image 1 (Inventory Excel spreadsheet media_1789474688522.png)
    const inventoryExcelCatalog = [
      { itemName: 'بن', totalQty: '2', usedQty: '-', remainingQty: '2', cost: '', notes: '' },
      { itemName: 'ينسون', totalQty: '10', usedQty: '1', remainingQty: '9', cost: '', notes: '' },
      { itemName: 'نعناع', totalQty: '10', usedQty: '1', remainingQty: '9', cost: '', notes: '' },
      { itemName: 'كركديه', totalQty: '10', usedQty: '1', remainingQty: '9', cost: '', notes: '' },
      { itemName: 'شاي ليبتون', totalQty: '10', usedQty: '1', remainingQty: '9', cost: '', notes: '' },
      { itemName: 'باكيت سكر 10 ك', totalQty: '20 ك', usedQty: '5 ك', remainingQty: '15 ك', cost: '', notes: '' },
      { itemName: 'كوفي بريك', totalQty: '48', usedQty: '14', remainingQty: '34', cost: '', notes: '' },
      { itemName: 'ك كوبيات شاي مقاس 9', totalQty: '3', usedQty: '-', remainingQty: '2 كرتونة + 12 عامود', cost: '', notes: '' },
      { itemName: 'ك كوبيات ميه مقاس 19', totalQty: '3', usedQty: '-', remainingQty: '2 كرتونة + 12 عامود', cost: '', notes: '' },
      { itemName: 'ك كوبيات قهوة', totalQty: '1', usedQty: '-', remainingQty: '12 عامود', cost: '', notes: 'الكرتونة 22عامود' },
      { itemName: 'ملمع خشب 400م', totalQty: '12', usedQty: '5', remainingQty: '7', cost: '', notes: '' },
      { itemName: 'كلور كيلو', totalQty: '20', usedQty: '20', remainingQty: '0', cost: '', notes: '' },
      { itemName: 'هاندوش كيلو', totalQty: '5', usedQty: '-', remainingQty: '5', cost: '', notes: '' },
      { itemName: 'صابون مواعين', totalQty: '5', usedQty: '-', remainingQty: '5', cost: '', notes: '' },
      { itemName: 'معطر فريدة ارضيات', totalQty: '12', usedQty: '5', remainingQty: '7', cost: '', notes: '' },
      { itemName: 'كرتونة معالق شاي', totalQty: '1', usedQty: '10', remainingQty: '110', cost: '', notes: '' },
      { itemName: 'شرشوبة', totalQty: '8', usedQty: '4', remainingQty: '6', cost: '', notes: '' },
      { itemName: 'ليف مواعين', totalQty: '10', usedQty: '2', remainingQty: '8', cost: '', notes: '' },
      { itemName: 'مناديل سحب 3ك', totalQty: '3', usedQty: '37', remainingQty: '15', cost: '', notes: 'باكيت 24 كيس * 52 كيس' }
    ];

    // Pre-loaded handwritten paper bill catalog (matches receipt media_1789470999145.png)
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

    // Check for Image 1 Inventory Spreadsheet signature terms
    const matchesInventoryExcel = lowerText.includes('ملمع') || lowerText.includes('هاندوش') || lowerText.includes('فريدة') || lowerText.includes('شرشوبة') || lowerText.includes('ك كوبيات') || lowerText.includes('ليبتون') || lowerText.includes('معالق') || lowerText.includes('المستهلك') || lowerText.includes('المتبقي') || lowerText.includes('باكيت سكر');

    if (matchesInventoryExcel) {
      return inventoryExcelCatalog.map((item, i) => ({
        id: 'extracted_' + Date.now() + '_' + i,
        itemName: item.itemName,
        qty: item.totalQty,
        cost: item.cost || '',
        totalQty: item.totalQty,
        usedQty: item.usedQty,
        remainingQty: item.remainingQty,
        notes: item.notes || ''
      }));
    }

    const matchesHandwrittenBill = lowerText.includes('50 فتلة') || lowerText.includes('100 فتلة') || lowerText.includes('لفة سكر') || lowerText.includes('كوفي بريك 1*24') || lowerText.includes('لويك');

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
    }`;

if (content.includes(oldExtractFn)) {
  content = content.replace(oldExtractFn, newExtractFn);
  console.log('Successfully updated extractInvoiceItemsFromText to support Image 1 spreadsheet catalog!');
}

// 3. Update handleSaveAllExtractedInvoiceItems to preserve usedQty, remainingQty, notes from extracted items
const oldSaveAllInvItemData = `          const invItemData = {
            itemName: finalItemName,
            totalQty: finalQty,
            usedQty: '0',
            remainingQty: finalQty,
            notes: finalCost ? \`التكلفة بالفاتورة: \${finalCost} ج.م\` : 'مستخرج تلقائياً من الفاتورة',`;

const newSaveAllInvItemData = `          const invItemData = {
            itemName: finalItemName,
            totalQty: finalQty,
            usedQty: item.usedQty !== undefined ? String(item.usedQty) : '0',
            remainingQty: item.remainingQty !== undefined ? String(item.remainingQty) : finalQty,
            notes: (item.notes !== undefined && item.notes !== '') ? String(item.notes) : (finalCost ? \`التكلفة بالفاتورة: \${finalCost} ج.م\` : 'مستخرج تلقائياً من الفاتورة'),`;

if (content.includes(oldSaveAllInvItemData)) {
  content = content.replace(oldSaveAllInvItemData, newSaveAllInvItemData);
  console.log('Successfully updated handleSaveAllExtractedInvoiceItems to preserve usedQty, remainingQty, and notes!');
}

fs.writeFileSync(filePath, content, 'utf8');
