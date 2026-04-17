module.exports=[18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},23862,e=>e.a(async(t,r)=>{try{let t=await e.y("pg-587764f78a6c7a9c");e.n(t),r()}catch(e){r(e)}},!0),22199,e=>e.a(async(t,r)=>{try{var a=e.i(23862),i=t([a]);[a]=i.then?(await i)():i;let m=process.env.DATABASE_URL?.trim(),_=process.env.PGSSLMODE?.trim()==="require"?{rejectUnauthorized:!1}:void 0;function n(e){let t=Number(e);return!Number.isFinite(t)||t<=0?null:Math.floor(t)}function s(e){return"object"==typeof e&&null!==e&&"code"in e}function o(e){return!!s(e)&&("53300"===e.code||"57P03"===e.code)}function u(){if(!m)throw Error("DATABASE_URL is not configured.");if(!e.g.__chocksPgPoolShutdownHandlersRegistered){e.g.__chocksPgPoolShutdownHandlersRegistered=!0;let t=async()=>{let t=e.g.__chocksPgPool;e.g.__chocksPgPool=void 0,t&&await t.end().catch(()=>null)};process.on("beforeExit",()=>{t()}),process.on("SIGINT",()=>{t().finally(()=>process.exit(0))}),process.on("SIGTERM",()=>{t().finally(()=>process.exit(0))})}if(!e.g.__chocksPgPool){let t=n(process.env.PG_POOL_MAX)??10,r=n(process.env.PG_POOL_IDLE_TIMEOUT_MS)??3e4,i=n(process.env.PG_POOL_CONNECTION_TIMEOUT_MS)??5e3;e.g.__chocksPgPool=new a.Pool({connectionString:m,ssl:_,max:t,idleTimeoutMillis:r,connectionTimeoutMillis:i}),e.g.__chocksPgPool.on("error",e=>{console.error("[db] Pool error:",e)})}return e.g.__chocksPgPool}async function l(e,t=[]){let r=n(process.env.PG_QUERY_RETRIES)??0,a=n(process.env.PG_QUERY_RETRY_BASE_DELAY_MS)??100,i=n(process.env.PG_QUERY_RETRY_MAX_DELAY_MS)??2e3;for(let n=0;n<=r;n++)try{let r=u();return await r.query(e,t)}catch(l){if(!(n<r&&o(l)))throw l;let e=Math.min(i,a*2**n),t=Math.floor(50*Math.random()),u=e+t;console.warn(`[db] Postgres busy (${s(l)?l.code:"unknown"}). Retrying query in ${u}ms (${n+1}/${r+1})...`),await function(e){return new Promise(t=>setTimeout(t,e))}(u)}throw Error("dbQuery: exhausted retries")}async function c(e){return(await l(`select id, email, display_name
     from public.app_users
     where lower(email) = lower($1)
     limit 1`,[e])).rows[0]??null}async function d(e,t,r){return(await l(`update public.app_users
     set display_name = $1,
          avatar = coalesce($3, avatar),
          updated_at = now()
     where id = $2
     returning id, email, display_name, avatar`,[t,e,void 0!==r?r:null])).rows[0]??null}e.s(["dbQuery",0,l,"findDbUserByEmail",0,c,"getDb",0,u,"hasDatabase",0,function(){return!!m},"isDatabaseBusyError",0,o,"updateDbUser",0,d]),r()}catch(e){r(e)}},!1),66680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},42151,e=>e.a(async(t,r)=>{try{var a=e.i(66680),i=e.i(22199),n=t([i]);function s(){let e=process.env.ADMIN_EMAIL?.trim(),t=process.env.ADMIN_PASSWORD?.trim(),r=process.env.ADMIN_DISPLAY_NAME?.trim()||"Admin Chocks",a=process.env.AUTH_SECRET?.trim();return e&&t&&a?{email:e,password:t,displayName:r,secret:a}:null}function o(e,t){return a.default.createHmac("sha256",t).update(e).digest("base64url")}function u(){let e=s();return e?{email:e.email,password:e.password,displayName:e.displayName}:null}async function l(e,t){let r=e.trim().toLowerCase(),a=t.trim(),n=u();if(!n)throw Error("Auth is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD and AUTH_SECRET.");if(r!==n.email.toLowerCase()||a!==n.password)return null;let s=await (0,i.findDbUserByEmail)(n.email).catch(()=>null);return{id:s?.id??"local-admin",email:s?.email??n.email,displayName:s?.display_name??n.displayName}}[i]=n.then?(await n)():n,e.s(["authenticate",0,l,"createToken",0,function(e){var t;let r=s();if(!r)throw Error("Auth is not configured. Set AUTH_SECRET before issuing tokens.");let a={...e,exp:Math.floor(Date.now()/1e3)+43200},i=(t=JSON.stringify(a),Buffer.from(t,"utf8").toString("base64url")),n=o(i,r.secret);return`${i}.${n}`},"getLoginConfig",0,u,"isAuthConfigured",0,function(){return null!==s()},"verifyToken",0,function(e){let t=s();if(!t)return null;let[r,a]=e.split(".");if(!r||!a)return null;let i=o(r,t.secret);if(a!==i)return null;try{let e=JSON.parse(Buffer.from(r,"base64url").toString("utf8"));if(e.exp<=Math.floor(Date.now()/1e3))return null;return{id:e.id,email:e.email,displayName:e.displayName}}catch{return null}}]),r()}catch(e){r(e)}},!1),97914,e=>e.a(async(t,r)=>{try{var a=e.i(42151),i=t([a]);[a]=i.then?(await i)():i,e.s(["requireUser",0,function(e){let t,r=(t=e.headers.get("authorization")||"").toLowerCase().startsWith("bearer ")&&t.slice(7).trim()||null;return(r||(r=e.nextUrl.searchParams.get("token")||null),r)?(0,a.verifyToken)(r):null}]),r()}catch(e){r(e)}},!1),39061,e=>{"use strict";e.s(["MEMORY_AUDIT_ACTIONS",0,["created","promoted","updated","contradicted","archived","deleted"],"MEMORY_ITEM_STATUSES",0,["candidate","active","archived","contradicted","deleted"],"MEMORY_ITEM_TYPES",0,["declared_fact","preference","goal","constraint","interaction_style","inferred_trait"],"MEMORY_SENSITIVITY_LEVELS",0,["low","medium","high","blocked"]])},64698,e=>e.a(async(t,r)=>{try{var a=e.i(66680),i=e.i(22199),n=e.i(39061),s=t([i]);[i]=s.then?(await s)():s;let D=null;async function o(e){if(!(0,i.hasDatabase)())throw Error("DATABASE_URL is not configured; memory orchestrator repository requires Postgres.");let t=e??(0,i.getDb)();D||(D=(async()=>{try{let e=(await t.query("select to_regclass('public.user_memory_items') as user_memory_items, to_regclass('public.user_profile') as user_profile, to_regclass('public.memory_audit_log') as memory_audit_log")).rows[0],r=[];if(e?.user_memory_items||r.push("public.user_memory_items"),e?.user_profile||r.push("public.user_profile"),e?.memory_audit_log||r.push("public.memory_audit_log"),r.length>0)throw Error(`Memory Orchestrator schema not found (missing: ${r.join(", ")}). Apply migration app/lib/server/migrations/memory-orchestrator.migration.ts (e.g. run scripts/memory-orchestrator-migration.js).`)}catch(e){throw D=null,e}})()),await D}function u(){return new Date().toISOString()}function l(e,t,r=""){let a=e[t];return null==a?r:String(a)}function c(e,t,r=0){let a=e[t];return null==a?r:Number(a)}function d(e,t){let r=e[t];return r?new Date(String(r)).toISOString():null}function m(e,t,r){return e&&t.includes(e)?e:r}function _(e){let t;return{id:l(e,"id"),userId:l(e,"user_id"),type:l(e,"type"),category:l(e,"category",""),content:l(e,"content",""),normalizedValue:l(e,"normalized_value",""),sourceConversationId:l(e,"source_conversation_id"),sourceMessageId:(t=e.source_message_id,null==t?null:Number(t)),confidenceScore:c(e,"confidence_score",0),relevanceScore:c(e,"relevance_score",0),sensitivityLevel:l(e,"sensitivity_level"),status:l(e,"status"),validFrom:d(e,"valid_from"),validUntil:d(e,"valid_until"),createdBy:l(e,"created_by","system"),createdAt:d(e,"created_at")??u(),updatedAt:d(e,"updated_at")??u()}}function y(e){let t=e.interaction_preferences,r=e.recurring_topics,a=e.active_goals,i=e.known_constraints,n=e.key_facts;return{userId:l(e,"user_id"),summaryShort:l(e,"summary_short",""),summaryLong:l(e,"summary_long",""),interactionPreferences:t&&"object"==typeof t?t:{},recurringTopics:Array.isArray(r)?r:[],activeGoals:Array.isArray(a)?a:[],knownConstraints:Array.isArray(i)?i:[],keyFacts:Array.isArray(n)?n:[],profileVersion:c(e,"profile_version",1),lastCompiledAt:d(e,"last_compiled_at"),updatedAt:d(e,"updated_at")??u()}}function p(e){let t,r;return{id:c(e,"id",0),memoryItemId:l(e,"memory_item_id"),userId:l(e,"user_id"),action:l(e,"action"),previousStatus:(t=e.previous_status)?String(t):null,newStatus:(r=e.new_status)?String(r):null,reason:l(e,"reason",""),actor:l(e,"actor","system"),createdAt:d(e,"created_at")??u()}}async function f(e,t){await o(t);let r=t??(0,i.getDb)(),s=String(e.id||a.default.randomUUID()),u=m(e.type,n.MEMORY_ITEM_TYPES,"declared_fact"),l=m(e.status,n.MEMORY_ITEM_STATUSES,"candidate"),c=m(e.sensitivityLevel,n.MEMORY_SENSITIVITY_LEVELS,"low"),d=await r.query(`
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
    `,[s,e.userId,u,e.category??"",e.content,e.normalizedValue??"",e.sourceConversationId,e.sourceMessageId??null,e.confidenceScore??0,e.relevanceScore??0,c,l,e.validFrom??null,e.validUntil??null,e.createdBy??"system"]);return _(d.rows[0])}async function g(e,t={},r){await o(r);let a=r??(0,i.getDb)(),n=[e],s=["user_id = $1"];t.status&&(n.push(t.status),s.push(`status = $${n.length}`)),t.type&&(n.push(t.type),s.push(`type = $${n.length}`));let u=Number.isFinite(t.limit)?Math.max(1,Math.min(200,t.limit)):50;return n.push(u),(await a.query(`
    select *
    from public.user_memory_items
    where ${s.join(" and ")}
    order by updated_at desc, created_at desc
    limit $${n.length}
    `,n)).rows.map(_)}async function w(e,t,r){await o(r);let a=r??(0,i.getDb)(),n=String(t??"").trim();return n?(await a.query(`
    select *
    from public.user_memory_items
    where user_id = $1
      and status = 'active'
      and normalized_value = $2
    order by updated_at desc, created_at desc
    limit 25
    `,[e,n])).rows.map(_):[]}async function h(e,t,r,a){await o(a);let n=a??(0,i.getDb)(),s=String(r??"").trim();if(!s)return null;let u=await n.query(`
    select *
    from public.user_memory_items
    where user_id = $1
      and status = 'active'
      and type = $2
      and normalized_value = $3
    order by updated_at desc, created_at desc
    limit 1
    `,[e,t,s]);return u.rows[0]?_(u.rows[0]):null}async function v(e,t,r){await o(r);let a=r??(0,i.getDb)(),n=await a.query(`
    select *
    from public.user_memory_items
    where user_id = $1 and id = $2
    limit 1
    `,[e,t]);return n.rows[0]?_(n.rows[0]):null}async function b(e,t,r,a){await o(a);let s=a??(0,i.getDb)(),u=m(r,n.MEMORY_ITEM_STATUSES,"candidate"),l=await s.query(`
    update public.user_memory_items
    set status = $3,
        updated_at = now()
    where user_id = $1 and id = $2
    returning *
    `,[e,t,u]);return l.rows[0]?_(l.rows[0]):null}async function S(e,t,r,a){await o(a);let n=a??(0,i.getDb)(),s="string"==typeof r.category?r.category:void 0,u="string"==typeof r.content?r.content:void 0,l="string"==typeof r.normalizedValue?r.normalizedValue:void 0,c=await n.query(`
    update public.user_memory_items
    set category = coalesce($3, category),
        content = coalesce($4, content),
        normalized_value = coalesce($5, normalized_value),
        updated_at = now()
    where user_id = $1 and id = $2
    returning *
    `,[e,t,s??null,u??null,l??null]);return c.rows[0]?_(c.rows[0]):null}async function $(e,t){await o(t);let r=t??(0,i.getDb)(),a=await r.query(`
    select *
    from public.user_profile
    where user_id = $1
    limit 1
    `,[e]);return a.rows[0]?y(a.rows[0]):null}async function E(e,t){await o(t);let r=t??(0,i.getDb)(),a=e.interactionPreferences??{},n=e.recurringTopics??[],s=e.activeGoals??[],u=e.knownConstraints??[],l=e.keyFacts??[],c=await r.query(`
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
    `,[e.userId,e.summaryShort??"",e.summaryLong??"",JSON.stringify(a),JSON.stringify(n),JSON.stringify(s),JSON.stringify(u),JSON.stringify(l),e.profileVersion??1,e.lastCompiledAt??null]);return y(c.rows[0])}async function M(e,t){await o(t);let r=t??(0,i.getDb)(),a=m(e.action,n.MEMORY_AUDIT_ACTIONS,"created"),s=e.previousStatus??null,u=e.newStatus??null,l=await r.query(`
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
    `,[e.memoryItemId,e.userId,a,s,u,e.reason??"",e.actor??"system"]);return p(l.rows[0])}function I(e){let t,r,a=p(e),i=e.item_content_preview,n=null==i?null:String(i).trim().slice(0,140)||null;return{...a,itemType:(t=e.item_type)?String(t):null,itemStatus:(r=e.item_status)?String(r):null,itemContentPreview:n}}async function A(e,t){await o(t);let r=t??(0,i.getDb)(),a=(await r.query(`
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
    `,[e])).rows[0]??{};return{userId:e,firstEventAt:d(a,"first_event_at"),automaticCaptures:c(a,"automatic_captures",0),manualCorrections:c(a,"manual_corrections",0),archived:c(a,"archived",0),contradicted:c(a,"contradicted",0),deleted:c(a,"deleted",0)}}async function x(e,t={},r){await o(r);let a=r??(0,i.getDb)(),n=Number.isFinite(t.limit)?Math.max(1,Math.min(200,t.limit)):50,s="string"==typeof t.memoryItemId&&t.memoryItemId.trim()?t.memoryItemId.trim():null;return(await a.query(`
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
    `,[e,s,n])).rows.map(I)}async function T(e){await o();let t=(0,i.getDb)(),r=await t.connect();try{await r.query("BEGIN");let t=await e(r);return await r.query("COMMIT"),t}catch(e){throw await r.query("ROLLBACK").catch(()=>null),e}finally{r.release()}}e.s(["findActiveUserMemoryItemByDedupeKey",0,h,"findActiveUserMemoryItemsByNormalizedValue",0,w,"getMemoryAuditSummary",0,A,"getUserMemoryItemById",0,v,"getUserProfile",0,$,"insertMemoryAuditLogEntry",0,M,"insertUserMemoryItem",0,f,"listMemoryAuditEvents",0,x,"listUserMemoryItemsByUserId",0,g,"updateUserMemoryItemFields",0,S,"updateUserMemoryItemStatus",0,b,"upsertUserProfile",0,E,"withMemoryTransaction",0,T]),r()}catch(e){r(e)}},!1)];

//# sourceMappingURL=%5Broot-of-the-server%5D__06x0nw0._.js.map