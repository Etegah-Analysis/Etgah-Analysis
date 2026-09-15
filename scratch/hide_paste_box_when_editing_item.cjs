const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/Dashboard.jsx');
let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

const oldImageBlockStart = "                {/* Clean Image Attachment / Paste Support */}\n                <div>\n                  <label className=\"block text-xs font-bold text-emerald-300 mb-1\">مكان لصق صورة أو نص الفاتورة (Ctrl + V / اختيار ملف)</label>";

const newImageBlockStart = "                {/* Clean Image Attachment / Paste Support - Only shown when adding a NEW item */}\n                {!editingBuffetItem && (\n                <div>\n                  <label className=\"block text-xs font-bold text-emerald-300 mb-1\">مكان لصق صورة أو نص الفاتورة (Ctrl + V / اختيار ملف)</label>";

const oldImageBlockEnd = "                      </div>\n                    </div>\n                  )}\n                </div>\n\n                <div className=\"flex items-center justify-end gap-2 pt-3 border-t border-gray-800\">";

const newImageBlockEnd = "                      </div>\n                    </div>\n                  )}\n                </div>\n                )}\n\n                <div className=\"flex items-center justify-end gap-2 pt-3 border-t border-gray-800\">";

if (content.includes(oldImageBlockStart) && content.includes(oldImageBlockEnd)) {
  content = content.replace(oldImageBlockStart, newImageBlockStart);
  content = content.replace(oldImageBlockEnd, newImageBlockEnd);
  console.log('Successfully hidden paste box and image preview when editing existing item!');
} else {
  console.error('Could not find image block start or end in Dashboard.jsx');
}

fs.writeFileSync(filePath, content, 'utf8');
