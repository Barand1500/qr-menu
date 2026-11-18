import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BarChart3, Check, CircleAlert, CircleHelp, CornerDownLeft, Layers2, Loader2, Maximize2, Package, PictureInPicture2, Plus, RefreshCw, Send, Sparkles, UsersRound, X } from 'lucide-react';
import { api } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import AdminOverlay from '@/components/admin/AdminOverlay';
import '@/admin-ai.css';

type AiAction =
  | { type: 'navigate'; path: string; label: string }
  | { type: 'created'; kind: 'group' | 'product' | 'user'; id: number; label: string }
  | { type: 'reload' };
type ChatMsg = { id: string; role: 'user'|'assistant'; text: string; actions?: AiAction[]; error?: boolean };
const TEMPLATES = [
  { label:'Grup ekle', icon:Layers2, text:'grup ekle [grup adı]' },
  { label:'Ürün ekle', icon:Package, text:'ürün ekle [ürün adı] fiyat [tutar] grup [grup adı]' },
  { label:'Kullanıcı ekle', icon:UsersRound, text:'kullanıcı ekle ad: [ad soyad] email: [e-posta] şifre: [şifre]' },
];
const SHORTCUTS = [ {label:'Ürünler',path:'products',icon:Package}, {label:'Gruplar',path:'groups',icon:Layers2}, {label:'Müşteriler',path:'customers',icon:UsersRound} ];
const uid = () => crypto.randomUUID();
function displayCommand(text:string) {
  return text.replace(/((?:şifre|sifre|password|parola)\s*[:\-]?\s*)(.+?)(?=\s+(?:ad|isim|email|eposta|rol|role)\s*[:\-]|$)/giu,'$1••••••••');
}
function replyText(text:string) {
  return text.split(/(`[^`\n]+`)/g).map((part,i)=>part.startsWith('`')&&part.endsWith('`')?<code key={i}>{part.slice(1,-1)}</code>:<Fragment key={i}>{part}</Fragment>);
}
/** Routes remain relative to the current panel address; old theme links resolve to the active editor. */
function actionPath(raw:string):string|null {
  if(raw==='startup/welcome'||raw==='startup/menu')return 'startup/theme';
  return /^(?:[a-z0-9_-]+(?:\/[a-z0-9_-]+)*)?$/.test(raw)?raw:null;
}

export default function AdminAIChat({open,onClose}:{open:boolean;onClose:()=>void}) {
  const navigate=useNavigate(), location=useLocation();
  const [messages,setMessages]=useState<ChatMsg[]>([]),[input,setInput]=useState('');
  const [busy,setBusy]=useState(false),[pip,setPip]=useState(false),[help,setHelp]=useState(false),[inputError,setInputError]=useState('');
  const listRef=useRef<HTMLDivElement>(null),inputRef=useRef<HTMLTextAreaElement>(null);
  const busyRef=useRef(false),generation=useRef(0),controller=useRef<AbortController|null>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),closeRef=useRef(onClose);
  closeRef.current=onClose;
  useEffect(()=>{
    if(!open){generation.current++;controller.current?.abort();clearTimeout(timer.current);busyRef.current=false;setMessages([]);setInput('');setBusy(false);setHelp(false);setPip(false);setInputError('');}
    return ()=>{generation.current++;controller.current?.abort();clearTimeout(timer.current);};
  },[open]);
  useEffect(()=>{if(!open)return;const focus=setTimeout(()=>inputRef.current?.focus({preventScroll:true}),100);return()=>clearTimeout(focus);},[open,pip]);
  useEffect(()=>{
    if(!open)return;const el=listRef.current;if(el)el.scrollTo({top:el.scrollHeight,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  },[messages,busy,open]);
  useEffect(()=>{const el=inputRef.current;if(el){el.style.height='auto';el.style.height=Math.min(130,Math.max(26,el.scrollHeight))+'px';}},[input,open,pip]);
  function close(){if(busyRef.current)return;clearTimeout(timer.current);closeRef.current();}
  function runNavigate(raw:string){
    if(busyRef.current)return;const path=actionPath(raw);if(path===null)return;
    clearTimeout(timer.current);const target=adminPath(path);
    if(location.pathname===target){window.location.reload();return;}
    navigate(target);if(!pip)closeRef.current();
  }
  function fillTemplate(text:string){if(busyRef.current)return;clearTimeout(timer.current);setInput(text);setInputError('');setHelp(false);setTimeout(()=>{const el=inputRef.current;if(!el)return;el.focus();const start=text.indexOf('[');if(start>=0)el.setSelectionRange(start,text.indexOf(']',start)+1);},0);}
  async function send(raw:string){
    const text=raw.trim();if(!text||busyRef.current)return;
    if(text.length>2000){setInputError('Mesaj en fazla 2000 karakter olabilir.');return;}
    if(/\[(?:ürün adı|tutar|grup adı|ad soyad|e-posta|şifre)\]/iu.test(text)){setInputError('Örnekteki köşeli parantezli alanları kendi bilgilerinizle değiştirin.');inputRef.current?.focus();return;}
    clearTimeout(timer.current);setInputError('');setHelp(false);busyRef.current=true;setBusy(true);setInput('');
    setMessages(m=>[...m,{id:uid(),role:'user',text:displayCommand(text)}]);
    const token=generation.current;const abort=new AbortController();controller.current=abort;
    try{
      const res=await api<{reply:string;actions?:AiAction[]}>('/api/admin/ai/chat',{method:'POST',body:JSON.stringify({message:text}),signal:abort.signal});
      if(token!==generation.current||abort.signal.aborted)return;
      if(typeof res.reply!=='string'||!res.reply.trim())throw new Error('Asistandan yanıt alınamadı.');
      setMessages(m=>[...m,{id:uid(),role:'assistant',text:res.reply,actions:Array.isArray(res.actions)?res.actions:[]}]);
      // Navigation is explicit in the reply; created records stay visible until the user chooses a page.
      const nav=res.actions?.find((a):a is Extract<AiAction,{type:'navigate'}>=>a.type==='navigate');
      if(nav&&actionPath(nav.path)!==null&&!res.actions?.some(a=>a.type==='created')&&/sayfasina yonlendiriyorum|yönlendiriyorum/i.test(res.reply)){
        const target=adminPath(actionPath(nav.path)!);
        if(target!==location.pathname)timer.current=setTimeout(()=>{if(token===generation.current)runNavigate(nav.path);},900);
      }
    }catch(err){
      if(token!==generation.current||abort.signal.aborted)return;
      setMessages(m=>[...m,{id:uid(),role:'assistant',error:true,text:err instanceof Error?err.message:'Yanıt alınamadı.'}]);
      setInput(text);
    }finally{if(token===generation.current){busyRef.current=false;setBusy(false);controller.current=null;}}
  }
  function submit(event:FormEvent){event.preventDefault();void send(input);}
  if(!open)return null;
  const panel=<section className="relative admin-ai-panel">
    <header className="admin-ai-header"><span className="admin-ai-mark"><Sparkles size={22} strokeWidth={1.6}/></span><div><h2>Asistan</h2><p>{pip?'Panelde çalışırken yanınızda.':'Panel işlerinizi kısa komutlarla halledin.'}</p></div><div className="admin-ai-header-actions"><button type="button" className="admin-ai-icon-btn admin-ai-mode" disabled={busy} aria-label={pip?'Tam boyuta büyüt':'Pencere moduna geç'} title={pip?'Tam boyuta büyüt':'Küçük pencerede kullan'} onClick={()=>{clearTimeout(timer.current);setPip(v=>!v);}}>{pip?<Maximize2 size={18}/>:<PictureInPicture2 size={18}/>}</button><button type="button" className="admin-ai-icon-btn" aria-label="Kapat" disabled={busy} onClick={close}><X size={20}/></button></div></header>
    <div className="admin-ai-body" ref={listRef}>
      {!messages.length?<div className="admin-ai-empty"><p className="admin-ai-kicker">Bir işi kolaylaştıralım.</p><h3>Nereden başlayalım?</h3><p>Menünüzü yönetin, güncel durumu öğrenin veya aradığınız sayfaya geçin.</p><button type="button" className="admin-ai-report" onClick={()=>void send('rapor')} disabled={busy}><span><BarChart3 size={23} strokeWidth={1.5}/></span><div><strong>Güncel özeti getir</strong><small>Ürünler, görüntülenmeler ve geri bildirimler.</small></div><ArrowRight size={19}/></button><div className="admin-ai-start-label">Bir kayıt oluşturun</div><div className="admin-ai-templates">{TEMPLATES.map(s=><button type="button" key={s.label} onClick={()=>fillTemplate(s.text)}><s.icon size={18}/><span>{s.label}</span><Plus size={14}/></button>)}</div><div className="admin-ai-start-label">Doğrudan açın</div><div className="admin-ai-shortcuts">{SHORTCUTS.map(s=><button type="button" key={s.path} onClick={()=>runNavigate(s.path)}><s.icon size={15}/>{s.label}<ArrowUpRight size={13}/></button>)}</div></div>:<div className="admin-ai-thread" role="log" aria-live="polite" aria-relevant="additions text" aria-label="Asistan mesajları">{messages.map(msg=><article key={msg.id} className={`admin-ai-msg is-${msg.role}${msg.error?' is-error':''}`}><div className="admin-ai-msg-label">{msg.role==='user'?'Siz':msg.error?<><CircleAlert size={14}/> Yanıt alınamadı</>:<><Sparkles size={14}/> Asistan</>}</div><div className="admin-ai-msg-text">{replyText(msg.text)}</div>{msg.actions&&<div className="admin-ai-msg-actions">{msg.actions.filter((a):a is Extract<AiAction,{type:'navigate'}>=>a.type==='navigate'&&actionPath(a.path)!==null).map((a,i)=><button type="button" key={i} disabled={busy} onClick={()=>runNavigate(a.path)}>{adminPath(actionPath(a.path)!)===location.pathname?'Listeyi yenile':a.label}<ArrowUpRight size={15}/></button>)}{msg.actions.some(a=>a.type==='reload')&&<button type="button" disabled={busy} onClick={()=>window.location.reload()}><RefreshCw size={15}/> Sayfayı yenile</button>}{msg.actions.some(a=>a.type==='created')&&<span className="admin-ai-completed"><Check size={14}/> Kayıt oluşturuldu</span>}</div>}</article>)}{busy&&<div className="admin-ai-thinking" role="status"><Loader2 size={16} className="animate-spin"/><span>İsteğiniz işleniyor…</span></div>}</div>}
    </div>
    <footer className="admin-ai-footer">
      {help&&<div className="admin-ai-examples"><div><strong>Bir örnekle başlayın.</strong><button type="button" className="admin-ai-icon-btn" aria-label="Örnekleri kapat" onClick={()=>setHelp(false)}><X size={16}/></button></div>{TEMPLATES.map(s=><button type="button" key={s.label} onClick={()=>fillTemplate(s.text)}><span>{s.label}</span><CornerDownLeft size={15}/></button>)}<button type="button" onClick={()=>void send('rapor')}><span>Güncel raporu getir</span><BarChart3 size={15}/></button></div>}
      <form className={`admin-ai-composer${inputError?' has-error':''}`} onSubmit={submit}><textarea ref={inputRef} aria-label="Asistana mesaj" aria-describedby={inputError?'admin-ai-input-error':undefined} rows={1} placeholder="Ne yapmak istersiniz?" value={input} maxLength={2000} disabled={busy} onChange={e=>{clearTimeout(timer.current);setInput(e.target.value);setInputError('');}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send(input);}}}/><div><button type="button" className={`admin-ai-example-toggle${help?' is-active':''}`} disabled={busy} aria-expanded={help} onClick={()=>setHelp(v=>!v)}><CircleHelp size={16}/> Örnekler</button>{input.length>1700&&<span className="admin-ai-length">{input.length}/2000</span>}<button type="submit" className="admin-ai-send" disabled={busy||!input.trim()} aria-label="Gönder">{busy?<Loader2 size={18} className="animate-spin"/>:<Send size={18}/>}</button></div></form>
      {inputError&&<p className="admin-ai-input-error" id="admin-ai-input-error" role="alert">{inputError}</p>}
      <p className="admin-ai-footer-hint">Sohbet kapanınca temizlenir.<span>Enter gönderir · Shift+Enter yeni satır</span></p>
    </footer>
  </section>;
  if(pip)return createPortal(<div className="admin-ai-pip" role="dialog" aria-modal="false" aria-label="Asistan penceresi" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();close();}}}>{panel}</div>,document.body);
  return <AdminOverlay label="Asistan" busy={busy} onClose={close} className="admin-ai-overlay">{panel}</AdminOverlay>;
}

export function AdminAIButton({onClick}:{onClick:()=>void}){return <button type="button" className="sidebar-footer-btn sidebar-footer-btn--ai" title="Asistan" aria-label="Asistan" data-tour="ai-assistant" onClick={onClick}><Sparkles size={18} strokeWidth={1.75}/></button>;}
