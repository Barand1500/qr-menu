import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import express from 'express';
import jwt from 'jsonwebtoken';
const backend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(backend,'node_modules/.assistant-reviews-check');
process.env.JWT_SECRET='local-test-only';process.env.UPLOAD_DIR=path.join(out,'uploads');delete process.env.GOOGLE_PLACES_API_KEY;
const rows=new Map();let timeConfig=null;
const tr=(name,description='')=>({tr:{name,description}});
const group={id:1,isActive:true,i18n:tr('Burgerler'),parent:null};
let products=[
 {id:1,isActive:true,name:'',i18n:tr('Tiramisu'),group:{...group,i18n:tr('Tatlılar')},groupId:1,price:100,calories:400,stockQty:null},
 {id:2,isActive:true,i18n:tr('Zeen Burger'),group,groupId:1,price:600,calories:850,stockQty:null},
 {id:3,isActive:true,i18n:tr('Pizza'),group,groupId:1,price:200,calories:600,stockQty:0},
 {id:4,isActive:true,i18n:tr('Izgara balık'),group,groupId:1,price:800,calories:550,stockQty:null},
 {id:5,isActive:true,i18n:tr('Pizza'),group:{...group,parent:{isActive:false,i18n:tr('Kapalı')}},groupId:1,price:50,stockQty:null},
];
globalThis.__prisma={
 user:{findUnique:async()=>({isActive:true,restaurantId:1,role:'admin',email:'test@example.invalid'})},
 restaurant:{findUnique:async()=>({id:1,slug:'test',name:'Test'})},
 language:{findFirst:async()=>({code:'tr'})},campaign:{findFirst:async()=>null},
 setting:{findUnique:async({where})=>{const {restaurantId,key}=where.restaurantId_key;return rows.get(restaurantId+'|'+key)||null;},
 findFirst:async()=>timeConfig?{value:JSON.stringify(timeConfig)}:null,
 upsert:async({where,create,update})=>{const k=where.restaurantId_key.restaurantId+'|'+where.restaurantId_key.key;const row={...(rows.get(k)||create),...update};rows.set(k,row);return row;}},
 product:{findMany:async({where,take})=>{assert.equal(where.isActive,true);assert.equal(where.group.isActive,true);assert.equal(take,undefined);return products.filter(p=>p.isActive&&p.group.isActive);}},
};
rows.set('1|addons_owned',{value:'["menu-assistant"]'});
for(const [name,entry]of [['settings','settings.ts'],['menu','public-menu.ts']])await build({entryPoints:[path.join(backend,'src/routes',entry)],outfile:path.join(out,name+'.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'fake-prisma',setup(b){b.onResolve({filter:/(^|\/)prisma\.js$/},()=>({path:'prisma',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const prisma=globalThis.__prisma;',loader:'js'}));}}]});
const app=express();app.use(express.json());app.use('/admin',(await import(pathToFileURL(path.join(out,'settings.mjs')))).default);app.use('/menu',(await import(pathToFileURL(path.join(out,'menu.mjs')))).default);
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
const auth={Authorization:'Bearer '+jwt.sign({userId:1},process.env.JWT_SECRET),'Content-Type':'application/json'};
const req=async(p,method='GET',body)=>{const r=await fetch(base+p,{method,headers:auth,...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,headers:r.headers,data:await r.json()};};
try{
 let r=await req('/admin/reviews','PUT',{config:{manualEnabled:true,manual:[{name:'Ada',text:'Çok güzel.',rating:5}]}});assert.equal(r.status,200);
 r=await req('/menu/test/reviews');assert.equal(r.data.reviews.items.length,1);assert.equal(r.headers.get('cache-control'),'no-store');
 r=await req('/admin/reviews','PATCH',{channel:'manualEnabled',enabled:false});assert.equal(r.status,200);assert.equal(r.data.config.manual.length,1);assert.equal((await req('/menu/test/reviews')).data.reviews,null);
 r=await req('/admin/reviews','PATCH',{channel:'manualEnabled',enabled:true});assert.equal(r.data.config.manual[0].name,'Ada');assert.equal((await req('/menu/test/reviews')).data.reviews.items.length,1);
 assert.equal((await req('/admin/reviews','PATCH',{channel:'manual',enabled:false})).status,400);
 assert.equal((await req('/admin/reviews','PATCH',{channel:'manualEnabled',enabled:'false'})).status,400);
 assert.equal((await req('/admin/reviews','PATCH',{channel:'googleEnabled',enabled:true})).status,400);
 const anonymous=await fetch(base+'/admin/reviews',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel:'manualEnabled',enabled:false})});assert.equal(anonymous.status,401);
 r=await req('/menu/test/assistant-suggest?taste=savory&hunger=stuffed&budget=high');assert.equal(r.status,200);assert.deepEqual(r.data.products.map(p=>p.id),[2,4]);assert.equal(r.data.products[0].classificationName,undefined);
 assert.deepEqual((await req('/menu/test/assistant-suggest?taste=sweet')).data.products.map(p=>p.id),[1]);
 assert.deepEqual((await req('/menu/test/assistant-suggest?taste=fresh')).data.products,[]);
 assert.equal((await req('/menu/test/assistant-suggest?taste=invalid')).status,400);
 assert.equal((await req('/menu/test/assistant-suggest?kampanya=missing')).status,404);
 timeConfig={enabled:true,timezone:'UTC',slots:[{id:'am',name:'AM',start:'00:00',end:'12:00',enabled:true},{id:'pm',name:'PM',start:'12:00',end:'00:00',enabled:true}],rules:['am','pm'].flatMap(slotId=>[{slotId,productId:2,hidden:true},{slotId,productId:4,price:99}])};
 r=await req('/menu/test/assistant-suggest?taste=savory');assert.deepEqual(r.data.products.map(p=>p.id),[4]);assert.equal(r.data.products[0].price,99);
 console.log('PASS: real Express handlers / visibility off-on, stored reviews retained, validation/auth, cache headers / taste filtering, stock, hidden parent, time rules/prices, invalid campaign');
}finally{await new Promise(r=>server.close(r));}
