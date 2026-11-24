import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './style.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const HOURS = 48;

function Brand() {
  return <div className="brand"><img src="/codex-logo.svg" alt="CODEX" /><span className="brand-name">ShopFlow</span><span className="brand-powered">Powered by <strong>CODEX</strong></span></div>;
}

function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [mode, setMode] = useState('login');
  const [trial, setTrial] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setTrial(null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) { loadTrial(); loadProfile(); }
  }, [session]);

  async function loadProfile() {
    setProfileLoading(true);
    const { data, error } = await supabase.from('shopflow_profiles').select('*').eq('user_id', session.user.id).maybeSingle();
    if (error) setMessage('لازم تشغّل كود إعداد ملفات المتاجر في Supabase أولاً.');
    else if (data) { setProfile(data); setStoreName(data.store_name || ''); setStoreUrl(data.store_url || ''); setLogoPreview(data.logo_url || ''); }
    setProfileLoading(false);
  }

  async function saveProfile(e) {
    e.preventDefault();
    if (!storeName.trim()) { setMessage('اكتب اسم المتجر الأول.'); return; }
    setBusy(true); setMessage('');
    let logoUrl = profile?.logo_url || '';
    try {
      if (logoFile) {
        const ext = (logoFile.name.split('.').pop() || 'png').toLowerCase();
        const path = session.user.id + '/logo-' + Date.now() + '.' + ext;
        const { error: uploadError } = await supabase.storage.from('shop-logos').upload(path, logoFile, { upsert: true, contentType: logoFile.type });
        if (uploadError) throw uploadError;
        logoUrl = supabase.storage.from('shop-logos').getPublicUrl(path).data.publicUrl;
      }
      const { data, error } = await supabase.from('shopflow_profiles').upsert({
        user_id: session.user.id, store_name: storeName.trim(),
        store_url: storeUrl.trim(), logo_url: logoUrl, updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' }).select().single();
      if (error) throw error;
      setProfile(data); setEditingProfile(false); setMessage('تم حفظ بيانات متجرك بنجاح.');
    } catch (err) {
      setMessage(err.message || 'تعذر حفظ بيانات المتجر. راجع إعدادات Supabase.');
    } finally { setBusy(false); }
  }

  async function loadTrial() {
    const { data, error } = await supabase.rpc('get_my_trial');
    if (error) setMessage('تعذر تحميل حالة التجربة. تأكد من تشغيل ملف إعداد قاعدة البيانات في Supabase.');
    else setTrial(data);
  }

  async function authenticate(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setMessage(error.message);
      } else {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) setMessage(error.message);
        else if (data.session) {
          setSession(data.session);
          setMessage('تم تأكيد الحساب بنجاح.');
        } else {
          setOtpStep(true);
          setMessage('بعتنالك رمز تأكيد من 6 أرقام على بريدك الإلكتروني. اكتبه هنا لتفعيل الحساب.');
        }
      }
    } catch {
      setMessage('حصل خطأ أثناء الاتصال. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmail(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otp.trim(), type: 'signup' });
    if (error) setMessage('رمز التأكيد غير صحيح أو انتهت صلاحيته. راجع البريد وحاول مرة أخرى.');
    else {
      setSession(data.session);
      setOtpStep(false);
      setOtp('');
      setMessage('تم تأكيد بريدك الإلكتروني وتفعيل حسابك بنجاح.');
    }
    setBusy(false);
  }

  async function resendOtp() {
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setMessage(error ? 'لم نتمكن من إعادة إرسال الرمز. حاول بعد قليل.' : 'تم إرسال رمز جديد إلى بريدك الإلكتروني.');
    setBusy(false);
  }

  async function startTrial() {
    setBusy(true); setMessage('');
    const { error } = await supabase.rpc('start_my_trial');
    if (error) setMessage('لم نتمكن من بدء التجربة. راجع إعداد قاعدة البيانات.');
    else await loadTrial();
    setBusy(false);
  }

  async function logout() { await supabase.auth.signOut(); setTrial(null); setProfile(null); }

  if (loading) return <main className="center"><div className="loader" /><p>جاري التحميل...</p></main>;
  if (!supabase) return <main className="center"><section className="setup card"><Brand /><h1>خطوة واحدة قبل التشغيل</h1><p>أضف متغيري Supabase في إعدادات المشروع على Vercel لربط تسجيل الدخول وقاعدة البيانات.</p><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_ANON_KEY</code><p className="muted">ستجد خطوات الإعداد في ملف README داخل المستودع.</p></section></main>;

  if (!session) return <main className="auth-layout">
    <section className="auth-card card">
      <Brand />
      <div className="eyebrow">مساحة إدارة متجرك</div>
      <h1>{otpStep ? 'تأكيد بريدك الإلكتروني' : mode === 'login' ? 'أهلاً بعودتك' : 'أنشئ حسابك'}</h1>
      <p className="muted">{otpStep ? 'أدخل رمز التأكيد المكوّن من 6 أرقام المرسل إلى بريدك الإلكتروني.' : 'ابدأ إدارة متجرك الإلكتروني من لوحة واحدة بسيطة.'}</p>
      {otpStep ? <form onSubmit={verifyEmail}>
        <label>رمز التأكيد (OTP)</label>
        <input className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g, '').slice(0,6))} placeholder="123456" required />
        <button className="primary" disabled={busy || otp.length !== 6}>{busy ? 'جاري التحقق...' : 'تأكيد الحساب والدخول'}</button>
        <button type="button" className="text-button resend" onClick={resendOtp} disabled={busy}>إعادة إرسال الرمز</button>
      </form> : <form onSubmit={authenticate}>
        <label>البريد الإلكتروني</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" required />
        <label>كلمة المرور</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" minLength="6" required />
        <button className="primary" disabled={busy}>{busy ? 'لحظة من فضلك...' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}</button>
      </form>}
      {message && <p className="notice">{message}</p>}
      {!otpStep && <p className="switch">{mode === 'login' ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'} <button className="text-button" onClick={()=>{setMode(mode==='login'?'signup':'login');setMessage('')}}>{mode==='login'?'إنشاء حساب':'تسجيل الدخول'}</button></p>}
      {otpStep && <p className="switch">البريد المستخدم: <strong>{email}</strong> · <button className="text-button" onClick={()=>{setOtpStep(false);setOtp('');setMessage('')}}>تغيير البريد</button></p>}
    </section>
    <aside className="auth-aside"><div className="aside-content"><span className="pill">SHOPFLOW DASHBOARD</span><h2>كل تفاصيل متجرك،<br/>في مكان واحد.</h2><p>مساحة منظمة تساعدك تتابع شغلك وتدير متجرك بسهولة.</p><div className="mini-stats"><div><strong>48 ساعة</strong><span>فترة تجربة مجانية</span></div><div><strong>بسيط</strong><span>إعداد سريع</span></div></div><div className="aside-powered">Powered by <strong>CODEX</strong></div></div></aside>
  </main>;

  if (session && profileLoading) return <main className="center"><div className="loader"/><p>جاري تجهيز مساحة متجرك...</p></main>;

  if (session && (!profile || editingProfile)) return <main className="onboarding-page"><section className="onboarding-card card"><Brand/><div className="eyebrow">الخطوة الأولى · إعداد متجرك</div><h1>{profile ? 'تعديل بيانات المتجر' : 'خلّينا نجهّز متجرك'}</h1><p className="muted">أضف بيانات متجرك عشان نخصص لوحة التحكم باسمك وهويتك.</p><form onSubmit={saveProfile} className="onboarding-form"><label>اسم المتجر *</label><input value={storeName} onChange={e=>setStoreName(e.target.value)} placeholder="مثال: متجري الإلكتروني" required maxLength="80"/><label>رابط موقع المتجر</label><input type="url" value={storeUrl} onChange={e=>setStoreUrl(e.target.value)} placeholder="https://yourstore.com"/><label>شعار المتجر</label><label className="logo-upload"><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e=>{const file=e.target.files?.[0]; if(file){if(file.size>2*1024*1024){setMessage('حجم الشعار لازم يكون أقل من 2 ميجابايت.');return;}setLogoFile(file);setLogoPreview(URL.createObjectURL(file));}}}/><span>{logoPreview ? <img src={logoPreview} alt="معاينة شعار المتجر"/> : '＋'}</span><b>{logoFile?.name || (logoPreview ? 'تغيير الشعار' : 'ارفع صورة الشعار')}</b><small>PNG أو JPG أو SVG أو WEBP · حتى 2MB</small></label><button className="primary" disabled={busy}>{busy ? 'جاري حفظ الإعدادات...' : 'حفظ ومتابعة إلى الداشبورد'}</button></form>{message && <p className="notice">{message}</p>}<div className="onboarding-foot">يمكنك تعديل البيانات لاحقاً من إعدادات المتجر.</div></section></main>;

  const startedAt = trial?.started_at ? new Date(trial.started_at) : null;
  const expiresAt = startedAt ? new Date(startedAt.getTime() + HOURS*60*60*1000) : null;
  const remaining = expiresAt ? Math.max(0, expiresAt.getTime() - now) : 0;
  const expired = expiresAt && remaining === 0;
  const hh = String(Math.floor(remaining / 3600000)).padStart(2,'0');
  const mm = String(Math.floor((remaining % 3600000) / 60000)).padStart(2,'0');
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2,'0');

  return <main className="dashboard">
    <header className="topbar"><div className="store-brand">{profile?.logo_url ? <img src={profile.logo_url} alt="شعار المتجر"/> : <Brand/>}<div><strong>{profile?.store_name || "ShopFlow"}</strong>{profile?.store_url && <a href={profile.store_url} target="_blank" rel="noreferrer">{profile.store_url}</a>}</div></div><div className="user-menu"><span>{session.user.email}</span><button className="outline small" onClick={()=>setEditingProfile(true)}>إعدادات المتجر</button><button className="outline small" onClick={logout}>تسجيل الخروج</button></div></header>
    <section className="welcome"><div><div className="eyebrow">لوحة التحكم</div><h1>أهلاً بك في {profile?.store_name || "متجرك"}</h1><p className="muted">ابدأ رحلتك في إدارة متجرك الإلكتروني.</p></div><span className="avatar">{session.user.email?.[0]?.toUpperCase()}</span></section>
    {expired ? <section className="expired card"><div className="status-icon">⌛</div><h2>انتهت فترة التجربة</h2><p>انتهت فترة التجربة المجانية لمدة 48 ساعة لهذا الحساب.</p><a className="primary link-button" href="mailto:hello@shopflow.example?subject=طلب%20تفعيل%20ShopFlow">تواصل معنا لطلب الخدمة</a></section>
    : !trial?.started_at ? <section className="trial-card card"><span className="pill">تجربة مجانية</span><h2>جرّب ShopFlow لمدة 48 ساعة</h2><p>استكشف لوحة التحكم وابدأ تجربة إدارة متجرك. يبدأ العدّ التنازلي فقط عند الضغط على الزر، والتجربة متاحة مرة واحدة لكل حساب.</p><button className="primary start" onClick={startTrial} disabled={busy}>{busy?'جاري بدء التجربة...':'ابدأ تجربتي المجانية'} <span>←</span></button><div className="fine-print">48 ساعة من لحظة البدء · لا يمكن إعادة ضبط التجربة</div></section>
    : <><section className="trial-banner card"><div><span className="pill active">التجربة مفعّلة</span><h2>لوحة متجرك التجريبية</h2><p className="muted">متبقي من وقت التجربة: <strong>{hh}:{mm}:{ss}</strong></p></div><div className="clock clock-live" dir="ltr"><strong>{hh}:{mm}:{ss}</strong><small>متبقي</small></div></section><section className="stats-grid"><article className="stat card"><span>الطلبات</span><strong>—</strong><small>ستظهر بياناتك هنا</small></article><article className="stat card"><span>المنتجات</span><strong>—</strong><small>إدارة كتالوج متجرك</small></article><article className="stat card"><span>المبيعات</span><strong>—</strong><small>ملخص أداء المتجر</small></article></section><section className="dashboard-lower"><article className="panel card"><div className="panel-heading"><div><h3>نظرة على المبيعات</h3><p>عرض توضيحي · آخر 7 أيام</p></div><span className="demo-tag">تجريبي</span></div><div className="mini-chart">{[34,55,42,76,50,88,66].map((v,i)=><div className="chart-column" key={i}><span style={{height:v+'%'}}/><small>{['س','ح','ن','ث','ر','خ','ج'][i]}</small></div>)}</div></article><article className="panel card"><div className="panel-heading"><div><h3>آخر النشاطات</h3><p>أمثلة توضيحية</p></div></div><div className="activity-item"><i className="activity-green"/> <span><b>طلب جديد</b><small>تم استلام طلب تجريبي</small></span></div><div className="activity-item"><i className="activity-gold"/> <span><b>تنبيه مخزون</b><small>منتج يحتاج مراجعة المخزون</small></span></div><div className="activity-item"><i className="activity-blue"/> <span><b>عميل جديد</b><small>تم تسجيل عميل تجريبي</small></span></div></article></section><section className="quick-actions"><button onClick={()=>setMessage('إدارة المنتجات الفعلية ستتوفر عند ربط قاعدة بيانات المتجر.')}>＋ إضافة منتج</button><button onClick={()=>setMessage('إدارة الطلبات الفعلية ستتوفر بعد ربط نظام الطلبات.')}>▤ عرض الطلبات</button><button onClick={()=>setMessage('التقارير الفعلية ستظهر بعد ربط بيانات المبيعات.')}>▥ التقارير</button></section></>}
    {message && <p className="notice">{message}</p>}
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
