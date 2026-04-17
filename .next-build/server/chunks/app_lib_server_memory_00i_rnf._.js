module.exports=[39061,e=>{"use strict";e.s(["MEMORY_AUDIT_ACTIONS",0,["created","promoted","updated","contradicted","archived","deleted"],"MEMORY_ITEM_STATUSES",0,["candidate","active","archived","contradicted","deleted"],"MEMORY_ITEM_TYPES",0,["declared_fact","preference","goal","constraint","interaction_style","inferred_trait"],"MEMORY_SENSITIVITY_LEVELS",0,["low","medium","high","blocked"]])},64698,e=>e.a(async(t,r)=>{try{var i=e.i(66680),n=e.i(22199),a=e.i(39061),s=t([n]);[n]=s.then?(await s)():s;let U=null;async function o(e){if(!(0,n.hasDatabase)())throw Error("DATABASE_URL is not configured; memory orchestrator repository requires Postgres.");let t=e??(0,n.getDb)();U||(U=(async()=>{try{let e=(await t.query("select to_regclass('public.user_memory_items') as user_memory_items, to_regclass('public.user_profile') as user_profile, to_regclass('public.memory_audit_log') as memory_audit_log")).rows[0],r=[];if(e?.user_memory_items||r.push("public.user_memory_items"),e?.user_profile||r.push("public.user_profile"),e?.memory_audit_log||r.push("public.memory_audit_log"),r.length>0)throw Error(`Memory Orchestrator schema not found (missing: ${r.join(", ")}). Apply migration app/lib/server/migrations/memory-orchestrator.migration.ts (e.g. run scripts/memory-orchestrator-migration.js).`)}catch(e){throw U=null,e}})()),await U}function l(){return new Date().toISOString()}function u(e,t,r=""){let i=e[t];return null==i?r:String(i)}function c(e,t,r=0){let i=e[t];return null==i?r:Number(i)}function m(e,t){let r=e[t];return r?new Date(String(r)).toISOString():null}function d(e,t,r){return e&&t.includes(e)?e:r}function _(e){let t;return{id:u(e,"id"),userId:u(e,"user_id"),type:u(e,"type"),category:u(e,"category",""),content:u(e,"content",""),normalizedValue:u(e,"normalized_value",""),sourceConversationId:u(e,"source_conversation_id"),sourceMessageId:(t=e.source_message_id,null==t?null:Number(t)),confidenceScore:c(e,"confidence_score",0),relevanceScore:c(e,"relevance_score",0),sensitivityLevel:u(e,"sensitivity_level"),status:u(e,"status"),validFrom:m(e,"valid_from"),validUntil:m(e,"valid_until"),createdBy:u(e,"created_by","system"),createdAt:m(e,"created_at")??l(),updatedAt:m(e,"updated_at")??l()}}function y(e){let t=e.interaction_preferences,r=e.recurring_topics,i=e.active_goals,n=e.known_constraints,a=e.key_facts;return{userId:u(e,"user_id"),summaryShort:u(e,"summary_short",""),summaryLong:u(e,"summary_long",""),interactionPreferences:t&&"object"==typeof t?t:{},recurringTopics:Array.isArray(r)?r:[],activeGoals:Array.isArray(i)?i:[],knownConstraints:Array.isArray(n)?n:[],keyFacts:Array.isArray(a)?a:[],profileVersion:c(e,"profile_version",1),lastCompiledAt:m(e,"last_compiled_at"),updatedAt:m(e,"updated_at")??l()}}function f(e){let t,r;return{id:c(e,"id",0),memoryItemId:u(e,"memory_item_id"),userId:u(e,"user_id"),action:u(e,"action"),previousStatus:(t=e.previous_status)?String(t):null,newStatus:(r=e.new_status)?String(r):null,reason:u(e,"reason",""),actor:u(e,"actor","system"),createdAt:m(e,"created_at")??l()}}async function p(e,t){await o(t);let r=t??(0,n.getDb)(),s=String(e.id||i.default.randomUUID()),l=d(e.type,a.MEMORY_ITEM_TYPES,"declared_fact"),u=d(e.status,a.MEMORY_ITEM_STATUSES,"candidate"),c=d(e.sensitivityLevel,a.MEMORY_SENSITIVITY_LEVELS,"low"),m=await r.query(`
    insert into public.user_memory_items (
      id,
      user_id,
      type,
      category,
      content,
      normalized_value,
      source_conversation_id,
      source_message_id,
      confidence_score,
      relevance_score,
      sensitivity_level,
      status,
      valid_from,
      valid_until,
      created_by
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15
    )
    returning *
    `,[s,e.userId,l,e.category??"",e.content,e.normalizedValue??"",e.sourceConversationId,e.sourceMessageId??null,e.confidenceScore??0,e.relevanceScore??0,c,u,e.validFrom??null,e.validUntil??null,e.createdBy??"system"]);return _(m.rows[0])}async function g(e,t={},r){await o(r);let i=r??(0,n.getDb)(),a=[e],s=["user_id = $1"];t.status&&(a.push(t.status),s.push(`status = $${a.length}`)),t.type&&(a.push(t.type),s.push(`type = $${a.length}`));let l=Number.isFinite(t.limit)?Math.max(1,Math.min(200,t.limit)):50;return a.push(l),(await i.query(`
    select *
    from public.user_memory_items
    where ${s.join(" and ")}
    order by updated_at desc, created_at desc
    limit $${a.length}
    `,a)).rows.map(_)}async function w(e,t,r){await o(r);let i=r??(0,n.getDb)(),a=String(t??"").trim();return a?(await i.query(`
    select *
    from public.user_memory_items
    where user_id = $1
      and status = 'active'
      and normalized_value = $2
    order by updated_at desc, created_at desc
    limit 25
    `,[e,a])).rows.map(_):[]}async function h(e,t,r,i){await o(i);let a=i??(0,n.getDb)(),s=String(r??"").trim();if(!s)return null;let l=await a.query(`
    select *
    from public.user_memory_items
    where user_id = $1
      and status = 'active'
      and type = $2
      and normalized_value = $3
    order by updated_at desc, created_at desc
    limit 1
    `,[e,t,s]);return l.rows[0]?_(l.rows[0]):null}async function $(e,t,r){await o(r);let i=r??(0,n.getDb)(),a=await i.query(`
    select *
    from public.user_memory_items
    where user_id = $1 and id = $2
    limit 1
    `,[e,t]);return a.rows[0]?_(a.rows[0]):null}async function v(e,t,r,i){await o(i);let s=i??(0,n.getDb)(),l=d(r,a.MEMORY_ITEM_STATUSES,"candidate"),u=await s.query(`
    update public.user_memory_items
    set status = $3,
        updated_at = now()
    where user_id = $1 and id = $2
    returning *
    `,[e,t,l]);return u.rows[0]?_(u.rows[0]):null}async function b(e,t,r,i){await o(i);let a=i??(0,n.getDb)(),s="string"==typeof r.category?r.category:void 0,l="string"==typeof r.content?r.content:void 0,u="string"==typeof r.normalizedValue?r.normalizedValue:void 0,c=await a.query(`
    update public.user_memory_items
    set category = coalesce($3, category),
        content = coalesce($4, content),
        normalized_value = coalesce($5, normalized_value),
        updated_at = now()
    where user_id = $1 and id = $2
    returning *
    `,[e,t,s??null,l??null,u??null]);return c.rows[0]?_(c.rows[0]):null}async function S(e,t){await o(t);let r=t??(0,n.getDb)(),i=await r.query(`
    select *
    from public.user_profile
    where user_id = $1
    limit 1
    `,[e]);return i.rows[0]?y(i.rows[0]):null}async function I(e,t){await o(t);let r=t??(0,n.getDb)(),i=e.interactionPreferences??{},a=e.recurringTopics??[],s=e.activeGoals??[],l=e.knownConstraints??[],u=e.keyFacts??[],c=await r.query(`
    insert into public.user_profile (
      user_id,
      summary_short,
      summary_long,
      interaction_preferences,
      recurring_topics,
      active_goals,
      known_constraints,
      key_facts,
      profile_version,
      last_compiled_at,
      updated_at
    ) values (
      $1, $2, $3,
      $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb,
      $9, $10, now()
    )
    on conflict (user_id) do update set
      summary_short = excluded.summary_short,
      summary_long = excluded.summary_long,
      interaction_preferences = excluded.interaction_preferences,
      recurring_topics = excluded.recurring_topics,
      active_goals = excluded.active_goals,
      known_constraints = excluded.known_constraints,
      key_facts = excluded.key_facts,
      profile_version = excluded.profile_version,
      last_compiled_at = excluded.last_compiled_at,
      updated_at = now()
    returning *
    `,[e.userId,e.summaryShort??"",e.summaryLong??"",JSON.stringify(i),JSON.stringify(a),JSON.stringify(s),JSON.stringify(l),JSON.stringify(u),e.profileVersion??1,e.lastCompiledAt??null]);return y(c.rows[0])}async function M(e,t){await o(t);let r=t??(0,n.getDb)(),i=d(e.action,a.MEMORY_AUDIT_ACTIONS,"created"),s=e.previousStatus??null,l=e.newStatus??null,u=await r.query(`
    insert into public.memory_audit_log (
      memory_item_id,
      user_id,
      action,
      previous_status,
      new_status,
      reason,
      actor
    ) values (
      $1, $2, $3, $4, $5, $6, $7
    )
    returning *
    `,[e.memoryItemId,e.userId,i,s,l,e.reason??"",e.actor??"system"]);return f(u.rows[0])}function A(e){let t,r,i=f(e),n=e.item_content_preview,a=null==n?null:String(n).trim().slice(0,140)||null;return{...i,itemType:(t=e.item_type)?String(t):null,itemStatus:(r=e.item_status)?String(r):null,itemContentPreview:a}}async function E(e,t){await o(t);let r=t??(0,n.getDb)(),i=(await r.query(`
    select
      min(created_at) as first_event_at,
      count(*) filter (where reason = 'chat_stream_auto') as automatic_captures,
      count(*) filter (
        where reason like 'manual_%' or reason = 'manual_change'
      ) as manual_corrections,
      count(*) filter (where action = 'archived') as archived,
      count(*) filter (where action = 'contradicted') as contradicted,
      count(*) filter (where action = 'deleted') as deleted
    from public.memory_audit_log
    where user_id = $1
    `,[e])).rows[0]??{};return{userId:e,firstEventAt:m(i,"first_event_at"),automaticCaptures:c(i,"automatic_captures",0),manualCorrections:c(i,"manual_corrections",0),archived:c(i,"archived",0),contradicted:c(i,"contradicted",0),deleted:c(i,"deleted",0)}}async function N(e,t={},r){await o(r);let i=r??(0,n.getDb)(),a=Number.isFinite(t.limit)?Math.max(1,Math.min(200,t.limit)):50,s="string"==typeof t.memoryItemId&&t.memoryItemId.trim()?t.memoryItemId.trim():null;return(await i.query(`
    select
      al.*,
      umi.type as item_type,
      umi.status as item_status,
      left(umi.content, 140) as item_content_preview
    from public.memory_audit_log al
    left join public.user_memory_items umi
      on umi.id = al.memory_item_id and umi.user_id = al.user_id
    where al.user_id = $1
      and ($2::text is null or al.memory_item_id = $2::text)
    order by al.created_at desc
    limit $3
    `,[e,s,a])).rows.map(A)}async function T(e){await o();let t=(0,n.getDb)(),r=await t.connect();try{await r.query("BEGIN");let t=await e(r);return await r.query("COMMIT"),t}catch(e){throw await r.query("ROLLBACK").catch(()=>null),e}finally{r.release()}}e.s(["findActiveUserMemoryItemByDedupeKey",0,h,"findActiveUserMemoryItemsByNormalizedValue",0,w,"getMemoryAuditSummary",0,E,"getUserMemoryItemById",0,$,"getUserProfile",0,S,"insertMemoryAuditLogEntry",0,M,"insertUserMemoryItem",0,p,"listMemoryAuditEvents",0,N,"listUserMemoryItemsByUserId",0,g,"updateUserMemoryItemFields",0,b,"updateUserMemoryItemStatus",0,v,"upsertUserProfile",0,I,"withMemoryTransaction",0,T]),r()}catch(e){r(e)}},!1),28,e=>e.a(async(t,r)=>{try{var i=e.i(64698),n=t([i]);function a(e){return String(e).padStart(2,"0")}function s(e){let t=String(e||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!t)return null;let r=Number(t[1]),i=Number(t[2]),n=Number(t[3]);return!Number.isFinite(r)||!Number.isFinite(i)||!Number.isFinite(n)||r<1900||r>2100||i<1||i>12||n<1||n>31?null:`${a(n)}/${a(i)}/${r}`}function o(e,t){return e.filter(e=>String(e||"").trim()).slice(0,t).map(e=>`- ${String(e).trim()}`).join("\n")}function l(e){let t=[],r=new Set;for(let i of e){let e=String(i||"").trim();if(!e)continue;let n=e.toLowerCase();r.has(n)||(r.add(n),t.push(e))}return t}async function u(e,t){let r=await (0,i.listUserMemoryItemsByUserId)(e,{status:"active",limit:500},t),n=await (0,i.getUserProfile)(e,t),u=function(e){let t=new Map;for(let r of e){let e=t.get(r.type)??[];e.push(r),t.set(r.type,e)}return t}(r),c=(u.get("declared_fact")??[]).map(e=>{let t;return(t=function(e){let t=String(e.normalizedValue||"").trim(),r=t.match(/^birthdate:(\d{4}-\d{2}-\d{2})$/i);if(r?.[1])return s(r[1]);let i=t.match(/^(\d{4}-\d{2}-\d{2})$/);if(i?.[1])return s(i[1]);let n=String(e.content||"").match(/\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/);if(!n)return null;let o=Number(n[1]),l=Number(n[2]),u=Number(n[3]);return!Number.isFinite(o)||!Number.isFinite(l)||!Number.isFinite(u)||u<1900||u>2100||l<1||l>12||o<1||o>31?null:`${a(o)}/${a(l)}/${u}`}(e))?`Nascimento: ${t}`:String(e.content||"").trim()}),m=(u.get("inferred_trait")??[]).map(e=>e.content),d=(u.get("preference")??[]).map(e=>e.content),_=(u.get("goal")??[]).map(e=>e.content),y=(u.get("constraint")??[]).map(e=>e.content),f=(u.get("interaction_style")??[]).map(e=>e.content),p=l([...c,...y.map(e=>`Restri\xe7\xe3o: ${e}`),...d.map(e=>`Prefer\xeancia: ${e}`),...f.map(e=>`Estilo: ${e}`)]).slice(0,20),g=l(_).slice(0,20),w=l(y).slice(0,20),h={interaction_style:l(f).slice(0,10),preferences:l(d).slice(0,20)},$=new Map;for(let e of r){let t=String(e.category||"").trim();if(!t)continue;let r=t.toLowerCase();$.set(r,($.get(r)??0)+1)}let v=[...$.entries()].sort((e,t)=>t[1]-e[1]).slice(0,10).map(([e])=>e),b=[],S=new Set,I=e=>{let t=String(e||"").trim();if(!t)return;let r=t.toLowerCase();S.has(r)||(S.add(r),b.push(t))},M=c.find(e=>/^nome:\s*/i.test(e))??null;M&&I(M);let A=c.find(e=>/^nascimento:\s*/i.test(e))??null;A&&I(A);let E=l(d)[0]??null,N=l(f)[0]??null;E?I(E.toLowerCase().startsWith("preferência:")?E:`Prefer\xeancia: ${E}`):N&&I(`Prefer\xeancia: ${N}`);let T=g[0]??null;if(T&&I(`Objetivo: ${T}`),0===b.length){for(let e of p)if(I(e),b.length>=3)break}let U=b.join(" • ").slice(0,240).trim(),x=["# Perfil do usuário","",p.length?"## Fatos e traços":"",p.length?o(p,20):"",m.length?`
## Infer\xeancias (n\xe3o confirmadas)`:"",m.length?o(l(m),20):"",g.length?`
## Objetivos`:"",g.length?o(g,20):"",w.length?`
## Restri\xe7\xf5es`:"",w.length?o(w,20):"",d.length?`
## Prefer\xeancias`:"",d.length?o(l(d),20):""].filter(Boolean).join("\n").trim(),O=(n?.profileVersion??0)+1,D=new Date().toISOString();return(0,i.upsertUserProfile)({userId:e,summaryShort:U,summaryLong:x,interactionPreferences:h,recurringTopics:v,activeGoals:g,knownConstraints:w,keyFacts:p,profileVersion:O,lastCompiledAt:D},t)}[i]=n.then?(await n)():n,e.s(["compileUserProfileFromActiveMemory",0,u]),r()}catch(e){r(e)}},!1)];

//# sourceMappingURL=app_lib_server_memory_00i_rnf._.js.map