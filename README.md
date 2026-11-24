# ShopFlow

واجهة عربية RTL لإدارة المتجر، مع تسجيل حسابات وتجربة مجانية مدتها 48 ساعة تبدأ فقط عندما يضغط المستخدم على زر البدء.

## التشغيل المحلي

```bash
npm install
cp .env.example .env
npm run dev
```

أضف بيانات مشروع Supabase إلى ملف `.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## إعداد Supabase

1. أنشئ مشروعًا في Supabase.
2. افتح SQL Editor.
3. نفّذ محتوى الملف `supabase/schema.sql`.
4. من Authentication > Providers فعّل Email.
5. أضف متغيري البيئة السابقين في Vercel لكل من Production وPreview وDevelopment.

## منطق التجربة

- يبدأ الوقت عند أول استدعاء ناجح لـ `start_my_trial()` بعد ضغط المستخدم.
- قيد المفتاح الأساسي `user_id` يمنع إنشاء تجربة ثانية للحساب نفسه.
- وقت البداية محفوظ في قاعدة البيانات، لذلك لا يتغير بتسجيل الخروج أو الدخول.
- انتهاء الصلاحية يُحسب من وقت البداية + 48 ساعة.

## النشر على Vercel

المشروع مبني باستخدام Vite. اربط مستودع GitHub هذا في Vercel، وسيتم اكتشاف إعدادات Vite تلقائيًا. أضف متغيرات Supabase قبل إتمام النشر.
