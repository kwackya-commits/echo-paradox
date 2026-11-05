import type {Difficulty} from './model';
export interface Settings{difficulty:Difficulty;master:number;music:number;sfx:number;quality:'low'|'medium'|'high';skin:string}
export interface RecordEntry{time:number;medal:number;route:{x:number;y:number}[]}
export interface Save{version:1;unlocked:number;records:Record<string,RecordEntry>;achievements:string[];settings:Settings;endless:number;daily:Record<string,number>}
export const KEY='echo-paradox.v1';
export function defaults():Save{return {version:1,unlocked:1,records:{},achievements:[],settings:{difficulty:'normal',master:.65,music:.35,sfx:.65,quality:'high',skin:'cyan'},endless:0,daily:{}};}
const finite=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function decode(raw:string|null):Save{
  const s=defaults();if(!raw)return s;
  try{const d=JSON.parse(raw);if(!d||d.version!==1)return s;
    if(finite(d.unlocked,1,20))s.unlocked=Math.floor(d.unlocked);
    if(finite(d.endless,0,1e9))s.endless=d.endless;
    if(Array.isArray(d.achievements))s.achievements=d.achievements.filter((v:unknown)=>typeof v==='string').slice(0,30);
    if(d.settings){for(const k of ['master','music','sfx'] as const)if(finite(d.settings[k],0,1))s.settings[k]=d.settings[k];
      if(['easy','normal','hard'].includes(d.settings.difficulty))s.settings.difficulty=d.settings.difficulty;
      if(['low','medium','high'].includes(d.settings.quality))s.settings.quality=d.settings.quality;
      if(['cyan','gold','rose'].includes(d.settings.skin))s.settings.skin=d.settings.skin;}
    if(d.records&&typeof d.records==='object')for(const [k,v] of Object.entries(d.records) as [string,any][]){
      if(/^\d{1,2}$/.test(k)&&v&&finite(v.time,0,1e9)&&Number.isInteger(v.medal)&&finite(v.medal,1,3))s.records[k]={time:v.time,medal:v.medal,route:Array.isArray(v.route)?v.route.filter((p:any)=>p&&finite(p.x,0,960)&&finite(p.y,0,600)).slice(0,18000):[]};}
    if(d.daily&&typeof d.daily==='object')for(const [k,v] of Object.entries(d.daily))if(/^\d{4}-\d{2}-\d{2}$/.test(k)&&finite(v,0,1e9))s.daily[k]=v as number;
  }catch{/* Corrupt or unavailable storage must never block boot. */}return s;
}
export function load(){try{return decode(localStorage.getItem(KEY));}catch{return defaults();}}
export function persist(s:Save){try{localStorage.setItem(KEY,JSON.stringify(s));return true;}catch{return false;}}
export function dayKey(date=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function dailyIndex(day:string){let h=2166136261;for(const c of day)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)%20;}
