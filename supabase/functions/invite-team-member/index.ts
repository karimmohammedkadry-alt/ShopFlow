import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return new Response("Method not allowed",{status:405,headers:cors});
  try{
    const url=Deno.env.get("SUPABASE_URL")!, serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const auth=req.headers.get("Authorization")||"";
    const caller=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const {data:{user},error:authError}=await caller.auth.getUser();
    if(authError||!user)return Response.json({error:"Unauthorized"},{status:401,headers:cors});
    const admin=createClient(url,serviceKey);
    const {data:profile}=await admin.from("shopflow_profiles").select("user_id").eq("user_id",user.id).maybeSingle();
    if(!profile)return Response.json({error:"Only the store owner can invite team members."},{status:403,headers:cors});
    const {data:membership}=await admin.from("shopflow_team_members").select("id").eq("member_user_id",user.id).eq("invite_status","accepted").maybeSingle();
    if(membership)return Response.json({error:"Team members cannot invite other members."},{status:403,headers:cors});
    const body=await req.json();
    const email=String(body.email||"").trim().toLowerCase();
    const roles=["manager","catalog","orders","support","staff"];
    const role=roles.includes(body.role)?body.role:"staff";
    const allowed=["products","orders","customers","marketing","appointments"];
    const permissions=role==="manager"?allowed: Array.isArray(body.permissions)?body.permissions.filter((p:string)=>allowed.includes(p)):[];
    if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))return Response.json({error:"Enter a valid email address."},{status:400,headers:cors});
    if(email===user.email?.toLowerCase())return Response.json({error:"You cannot invite your own email."},{status:400,headers:cors});
    const siteUrl=Deno.env.get("SHOPFLOW_SITE_URL")||"https://shopflow-codex-7d26.vercel.app";
    const {data:inviteData,error:inviteError}=await admin.auth.admin.inviteUserByEmail(email,{redirectTo:siteUrl});
    if(inviteError)return Response.json({error:inviteError.message},{status:400,headers:cors});
    const memberId=inviteData.user?.id;
    if(!memberId)return Response.json({error:"Invitation was created but user ID was not returned."},{status:500,headers:cors});
    const {error:saveError}=await admin.from("shopflow_team_members").upsert({
      owner_id:user.id,member_email:email,member_user_id:memberId,role,permissions,
      invited_by:user.id,invite_status:"pending",accepted_at:null
    },{onConflict:"owner_id,member_email"});
    if(saveError)return Response.json({error:saveError.message},{status:500,headers:cors});
    return Response.json({ok:true,email,role},{headers:cors});
  }catch(e){return Response.json({error:String(e?.message||e)},{status:500,headers:cors});}
});
