import React, { useCallback, useEffect, useMemo, useState } from 'react';

const labels = {
  overview: 'نظرة عامة', catalog: 'إدارة المنتجات والمنيو', orders: 'إدارة الطلبات',
  customers: 'العملاء', inventory: 'المخزون', marketing: 'التسويق والعروض',
  reports: 'التقارير والتحليلات', website: 'منشئ الموقع والقوالب',
  integrations: 'التكاملات والربط', staff: 'الموظفون والصلاحيات', settings: 'إعدادات النشاط والمتجر'
};
const money = (value, currency='EGP') => new Intl.NumberFormat('ar-EG', { style:'currency', currency, maximumFractionDigits:2 }).format(Number(value || 0));
const orderStates = { new:'جديد', confirmed:'مؤكد', preparing:'قيد التجهيز', shipped:'تم الشحن', completed:'مكتمل', cancelled:'ملغي' };

export default function DashboardModules({ supabase, user, profile, activeSection, setActiveSection, setMessage, setEditingProfile, language='ar' }) {
  const [products,setProducts] = useState([]);
  const [customers,setCustomers] = useState([]);
  const [orders,setOrders] = useState([]);
  const [appointments,setAppointments] = useState([]);
  const [showAppointment,setShowAppointment] = useState(false);
  const [ga4Id,setGa4Id] = useState('');
  const [ga4Saved,setGa4Saved] = useState(false);
  const [appointmentForm,setAppointmentForm] = useState({customer_name:'',service_name:'',starts_at:'',notes:''});
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [showProduct,setShowProduct] = useState(false);
  const [showCustomer,setShowCustomer] = useState(false);
  const [showOrder,setShowOrder] = useState(false);
  const [productForm,setProductForm] = useState({name:'',category:'',description:'',price:'',stock:'0'});
  const [productExtras,setProductExtras] = useState({});
  const [customerForm,setCustomerForm] = useState({full_name:'',email:'',phone:'',notes:''});
  const [orderForm,setOrderForm] = useState({customer_id:'',total:'',currency:'EGP',notes:''});

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true); setError('');
    const [p,c,o,a,g] = await Promise.all([
      supabase.from('shopflow_products').select('*').eq('user_id',user.id).order('created_at',{ascending:false}),
      supabase.from('shopflow_customers').select('*').eq('user_id',user.id).order('created_at',{ascending:false}),
      supabase.from('shopflow_orders').select('*').eq('user_id',user.id).order('created_at',{ascending:false}),
      supabase.from('shopflow_appointments').select('*').eq('user_id',user.id).order('starts_at',{ascending:true}),
      supabase.from('shopflow_integrations').select('public_config,status').eq('user_id',user.id).eq('provider','google_analytics_4').maybeSingle()
    ]);
    const failed = [p,c,o,a,g].find(x=>x.error);
    if (failed) setError(failed.error.message || 'تعذر تحميل بيانات المتجر');
    setProducts(p.data || []); setCustomers(c.data || []); setOrders(o.data || []); setAppointments(a.data || []);
    setGa4Id(g.data?.public_config?.measurement_id || ''); setGa4Saved(Boolean(g.data?.public_config?.measurement_id));
    setLoading(false);
  },[supabase,user?.id]);

  useEffect(()=>{ load(); },[load]);

  const stats = useMemo(()=>{
    const completed = orders.filter(o=>o.status==='completed');
    const revenue = completed.reduce((sum,o)=>sum+Number(o.total||0),0);
    const lowStock = products.filter(p=>Number(p.stock)<=5).length;
    return { products:products.length, customers:customers.length, orders:orders.length, revenue, lowStock };
  },[products,customers,orders]);

  async function saveAnalyticsId(e) {
    e.preventDefault(); setSaving(true); setError('');
    const cleanId=ga4Id.trim().toUpperCase();
    if(!/^G-[A-Z0-9]+$/.test(cleanId)){setError(isEnglish?'Enter a valid GA4 Measurement ID (G-XXXXXXXXXX).':'اكتب Measurement ID صحيح يبدأ بـ G-');setSaving(false);return;}
    const {error:e1}=await supabase.from('shopflow_integrations').upsert({
      user_id:user.id,provider:'google_analytics_4',display_name:'Google Analytics 4',
      status:'pending',public_config:{measurement_id:cleanId}
    },{onConflict:'user_id,provider'});
    setSaving(false);
    if(e1){setError(e1.message);return;}
    setGa4Id(cleanId);setGa4Saved(true);
  }
  async function addProduct(e) {
    e.preventDefault(); setSaving(true); setError('');
    const {error:e1}=await supabase.from('shopflow_products').insert({
      user_id:user.id, name:productForm.name.trim(), category:productForm.category.trim(),
      description:productForm.description.trim(), price:Number(productForm.price), stock:Number(productForm.stock||0), options:productExtras
    });
    setSaving(false);
    if(e1){setError(e1.message);return;}
    setProductForm({name:'',category:'',description:'',price:'',stock:'0'});setProductExtras({});setShowProduct(false);await load();
  }
  async function changeStock(product, value) {
    const stock = Math.max(0,Number(value)||0);
    const {error:e1}=await supabase.from('shopflow_products').update({stock,updated_at:new Date().toISOString()}).eq('id',product.id).eq('user_id',user.id);
    if(e1)setError(e1.message);else await load();
  }
  async function deleteProduct(product) {
    if(!window.confirm('حذف المنتج «'+product.name+'»؟'))return;
    const {error:e1}=await supabase.from('shopflow_products').delete().eq('id',product.id).eq('user_id',user.id);
    if(e1)setError(e1.message);else await load();
  }
  async function addCustomer(e) {
    e.preventDefault();setSaving(true);setError('');
    const {error:e1}=await supabase.from('shopflow_customers').insert({...customerForm,user_id:user.id});
    setSaving(false);
    if(e1){setError(e1.message);return;}
    setCustomerForm({full_name:'',email:'',phone:'',notes:''});setShowCustomer(false);await load();
  }
  async function addOrder(e) {
    e.preventDefault();setSaving(true);setError('');
    const customer=customers.find(c=>c.id===orderForm.customer_id);
    const {error:e1}=await supabase.from('shopflow_orders').insert({
      user_id:user.id,customer_id:customer?.id||null,total:Number(orderForm.total),
      currency:orderForm.currency,notes:orderForm.notes,
      customer_snapshot:customer?{full_name:customer.full_name,email:customer.email,phone:customer.phone}:{},
      items:[]
    });
    setSaving(false);
    if(e1){setError(e1.message);return;}
    setOrderForm({customer_id:'',total:'',currency:'EGP',notes:''});setShowOrder(false);await load();
  }
  async function addAppointment(e) {
    e.preventDefault(); setSaving(true); setError('');
    const {error:e1}=await supabase.from('shopflow_appointments').insert({
      user_id:user.id, customer_name:appointmentForm.customer_name.trim(),
      service_name:appointmentForm.service_name.trim(),
      starts_at:new Date(appointmentForm.starts_at).toISOString(), notes:appointmentForm.notes
    });
    setSaving(false);
    if(e1){setError(e1.message);return;}
    setAppointmentForm({customer_name:'',service_name:'',starts_at:'',notes:''});setShowAppointment(false);await load();
  }
  async function updateAppointmentStatus(item,status) {
    const {error:e1}=await supabase.from('shopflow_appointments').update({status}).eq('id',item.id).eq('user_id',user.id);
    if(e1)setError(e1.message);else await load();
  }
  async function changeOrderStatus(order,status) {
    const {error:e1}=await supabase.from('shopflow_orders').update({status,updated_at:new Date().toISOString()}).eq('id',order.id).eq('user_id',user.id);
    if(e1)setError(e1.message);else await load();
  }

  const isEnglish = language === 'en';
  const industry = profile?.business_type || 'general';
  const industryFields = {
    restaurant:[['portion', 'حجم الوجبة'],['prep_minutes','وقت التحضير بالدقائق'],['dietary','نوع الوجبة']],
    fashion:[['size','المقاسات'],['color','الألوان'],['material','الخامة']],
    electronics:[['brand','الماركة'],['model','الموديل'],['warranty_months','الضمان بالشهور']],
    beauty:[['skin_type','نوع البشرة/الشعر'],['volume','الحجم'],['ingredients','المكونات']],
    services:[['duration_minutes','مدة الخدمة بالدقائق'],['delivery_mode','طريقة تقديم الخدمة'],['staff_name','مقدم الخدمة']],
    general:[['sku','رمز المنتج SKU'],['supplier','المورد'],['unit','وحدة القياس']]
  };
  const title = isEnglish ? ({overview:'Overview',catalog:'Products & menu',orders:'Orders',customers:'Customers',inventory:'Inventory',marketing:'Marketing & offers',reports:'Analytics & reports',website:'Website builder',integrations:'Integrations',staff:'Team & permissions',settings:'Store settings',appointments:'Appointments'}[activeSection] || 'Store dashboard') : (labels[activeSection] || 'لوحة المتجر');
  const isRestaurant = industry==='restaurant';
  const productLabel = isRestaurant?(isEnglish?'Menu item':'الصنف'):(isEnglish?'Product':'المنتج');
  const fieldList = industryFields[industry] || industryFields.general;

  if(loading) return <section className="module-panel card"><div className="loader"/><p style={{textAlign:'center'}}>{isEnglish?'Loading your store data...':'جاري تحميل بيانات متجرك...'}</p></section>;

  return <section className="module-panel card">
    <div className="panel-heading">
      <div><h3>{title}</h3><p>{isEnglish?'Live store data':'بيانات متجرك الفعلية'} · {profile?.store_name || 'ShopFlow'}</p></div>
      <button className="outline small" onClick={load}>↻ تحديث</button>
    </div>
    {error && <p className="notice" role="alert">{error}</p>}
    {activeSection==='overview' && <>
      <div className="stats-grid module-stats">
        <article className="stat card"><span>{isEnglish?'Total orders':'إجمالي الطلبات'}</span><strong>{stats.orders}</strong><small>{isEnglish?'Orders saved in your database':'طلبات محفوظة في قاعدة البيانات'}</small></article>
        <article className="stat card"><span>{isRestaurant?(isEnglish?'Menu items':'أصناف المنيو'):(isEnglish?'Products':'المنتجات')}</span><strong>{stats.products}</strong><small>{isEnglish?'Catalog entries':'عناصر الكتالوج المسجلة'}</small></article>
        <article className="stat card"><span>{isEnglish?'Customers':'العملاء'}</span><strong>{stats.customers}</strong><small>{isEnglish?'Customer records':'ملفات العملاء المسجلة'}</small></article>
        <article className="stat card"><span>{isEnglish?'Completed order sales':'مبيعات الطلبات المكتملة'}</span><strong>{money(stats.revenue)}</strong><small>{isEnglish?'Completed orders only':'محسوبة من الطلبات المكتملة فقط'}</small></article>
      </div>
      <div className="module-actions"><button className="primary" onClick={()=>setActiveSection('catalog')}>＋ إضافة {productLabel}</button><button className="outline" onClick={()=>setActiveSection('orders')}>عرض الطلبات</button><button className="outline" onClick={()=>setActiveSection('customers')}>إدارة العملاء</button></div>
      <p className="module-hint">الأرقام هنا مبنية على سجلات حسابك في قاعدة البيانات، وليست بيانات تجريبية.</p>
    </>}
    {(activeSection==='catalog'||activeSection==='inventory') && <>
      <div className="module-actions"><button className="primary" onClick={()=>setShowProduct(v=>!v)}>＋ إضافة {productLabel}</button><span className="module-hint">عدد العناصر: {products.length} · مخزون منخفض: {stats.lowStock}</span></div>
      {showProduct && <form className="module-form" onSubmit={addProduct}>
        <label>اسم {productLabel} *</label><input required maxLength="120" value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})}/>
        <label>التصنيف</label><input value={productForm.category} onChange={e=>setProductForm({...productForm,category:e.target.value})}/>
        <label>الوصف</label><textarea rows="2" value={productForm.description} onChange={e=>setProductForm({...productForm,description:e.target.value})}/>
        <div className="industry-fields"><strong>{isEnglish ? "Industry-specific details" : "بيانات خاصة بنشاطك"}</strong>{fieldList.map(([key,label])=><div key={key}><label>{isEnglish?({portion:'Portion',prep_minutes:'Prep time (minutes)',dietary:'Meal type',size:'Sizes',color:'Colors',material:'Material',brand:'Brand',model:'Model',warranty_months:'Warranty (months)',skin_type:'Skin / hair type',volume:'Volume',ingredients:'Ingredients',duration_minutes:'Duration (minutes)',delivery_mode:'Service mode',staff_name:'Staff member',sku:'SKU',supplier:'Supplier',unit:'Unit'}[key]||label):label}</label><input value={productExtras[key]||''} onChange={e=>setProductExtras(v=>({...v,[key]:e.target.value}))}/></div>)}</div>
        <div className="module-form-grid"><div><label>السعر *</label><input required type="number" min="0" step="0.01" value={productForm.price} onChange={e=>setProductForm({...productForm,price:e.target.value})}/></div><div><label>الكمية المتاحة</label><input type="number" min="0" step="1" value={productForm.stock} onChange={e=>setProductForm({...productForm,stock:e.target.value})}/></div></div>
        <div className="module-actions"><button className="primary" disabled={saving}>{saving?'جاري الحفظ...':'حفظ '+productLabel}</button><button type="button" className="outline" onClick={()=>setShowProduct(false)}>إلغاء</button></div>
      </form>}
      {products.length===0?<div className="module-empty">لا توجد {productLabel==='الصنف'?'أصناف':'منتجات'} حتى الآن. أضف أول عنصر لبدء إدارة الكتالوج.</div>:<div className="module-table-wrap"><table className="module-table"><thead><tr><th>الاسم</th><th>التصنيف</th><th>السعر</th><th>المخزون</th><th>إجراء</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td><b>{p.name}</b><small>{[p.description,...Object.entries(p.options||{}).filter(([,v])=>String(v).trim()).map(([k,v])=>k+': '+v)].filter(Boolean).join(' · ')}</small></td><td>{p.category||'—'}</td><td>{money(p.price)}</td><td><input aria-label={'كمية '+p.name} className="stock-input" type="number" min="0" defaultValue={p.stock} onBlur={e=>{if(Number(e.target.value)!==Number(p.stock))changeStock(p,e.target.value)}} /></td><td><button className="danger-link" onClick={()=>deleteProduct(p)}>حذف</button></td></tr>)}</tbody></table></div>}
    </>}
    {activeSection==='customers' && <>
      <div className="module-actions"><button className="primary" onClick={()=>setShowCustomer(v=>!v)}>＋ إضافة عميل</button><span className="module-hint">إجمالي العملاء: {customers.length}</span></div>
      {showCustomer&&<form className="module-form" onSubmit={addCustomer}><label>اسم العميل *</label><input required value={customerForm.full_name} onChange={e=>setCustomerForm({...customerForm,full_name:e.target.value})}/><label>البريد الإلكتروني</label><input type="email" value={customerForm.email} onChange={e=>setCustomerForm({...customerForm,email:e.target.value})}/><label>رقم الهاتف</label><input value={customerForm.phone} onChange={e=>setCustomerForm({...customerForm,phone:e.target.value})}/><label>ملاحظات</label><textarea rows="2" value={customerForm.notes} onChange={e=>setCustomerForm({...customerForm,notes:e.target.value})}/><div className="module-actions"><button className="primary" disabled={saving}>{saving?'جاري الحفظ...':'حفظ العميل'}</button><button type="button" className="outline" onClick={()=>setShowCustomer(false)}>إلغاء</button></div></form>}
      {customers.length===0?<div className="module-empty">لا يوجد عملاء مسجلون حتى الآن.</div>:<div className="module-table-wrap"><table className="module-table"><thead><tr><th>الاسم</th><th>البريد</th><th>الهاتف</th><th>تاريخ الإضافة</th></tr></thead><tbody>{customers.map(c=><tr key={c.id}><td><b>{c.full_name}</b></td><td>{c.email||'—'}</td><td>{c.phone||'—'}</td><td>{new Date(c.created_at).toLocaleDateString('ar-EG')}</td></tr>)}</tbody></table></div>}
    </>}
    {activeSection==='orders' && <>
      <div className="module-actions"><button className="primary" onClick={()=>setShowOrder(v=>!v)}>＋ تسجيل طلب</button><span className="module-hint">إجمالي الطلبات: {orders.length}</span></div>
      {showOrder&&<form className="module-form" onSubmit={addOrder}><label>العميل</label><select value={orderForm.customer_id} onChange={e=>setOrderForm({...orderForm,customer_id:e.target.value})}><option value="">طلب بدون عميل مسجل</option>{customers.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select><div className="module-form-grid"><div><label>إجمالي الطلب *</label><input required type="number" min="0" step="0.01" value={orderForm.total} onChange={e=>setOrderForm({...orderForm,total:e.target.value})}/></div><div><label>العملة</label><select value={orderForm.currency} onChange={e=>setOrderForm({...orderForm,currency:e.target.value})}><option value="EGP">EGP - جنيه مصري</option><option value="USD">USD - دولار</option><option value="SAR">SAR - ريال سعودي</option><option value="AED">AED - درهم إماراتي</option><option value="EUR">EUR - يورو</option></select></div></div><label>ملاحظات الطلب</label><textarea rows="2" value={orderForm.notes} onChange={e=>setOrderForm({...orderForm,notes:e.target.value})}/><div className="module-actions"><button className="primary" disabled={saving}>{saving?'جاري الحفظ...':'حفظ الطلب'}</button><button type="button" className="outline" onClick={()=>setShowOrder(false)}>إلغاء</button></div></form>}
      {orders.length===0?<div className="module-empty">لا توجد طلبات حتى الآن. يمكنك تسجيل طلب يدوي للتجربة.</div>:<div className="module-table-wrap"><table className="module-table"><thead><tr><th>رقم الطلب</th><th>العميل</th><th>الإجمالي</th><th>الحالة</th><th>تحديث الحالة</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td>#{o.order_number}</td><td>{o.customer_snapshot?.full_name||'عميل غير محدد'}</td><td>{money(o.total,o.currency||'EGP')}</td><td><span className={'status-chip status-'+o.status}>{orderStates[o.status]||o.status}</span></td><td><select aria-label={'حالة الطلب '+o.order_number} value={o.status} onChange={e=>changeOrderStatus(o,e.target.value)}>{Object.entries(orderStates).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></td></tr>)}</tbody></table></div>}
    </>}
    {activeSection==='appointments' && industry==='services' && <>
      <div className="module-actions"><button className="primary" onClick={()=>setShowAppointment(v=>!v)}>＋ {isEnglish?'Book appointment':'إضافة حجز'}</button><span className="module-hint">{isEnglish?'Bookings':'الحجوزات'}: {appointments.length}</span></div>
      {showAppointment&&<form className="module-form" onSubmit={addAppointment}>
        <label>{isEnglish?'Customer name':'اسم العميل'} *</label><input required value={appointmentForm.customer_name} onChange={e=>setAppointmentForm({...appointmentForm,customer_name:e.target.value})}/>
        <label>{isEnglish?'Service':'الخدمة'} *</label><input required value={appointmentForm.service_name} onChange={e=>setAppointmentForm({...appointmentForm,service_name:e.target.value})}/>
        <label>{isEnglish?'Date and time':'التاريخ والوقت'} *</label><input required type="datetime-local" value={appointmentForm.starts_at} onChange={e=>setAppointmentForm({...appointmentForm,starts_at:e.target.value})}/>
        <label>{isEnglish?'Notes':'ملاحظات'}</label><textarea rows="2" value={appointmentForm.notes} onChange={e=>setAppointmentForm({...appointmentForm,notes:e.target.value})}/>
        <div className="module-actions"><button className="primary" disabled={saving}>{saving?(isEnglish?'Saving...':'جاري الحفظ...'):(isEnglish?'Save booking':'حفظ الحجز')}</button><button type="button" className="outline" onClick={()=>setShowAppointment(false)}>{isEnglish?'Cancel':'إلغاء'}</button></div>
      </form>}
      {appointments.length===0?<div className="module-empty">{isEnglish?'No bookings yet. Add your first appointment.':'لا توجد حجوزات حتى الآن. أضف أول موعد.'}</div>:<div className="module-table-wrap"><table className="module-table"><thead><tr><th>{isEnglish?'Customer':'العميل'}</th><th>{isEnglish?'Service':'الخدمة'}</th><th>{isEnglish?'Date':'الموعد'}</th><th>{isEnglish?'Status':'الحالة'}</th></tr></thead><tbody>{appointments.map(a=><tr key={a.id}><td>{a.customer_name}</td><td>{a.service_name}</td><td>{new Date(a.starts_at).toLocaleString(isEnglish?'en-US':'ar-EG')}</td><td><select value={a.status} onChange={e=>updateAppointmentStatus(a,e.target.value)}><option value="booked">{isEnglish?'Booked':'محجوز'}</option><option value="confirmed">{isEnglish?'Confirmed':'مؤكد'}</option><option value="completed">{isEnglish?'Completed':'مكتمل'}</option><option value="cancelled">{isEnglish?'Cancelled':'ملغي'}</option></select></td></tr>)}</tbody></table></div>}
    </>}
    {activeSection==='marketing'&&<div className="feature-grid"><article><b>كوبونات الخصم</b><p>تصميم الكوبونات وتحديد صلاحيتها يحتاج جداول وآلية تحقق عند إتمام الطلب.</p><span>غير مفعّل بعد</span></article><article><b>الحملات التسويقية</b><p>ربط حملات البريد وواتساب يحتاج مزود إرسال وموافقة المستخدم.</p><span>غير مفعّل بعد</span></article><article><b>العروض</b><p>يمكن بناء عروض مرتبطة بالمنتجات بعد إضافة محرك تسعير للمتجر.</p><span>قيد التجهيز</span></article></div>}
    {activeSection==='reports'&&<><div className="stats-grid module-stats"><article className="stat card"><span>إجمالي الطلبات</span><strong>{stats.orders}</strong></article><article className="stat card"><span>قيمة الطلبات المكتملة</span><strong>{money(stats.revenue)}</strong></article><article className="stat card"><span>متوسط قيمة الطلب المكتمل</span><strong>{money(stats.orders?stats.revenue/(orders.filter(o=>o.status==='completed').length||1):0)}</strong></article></div><p className="module-hint">التقرير الحالي مبني على سجلات الطلبات الفعلية. تقارير الأرباح الصافية والضرائب والتكاليف تحتاج تسجيل المصروفات وتكلفة البضاعة.</p></>}
    {activeSection==='website'&&<div className="feature-grid"><article><b>صفحات المتجر</b><p>قاعدة البيانات مجهزة لحفظ الصفحات والقوالب، لكن محرر السحب والإفلات والنشر العام لم يُنفذا بعد.</p><span>قاعدة البيانات جاهزة</span></article><article><b>القوالب</b><p>سنضيف قوالب متخصصة لكل نشاط مع معاينة قبل النشر.</p><span>قيد التطوير</span></article><article><b>الدومين وSEO</b><p>ربط الدومين وإعدادات محركات البحث يحتاج إعداد DNS ونشر الصفحات.</p><span>يحتاج إعداد خارجي</span></article></div>}
    {activeSection==='website'&&<>
      <div className="feature-grid">
        <article><b>{isEnglish?'Store URL':'رابط المتجر'}</b><p>{profile?.store_url|| (isEnglish?'No website URL added yet.':'لم تتم إضافة رابط موقع بعد.')}</p><span>{isEnglish?'Saved in store profile':'محفوظ في بيانات المتجر'}</span></article>
        <article><b>Google Analytics 4</b><p>{isEnglish?'A website URL alone cannot reveal visitor counts. Add a GA4 Measurement ID, install its tracking tag on the public website, then authorize the Analytics Data API to import real reports.':'إدخال رابط الموقع وحده لا يكشف عدد الزوار. نحتاج Measurement ID من GA4 وتركيب كود التتبع على الموقع، وبعدها صلاحية قراءة التقارير عبر Analytics Data API.'}</p><span>{isEnglish?'External setup required':'يحتاج إعداد خارجي'}</span></article>
      </div>
      <form className="module-form" onSubmit={saveAnalyticsId}>
        <label>Google Analytics 4 · Measurement ID</label>
        <input value={ga4Id} onChange={e=>{setGa4Id(e.target.value);setGa4Saved(false)}} placeholder="G-XXXXXXXXXX" />
        <button className="primary" disabled={saving}>{saving?(isEnglish?'Saving...':'جاري الحفظ...'):(isEnglish?'Save Measurement ID':'حفظ معرّف القياس')}</button>
        {ga4Saved&&<p className="module-hint">{isEnglish?'ID saved. Tracking is not active until the GA4 tag is installed on the website and reporting access is connected.':'تم حفظ المعرّف. التتبع لم يبدأ بعد؛ لازم نركّب كود GA4 على الموقع ونربط صلاحية قراءة التقارير.'}</p>}
      </form>
    </>}
    {activeSection==='integrations'&&<div className="feature-grid">{[['الدفع الإلكتروني','بوابات الدفع تحتاج حساب تاجر ومفاتيح سرية محفوظة في الخادم.'],['الشحن والتوصيل','التوصيل يحتاج ربط شركة الشحن وحسابها التجاري.'],['واتساب','الربط الرسمي يحتاج إعداد WhatsApp Business Platform.'],['التحليلات','يمكن إضافة أدوات التحليلات بعد ضبط الموافقة والخصوصية.']].map(([name,desc])=><article key={name}><b>{name}</b><p>{desc}</p><span>غير متصل</span></article>)}</div>}
    {activeSection==='staff'&&<div className="module-empty">جدول أعضاء الفريق موجود، لكن دعوات البريد وتطبيق الصلاحيات على كل إجراء لم تُفعّل بعد. لن نعرض دعوات وهمية أو نمنح وصولًا غير محمي.</div>}
    {activeSection==='settings'&&<div className="settings-summary"><p><b>اسم المتجر:</b> {profile?.store_name}</p><p><b>نوع النشاط:</b> {profile?.business_type}</p><p><b>رابط المتجر:</b> {profile?.store_url||'غير محدد'}</p><button className="primary" onClick={()=>setEditingProfile(true)}>تعديل بيانات المتجر</button></div>}
  </section>;
}
