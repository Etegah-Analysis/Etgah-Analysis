const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/Dashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

// 1. Update handleModalPasteBuffetItem to use fixed toast ID & prevent duplicate messages
const oldModalPasteFn = `const handleModalPasteBuffetItem = (e) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
              setBuffetItemImage(reader.result);
              toast.success('تم لزق الصورة من الحافظة بنجاح 📋📸');
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    }
  };`;

const newModalPasteFn = `const handleModalPasteBuffetItem = (e) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            if (e && e.stopPropagation) e.stopPropagation();
            const reader = new FileReader();
            reader.onloadend = () => {
              setBuffetItemImage(reader.result);
              toast.success('تم لصق صورة الفاتورة بنجاح 🖼️✨', { id: 'single-buffet-paste-toast' });
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    }
  };`;

if (content.includes(oldModalPasteFn)) {
  content = content.replace(oldModalPasteFn, newModalPasteFn);
  console.log('Successfully updated handleModalPasteBuffetItem!');
}

// 2. Update handleModalPasteBuffetPurchase to use fixed toast ID
const oldPurchPasteFn = `const handleModalPasteBuffetPurchase = (e) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
              setBuffetPurchaseImage(reader.result);
              toast.success('تم لزق الصورة من الحافظة بنجاح 📋📸');
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    }
  };`;

const newPurchPasteFn = `const handleModalPasteBuffetPurchase = (e) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            if (e && e.stopPropagation) e.stopPropagation();
            const reader = new FileReader();
            reader.onloadend = () => {
              setBuffetPurchaseImage(reader.result);
              toast.success('تم لصق صورة الفاتورة بنجاح 🖼️✨', { id: 'single-buffet-paste-toast' });
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    }
  };`;

if (content.includes(oldPurchPasteFn)) {
  content = content.replace(oldPurchPasteFn, newPurchPasteFn);
  console.log('Successfully updated handleModalPasteBuffetPurchase!');
}

// 3. Replace all remaining toast.success messages in paste handlers with single fixed toast ID & stopPropagation
content = content.replace(
  /toast\.success\('تم لصق صورة\/سكرين شوت الفاتورة بنجاح[^']*'\);/g,
  "toast.success('تم لصق صورة الفاتورة بنجاح 🖼️✨', { id: 'single-buffet-paste-toast' });"
);

content = content.replace(
  /toast\.success\('تم لصق صورة\/سكرين شوت الصنف بنجاح[^']*'\);/g,
  "toast.success('تم لصق صورة الفاتورة بنجاح 🖼️✨', { id: 'single-buffet-paste-toast' });"
);

content = content.replace(
  /toast\.success\('تم إرفاق صورة الفاتورة 🖼️[^']*'\);/g,
  "toast.success('تم إرفاق صورة الفاتورة بنجاح 🖼️✨', { id: 'single-buffet-paste-toast' });"
);

// Add stopPropagation to paste events in JSX
content = content.replace(/onPaste=\{\(e\) => \{/g, "onPaste={(e) => { if (e && e.stopPropagation) e.stopPropagation();");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully guaranteed single clean toast message on paste!');
