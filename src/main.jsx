import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import './style.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const HOURS = 48;

function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [trial, setTrial] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

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
    if (session?.user) loadTrial();
  }, [session]);

  async function loadTrial() {
    const { data, error } = await supabase.rpc('get_my_trial');
    if (error) setMessage('تعذر تحميل حالة التجربة. تأكد من تشغيل ملف إعداد قاعدة البيانات في Supabase.');
    else setTrial(data);
  }

  async function authenticate(e) {
    e.preventDefault(); setBusy(true); setMessage('');
    const action = mode === 'login'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password });
    const { error, data } = await action;
    if (error) setMessage(error.message);
    else if (mode === 'signup' && !data.session) setMessage('تم إنشاء الحساب. راجع بريدك الإلكتروني لتأكيد التسجيل ثم سجّل الدخول.');
    setBusy(false);
  }

  async function startTrial() {
    setBusy(true); setMessage('');
    const { error } = await supabase.rpc('start_my_trial');
    if (error) setMessage('لم نتمكن من بدء التجربة. راجع إعداد قاعدة البيانات.');
    else await loadTrial();
    setBusy(false);
  }

  async function logout() { await supabase.auth.signOut(); setTrial(null); }

  if (loading) return <main className="center"><div className="loader" /><p>جاري التحميل...</p></main>;
  if (!supabase) return <main className="center"><section className="setup card"><div className="brand"><span className="brand-mark">S</span> ShopFlow</div><h1>خطوة واحدة قبل التشغيل</h1><p>أضف متغيري Supabase في إعدادات المشروع على Vercel لربط تسجيل الدخول وقاعدة البيانات.</p><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_ANON_KEY</code><p className="muted">ستجد خطوات الإعداد في ملف README داخل المستودع.</p></section></main>;

  if (!session) return <main className="auth-layout">
    <section className="auth-card card">
      <div className="brand"><span className="brand-mark">S</span> ShopFlow</div>
      <div className="eyebrow">مساحة إدارة متجرك</div>
      <h1>{mode === 'login' ? 'أهلاً بعودتك' : 'أنشئ حسابك'}</h1>
      <p className="muted">ابدأ إدارة متجرك الإلكتروني من لوحة واحدة بسيطة.</p>
      <form onSubmit={authenticate}>
        <label>البريد الإلكتروني</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" required />
        <label>كلمة المرور</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" minLength="6" required />
        <button className="primary" disabled={busy}>{busy ? 'لحظة من فضلك...' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}</button>
      </form>
      {message && <p className="notice">{message}</p>}
      <p className="switch">{mode === 'login' ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'} <button className="text-button" onClick={()=>{setMode(mode==='login'?'signup':'login');setMessage('')}}>{mode==='login'?'إنشاء حساب':'تسجيل الدخول'}</button></p>
    </section>
    <aside className="auth-aside"><div className="aside-content"><span className="pill">SHOPFLOW DASHBOARD</span><h2>كل تفاصيل متجرك،<br/>في مكان واحد.</h2><p>مساحة منظمة تساعدك تتابع شغلك وتدير متجرك بسهولة.</p><div className="mini-stats"><div><strong>48 ساعة</strong><span>فترة تجربة مجانية</span></div><div><strong>بسيط</strong><span>إعداد سريع</span></div></div></div></aside>
  </main>;

  const startedAt = trial?.started_at ? new Date(trial.started_at) : null;
  const expiresAt = startedAt ? new Date(startedAt.getTime() + HOURS*60*60*1000) : null;
  const expired = expiresAt && Date.now() >= expiresAt.getTime();

  return <main className="dashboard">
    <header className="topbar"><div className="brand"><span className="brand-mark">S</span> ShopFlow</div><div className="user-menu"><span>{session.user.email}</span><button className="outline small" onClick={logout}>تسجيل الخروج</button></div></header>
    <section className="welcome"><div><div className="eyebrow">لوحة التحكم</div><h1>أهلاً بك في ShopFlow</h1><p className="muted">ابدأ رحلتك في إدارة متجرك الإلكتروني.</p></div><span className="avatar">{session.user.email?.[0]?.toUpperCase()}</span></section>
    {expired ? <section className="expired card"><div className="status-icon">⌛</div><h2>انتهت فترة التجربة</h2><p>انتهت فترة التجربة المجانية لمدة 48 ساعة لهذا الحساب.</p><a className="primary link-button" href="mailto:hello@shopflow.example?subject=طلب%20تفعيل%20ShopFlow">تواصل معنا لطلب الخدمة</a></section>
    : !trial?.started_at ? <section className="trial-card card"><span className="pill">تجربة مجانية</span><h2>جرّب ShopFlow لمدة 48 ساعة</h2><p>استكشف لوحة التحكم وابدأ تجربة إدارة متجرك. يبدأ العدّ التنازلي فقط عند الضغط على الزر، والتجربة متاحة مرة واحدة لكل حساب.</p><button className="primary start" onClick={startTrial} disabled={busy}>{busy?'جاري بدء التجربة...':'ابدأ تجربتي المجانية'} <span>←</span></button><div className="fine-print">48 ساعة من لحظة البدء · لا يمكن إعادة ضبط التجربة</div></section>
    : <><section className="trial-banner card"><div><span className="pill active">التجربة مفعّلة</span><h2>لوحة متجرك التجريبية</h2><p className="muted">متبقي من وقت التجربة: <strong>{Math.max(0,Math.ceil((expiresAt-Date.now())/3600000))} ساعة تقريباً</strong></p></div><div className="clock">48h</div></section><section className="stats-grid"><article className="stat card"><span>الطلبات</span><strong>—</strong><small>ستظهر بياناتك هنا</small></article><article className="stat card"><span>المنتجات</span><strong>—</strong><small>إدارة كتالوج متجرك</small></article><article className="stat card"><span>المبيعات</span><strong>—</strong><small>ملخص أداء المتجر</small></article></section><section className="empty card"><div className="empty-icon">✦</div><h3>مساحتك جاهزة للانطلاق</h3><p className="muted">سيتم تفعيل أدوات إدارة المتجر عند إعداد الخدمة.</p></section></>}
    {message && <p className="notice">{message}</p>}
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
