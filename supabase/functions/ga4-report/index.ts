import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const enc=(v:string)=>btoa(String.fromCharCode(...new TextEncoder().encode(v))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const toBase64Url=(bytes:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return new Response("Method not allowed",{status:405,headers:cors});
  try{
    const url=Deno.env.get("SUPABASE_URL")!, serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const caller=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("Authorization")||""}}});
    const {data:{user},error:authError}=await caller.auth.getUser();
    if(authError||!user)return Response.json({error:"Unauthorized"},{status:401,headers:cors});
    const admin=createClient(url,serviceKey);
    const {data:integration,error}=await admin.from("shopflow_integrations").select("public_config").eq("user_id",user.id).eq("provider","google_analytics_4").maybeSingle();
    if(error||!integration?.public_config?.property_id)return Response.json({error:"Save a GA4 Property ID first."},{status:400,headers:cors});
    const raw=Deno.env.get("GA4_SERVICE_ACCOUNT_JSON");
    if(!raw)return Response.json({error:"GA4_SERVICE_ACCOUNT_JSON is not configured in Supabase Edge Function secrets."},{status:503,headers:cors});
    const account=JSON.parse(raw);
    const now=Math.floor(Date.now()/1000);
    const header=enc(JSON.stringify({alg:"RS256",typ:"JWT"}));
    const claim=enc(JSON.stringify({iss:account.client_email,scope:"https://www.googleapis.com/auth/analytics.readonly",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600}));
    const unsigned=header+"."+claim;
    const pem=String(account.private_key||"").replace(/\\n/g,"\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\\s/g,"");
    const binary=Uint8Array.from(atob(pem),c=>c.charCodeAt(0));
    const key=await crypto.subtle.importKey("pkcs8",binary.buffer,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
    const signature=await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(unsigned));
    const assertion=unsigned+"."+toBase64Url(signature);
    const tokenResponse=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})});
    const tokenJson=await tokenResponse.json();
    if(!tokenResponse.ok)return Response.json({error:tokenJson.error_description||tokenJson.error||"Google authorization failed."},{status:502,headers:cors});
    const body=await req.json().catch(()=>({}));
    const endDate=String(body.endDate||new Date().toISOString().slice(0,10));
    const startDate=String(body.startDate||new Date(Date.now()-29*86400000).toISOString().slice(0,10));
    if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(startDate)||!/^\\d{4}-\\d{2}-\\d{2}$/.test(endDate))return Response.json({error:"Dates must use YYYY-MM-DD."},{status:400,headers:cors});
    const report=await fetch("https://analyticsdata.googleapis.com/v1beta/properties/"+encodeURIComponent(String(integration.public_config.property_id))+":runReport",{
      method:"POST",headers:{"Authorization":"Bearer "+tokenJson.access_token,"Content-Type":"application/json"},
      body:JSON.stringify({dateRanges:[{startDate,endDate}],dimensions:[{name:"sessionSource"},{name:"pagePath"}],metrics:[{name:"activeUsers"},{name:"sessions"},{name:"screenPageViews"},{name:"eventCount"},{name:"conversions"},{name:"totalRevenue"}],limit:100})
    });
    const reportJson=await report.json();
    if(!report.ok)return Response.json({error:reportJson.error?.message||"GA4 Data API request failed."},{status:502,headers:cors});
    return Response.json({ok:true,startDate,endDate,report:reportJson},{headers:cors});
  }catch(e){return Response.json({error:String(e?.message||e)},{status:500,headers:cors});}
});
