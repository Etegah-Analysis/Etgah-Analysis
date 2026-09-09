/**
 * ===================================================
 *  نسخه من جميع بيانات الداش firbase
 *  Firebase Full Dashboard Backup - Real-Time Watcher
 * ===================================================
 * يقوم هذا السكريبت بـ:
 *   1. الاتصال بـ Firebase Admin باستخدام مفاتيح المشروع
 *   2. مراقبة جميع مجموعات البيانات في الداش بشكل فوري (Real-Time)
 *   3. حفظ نسخة JSON كاملة في مجلد "نسخه من جميع بيانات الداش firbase"
 *   4. التحديث التلقائي في كل مرة تُضاف أو تُعدَّل أي بيانات
 *
 * طريقة التشغيل:
 *   - انقر مرتين على ملف: start_backup.bat
 *   - أو شغّل في Terminal: node backup_firebase.mjs
 *
 * لإيقاف المراقبة: اضغط Ctrl+C
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── إعداد Firebase Admin من ملف service account ────────────────────────────
let db;
try {
  // قراءة مفتاح الخدمة من ملف JSON المحفوظ بجانب السكريبت
  const keyPath = path.join(__dirname, 'api', 'serviceAccountKey.json');
  
  if (!fs.existsSync(keyPath)) {
    console.error('\n❌ لم يتم العثور على ملف مفتاح الخدمة!');
    console.error('📋 الخطوات المطلوبة لإعداد النسخ الاحتياطي:');
    console.error('   1. افتح Firebase Console: https://console.firebase.google.com/project/etegah-dafe5');
    console.error('   2. اذهب إلى: Project Settings → Service accounts');
    console.error('   3. اضغط "Generate new private key" → احفظ الملف بالاسم: serviceAccountKey.json');
    console.error(`   4. ضع الملف هنا: ${keyPath}`);
    console.error('   5. شغّل السكريبت مجدداً\n');
    
    // إنشاء ملف README للمساعدة
    const readmePath = path.join(__dirname, 'BACKUP_SETUP.txt');
    fs.writeFileSync(readmePath, `
نسخه من جميع بيانات الداش firbase - خطوات الإعداد
================================================

لتشغيل النسخ الاحتياطي التلقائي، اتبع الخطوات التالية:

1. افتح Firebase Console:
   https://console.firebase.google.com/project/etegah-dafe5/settings/serviceaccounts/adminsdk

2. اضغط على: "Generate new private key"

3. سيتم تنزيل ملف JSON تلقائياً

4. أعد تسمية الملف إلى: serviceAccountKey.json

5. انسخ الملف إلى المسار:
   ${keyPath}

6. انقر مرتين على: start_backup.bat

بعد التشغيل سيتم إنشاء مجلد:
"نسخه من جميع بيانات الداش firbase"
ويحتوي على جميع بيانات الداش محدّثة تلقائياً.
`, 'utf-8');
    
    console.log(`📄 تم إنشاء ملف تعليمات: BACKUP_SETUP.txt`);
    process.exit(1);
  }

  const saKey = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
  if (!getApps().length) {
    initializeApp({ credential: cert(saKey) });
  }
  db = getFirestore();
  console.log('✅ اتصال Firebase Admin ناجح - etegah-dafe5');
} catch (err) {
  console.error('❌ فشل الاتصال بـ Firebase:', err.message);
  process.exit(1);
}

// ─── إعداد مجلد النسخ الاحتياطي ──────────────────────────────────────────────
const BACKUP_DIR = path.join(__dirname, 'نسخه من جميع بيانات الداش firbase');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`📁 تم إنشاء مجلد النسخ الاحتياطي: ${BACKUP_DIR}`);
}

// ─── قائمة جميع مجموعات الداش ────────────────────────────────────────────────
const COLLECTIONS = [
  { id: 'leads_crm',                    name: 'Leads_CRM'               },
  { id: 'بيانات_تسجيل_العملاء',          name: 'عملاء_الداش'             },
  { id: 'users',                         name: 'الموظفين'                },
  { id: 'visitor_customers',             name: 'عملاء_الزوار'            },
  { id: 'recycle_bin',                   name: 'سلة_المهملات'            },
  { id: 'رسائل_الموظفين_للعملاء',        name: 'رسائل_الموظفين'          },
  { id: 'assignment_logs',               name: 'سجلات_التوزيع'           },
];

// ─── دالة تحويل Firestore Timestamps بشكل آمن ───────────────────────────────
function serializeDoc(docData) {
  const result = {};
  for (const [key, value] of Object.entries(docData)) {
    if (value && typeof value.toDate === 'function') {
      result[key] = value.toDate().toISOString();
    } else if (value && typeof value === 'object' && '_seconds' in value) {
      result[key] = new Date(value._seconds * 1000).toISOString();
    } else if (Array.isArray(value)) {
      result[key] = value.map(v => (v && typeof v.toDate === 'function') ? v.toDate().toISOString() : v);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── دالة حفظ البيانات ────────────────────────────────────────────────────────
const inMemoryData = {};
const unsubscribers = [];

function saveCollection(collectionId, name, docs) {
  inMemoryData[collectionId] = docs;

  const now = new Date();
  const timestamp = now.toLocaleString('ar-EG', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const output = {
    collection: collectionId,
    totalRecords: docs.length,
    lastUpdated: now.toISOString(),
    lastUpdatedArabic: timestamp,
    data: docs
  };

  const filePath = path.join(BACKUP_DIR, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf-8');
  saveIndex();
  console.log(`💾 [${timestamp}] تم تحديث: ${name} → ${docs.length} سجل`);
}

function saveIndex() {
  const index = {
    projectId: 'etegah-dafe5',
    backupName: 'نسخه من جميع بيانات الداش firbase',
    lastUpdated: new Date().toISOString(),
    collections: Object.entries(inMemoryData).map(([id, docs]) => ({
      collectionId: id,
      totalRecords: docs.length
    })),
    totalRecordsAllCollections: Object.values(inMemoryData).reduce((sum, docs) => sum + docs.length, 0)
  };
  fs.writeFileSync(path.join(BACKUP_DIR, 'INDEX.json'), JSON.stringify(index, null, 2), 'utf-8');
}

// ─── بدء المراقبة الفورية لكل مجموعة ─────────────────────────────────────────
console.log('\n🚀 بدء مراقبة Firebase Firestore...\n');

for (const col of COLLECTIONS) {
  const colRef = db.collection(col.id);

  const unsubscribe = colRef.onSnapshot(
    (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        _id: doc.id,
        ...serializeDoc(doc.data())
      }));
      saveCollection(col.id, col.name, docs);
    },
    (error) => {
      if (error.code === 5 || String(error.code) === 'NOT_FOUND') {
        console.log(`⚠️  المجموعة غير موجودة (سيتم تخطيها): ${col.id}`);
      } else {
        console.error(`❌ خطأ في مراقبة ${col.id}:`, error.message);
      }
    }
  );
  unsubscribers.push(unsubscribe);
}

console.log(`\n✅ يتم الآن مراقبة ${COLLECTIONS.length} مجموعة بيانات`);
console.log(`📂 مسار النسخ الاحتياطي:\n   ${BACKUP_DIR}`);
console.log('\n🔄 التحديث يتم تلقائياً عند أي تغيير في البيانات');
console.log('⏹️  لإيقاف المراقبة اضغط: Ctrl+C\n');

// ─── إيقاف نظيف عند الخروج ───────────────────────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n\n🛑 إيقاف المراقبة...');
  unsubscribers.forEach(fn => fn());
  console.log('✅ تم إيقاف جميع المستمعين. البيانات محفوظة بالكامل.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  unsubscribers.forEach(fn => fn());
  process.exit(0);
});
