import {EchoSystem,HZ,type Frame,type EchoKind} from './echo';
import data from './levels.json';
export type Rect={x:number;y:number;w:number;h:number};
export type Point={x:number;y:number};
export type Mode='story'|'endless'|'time'|'daily';
export type Difficulty='easy'|'normal'|'hard';
export type Level=typeof data[number];
export const LEVELS:Level[]=data;
export const CHAPTERS=['MEMORY CHAMBER','ECHO FACTORY','MIRROR CITY','COLLAPSE LAB','ZERO CORE'];
export const COLORS=[0x61eadb,0xffad67,0xbe92ff,0xff6e89,0xf3d995];
export const RULES={easy:{hp:4,max:2,life:1200,inv:75},normal:{hp:3,max:3,life:1800,inv:60},hard:{hp:2,max:4,life:2400,inv:45}};
export interface Input{x:number;y:number;dash?:boolean;lock?:boolean;burst?:boolean;interact?:boolean;vision?:boolean}
export type Event={type:string;x:number;y:number;value?:number};
export const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export function inside(p:Point,r:Rect,pad=0){return p.x>=r.x-pad&&p.x<=r.x+r.w+pad&&p.y>=r.y-pad&&p.y<=r.y+r.h+pad;}
export function wallsFor(index:number):Rect[]{
  const walls:Rect[]=[{x:135,y:100,w:690,h:18},{x:135,y:502,w:690,h:18},{x:135,y:100,w:18,h:420},{x:807,y:100,w:18,h:420}];
  // Every room retains a complete outer ring; partitions vary without enclosing devices.
  if(index===0)walls.push({x:450,y:215,w:55,h:180});
  else if(index%4===1)walls.push({x:370,y:250,w:220,h:38});
  else if(index%4===2)walls.push({x:370,y:200,w:35,h:110},{x:540,y:350,w:35,h:110});
  else if(index%4===3)walls.push({x:410,y:210,w:140,h:35},{x:410,y:360,w:140,h:35});
  else walls.push({x:390,y:235,w:45,h:140},{x:550,y:235,w:45,h:140});
  if([7,11,15,19].includes(index))return walls.slice(0,4);
  return walls;
}
export class Simulation{
  x=205;y=310;angle=0;hp:number;tick=0;inv=0;damage=0;
  dashCD=0;dashTicks=0;lockCD=0;lockTicks=0;burstCD=0;
  dashX=1;dashY=0;echo:EchoSystem;walls:Rect[];
  cores:{x:number;y:number;taken:boolean}[];plates:{x:number;y:number;active:boolean}[];
  door=false;status:'playing'|'dead'|'clear'='playing';events:Event[]=[];
  boss?:{name:string;x:number;y:number;hp:number;max:number;phase:number;state:'shield'|'exposed'|'dead';hitCD:number;attack:Point;attackTick:number};
  traps:{x:number;y:number;born:number}[]=[];
  route:Point[]=[];
  warning=-1;
  constructor(public level:Level,public difficulty:Difficulty='normal',public mode:Mode='story'){
    const rules=RULES[difficulty];this.hp=rules.hp;
    this.echo=new EchoSystem(rules.max,rules.life);this.walls=wallsFor(level.layout);
    this.cores=level.cores.map(p=>({x:p[0],y:p[1],taken:false}));
    this.plates=level.plates.map(p=>({x:p[0],y:p[1],active:false}));
    if(level.boss){let max=level.boss==='ORIGINAL'?9:4;this.boss={name:level.boss,x:670,y:310,hp:max,max,phase:1,state:'shield',hitCD:0,attack:{x:480,y:310},attackTick:0};}
  }
  get seconds(){return this.tick/HZ;}
  get exit(){return {x:776,y:310};}
  get collected(){return this.cores.filter(c=>c.taken).length;}
  emit(type:string,x=this.x,y=this.y,value?:number){this.events.push({type,x,y,value});}
  canStand(x:number,y:number){return !this.walls.some(w=>inside({x,y},w,12));}
  move(dx:number,dy:number){
    const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/5));
    for(let i=0;i<steps;i++){if(this.canStand(this.x+dx/steps,this.y))this.x+=dx/steps;if(this.canStand(this.x,this.y+dy/steps))this.y+=dy/steps;}
  }
  hurt(){if(this.inv>0||this.dashTicks>0||this.status!=='playing')return;this.hp--;this.damage++;this.inv=RULES[this.difficulty].inv;this.emit('hurt');if(this.hp<=0){this.status='dead';this.emit('death');}}
  laserState(l:number[]){const cycle=l[4];const t=(this.tick+l[0])%cycle;return t<65?'warning':t<140?'on':'off';}
  get collapseState(){const t=this.tick%360;return t<150?'off':t<210?'warning':'on';}
  get collapseRect():Rect{return {x:this.level.layout%2?425:470,y:255,w:100,h:95};}
  step(input:Input){
    this.events=[];if(this.status!=='playing')return;
    this.tick++;this.inv=Math.max(0,this.inv-1);
    this.dashCD=Math.max(0,this.dashCD-1);this.lockCD=Math.max(0,this.lockCD-1);this.burstCD=Math.max(0,this.burstCD-1);
    this.dashTicks=Math.max(0,this.dashTicks-1);
    let mx=input.x,my=input.y;const length=Math.hypot(mx,my);if(length>1){mx/=length;my/=length;}
    if(length>0)this.angle=Math.atan2(my,mx);
    if(input.dash){if(!this.dashCD){this.dashCD=300;this.dashTicks=11;this.dashX=length?mx:Math.cos(this.angle);this.dashY=length?my:Math.sin(this.angle);this.emit('dash');}else this.emit('unavailable');}
    if(input.lock){if(!this.lockCD){this.lockCD=720;this.lockTicks=120;this.emit('lock');}else this.emit('unavailable');}
    if(input.burst){if(this.level.id<13){this.emit('locked');}else if(!this.burstCD){this.burstCD=900;for(const e of this.echo.echoes)if(distance(this,e.frame)<170)e.disabled=180;this.emit('burst');}else this.emit('unavailable');}
    if(this.dashTicks>0)this.move(this.dashX*500/HZ,this.dashY*500/HZ);else this.move(mx*220/HZ,my*220/HZ);
    if(this.level.conveyor){const [x,y,w,h,speed]=this.level.conveyor;if(inside(this,{x,y,w,h}))this.move(speed/HZ,0);}
    const frame:Frame={x:this.x,y:this.y,angle:this.angle,dash:this.dashTicks>0,animation:this.dashTicks>0?'dash':length?'walk':'idle',interact:!!input.interact};
    let kind:EchoKind=this.level.phantom?'phantom':'normal';if(this.boss?.name==='ORIGINAL'&&this.boss.phase>=2)kind='corrupted';else if(this.level.id%4===0&&!this.boss)kind='puzzle';
    const result=this.echo.step(frame,this.lockTicks>0,kind);
    if(this.lockTicks>0)this.lockTicks--;
    if(result.born)this.emit('echo',result.born.frame.x,result.born.frame.y);
    for(const e of result.expired)this.emit('expire',e.frame.x,e.frame.y);
    if(this.echo.recording.length===480)this.emit('warning');
    for(const e of this.echo.echoes){if(e.age>=48&&!e.disabled&&distance(this,e.frame)<(e.kind==='phantom'?36:e.kind==='corrupted'?38:26))this.hurt();}
    for(const c of this.cores)if(!c.taken&&distance(this,c)<28){c.taken=true;this.emit('core',c.x,c.y);}
    for(const p of this.plates){const active=this.echo.echoes.some(e=>!e.disabled&&distance(p,e.frame)<32);if(active&&!p.active)this.emit('plate',p.x,p.y);p.active=active;}
    for(const l of this.level.lasers){if(this.laserState(l)==='on'){const x=Math.min(l[0],l[2]),y=Math.min(l[1],l[3]);if(inside(this,{x,y,w:Math.abs(l[2]-l[0]),h:Math.abs(l[3]-l[1])},13))this.hurt();}}
    if(this.level.collapse&&this.collapseState==='on'&&inside(this,this.collapseRect,8))this.hurt();
    if(this.boss)this.updateBoss(input);
    const open=this.plates.every(p=>p.active)&&this.collected===this.cores.length&&(!this.boss||this.boss.hp===0);
    if(open&&!this.door)this.emit('door',this.exit.x,this.exit.y);this.door=open;
    if(this.mode!=='endless'&&this.door&&distance(this,this.exit)<28&&this.status==='playing'){this.status='clear';this.emit('clear');}
    if(this.mode==='endless'){
      if(this.tick%900===0)this.echo.max=Math.min(RULES[this.difficulty].max+2,this.echo.max+1);
      if(this.tick%180===0&&this.tick>600)this.traps.push({x:this.x,y:this.y,born:this.tick});
    }
    for(const t of this.traps)if(this.tick-t.born>=60&&distance(this,t)<30)this.hurt();
    this.traps=this.traps.filter(t=>this.tick-t.born<125);
    if(this.tick%6===0){this.route.push({x:this.x,y:this.y});if(this.route.length>18000)this.route.shift();}
  }
  private updateBoss(input:Input){
    const b=this.boss!;if(!b.hp)return;
    b.hitCD=Math.max(0,b.hitCD-1);
    const exposed=this.plates.every(p=>p.active);
    b.state=exposed?'exposed':'shield';
    b.attackTick=(b.attackTick+1)%180;
    if(b.attackTick===1){
      const old=this.route[Math.max(0,this.route.length-(b.name==='WATCHER'?1:12))];
      b.attack=old?{...old}:{x:this.x,y:this.y};this.emit('boss-warning',b.attack.x,b.attack.y);
      if(b.name==='ORIGINAL'&&b.phase>=2){const oldFrame=this.echo.recording[Math.max(0,this.echo.recording.length-120)];if(oldFrame)this.traps.push({x:oldFrame.x,y:oldFrame.y,born:this.tick});}
    }
    if(b.attackTick>=65&&b.attackTick<=95){
      if(b.name==='WATCHER'){if(Math.abs(this.y-b.attack.y)<20&&this.x>350)this.hurt();}
      else if(distance(this,b.attack)<(b.name==='ORIGINAL'?65:50))this.hurt();
    }
    if(input.interact){
      if(distance(this,b)<85&&exposed&&!b.hitCD){
        b.hp--;b.hitCD=90;this.emit('boss-hit',b.x,b.y);
        const phase=b.name==='ORIGINAL'?Math.min(3,Math.floor((b.max-b.hp)/3)+1):b.hp<=2?2:1;
        if(phase!==b.phase){b.phase=phase;this.emit('phase',b.x,b.y,phase);}
        if(!b.hp){b.state='dead';this.emit('boss-death',b.x,b.y);}
      }else this.emit('unavailable');
    }
  }
}
