
/* @ts-nocheck */
// app/api/round/start/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function shuffle(a:number[]){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a;}
async function readConfigSpeed(supabase:any){try{
  const { data }=await supabase.from('config').select('value').eq('key','round.duration_ms').maybeSingle();
  const n=Number(data?.value); if(Number.isFinite(n)&&n>=100&&n<=5000) return n;
}catch{} return 800;}

export async function POST(){
  const helper=createRouteHandlerClient({cookies});
  const { data:{session} }=await helper.auth.getSession();
  if(!session) return NextResponse.json({error:'Unauthorized'},{status:401});
  const { data:me, error:meErr }=await helper.from('profiles').select('role').eq('id',session.user.id).single();
  if(meErr) return NextResponse.json({error:`profiles select failed: ${meErr.message}`},{status:400});
  if(!me||me.role!=='admin') return NextResponse.json({error:'Forbidden (need admin)'},{status:403});

  const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!);

  { const { data: live } = await supabase.from('rounds').select('*').eq('phase','live')
      .order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(live){ return NextResponse.json({ id: live.id, phase: live.phase, speed_ms: live.speed_ms, called: live.called }, { headers:{'Cache-Control':'no-store'} }); }
  }

  await supabase.from('rounds').update({phase:'ended'}).eq('phase','live');

  const speed_ms=await readConfigSpeed(supabase);
  const deck=shuffle(Array.from({length:25},(_,i)=>i+1));

  const { data: row, error }=await supabase.from('rounds')
    .insert([{ phase:'live', speed_ms, deck, called:[] }]).select('*').single();

  if(!error && row){
    return NextResponse.json({ id: row.id, phase: row.phase, speed_ms: row.speed_ms, called: row.called }, { headers:{'Cache-Control':'no-store'} });
  }

  if (error?.code === '23505' || /duplicate key value/.test(String(error?.message||''))) {
    const { data: liveAgain, error: liveErr } = await supabase.from('rounds').select('*').eq('phase','live')
      .order('created_at',{ascending:false}).limit(1).maybeSingle();
    if (liveErr) return NextResponse.json({ error: `start race: ${liveErr.message}` }, { status: 500 });
    if (liveAgain) {
      return NextResponse.json({ id: liveAgain.id, phase: liveAgain.phase, speed_ms: liveAgain.speed_ms, called: liveAgain.called }, { headers:{'Cache-Control':'no-store'} });
    }
  }

  return NextResponse.json({error:`round insert failed: ${error?.message||'unknown'}`},{status:500});
}
