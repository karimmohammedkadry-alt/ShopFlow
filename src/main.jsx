import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './style.css';
import DashboardModules from './DashboardModules.jsx';

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
  const [businessType, setBusinessType] = useState('general');
  const [activeSection, setActiveSection] = useState('overview');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('shopflow-theme') || 'light');
  const [language, setLanguage] = useState(() => localStorage.getItem('shopflow-language') || 'ar');
  useEffect(() => { localStorage.setItem('shopflow-theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('shopflow-language', language); document.documentElement.lang = language; document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'; }, [language]);

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
    else if (data) { setProfile(data); setStoreName(data.store_name || ''); setStoreUrl(data.store_url || ''); setBusinessType(data.business_type || 'general'); setLogoPreview(data.logo_url || ''); }
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
        store_url: storeUrl.trim(), logo_url: logoUrl, business_type: businessType, updated_at: new Date().toISOString()
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
          setMessage('تم إنشاء طلب التسجيل. لو إعدادات البريد في Supabase سليمة، هيوصلك رمز التأكيد. لو ماوصلش، راجع صندوق Spam وإعدادات SMTP و Email Templates في Supabase.');
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
    if (error) setMessage(`تعذر تأكيد البريد: ${error.message}`);
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
    setMessage(error ? `تعذر طلب رمز جديد: ${error.message}` : 'تم قبول طلب إعادة الإرسال من Supabase. وصول الرسالة يعتمد على إعدادات البريد وSMTP.');
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

  if (session && (!profile || editingProfile)) return <main className="onboarding-page"><section className="onboarding-card card"><Brand/><div className="eyebrow">الخطوة الأولى · إعداد متجرك</div><h1>{profile ? 'تعديل بيانات المتجر' : 'خلّينا نجهّز متجرك'}</h1><p className="muted">أضف بيانات متجرك واختر نشاطك عشان نخصص الأقسام والأدوات المناسبة.</p><form onSubmit={saveProfile} className="onboarding-form"><label>اسم المتجر *</label><input value={storeName} onChange={e=>setStoreName(e.target.value)} placeholder="مثال: متجري الإلكتروني" required maxLength="80"/><label>نوع النشاط *</label><select value={businessType} onChange={e=>setBusinessType(e.target.value)} required><option value="general">متجر عام</option><option value="restaurant">مطعم وكافيه</option><option value="fashion">ملابس وأزياء</option><option value="electronics">إلكترونيات</option><option value="beauty">تجميل وعناية</option><option value="services">خدمات وحجوزات</option></select><label>رابط موقع المتجر</label><input type="url" value={storeUrl} onChange={e=>setStoreUrl(e.target.value)} placeholder="https://yourstore.com"/><label>شعار المتجر</label><label className="logo-upload"><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e=>{const file=e.target.files?.[0]; if(file){if(file.size>2*1024*1024){setMessage('حجم الشعار لازم يكون أقل من 2 ميجابايت.');return;}setLogoFile(file);setLogoPreview(URL.createObjectURL(file));}}}/><span>{logoPreview ? <img src={logoPreview} alt="معاينة شعار المتجر"/> : '＋'}</span><b>{logoFile?.name || (logoPreview ? 'تغيير الشعار' : 'ارفع صورة الشعار')}</b><small>PNG أو JPG أو SVG أو WEBP · حتى 2MB</small></label><button className="primary" disabled={busy}>{busy ? 'جاري حفظ الإعدادات...' : 'حفظ ومتابعة إلى الداشبورد'}</button></form>{message && <p className="notice">{message}</p>}<div className="onboarding-foot">يمكنك تعديل البيانات لاحقاً من إعدادات المتجر.</div></section></main>;

  const startedAt = trial?.started_at ? new Date(trial.started_at) : null;
  const expiresAt = startedAt ? new Date(startedAt.getTime() + HOURS*60*60*1000) : null;
  const remaining = expiresAt ? Math.max(0, expiresAt.getTime() - now) : 0;
  const expired = expiresAt && remaining === 0;
  const hh = String(Math.floor(remaining / 3600000)).padStart(2,'0');
  const mm = String(Math.floor((remaining % 3600000) / 60000)).padStart(2,'0');
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2,'0');

  const isArabic = language === 'ar';
  const navItems = [
    {id:'overview',ar:'الرئيسية',en:'Overview',icon:'⌂'},
    {id:'catalog',ar:profile?.business_type==='restaurant'?'المنيو':'المنتجات',en:profile?.business_type==='restaurant'?'Menu':'Products',icon:'▦'},
    {id:'orders',ar:'الطلبات',en:'Orders',icon:'▤'},...(profile?.business_type==='services'?[{id:'appointments',ar:'الحجوزات',en:'Appointments',icon:'◷'}]:[]),{id:'customers',ar:'العملاء',en:'Customers',icon:'♙'},
    {id:'inventory',ar:'المخزون',en:'Inventory',icon:'▥'},{id:'marketing',ar:'التسويق',en:'Marketing',icon:'✦'},
    {id:'reports',ar:'التقارير',en:'Analytics',icon:'▧'},{id:'website',ar:'الموقع والقوالب',en:'Website builder',icon:'◫'},
    {id:'integrations',ar:'التكاملات',en:'Integrations',icon:'⌘'},{id:'staff',ar:'الموظفون',en:'Team & roles',icon:'♧'},
    {id:'settings',ar:'الإعدادات',en:'Settings',icon:'⚙'}
  ];
  return <main className={'dashboard '+(theme==='dark'?'theme-dark':'')} dir={isArabic?'rtl':'ltr'}>
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand"><Brand/></div>
        <div className="sidebar-store"><strong>{profile?.store_name || 'ShopFlow'}</strong><small>{isArabic?'مساحة المتجر':'Store workspace'}</small></div>
        <nav className="sidebar-nav">{navItems.map(item=><button key={item.id} className={activeSection===item.id?'selected':''} onClick={()=>setActiveSection(item.id)}><span>{item.icon}</span>{isArabic?item.ar:item.en}</button>)}</nav>
        <div className="sidebar-controls">
          <button onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?(isArabic?'☀ الوضع الفاتح':'☀ Light mode'):(isArabic?'☾ الوضع الداكن':'☾ Dark mode')}</button>
          <button onClick={()=>setLanguage(isArabic?'en':'ar')}>{isArabic?'English':'العربية'}</button>
        </div>
      </aside>
      <div className="dashboard-main">
    <header className="topbar"><div className="store-brand">{profile?.logo_url ? <img src={profile.logo_url} alt="شعار المتجر"/> : <Brand/>}<div><strong>{profile?.store_name || "ShopFlow"}</strong>{profile?.store_url && <a href={profile.store_url} target="_blank" rel="noreferrer">{profile.store_url}</a>}</div></div><div className="user-menu"><span>{session.user.email}</span><button className="outline small" onClick={()=>setEditingProfile(true)}>{isArabic?"إعدادات المتجر":"Store settings"}</button><button className="outline small" onClick={logout}>{isArabic?"تسجيل الخروج":"Sign out"}</button></div></header>
    <section className="welcome"><div><div className="eyebrow">{isArabic?"لوحة التحكم":"Dashboard"} · {({restaurant:'مطعم وكافيه',fashion:'ملابس وأزياء',electronics:'إلكترونيات',beauty:'تجميل وعناية',services:'خدمات وحجوزات',general:'متجر عام'})[profile?.business_type || 'general']}</div><h1>{isArabic?("أهلاً بك في "+(profile?.store_name||"متجرك")):("Welcome to "+(profile?.store_name||"your store"))}</h1><p className="muted">{isArabic?"ابدأ رحلتك في إدارة متجرك الإلكتروني.":"Manage your business from one workspace."}</p></div><span className="avatar">{session.user.email?.[0]?.toUpperCase()}</span></section>
    {expired ? <section className="expired card"><div className="status-icon">⌛</div><h2>انتهت فترة التجربة</h2><p>انتهت فترة التجربة المجانية لمدة 48 ساعة لهذا الحساب.</p><a className="primary link-button" href="mailto:hello@shopflow.example?subject=طلب%20تفعيل%20ShopFlow">تواصل معنا لطلب الخدمة</a></section>
    : !trial?.started_at ? <section className="trial-card card"><span className="pill">تجربة مجانية</span><h2>جرّب ShopFlow لمدة 48 ساعة</h2><p>استكشف لوحة التحكم وابدأ تجربة إدارة متجرك. يبدأ العدّ التنازلي فقط عند الضغط على الزر، والتجربة متاحة مرة واحدة لكل حساب.</p><button className="primary start" onClick={startTrial} disabled={busy}>{busy?'جاري بدء التجربة...':'ابدأ تجربتي المجانية'} <span>←</span></button><div className="fine-print">48 ساعة من لحظة البدء · لا يمكن إعادة ضبط التجربة</div></section>
    : <><section className="trial-banner card"><div><span className="pill active">التجربة مفعّلة</span><h2>لوحة متجرك</h2><p className="muted">متبقي من وقت التجربة: <strong>{hh}:{mm}:{ss}</strong></p></div><div className="clock clock-live" dir="ltr"><strong>{hh}:{mm}:{ss}</strong><small>متبقي</small></div></section><DashboardModules supabase={supabase} user={session.user} profile={profile} activeSection={activeSection} setActiveSection={setActiveSection} setMessage={setMessage} setEditingProfile={setEditingProfile} language={language}/></>}
    {message && <p className="notice">{message}</p>}
      </div>
    </div>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
