# مدرسة أرشى أنجيلوس للشمامسة

تحتفظ هذه النسخة بالموقع الثابت الحالي باللغتين، وتربطه بخدمة Cloudflare Worker وقاعدة D1 وحاوية R2 الموجودين بالفعل.

## النشر

### واجهة GitHub Pages

انشر محتويات هذا المجلد في جذر مستودع GitHub Pages الحالي. أبقِ `index.html` و`app.js` و`localization.js` و`styles.css` و`sw.js` وملفات manifest ومجلد `assets/` معًا. لا تحتاج الواجهة إلى خطوة بناء. عنوان API مضبوط مسبقًا على:

`https://archangelos-deacons-api-2026.archangelosschoolofdeacons.workers.dev`

### Cloudflare Worker

يوجد إعداد النشر في `worker/wrangler.toml`. قبل النشر، استبدل `REPLACE_WITH_EXISTING_DATABASE_ID` بمعرّف قاعدة `archangelos-content` الموجودة. لا تنشئ قاعدة D1 أو حاوية R2 إضافية. تأكد من أن الربطين هما `DB` مع `archangelos-content` و`MEDIA` مع `archangelos-media`.

من مجلد `worker` وباستخدام Node.js 20 أو أحدث:

```powershell
npm install
npx wrangler whoami
npx wrangler deploy
```

عند إعادة نشر Worker نفسه، تبقى قيمة السر الحالية `ADMIN_PASSWORD`. تحقق من وجودها في لوحة Cloudflare أو باستخدام `npx wrangler secret list`. استخدم `npx wrangler secret put ADMIN_PASSWORD` فقط إذا كانت مفقودة أو يلزم تغييرها؛ سيطلب Wrangler القيمة تفاعليًا. لا تضعها في هذا المستودع أو في كود الواجهة. اسم المستخدم `admin` وأصل GitHub Pages المحدد متغيران عاديان في `wrangler.toml`.

يخدم Worker واجهات API والملفات، بينما يخدم GitHub Pages الواجهة الثابتة فقط. ملفات `server.py` وإعدادات Render وVercel القديمة ليست جزءًا من هذا النشر.

## قاعدة البيانات والإجراءات اليدوية

لا تُحذف المواد الحالية ولا توجد ترحيلة لجدول الموارد. يقرأ Worker أعمدة `resources` الحالية ويكتب `id` و`title` و`description` و`grade_id` و`subject_id` و`term_id` و`kind` و`url` و`file_name` و`updated_at`.

يستخدم الرفع أعمدة `uploads` الحالية: `id` و`objectKey` و`uploadId` و`metadataJson` و`expectedSize` و`contentType` و`createdAt` و`owner`، وأعمدة `upload_parts`: `uploadId` و`partNumber` و`etag`. لا تحتاج هذه الجداول إلى ترحيلة إذا كانت أعمدتها كما وردت.

يفحص Worker أعمدة `admin_sessions` ويدعم أسماء شائعة لمعرّف الجلسة وبصمة CSRF ووقت الانتهاء. افحص الجدول أولًا عبر `PRAGMA table_info(admin_sessions);`. إذا كانت الأعمدة الثلاثة التالية غير موجودة، أضفها فقط:

```sql
ALTER TABLE admin_sessions ADD COLUMN tokenHash TEXT;
ALTER TABLE admin_sessions ADD COLUMN csrfToken TEXT;
ALTER TABLE admin_sessions ADD COLUMN expiresAt TEXT;
```

إذا لم يكن الجدول نفسه موجودًا، أنشئ `admin_sessions` بهذا الشكل بدل إنشاء جدول جلسات آخر:

```sql
CREATE TABLE admin_sessions (
  tokenHash TEXT PRIMARY KEY,
  csrfToken TEXT NOT NULL,
  username TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
```

لا تنفّذ `ALTER TABLE` لعمود موجود. لا تتطلب هذه النسخة ترحيلات SQL أخرى.

## حدود الرفع

يرسل المتصفح أجزاء الملف بالتتابع، عادةً بحجم 8 MiB. يرفع Worker حجم الجزء تدريجيًا للملفات الكبيرة حتى 64 MiB كي لا يتجاوز حد R2 البالغ 10,000 جزء. الحد المضبوط في التطبيق هو 625 GiB، لكنه ليس ضمانًا بأن خطة الحساب قادرة على تخزين هذا الحجم أو تقديمه. توثّق Cloudflare حدًا أدنى قدره 5 MiB للجزء (باستثناء الأخير)، وحدًا أقصى 5 GiB للجزء، و10,000 جزء، وحجمًا أقصى قدره 5 TiB للكائن متعدد الأجزاء. [توثيق R2](https://developers.cloudflare.com/r2/objects/upload-objects/)

لا يرسل Worker الفيديو كاملًا في طلب واحد. يختلف حد جسم الطلب حسب خطة Cloudflare (حاليًا 100 MB لـ Free وPro، و200 MB لـ Business، وحتى 5 GB لـ Enterprise). تظل حدود الحساب والحصص والتخزين والعمليات والنطاق الترددي سارية. حجم الجزء الأقصى هنا 64 MiB، لكن راجع إعدادات الحساب الحالية قبل نشر ملفات كبيرة. [حدود Workers](https://developers.cloudflare.com/workers/platform/limits/)

## الفحوصات المحلية

```powershell
cd worker
npm test
npm run check
```

طلبات قراءة الموارد والوسائط عامة ولا تحمل بيانات اعتماد المسؤول. تحفظ الواجهة رمز Bearer ورمز CSRF في `sessionStorage` الخاص بعلامة التبويب، ويتحقق Worker من كل عملية كتابة. كلمة المرور لا تدخل في ملفات الواجهة.
