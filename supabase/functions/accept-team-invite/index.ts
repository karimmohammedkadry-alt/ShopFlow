import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return new Response("Method not allowed",{status:405,headers:cors});
  try{
    const url=Deno.env.get("SUPABASE_URL")!, serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const caller=createClient(url,anon,{global:{headers:{Authorization:req.headers.get("Authorization")||""}}});
    const {data:{user},error}=await caller.auth.getUser();
    if(error||!user)return Response.json({error:"Unauthorized"},{status:401,headers:cors});
    const admin=createClient(url,serviceKey);
    const {data:rows,error:lookupError}=await admin.from("shopflow_team_members").update({invite_status:"accepted",accepted_at:new Date().toISOString()})
      .eq("member_user_id",user.id).eq("invite_status","pending").ilike("member_email",user.email||"").select("owner_id,role,permissions");
    if(lookupError)return Response.json({error:lookupError.message},{status:500,headers:cors});
    return Response.json({ok:true,memberships:rows||[]},{headers:cors});
  }catch(e){return Response.json({error:String(e?.message||e)},{status:500,headers:cors});}
});
