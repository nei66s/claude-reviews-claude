module.exports=[18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,t,r)=>{t.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},23862,e=>e.a(async(t,r)=>{try{let t=await e.y("pg-587764f78a6c7a9c");e.n(t),r()}catch(e){r(e)}},!0),22199,e=>e.a(async(t,r)=>{try{var a=e.i(23862),n=t([a]);[a]=n.then?(await n)():n;let m=process.env.DATABASE_URL?.trim(),p=process.env.PGSSLMODE?.trim()==="require"?{rejectUnauthorized:!1}:void 0;function i(e){let t=Number(e);return!Number.isFinite(t)||t<=0?null:Math.floor(t)}function s(e){return"object"==typeof e&&null!==e&&"code"in e}function o(e){return!!s(e)&&("53300"===e.code||"57P03"===e.code)}function l(){if(!m)throw Error("DATABASE_URL is not configured.");if(!e.g.__chocksPgPoolShutdownHandlersRegistered){e.g.__chocksPgPoolShutdownHandlersRegistered=!0;let t=async()=>{let t=e.g.__chocksPgPool;e.g.__chocksPgPool=void 0,t&&await t.end().catch(()=>null)};process.on("beforeExit",()=>{t()}),process.on("SIGINT",()=>{t().finally(()=>process.exit(0))}),process.on("SIGTERM",()=>{t().finally(()=>process.exit(0))})}if(!e.g.__chocksPgPool){let t=i(process.env.PG_POOL_MAX)??10,r=i(process.env.PG_POOL_IDLE_TIMEOUT_MS)??3e4,n=i(process.env.PG_POOL_CONNECTION_TIMEOUT_MS)??5e3;e.g.__chocksPgPool=new a.Pool({connectionString:m,ssl:p,max:t,idleTimeoutMillis:r,connectionTimeoutMillis:n}),e.g.__chocksPgPool.on("error",e=>{console.error("[db] Pool error:",e)})}return e.g.__chocksPgPool}async function u(e,t=[]){let r=i(process.env.PG_QUERY_RETRIES)??0,a=i(process.env.PG_QUERY_RETRY_BASE_DELAY_MS)??100,n=i(process.env.PG_QUERY_RETRY_MAX_DELAY_MS)??2e3;for(let i=0;i<=r;i++)try{let r=l();return await r.query(e,t)}catch(u){if(!(i<r&&o(u)))throw u;let e=Math.min(n,a*2**i),t=Math.floor(50*Math.random()),l=e+t;console.warn(`[db] Postgres busy (${s(u)?u.code:"unknown"}). Retrying query in ${l}ms (${i+1}/${r+1})...`),await function(e){return new Promise(t=>setTimeout(t,e))}(l)}throw Error("dbQuery: exhausted retries")}async function c(e){return(await u(`select id, email, display_name
     from public.app_users
     where lower(email) = lower($1)
     limit 1`,[e])).rows[0]??null}async function d(e,t,r){return(await u(`update public.app_users
     set display_name = $1,
          avatar = coalesce($3, avatar),
          updated_at = now()
     where id = $2
     returning id, email, display_name, avatar`,[t,e,void 0!==r?r:null])).rows[0]??null}e.s(["dbQuery",0,u,"findDbUserByEmail",0,c,"getDb",0,l,"hasDatabase",0,function(){return!!m},"isDatabaseBusyError",0,o,"updateDbUser",0,d]),r()}catch(e){r(e)}},!1),66680,(e,t,r)=>{t.exports=e.x("node:crypto",()=>require("node:crypto"))},42151,e=>e.a(async(t,r)=>{try{var a=e.i(66680),n=e.i(22199),i=t([n]);function s(){let e=process.env.ADMIN_EMAIL?.trim(),t=process.env.ADMIN_PASSWORD?.trim(),r=process.env.ADMIN_DISPLAY_NAME?.trim()||"Admin Chocks",a=process.env.AUTH_SECRET?.trim();return e&&t&&a?{email:e,password:t,displayName:r,secret:a}:null}function o(e,t){return a.default.createHmac("sha256",t).update(e).digest("base64url")}function l(){let e=s();return e?{email:e.email,password:e.password,displayName:e.displayName}:null}async function u(e,t){let r=e.trim().toLowerCase(),a=t.trim(),i=l();if(!i)throw Error("Auth is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD and AUTH_SECRET.");if(r!==i.email.toLowerCase()||a!==i.password)return null;let s=await (0,n.findDbUserByEmail)(i.email).catch(()=>null);return{id:s?.id??"local-admin",email:s?.email??i.email,displayName:s?.display_name??i.displayName}}[n]=i.then?(await i)():i,e.s(["authenticate",0,u,"createToken",0,function(e){var t;let r=s();if(!r)throw Error("Auth is not configured. Set AUTH_SECRET before issuing tokens.");let a={...e,exp:Math.floor(Date.now()/1e3)+43200},n=(t=JSON.stringify(a),Buffer.from(t,"utf8").toString("base64url")),i=o(n,r.secret);return`${n}.${i}`},"getLoginConfig",0,l,"isAuthConfigured",0,function(){return null!==s()},"verifyToken",0,function(e){let t=s();if(!t)return null;let[r,a]=e.split(".");if(!r||!a)return null;let n=o(r,t.secret);if(a!==n)return null;try{let e=JSON.parse(Buffer.from(r,"base64url").toString("utf8"));if(e.exp<=Math.floor(Date.now()/1e3))return null;return{id:e.id,email:e.email,displayName:e.displayName}}catch{return null}}]),r()}catch(e){r(e)}},!1),97914,e=>e.a(async(t,r)=>{try{var a=e.i(42151),n=t([a]);[a]=n.then?(await n)():n,e.s(["requireUser",0,function(e){let t,r=(t=e.headers.get("authorization")||"").toLowerCase().startsWith("bearer ")&&t.slice(7).trim()||null;return(r||(r=e.nextUrl.searchParams.get("token")||null),r)?(0,a.verifyToken)(r):null}]),r()}catch(e){r(e)}},!1),39061,e=>{"use strict";e.s(["MEMORY_AUDIT_ACTIONS",0,["created","promoted","updated","contradicted","archived","deleted"],"MEMORY_ITEM_STATUSES",0,["candidate","active","archived","contradicted","deleted"],"MEMORY_ITEM_TYPES",0,["declared_fact","preference","goal","constraint","interaction_style","inferred_trait"],"MEMORY_SENSITIVITY_LEVELS",0,["low","medium","high","blocked"]])},64698,e=>e.a(async(t,r)=>{try{var a=e.i(66680),n=e.i(22199),i=e.i(39061),s=t([n]);[n]=s.then?(await s)():s;let T=null;async function o(e){if(!(0,n.hasDatabase)())throw Error("DATABASE_URL is not configured; memory orchestrator repository requires Postgres.");let t=e??(0,n.getDb)();T||(T=(async()=>{try{let e=(await t.query("select to_regclass('public.user_memory_items') as user_memory_items, to_regclass('public.user_profile') as user_profile, to_regclass('public.memory_audit_log') as memory_audit_log")).rows[0],r=[];if(e?.user_memory_items||r.push("public.user_memory_items"),e?.user_profile||r.push("public.user_profile"),e?.memory_audit_log||r.push("public.memory_audit_log"),r.length>0)throw Error(`Memory Orchestrator schema not found (missing: ${r.join(", ")}). Apply migration app/lib/server/migrations/memory-orchestrator.migration.ts (e.g. run scripts/memory-orchestrator-migration.js).`)}catch(e){throw T=null,e}})()),await T}function l(){return new Date().toISOString()}function u(e,t,r=""){let a=e[t];return null==a?r:String(a)}function c(e,t,r=0){let a=e[t];return null==a?r:Number(a)}function d(e,t){let r=e[t];return r?new Date(String(r)).toISOString():null}function m(e,t,r){return e&&t.includes(e)?e:r}function p(e){let t;return{id:u(e,"id"),userId:u(e,"user_id"),type:u(e,"type"),category:u(e,"category",""),content:u(e,"content",""),normalizedValue:u(e,"normalized_value",""),sourceConversationId:u(e,"source_conversation_id"),sourceMessageId:(t=e.source_message_id,null==t?null:Number(t)),confidenceScore:c(e,"confidence_score",0),relevanceScore:c(e,"relevance_score",0),sensitivityLevel:u(e,"sensitivity_level"),status:u(e,"status"),validFrom:d(e,"valid_from"),validUntil:d(e,"valid_until"),createdBy:u(e,"created_by","system"),createdAt:d(e,"created_at")??l(),updatedAt:d(e,"updated_at")??l()}}function _(e){let t=e.interaction_preferences,r=e.recurring_topics,a=e.active_goals,n=e.known_constraints,i=e.key_facts;return{userId:u(e,"user_id"),summaryShort:u(e,"summary_short",""),summaryLong:u(e,"summary_long",""),interactionPreferences:t&&"object"==typeof t?t:{},recurringTopics:Array.isArray(r)?r:[],activeGoals:Array.isArray(a)?a:[],knownConstraints:Array.isArray(n)?n:[],keyFacts:Array.isArray(i)?i:[],profileVersion:c(e,"profile_version",1),lastCompiledAt:d(e,"last_compiled_at"),updatedAt:d(e,"updated_at")??l()}}function y(e){let t,r;return{id:c(e,"id",0),memoryItemId:u(e,"memory_item_id"),userId:u(e,"user_id"),action:u(e,"action"),previousStatus:(t=e.previous_status)?String(t):null,newStatus:(r=e.new_status)?String(r):null,reason:u(e,"reason",""),actor:u(e,"actor","system"),createdAt:d(e,"created_at")??l()}}async function f(e,t){await o(t);let r=t??(0,n.getDb)(),s=String(e.id||a.default.randomUUID()),l=m(e.type,i.MEMORY_ITEM_TYPES,"declared_fact"),u=m(e.status,i.MEMORY_ITEM_STATUSES,"candidate"),c=m(e.sensitivityLevel,i.MEMORY_SENSITIVITY_LEVELS,"low"),d=await r.query(`
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
    `,[s,e.userId,l,e.category??"",e.content,e.normalizedValue??"",e.sourceConversationId,e.sourceMessageId??null,e.confidenceScore??0,e.relevanceScore??0,c,u,e.validFrom??null,e.validUntil??null,e.createdBy??"system"]);return p(d.rows[0])}async function g(e,t={},r){await o(r);let a=r??(0,n.getDb)(),i=[e],s=["user_id = $1"];t.status&&(i.push(t.status),s.push(`status = $${i.length}`)),t.type&&(i.push(t.type),s.push(`type = $${i.length}`));let l=Number.isFinite(t.limit)?Math.max(1,Math.min(200,t.limit)):50;return i.push(l),(await a.query(`
    select *
    from public.user_memory_items
    where ${s.join(" and ")}
    order by updated_at desc, created_at desc
    limit $${i.length}
    `,i)).rows.map(p)}async function h(e,t,r){await o(r);let a=r??(0,n.getDb)(),i=String(t??"").trim();return i?(await a.query(`
    select *
    from public.user_memory_items
    where user_id = $1
      and status = 'active'
      and normalized_value = $2
    order by updated_at desc, created_at desc
    limit 25
    `,[e,i])).rows.map(p):[]}async function w(e,t,r,a){await o(a);let i=a??(0,n.getDb)(),s=String(r??"").trim();if(!s)return null;let l=await i.query(`
    select *
    from public.user_memory_items
    where user_id = $1
      and status = 'active'
      and type = $2
      and normalized_value = $3
    order by updated_at desc, created_at desc
    limit 1
    `,[e,t,s]);return l.rows[0]?p(l.rows[0]):null}async function v(e,t,r){await o(r);let a=r??(0,n.getDb)(),i=await a.query(`
    select *
    from public.user_memory_items
    where user_id = $1 and id = $2
    limit 1
    `,[e,t]);return i.rows[0]?p(i.rows[0]):null}async function E(e,t,r,a){await o(a);let s=a??(0,n.getDb)(),l=m(r,i.MEMORY_ITEM_STATUSES,"candidate"),u=await s.query(`
    update public.user_memory_items
    set status = $3,
        updated_at = now()
    where user_id = $1 and id = $2
    returning *
    `,[e,t,l]);return u.rows[0]?p(u.rows[0]):null}async function b(e,t,r,a){await o(a);let i=a??(0,n.getDb)(),s="string"==typeof r.category?r.category:void 0,l="string"==typeof r.content?r.content:void 0,u="string"==typeof r.normalizedValue?r.normalizedValue:void 0,c=await i.query(`
    update public.user_memory_items
    set category = coalesce($3, category),
        content = coalesce($4, content),
        normalized_value = coalesce($5, normalized_value),
        updated_at = now()
    where user_id = $1 and id = $2
    returning *
    `,[e,t,s??null,l??null,u??null]);return c.rows[0]?p(c.rows[0]):null}async function S(e,t){await o(t);let r=t??(0,n.getDb)(),a=await r.query(`
    select *
    from public.user_profile
    where user_id = $1
    limit 1
    `,[e]);return a.rows[0]?_(a.rows[0]):null}async function R(e,t){await o(t);let r=t??(0,n.getDb)(),a=e.interactionPreferences??{},i=e.recurringTopics??[],s=e.activeGoals??[],l=e.knownConstraints??[],u=e.keyFacts??[],c=await r.query(`
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
    `,[e.userId,e.summaryShort??"",e.summaryLong??"",JSON.stringify(a),JSON.stringify(i),JSON.stringify(s),JSON.stringify(l),JSON.stringify(u),e.profileVersion??1,e.lastCompiledAt??null]);return _(c.rows[0])}async function x(e,t){await o(t);let r=t??(0,n.getDb)(),a=m(e.action,i.MEMORY_AUDIT_ACTIONS,"created"),s=e.previousStatus??null,l=e.newStatus??null,u=await r.query(`
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
    `,[e.memoryItemId,e.userId,a,s,l,e.reason??"",e.actor??"system"]);return y(u.rows[0])}function A(e){let t,r,a=y(e),n=e.item_content_preview,i=null==n?null:String(n).trim().slice(0,140)||null;return{...a,itemType:(t=e.item_type)?String(t):null,itemStatus:(r=e.item_status)?String(r):null,itemContentPreview:i}}async function I(e,t){await o(t);let r=t??(0,n.getDb)(),a=(await r.query(`
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
    `,[e])).rows[0]??{};return{userId:e,firstEventAt:d(a,"first_event_at"),automaticCaptures:c(a,"automatic_captures",0),manualCorrections:c(a,"manual_corrections",0),archived:c(a,"archived",0),contradicted:c(a,"contradicted",0),deleted:c(a,"deleted",0)}}async function M(e,t={},r){await o(r);let a=r??(0,n.getDb)(),i=Number.isFinite(t.limit)?Math.max(1,Math.min(200,t.limit)):50,s="string"==typeof t.memoryItemId&&t.memoryItemId.trim()?t.memoryItemId.trim():null;return(await a.query(`
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
    `,[e,s,i])).rows.map(A)}async function $(e){await o();let t=(0,n.getDb)(),r=await t.connect();try{await r.query("BEGIN");let t=await e(r);return await r.query("COMMIT"),t}catch(e){throw await r.query("ROLLBACK").catch(()=>null),e}finally{r.release()}}e.s(["findActiveUserMemoryItemByDedupeKey",0,w,"findActiveUserMemoryItemsByNormalizedValue",0,h,"getMemoryAuditSummary",0,I,"getUserMemoryItemById",0,v,"getUserProfile",0,S,"insertMemoryAuditLogEntry",0,x,"insertUserMemoryItem",0,f,"listMemoryAuditEvents",0,M,"listUserMemoryItemsByUserId",0,g,"updateUserMemoryItemFields",0,b,"updateUserMemoryItemStatus",0,E,"upsertUserProfile",0,R,"withMemoryTransaction",0,$]),r()}catch(e){r(e)}},!1),62722,e=>e.a(async(t,r)=>{try{var a=e.i(89171),n=e.i(64698),i=e.i(97914),s=e.i(22199),o=t([n,i,s]);async function l(e,t){let r=(0,i.requireUser)(e);if(!r)return a.NextResponse.json({error:"Não autorizado."},{status:401});let{id:o}=await t.params,l=String(o||"").trim();if(!l)return a.NextResponse.json({error:"userId required"},{status:400});if("local-admin"!==r.id&&r.id!==l)return a.NextResponse.json({error:"Proibido."},{status:403});try{let e=await (0,n.getUserProfile)(l),t=a.NextResponse.json({userId:l,profile:e});return t.headers.set("Cache-Control","no-store"),t}catch(e){if((0,s.isDatabaseBusyError)(e))return a.NextResponse.json({error:"Banco de dados ocupado (muitos clientes). Tente novamente em alguns segundos."},{status:503});return a.NextResponse.json({error:e instanceof Error?e.message:"Falha ao buscar perfil."},{status:500})}}[n,i,s]=o.then?(await o)():o,e.s(["GET",0,l]),r()}catch(e){r(e)}},!1),27861,e=>e.a(async(t,r)=>{try{var a=e.i(47909),n=e.i(74017),i=e.i(96250),s=e.i(59756),o=e.i(61916),l=e.i(74677),u=e.i(69741),c=e.i(16795),d=e.i(87718),m=e.i(95169),p=e.i(47587),_=e.i(66012),y=e.i(70101),f=e.i(74838),g=e.i(10372),h=e.i(93695);e.i(52474);var w=e.i(220),v=e.i(62722),E=t([v]);[v]=E.then?(await E)():E;let S=new a.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/memory/users/[id]/profile/route",pathname:"/api/memory/users/[id]/profile",filename:"route",bundlePath:""},distDir:".next-build",relativeProjectDir:"",resolvedPagePath:"[project]/app/api/memory/users/[id]/profile/route.ts",nextConfigOutput:"",userland:v,...{}}),{workAsyncStorage:R,workUnitAsyncStorage:x,serverHooks:A}=S;async function b(e,t,r){r.requestMeta&&(0,s.setRequestMeta)(e,r.requestMeta),S.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let a="/api/memory/users/[id]/profile/route";a=a.replace(/\/index$/,"")||"/";let i=await S.prepare(e,t,{srcPage:a,multiZoneDraftMode:!1});if(!i)return t.statusCode=400,t.end("Bad Request"),null==r.waitUntil||r.waitUntil.call(r,Promise.resolve()),null;let{buildId:v,params:E,nextConfig:b,parsedUrl:R,isDraftMode:x,prerenderManifest:A,routerServerContext:I,isOnDemandRevalidate:M,revalidateOnlyGenerated:$,resolvedPathname:T,clientReferenceManifest:P,serverActionsManifest:N}=i,C=(0,u.normalizeAppPath)(a),D=!!(A.dynamicRoutes[C]||A.routes[T]),O=async()=>((null==I?void 0:I.render404)?await I.render404(e,t,R,!1):t.end("This page could not be found"),null);if(D&&!x){let e=!!A.routes[T],t=A.dynamicRoutes[C];if(t&&!1===t.fallback&&!e){if(b.adapterPath)return await O();throw new h.NoFallbackError}}let U=null;!D||S.isDev||x||(U=T,U="/index"===U?"/":U);let k=!0===S.isDev||!D,q=D&&!k;N&&P&&(0,l.setManifestsSingleton)({page:a,clientReferenceManifest:P,serverActionsManifest:N});let j=e.method||"GET",L=(0,o.getTracer)(),B=L.getActiveScopeSpan(),H=!!(null==I?void 0:I.isWrappedByNextServer),Y=!!(0,s.getRequestMeta)(e,"minimalMode"),F=(0,s.getRequestMeta)(e,"incrementalCache")||await S.getIncrementalCache(e,b,A,Y);null==F||F.resetRequestCache(),globalThis.__incrementalCache=F;let G={params:E,previewProps:A.preview,renderOpts:{experimental:{authInterrupts:!!b.experimental.authInterrupts},cacheComponents:!!b.cacheComponents,supportsDynamicResponse:k,incrementalCache:F,cacheLifeProfiles:b.cacheLife,waitUntil:r.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,n)=>S.onRequestError(e,t,a,n,I)},sharedContext:{buildId:v}},z=new c.NodeNextRequest(e),V=new c.NodeNextResponse(t),K=d.NextRequestAdapter.fromNodeNextRequest(z,(0,d.signalFromNodeResponse)(t));try{let i,s=async e=>S.handle(K,G).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=L.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let n=r.get("next.route");if(n){let t=`${j} ${n}`;e.setAttributes({"next.route":n,"http.route":n,"next.span_name":t}),e.updateName(t),i&&i!==e&&(i.setAttribute("http.route",n),i.updateName(t))}else e.updateName(`${j} ${a}`)}),l=async i=>{var o,l;let u=async({previousCacheEntry:n})=>{try{if(!Y&&M&&$&&!n)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let a=await s(i);e.fetchMetrics=G.renderOpts.fetchMetrics;let o=G.renderOpts.pendingWaitUntil;o&&r.waitUntil&&(r.waitUntil(o),o=void 0);let l=G.renderOpts.collectedTags;if(!D)return await (0,_.sendResponse)(z,V,a,G.renderOpts.pendingWaitUntil),null;{let e=await a.blob(),t=(0,y.toNodeOutgoingHttpHeaders)(a.headers);l&&(t[g.NEXT_CACHE_TAGS_HEADER]=l),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==G.renderOpts.collectedRevalidate&&!(G.renderOpts.collectedRevalidate>=g.INFINITE_CACHE)&&G.renderOpts.collectedRevalidate,n=void 0===G.renderOpts.collectedExpire||G.renderOpts.collectedExpire>=g.INFINITE_CACHE?void 0:G.renderOpts.collectedExpire;return{value:{kind:w.CachedRouteKind.APP_ROUTE,status:a.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:n}}}}catch(t){throw(null==n?void 0:n.isStale)&&await S.onRequestError(e,t,{routerKind:"App Router",routePath:a,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:q,isOnDemandRevalidate:M})},!1,I),t}},c=await S.handleResponse({req:e,nextConfig:b,cacheKey:U,routeKind:n.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:A,isRoutePPREnabled:!1,isOnDemandRevalidate:M,revalidateOnlyGenerated:$,responseGenerator:u,waitUntil:r.waitUntil,isMinimalMode:Y});if(!D)return null;if((null==c||null==(o=c.value)?void 0:o.kind)!==w.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==c||null==(l=c.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});Y||t.setHeader("x-nextjs-cache",M?"REVALIDATED":c.isMiss?"MISS":c.isStale?"STALE":"HIT"),x&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let d=(0,y.fromNodeOutgoingHttpHeaders)(c.value.headers);return Y&&D||d.delete(g.NEXT_CACHE_TAGS_HEADER),!c.cacheControl||t.getHeader("Cache-Control")||d.get("Cache-Control")||d.set("Cache-Control",(0,f.getCacheControlHeader)(c.cacheControl)),await (0,_.sendResponse)(z,V,new Response(c.value.body,{headers:d,status:c.value.status||200})),null};H&&B?await l(B):(i=L.getActiveScopeSpan(),await L.withPropagatedContext(e.headers,()=>L.trace(m.BaseServerSpan.handleRequest,{spanName:`${j} ${a}`,kind:o.SpanKind.SERVER,attributes:{"http.method":j,"http.target":e.url}},l),void 0,!H))}catch(t){if(t instanceof h.NoFallbackError||await S.onRequestError(e,t,{routerKind:"App Router",routePath:C,routeType:"route",revalidateReason:(0,p.getRevalidateReason)({isStaticGeneration:q,isOnDemandRevalidate:M})},!1,I),D)throw t;return await (0,_.sendResponse)(z,V,new Response(null,{status:500})),null}}e.s(["handler",0,b,"patchFetch",0,function(){return(0,i.patchFetch)({workAsyncStorage:R,workUnitAsyncStorage:x})},"routeModule",0,S,"serverHooks",0,A,"workAsyncStorage",0,R,"workUnitAsyncStorage",0,x]),r()}catch(e){r(e)}},!1)];

//# sourceMappingURL=%5Broot-of-the-server%5D__08nk6z3._.js.map