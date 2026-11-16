import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'backend/node_modules/.customer-auth-check');await fs.mkdir(out,{recursive:true});
process.env.JWT_SECRET='customer-test-secret';
const bcrypt=(await import(pathToFileURL(path.join(root,'backend/node_modules/bcryptjs/index.js')).href)).default;
const jwt=(await import(pathToFileURL(path.join(root,'backend/node_modules/jsonwebtoken/index.js')).href)).default;
let challenges=new Map(),customers=new Map(),nextId=1;
const clone=value=>value==null?null:structuredClone(value);
function matches(row,where){return Object.entries(where).every(([key,value])=>{
  const actual=row[key];if(value&&typeof value==='object'&&!(value instanceof Date))return ('gt'in value?actual>value.gt:true)&&('lt'in value?actual<value.lt:true);
  return value instanceof Date?actual?.getTime()===value.getTime():actual===value;
});}
function patch(row,data){const next={...row};for(const [key,value]of Object.entries(data))next[key]=value&&typeof value==='object'&&'increment'in value?next[key]+value.increment:value;return next;}
let serial=Promise.resolve();
const db={
  customerEmailChallenge:{
    findUnique:async({where})=>clone(challenges.get(where.email)),
    create:async({data})=>{if(challenges.has(data.email))throw Object.assign(new Error(),{code:'P2002'});const row={version:0,...data};challenges.set(data.email,row);return clone(row);},
    updateMany:async({where,data})=>{let count=0;for(const[key,row]of challenges)if(matches(row,where)){challenges.set(key,patch(row,data));count++;}return{count};},
    deleteMany:async({where})=>{for(const[key,row]of challenges)if(matches(row,where))challenges.delete(key);return{count:0};},
  },
  menuCustomer:{
    findUnique:async({where})=>clone([...customers.values()].find(row=>matches(row,where))),
    create:async({data})=>{if([...customers.values()].some(c=>data.email&&c.email===data.email))throw Object.assign(new Error(),{code:'P2002'});const row={id:nextId++,authVersion:0,phone:null,email:null,allergenTags:[],dietTags:[],likedFoods:[],dislikedFoods:[],drinksAlcohol:null,pointsJson:{},...data};customers.set(row.id,row);return clone(row);},
    update:async({where,data})=>{const row=customers.get(where.id);assert.ok(row);const next=patch(row,data);customers.set(row.id,next);return clone(next);},
  },
  $transaction:async fn=>{let release;const previous=serial;serial=new Promise(r=>release=r);await previous;const beforeChallenges=clone([...challenges]),beforeCustomers=clone([...customers]);try{return await fn(db);}catch(err){challenges=new Map(beforeChallenges);customers=new Map(beforeCustomers);throw err;}finally{release();}},
};
globalThis.__customerDb=db;
let configured=true,failMail=false;const sent=[];
globalThis.__customerMail={configured:()=>configured,send:async(email,code,purpose)=>{if(failMail)throw Error('smtp failure');sent.push({email,code,purpose});}};
await build({entryPoints:[path.join(root,'backend/src/routes/customer-auth.ts')],outfile:path.join(out,'router.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'customer-test-deps',setup(b){
  b.onResolve({filter:/(^|\/)prisma\.js$/},()=>({path:'db',namespace:'test'}));b.onResolve({filter:/(^|\/)customer-mail\.js$/},()=>({path:'mail',namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},args=>({loader:'js',contents:args.path==='db'?'export const prisma=globalThis.__customerDb;':'export const customerMailConfigured=globalThis.__customerMail.configured;export const sendCustomerCode=globalThis.__customerMail.send;'}));
}}]});
const router=(await import(pathToFileURL(path.join(out,'router.mjs')).href)).default;
const express=(await import(pathToFileURL(path.join(root,'backend/node_modules/express/index.js')).href)).default;
const app=express();app.use(express.json());app.use(router);app.use((err,req,res,next)=>res.status(500).json({message:'test error'}));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
const actualNow=Date.now;let clock=actualNow();Date.now=()=>clock;
const call=async(route,body,token)=>{const res=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:res.status,body:await res.json(),headers:res.headers};};
const send=(email,purpose='register')=>call('/email/code',{email,purpose});
const verify=(email,id,code,purpose='register')=>call('/email/verify',{email,challengeId:id,code,purpose});
const complete=(email,verificationToken,purpose='register',extra={})=>call('/email/complete',{email,verificationToken,purpose,password:'Strong-pass-8',kvkkAccepted:true,remember:true,...extra});
const wrong=code=>String((Number(code)+1)%1000000).padStart(6,'0');
try{
  assert.equal((await call('/email/start',{email:'not-email'})).status,400);
  assert.equal((await call('/email/start',{email:'x'.repeat(151)+'@example.test'})).status,400);
  assert.equal((await call('/register',{loginType:'email',email:'bypass@example.test',password:'password',fullName:'Bypass',kvkkAccepted:true})).status,410);
  assert.equal((await complete('bypass@example.test','a'.repeat(64))).status,401);
  const phone=await call('/register',{loginType:'phone',phone:'5551234567',password:'old-phone-pass',fullName:'Eski Üye',kvkkAccepted:true});assert.equal(phone.status,201);assert.equal((await call('/login',{loginType:'phone',phone:'5551234567',password:'old-phone-pass'})).status,200);  let res=await call('/email/start',{email:' New@Example.test '});assert.equal(res.body.step,'code');assert.equal(res.body.email,'new@example.test');assert.equal(res.headers.get('cache-control'),'no-store');
  const firstId=res.body.challengeId,firstCode=sent.at(-1).code;assert.match(firstCode,/^\d{6}$/);assert.equal(res.body.code,undefined);assert.notEqual(challenges.get('new@example.test').codeHash,firstCode);
  assert.equal((await send('new@example.test')).status,429);
  assert.equal((await verify('other@example.test',firstId,firstCode)).status,401);
  assert.equal((await verify('new@example.test',firstId,firstCode,'reset')).status,401);
  assert.equal((await verify('new@example.test',firstId,wrong(firstCode))).status,401);
  res=await verify('new@example.test',firstId,firstCode);assert.equal(res.status,200);const grant=res.body.verificationToken;assert.match(grant,/^[a-f0-9]{64}$/);assert.notEqual(challenges.get('new@example.test').grantHash,grant);
  assert.equal((await verify('new@example.test',firstId,firstCode)).status,401);
  assert.equal((await complete('new@example.test',grant,'register',{kvkkAccepted:false})).status,400);
  assert.equal((await complete('new@example.test',grant,'register',{password:'short'})).status,400);
  res=await complete('new@example.test',grant);assert.equal(res.status,200);assert.equal(res.body.customer.email,'new@example.test');assert.equal(res.body.customer.passwordHash,undefined);const customerId=res.body.customer.id,oldToken=res.body.token;
  assert.equal(jwt.verify(oldToken,process.env.JWT_SECRET).typ,'customer');assert.equal((await call('/me',null,oldToken)).status,200);const preUpgrade=jwt.sign({typ:'customer',customerId},process.env.JWT_SECRET,{expiresIn:'1h'});assert.equal((await call('/me',null,preUpgrade)).status,200);
  assert.equal((await complete('new@example.test',grant)).status,401);
  assert.equal((await call('/email/start',{email:'new@example.test'})).body.step,'password');
  configured=false;assert.equal((await call('/email/start',{email:'new@example.test'})).body.step,'password');assert.equal((await call('/email/start',{email:'no-smtp@example.test'})).status,503);configured=true;
  assert.equal((await call('/login',{loginType:'email',email:'new@example.test',password:'wrong'})).status,401);
  assert.equal((await call('/login',{loginType:'email',email:'new@example.test',password:'Strong-pass-8'})).status,200);
  clock+=61000;res=await send('new@example.test','reset');const resetId=res.body.challengeId,resetCode=sent.at(-1).code;res=await verify('new@example.test',resetId,resetCode,'reset');const resetGrant=res.body.verificationToken;
  assert.equal((await complete('new@example.test',resetGrant)).status,401);
  res=await complete('new@example.test',resetGrant,'reset',{password:'Replacement-pass-9'});assert.deepEqual(res.body,{reset:true});assert.equal(customers.get(customerId).authVersion,1);assert.equal((await call('/me',null,oldToken)).status,401);
  const legacy=jwt.sign({typ:'customer',customerId},process.env.JWT_SECRET,{expiresIn:'1h'});assert.equal((await call('/me',null,legacy)).status,401);
  assert.equal((await call('/login',{loginType:'email',email:'new@example.test',password:'Strong-pass-8'})).status,401);
  res=await call('/login',{loginType:'email',email:'new@example.test',password:'Replacement-pass-9'});assert.equal(res.status,200);assert.equal(jwt.verify(res.body.token,process.env.JWT_SECRET).version,1);assert.equal((await call('/me',null,res.body.token)).status,200);
  const beforeMail=sent.length;assert.equal((await send('unknown@example.test','reset')).status,200);assert.equal(sent.length,beforeMail);
  res=await send('attempts@example.test');const attemptId=res.body.challengeId,attemptCode=sent.at(-1).code;for(let n=0;n<5;n++)assert.equal((await verify('attempts@example.test',attemptId,wrong(attemptCode))).status,401);assert.equal((await verify('attempts@example.test',attemptId,attemptCode)).status,401);
  res=await send('expiry@example.test');const expId=res.body.challengeId,expCode=sent.at(-1).code;clock+=301000;assert.equal((await verify('expiry@example.test',expId,expCode)).status,401);
  res=await send('grant-expiry@example.test');res=await verify('grant-expiry@example.test',res.body.challengeId,sent.at(-1).code);const expiresGrant=res.body.verificationToken;clock+=601000;assert.equal((await complete('grant-expiry@example.test',expiresGrant)).status,401);
  res=await send('resend@example.test');const oldId=res.body.challengeId,oldCode=sent.at(-1).code;res=await verify('resend@example.test',oldId,oldCode);const revokedGrant=res.body.verificationToken;clock+=61000;res=await send('resend@example.test');assert.equal(res.status,200);assert.equal((await complete('resend@example.test',revokedGrant)).status,401);assert.equal((await verify('resend@example.test',oldId,oldCode)).status,401);
  res=await send('concurrent@example.test');const concurrentId=res.body.challengeId,concurrentCode=sent.at(-1).code;const verified=await Promise.all([verify('concurrent@example.test',concurrentId,concurrentCode),verify('concurrent@example.test',concurrentId,concurrentCode)]);assert.deepEqual(verified.map(x=>x.status).sort(),[200,401]);const token=verified.find(x=>x.status===200).body.verificationToken;
  const completed=await Promise.all([complete('concurrent@example.test',token),complete('concurrent@example.test',token)]);assert.deepEqual(completed.map(x=>x.status).sort(),[200,401]);
  failMail=true;assert.equal((await send('mail-failure@example.test')).status,503);assert.equal(challenges.get('mail-failure@example.test').codeHash,null);failMail=false;
  for(let n=0;n<5;n++){assert.equal((await send('quota@example.test')).status,200);clock+=61000;}assert.equal((await send('quota@example.test')).status,429);
  console.log('PASS customer email: verify/register/login/reset, consent, expiry/replay, wrong-code limits, resend revocation, atomic concurrent use, SMTP failures, durable send quota and session invalidation');
}finally{Date.now=actualNow;server.close();}