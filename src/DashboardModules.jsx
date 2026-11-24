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
  const [pages,setPages] = useState([]);
  const [coupons,setCoupons] = useState([]);
  const [campaigns,setCampaigns] = useState([]);
  const [team,setTeam] = useState([]);
  const [trackingSite,setTrackingSite] = useState(null);
  const [analyticsSummary,setAnalyticsSummary] = useState(null);
  const [trackingDomain,setTrackingDomain] = useState('');
  const [showPageForm,setShowPageForm] = useState(false);
  const [pageForm,setPageForm] = useState({id:null,title:'',slug:'',template:'classic',hero_title:'',description:'',button_label:'تسوق الآن'});
  const [couponForm,setCouponForm] = useState({code:'',discount_type:'percent',discount_value:'10',min_order:'0',expires_at:''});
  const [campaignForm,setCampaignForm] = useState({name:'',channel:'email',message:''});
  const [inviteForm,setInviteForm] = useState({email:'',role:'staff',permissions:['products','orders']});
  const [showAppointment,setShowAppointment] = useState(false);
  const [ga4Id,setGa4Id] = useState('');
  const [ga4PropertyId,setGa4PropertyId] = useState('');
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
    const [p,c,o,a,g,pg,cp,cm,tm,ts,an] = await Promise.all([
      supabase.from('shopflow_products').select('*').eq('user_id',user.id).order('created_at',{ascending:false}),
      supabase.from('shopflow_customers').select('*').eq('user_id',user.id).order('created_at',{ascending:false}),
      supabase.from('shopflow_orders').select('*').eq('user_id',user.id).order('created_at',{ascending:false}),
      supabase.from('shopflow_appointments').select('*').eq('user_id',user.id).order('starts_at',{ascending:true}),
      supabase.from('shopflow_integrations').select('public_config,status').eq('user_id',user.id).eq('provider','google_analytics_4').maybeSingle()
    ]);
    const failed = [p,c,o,a,g].find(x=>x.error);
    if (failed) setError(failed.error.message || 'تعذر تحميل بيانات المتجر');
    setProducts(p.data || []); setCustomers(c.data || []); setOrders(o.data || []); setAppointments(a.data || []);
    setGa4Id(g.data?.public_config?.measurement_id || ''); setGa4PropertyId(g.data?.public_config?.property_id || ''); setGa4Saved(Boolean(g.data?.public_config?.measurement_id || g.data?.public_config?.property_id));
    setLoading(false);
  },[supabase,user?.id]);

  useEffect(()=>{ load(); },[load]);

  const stats = useMemo(()=>{
    const completed = orders.filter(o=>o.status==='completed');
    const revenue = completed.reduce((sum,o)=>sum+Number(o.total||0),0);
    const lowStock = products.filter(p=>Number(p.stock)<=5).length;
    return { products:products.length, customers:customers.length, orders:orders.length, revenue, lowStock };
  },[products,customers,orders]);

  async function savePage(e) {
    e.preventDefault(); setSaving(true); setError('');
    const slug=pageForm.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'');
    if(!slug){setError(isEnglish?'Use an English URL slug (a-z, 0-9, hyphens).':'اكتب رابط الصفحة بحروف إنجليزية وأرقام وشرطة فقط.');setSaving(false);return;}
    const payload={user_id:user.id,title:pageForm.title.trim(),slug,template:pageForm.template,
      content:{hero_title:pageForm.hero_title,description:pageForm.description,button_label:pageForm.button_label}};
    const result=pageForm.id
      ? await supabase.from('shopflow_pages').update({...payload,updated_at:new Date().toISOString()}).eq('id',pageForm.id).eq('user_id',user.id)
      : await supabase.from('shopflow_pages').insert(payload);
    setSaving(false);if(result.error){setError(result.error.message);return;}
    setShowPageForm(false);setPageForm({id:null,title:'',slug:'',template:'classic',hero_title:'',description:'',button_label:'تسوق الآن'});await load();
  }
  function editPage(page) {
    setPageForm({id:page.id,title:page.title,slug:page.slug,template:page.template||'classic',
      hero_title:page.content?.hero_title||'',description:page.content?.description||'',button_label:page.content?.button_label||'تسوق الآن'});
    setShowPageForm(true);
  }
  async function togglePage(page) {
    const {error:e1}=await supabase.from('shopflow_pages').update({is_published:!page.is_published,updated_at:new Date().toISOString()}).eq('id',page.id).eq('user_id',user.id);
    if(e1)setError(e1.message);else await load();
  }
  async function deletePage(page) {
    if(!window.confirm((isEnglish?'Delete page ':'حذف الصفحة ')+page.title+'?'))return;
    const {error:e1}=await supabase.from('shopflow_pages').delete().eq('id',page.id).eq('user_id',user.id);
    if(e1)setError(e1.message);else await load();
  }
  async function addCoupon(e) {
    e.preventDefault();setSaving(true);setError('');
    const payload={user_id:user.id,code:couponForm.code.trim().toUpperCase(),discount_type:couponForm.discount_type,
      discount_value:Number(couponForm.discount_value),min_order:Number(couponForm.min_order||0),
      expires_at:couponForm.expires_at?new Date(couponForm.expires_at).toISOString():null};
    const {error:e1}=await supabase.from('shopflow_coupons').insert(payload);
    setSaving(false);if(e1){setError(e1.message);return;}
    setCouponForm({code:'',discount_type:'percent',discount_value:'10',min_order:'0',expires_at:''});await load();
  }
  async function toggleCoupon(coupon) {
    const {error:e1}=await supabase.from('shopflow_coupons').update({is_active:!coupon.is_active}).eq('id',coupon.id).eq('user_id',user.id);
    if(e1)setError(e1.message);else await load();
  }
  async function addCampaign(e) {
    e.preventDefault();setSaving(true);setError('');
    const {error:e1}=await supabase.from('shopflow_campaigns').insert({...campaignForm,user_id:user.id});
    setSaving(false);if(e1){setError(e1.message);return;}
    setCampaignForm({name:'',channel:'email',message:''});await load();
  }
  async function inviteMember(e) {
    e.preventDefault();setSaving(true);setError('');
    const {data,error:e1}=await supabase.functions.invoke('invite-team-member',{body:inviteForm});
    setSaving(false);if(e1){setError(e1.message||'تعذر إرسال الدعوة');return;}
    setMessage(isEnglish?'Invitation sent. The member must accept the email invite before access is enabled.':'تم إرسال الدعوة. صلاحيات العضو هتتفعل بعد قبول دعوة البريد.');
    setInviteForm({email:'',role:'staff',permissions:['products','orders']});await load();
  }
  async function saveTrackingSite(e) {
    e.preventDefault();setSaving(true);setError('');
    let origin='';
    try{origin=new URL(trackingDomain.includes('://')?trackingDomain:'https://'+trackingDomain).origin;}catch{setError(isEnglish?'Enter a valid website domain.':'اكتب دومين صحيح.');setSaving(false);return;}
    const payload={user_id:user.id,allowed_origins:[origin],is_active:true};
    const result=trackingSite
      ? await supabase.from('shopflow_tracking_sites').update({...payload,updated_at:new Date().toISOString()}).eq('user_id',user.id).select().single()
      : await supabase.from('shopflow_tracking_sites').insert(payload).select().single();
    setSaving(false);if(result.error){setError(result.error.message);return;}
    setTrackingSite(result.data);setTrackingDomain(origin);
  }
  async function saveAnalyticsId(e) {
    e.preventDefault(); setSaving(true); setError('');
    const cleanId=ga4Id.trim().toUpperCase();
    if(cleanId && !/^G-[A-Z0-9]+$/.test(cleanId)){setError(isEnglish?'Enter a valid GA4 Measurement ID (G-XXXXXXXXXX).':'اكتب Measurement ID صحيح يبدأ بـ G-');setSaving(false);return;}\n    if(ga4PropertyId.trim() && !/^\\d+$/.test(ga4PropertyId.trim())){setError(isEnglish?'Property ID must contain digits only.':'رقم الخاصية لازم يكون أرقام فقط.');setSaving(false);return;}\n    if(!cleanId && !ga4PropertyId.trim()){setError(isEnglish?'Enter a Measurement ID or Property ID.':'اكتب معرّف القياس أو رقم الخاصية.');setSaving(false);return;}
    const {error:e1}=await supabase.from('shopflow_integrations').upsert({
      user_id:user.id,provider:'google_analytics_4',display_name:'Google Analytics 4',
      status:'pending',public_config:{measurement_id:cleanId,property_id:ga4PropertyId.trim()}
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
    {activeSection==='marketing'&&<>
      <h4>{isEnglish?'Discount coupons':'كوبونات الخصم'}</h4>
      <form className="module-form" onSubmit={addCoupon}>
        <div className="module-form-grid"><div><label>{isEnglish?'Coupon code':'كود الخصم'}</label><input required maxLength="30" value={couponForm.code} onChange={e=>setCouponForm({...couponForm,code:e.target.value.toUpperCase()})} placeholder="WELCOME10"/></div><div><label>{isEnglish?'Discount type':'نوع الخصم'}</label><select value={couponForm.discount_type} onChange={e=>setCouponForm({...couponForm,discount_type:e.target.value})}><option value="percent">{isEnglish?'Percentage':'نسبة مئوية'}</option><option value="fixed">{isEnglish?'Fixed amount':'مبلغ ثابت'}</option></select></div></div>
        <div className="module-form-grid"><div><label>{isEnglish?'Discount value':'قيمة الخصم'}</label><input type="number" min="0.01" step="0.01" required value={couponForm.discount_value} onChange={e=>setCouponForm({...couponForm,discount_value:e.target.value})}/></div><div><label>{isEnglish?'Minimum order':'الحد الأدنى للطلب'}</label><input type="number" min="0" step="0.01" value={couponForm.min_order} onChange={e=>setCouponForm({...couponForm,min_order:e.target.value})}/></div></div>
        <label>{isEnglish?'Expiry date (optional)':'تاريخ الانتهاء (اختياري)'}</label><input type="datetime-local" value={couponForm.expires_at} onChange={e=>setCouponForm({...couponForm,expires_at:e.target.value})}/>
        <button className="primary" disabled={saving}>{isEnglish?'Create coupon':'إنشاء الكوبون'}</button>
      </form>
      {coupons.length===0?<div className="module-empty">{isEnglish?'No coupons yet.':'لا توجد كوبونات حتى الآن.'}</div>:<div className="module-table-wrap"><table className="module-table"><thead><tr><th>{isEnglish?'Code':'الكود'}</th><th>{isEnglish?'Discount':'الخصم'}</th><th>{isEnglish?'Usage':'الاستخدام'}</th><th>{isEnglish?'Status':'الحالة'}</th><th>{isEnglish?'Action':'إجراء'}</th></tr></thead><tbody>{coupons.map(c=><tr key={c.id}><td><b>{c.code}</b></td><td>{c.discount_value}{c.discount_type==='percent'?'%':' '+profile?.currency}</td><td>{c.redeemed_count}{c.max_redemptions?'/'+c.max_redemptions:''}</td><td>{c.is_active?(isEnglish?'Active':'فعال'):(isEnglish?'Paused':'متوقف')}</td><td><button className="outline small" onClick={()=>toggleCoupon(c)}>{c.is_active?(isEnglish?'Pause':'إيقاف'):(isEnglish?'Enable':'تفعيل')}</button></td></tr>)}</tbody></table></div>}
      <divider />
      <h4>{isEnglish?'Campaign drafts':'مسودات الحملات التسويقية'}</h4>
      <form className="module-form" onSubmit={addCampaign}><label>{isEnglish?'Campaign name':'اسم الحملة'}</label><input required value={campaignForm.name} onChange={e=>setCampaignForm({...campaignForm,name:e.target.value})}/><label>{isEnglish?'Channel':'القناة'}</label><select value={campaignForm.channel} onChange={e=>setCampaignForm({...campaignForm,channel:e.target.value})}><option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="social">Social</option></select><label>{isEnglish?'Message draft':'نص الرسالة'}</label><textarea rows="3" value={campaignForm.message} onChange={e=>setCampaignForm({...campaignForm,message:e.target.value})}/><button className="primary" disabled={saving}>{isEnglish?'Save draft':'حفظ كمسودة'}</button></form>
      {campaigns.map(c=><article className="settings-summary" key={c.id}><b>{c.name}</b><p>{c.channel} · {c.status}</p><small>{c.message}</small></article>)}
      <p className="module-hint">{isEnglish?'Campaigns are saved as drafts. Sending is disabled until a verified email or WhatsApp provider is connected.':'الحملات بتتحفظ كمسودات. الإرسال مش متاح قبل توصيل مزود بريد أو واتساب موثّق.'}</p>
    </>}
    {activeSection==='reports'&&<>
      <div className="stats-grid module-stats"><article className="stat card"><span>{isEnglish?'Website visitors (30d)':'زوار الموقع (30 يوم)'}</span><strong>{analyticsSummary?.visitors??'—'}</strong></article><article className="stat card"><span>{isEnglish?'Sessions':'الجلسات'}</span><strong>{analyticsSummary?.sessions??'—'}</strong></article><article className="stat card"><span>{isEnglish?'Page views':'مشاهدات الصفحات'}</span><strong>{analyticsSummary?.page_views??'—'}</strong></article><article className="stat card"><span>{isEnglish?'Tracked purchases':'عمليات الشراء المتتبعة'}</span><strong>{analyticsSummary?.purchases??'—'}</strong></article></div>
      <div className="stats-grid module-stats"><article className="stat card"><span>{isEnglish?'Completed orders':'الطلبات المكتملة'}</span><strong>{stats.orders}</strong></article><article className="stat card"><span>{isEnglish?'Completed order revenue':'قيمة الطلبات المكتملة'}</span><strong>{money(stats.revenue)}</strong></article><article className="stat card"><span>{isEnglish?'Tracked web revenue':'إيراد الويب المتتبع'}</span><strong>{money(analyticsSummary?.tracked_revenue||0)}</strong></article></div>
      <h4>{isEnglish?'Top traffic sources':'أهم مصادر الزيارات'}</h4><div className="module-table-wrap"><table className="module-table"><thead><tr><th>{isEnglish?'Source':'المصدر'}</th><th>{isEnglish?'Sessions':'الجلسات'}</th></tr></thead><tbody>{(analyticsSummary?.sources||[]).map(x=><tr key={x.source}><td>{x.source}</td><td>{x.sessions}</td></tr>)}</tbody></table></div>
      <h4>{isEnglish?'Top pages':'أكثر الصفحات زيارة'}</h4><div className="module-table-wrap"><table className="module-table"><thead><tr><th>{isEnglish?'Page':'الصفحة'}</th><th>{isEnglish?'Views':'المشاهدات'}</th></tr></thead><tbody>{(analyticsSummary?.pages||[]).map(x=><tr key={x.page_path}><td>{x.page_path}</td><td>{x.views}</td></tr>)}</tbody></table></div>
      <p className="module-hint">{isEnglish?'Website metrics are based on events received from the installed ShopFlow tracker, not estimates. No data appears until the SQL migration, Edge Function and website script are installed.':'إحصائيات الموقع مبنية على الأحداث اللي استقبلها كود التتبع، مش تقديرات. مش هتظهر بيانات قبل تشغيل SQL ونشر Edge Function وتركيب الكود على الموقع.'}</p>
      <p className="module-hint">{isEnglish?'Store sales are calculated from completed orders. Profit is not shown because costs and fees are not yet recorded.':'مبيعات المتجر محسوبة من الطلبات المكتملة. مش بنعرض صافي الربح لأن التكاليف والرسوم لسه مش مسجلة.'}</p>
    </>}

    {activeSection==='website'&&<>
      <div className="module-actions"><button className="primary" onClick={()=>{setPageForm({id:null,title:'',slug:'',template:industry==='restaurant'?'restaurant':industry==='fashion'?'fashion':industry==='beauty'?'beauty':'classic',hero_title:'',description:'',button_label:'تسوق الآن'});setShowPageForm(v=>!v)}}>＋ {isEnglish?'Create page':'إنشاء صفحة'}</button><span className="module-hint">{isEnglish?'Published pages can be opened on a public URL.':'الصفحات المنشورة بيكون لها رابط عام.'}</span></div>
      {showPageForm&&<form className="module-form" onSubmit={savePage}><h4>{isEnglish?'Page editor':'محرر الصفحة'}</h4><label>{isEnglish?'Page name':'اسم الصفحة'}</label><input required value={pageForm.title} onChange={e=>setPageForm({...pageForm,title:e.target.value})}/><label>{isEnglish?'URL slug (English)':'رابط الصفحة بالإنجليزية'}</label><input required pattern="[A-Za-z0-9-]+" value={pageForm.slug} onChange={e=>setPageForm({...pageForm,slug:e.target.value})} placeholder="summer-collection"/><label>{isEnglish?'Template':'القالب'}</label><select value={pageForm.template} onChange={e=>setPageForm({...pageForm,template:e.target.value})}><option value="classic">{isEnglish?'Classic store':'متجر كلاسيكي'}</option><option value="restaurant">{isEnglish?'Restaurant menu':'منيو مطعم'}</option><option value="fashion">{isEnglish?'Fashion collection':'مجموعة أزياء'}</option><option value="beauty">{isEnglish?'Beauty boutique':'متجر تجميل'}</option><option value="services">{isEnglish?'Services landing page':'صفحة خدمات'}</option></select><label>{isEnglish?'Main headline':'العنوان الرئيسي'}</label><input value={pageForm.hero_title} onChange={e=>setPageForm({...pageForm,hero_title:e.target.value})}/><label>{isEnglish?'Description':'الوصف'}</label><textarea rows="3" value={pageForm.description} onChange={e=>setPageForm({...pageForm,description:e.target.value})}/><label>{isEnglish?'Button label':'نص الزر'}</label><input value={pageForm.button_label} onChange={e=>setPageForm({...pageForm,button_label:e.target.value})}/><div className="module-actions"><button className="primary" disabled={saving}>{isEnglish?'Save page':'حفظ الصفحة'}</button><button type="button" className="outline" onClick={()=>setShowPageForm(false)}>{isEnglish?'Cancel':'إلغاء'}</button></div></form>}
      {pages.length===0?<div className="module-empty">{isEnglish?'No pages created yet.':'لم تنشئ صفحات بعد.'}</div>:<div className="module-table-wrap"><table className="module-table"><thead><tr><th>{isEnglish?'Page':'الصفحة'}</th><th>{isEnglish?'Template':'القالب'}</th><th>{isEnglish?'Status':'الحالة'}</th><th>{isEnglish?'Actions':'إجراءات'}</th></tr></thead><tbody>{pages.map(p=><tr key={p.id}><td><b>{p.title}</b><small>/{p.slug}</small></td><td>{p.template}</td><td>{p.is_published?(isEnglish?'Published':'منشورة'):(isEnglish?'Draft':'مسودة')}</td><td><button className="outline small" onClick={()=>editPage(p)}>{isEnglish?'Edit':'تعديل'}</button> <button className="outline small" onClick={()=>togglePage(p)}>{p.is_published?(isEnglish?'Unpublish':'إلغاء النشر'):(isEnglish?'Publish':'نشر')}</button> <button className="danger-link" onClick={()=>deletePage(p)}>{isEnglish?'Delete':'حذف'}</button> {p.is_published&&<a href={'/store/'+user.id+'/'+p.slug} target="_blank" rel="noreferrer">{isEnglish?'Open':'فتح'}</a>}</td></tr>)}</tbody></table></div>}
      <divider />
      <h4>{isEnglish?'Independent website tracking':'تتبع موقعك المستقل'}</h4>
      <p className="module-hint">{isEnglish?'Enter the exact origin of your independently coded website. Install the script below only after obtaining analytics consent where required.':'اكتب عنوان الموقع المستقل بدقة. ركّب كود التتبع بعد الحصول على موافقة التحليلات عند الحاجة.'}</p>
      <form className="module-form" onSubmit={saveTrackingSite}><label>{isEnglish?'Website domain':'دومين الموقع'}</label><input required value={trackingDomain} onChange={e=>setTrackingDomain(e.target.value)} placeholder="https://www.example.com"/><button className="primary" disabled={saving}>{isEnglish?'Save tracking domain':'حفظ دومين التتبع'}</button></form>
      {trackingSite&&<div className="settings-summary"><p><b>{isEnglish?'Tracking token':'رمز التتبع'}:</b> {trackingSite.public_token}</p><p>{isEnglish?'Add this script to every page of the independent website:':'أضف الكود ده داخل كل صفحة في الموقع المستقل:'}</p><pre className="tracking-code">{'<script defer src="https://shopflow-codex-7d26.vercel.app/shopflow-tracker.js" data-site-token="'+trackingSite.public_token+'" data-endpoint="'+supabase.supabaseUrl+'/functions/v1/shopflow-track"></script>'}</pre><button className="outline small" onClick={()=>navigator.clipboard?.writeText('<script defer src="https://shopflow-codex-7d26.vercel.app/shopflow-tracker.js" data-site-token="'+trackingSite.public_token+'" data-endpoint="'+supabase.supabaseUrl+'/functions/v1/shopflow-track"></script>')}>{isEnglish?'Copy tracking code':'نسخ كود التتبع'}</button><p className="module-hint">{isEnglish?'Deploy the shopflow-track Edge Function and run the growth SQL migration before events can be collected.':'لازم تنشر Edge Function باسم shopflow-track وتشغّل ملف SQL الجديد قبل استقبال الزيارات.'}</p></div>}
      <divider />
      <h4>Google Analytics 4 · Data API</h4>
      <form className="module-form" onSubmit={saveAnalyticsId}><label>{isEnglish?'Measurement ID':'معرّف القياس'}</label><input value={ga4Id} onChange={e=>{setGa4Id(e.target.value);setGa4Saved(false)}} placeholder="G-XXXXXXXXXX"/><label>{isEnglish?'GA4 Property ID':'رقم خاصية GA4 (Property ID)'}</label><input value={ga4PropertyId} onChange={e=>setGa4PropertyId(e.target.value)} placeholder="123456789"/><button className="primary" disabled={saving}>{isEnglish?'Save GA4 settings':'حفظ إعدادات GA4'}</button><p className="module-hint">{isEnglish?'The GA4 Data API also needs a Google service account with Viewer access to this property. Add its credentials as Supabase Edge Function secrets; never paste private keys here.':'قراءة تقارير GA4 تحتاج Service Account من Google بصلاحية Viewer على الخاصية. بياناته السرية تتحط في Supabase Edge Function Secrets، وممنوع لصق المفتاح الخاص هنا.'}</p></form>
    </>}
    {activeSection==='integrations'&&<div className="feature-grid">{[['الدفع الإلكتروني','بوابات الدفع تحتاج حساب تاجر ومفاتيح سرية محفوظة في الخادم.'],['الشحن والتوصيل','التوصيل يحتاج ربط شركة الشحن وحسابها التجاري.'],['واتساب','الربط الرسمي يحتاج إعداد WhatsApp Business Platform.'],['التحليلات','يمكن إضافة أدوات التحليلات بعد ضبط الموافقة والخصوصية.']].map(([name,desc])=><article key={name}><b>{name}</b><p>{desc}</p><span>غير متصل</span></article>)}</div>}
    {activeSection==='staff'&&<>
      <form className="module-form" onSubmit={inviteMember}><h4>{isEnglish?'Invite a teammate':'دعوة عضو للفريق'}</h4><label>{isEnglish?'Email address':'البريد الإلكتروني'}</label><input type="email" required value={inviteForm.email} onChange={e=>setInviteForm({...inviteForm,email:e.target.value})}/><label>{isEnglish?'Role':'الدور'}</label><select value={inviteForm.role} onChange={e=>setInviteForm({...inviteForm,role:e.target.value})}><option value="manager">{isEnglish?'Manager':'مدير'}</option><option value="catalog">{isEnglish?'Catalog':'إدارة المنتجات'}</option><option value="orders">{isEnglish?'Orders':'الطلبات'}</option><option value="support">{isEnglish?'Support':'دعم العملاء'}</option><option value="staff">{isEnglish?'Custom staff':'موظف مخصص'}</option></select><label>{isEnglish?'Permissions':'الصلاحيات'}</label><div className="permission-list">{[['products','المنتجات'],['orders','الطلبات'],['customers','العملاء'],['marketing','التسويق'],['appointments','الحجوزات']].map(([key,label])=><label key={key}><input type="checkbox" checked={inviteForm.permissions.includes(key)} onChange={e=>setInviteForm(v=>({...v,permissions:e.target.checked?[...v.permissions,key]:v.permissions.filter(x=>x!==key)}))}/>{isEnglish?key:label}</label>)}</div><button className="primary" disabled={saving}>{saving?(isEnglish?'Sending...':'جاري الإرسال...'):(isEnglish?'Send invitation':'إرسال الدعوة')}</button></form>
      {team.length===0?<div className="module-empty">{isEnglish?'No team members yet.':'لا يوجد أعضاء فريق بعد.'}</div>:<div className="module-table-wrap"><table className="module-table"><thead><tr><th>{isEnglish?'Email':'البريد'}</th><th>{isEnglish?'Role':'الدور'}</th><th>{isEnglish?'Status':'الحالة'}</th></tr></thead><tbody>{team.map(m=><tr key={m.id}><td>{m.member_email}</td><td>{m.role}</td><td>{m.invite_status}</td></tr>)}</tbody></table></div>}
      <p className="module-hint">{isEnglish?'Permissions are enforced by Supabase row-level security after the invite is accepted.':'الصلاحيات بيطبقها Supabase RLS على البيانات بعد قبول الدعوة.'}</p>
    </>}
    {activeSection==='settings'&&<div className="settings-summary"><p><b>اسم المتجر:</b> {profile?.store_name}</p><p><b>نوع النشاط:</b> {profile?.business_type}</p><p><b>رابط المتجر:</b> {profile?.store_url||'غير محدد'}</p><button className="primary" onClick={()=>setEditingProfile(true)}>تعديل بيانات المتجر</button></div>}
  </section>;
}
