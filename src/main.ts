import Phaser from 'phaser';
import './style.css';
import {Simulation,LEVELS,CHAPTERS,COLORS,RULES,type Mode,type Input,type Point} from './model';
import {load,persist,defaults,dayKey,dailyIndex,type Save} from './save';
import {Sound} from './audio';

const ui=document.querySelector<HTMLDivElement>('#ui')!;
const touch=document.querySelector<HTMLDivElement>('#touch')!;
let save:Save=load(),sound=new Sound(save.settings),scene:World;
let mode:Mode='story',selected=0,screen='menu',paused=false;
let joystick={x:0,y:0},buttons:Partial<Input>={},visionToggle=false;
let previousHUD='',toastTimer=0;
const achievements:Record<string,[string,string]>={first:['첫 번째 잔향','첫 에코를 생성했습니다.'],three:['나, 나, 그리고 나','3개의 에코와 동시에 생존했습니다.'],perfect:['흠 없는 기억','피해 없이 스테이지를 클리어했습니다.'],lock:['멈춰진 위험','가까운 에코를 TIME LOCK으로 정지했습니다.'],boss:['감시 종료','첫 보스를 격파했습니다.'],ending:['나의 다음 걸음','ORIGINAL을 격파하고 탈출했습니다.'],gold:['완벽한 시간선','모든 스테이지에서 골드 메달을 획득했습니다.'],survive:['시간의 생존자','무한 모드에서 120초를 생존했습니다.']};
const fmt=(n:number)=>`${Math.floor(n/60).toString().padStart(2,'0')}:${Math.floor(n%60).toString().padStart(2,'0')}`;
const tag=(text:string)=>`<span class="eyebrow">${text}</span>`;
const button=(id:string,text:string,extra='')=>`<button data-action="${id}" ${extra}>${text}</button>`;
function store(){if(!persist(save))toast('저장 공간을 사용할 수 없습니다. 이번 진행은 메모리에 유지됩니다.');}
function unlock(id:string){if(!save.achievements.includes(id)){save.achievements.push(id);store();toast(`업적 해금 · ${achievements[id][0]}`);}}
function toast(text:string){document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.textContent=text;document.querySelector('#app')!.append(el);clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>el.remove(),3500);}
function resetInputs(){joystick={x:0,y:0};buttons={};scene?.keys?.forEach(k=>k.reset());}
function panel(title:string,body:string,back='menu'){
  ui.innerHTML=`<div class="veil"><section class="panel">${tag('ECHO / PARADOX')}<div class="panel-title"><h1>${title}</h1>${button(back,'← 돌아가기','class="quiet"')}</div>${body}</section></div>`;
}
function menu(){screen='menu';paused=false;touch.innerHTML='';sound.menu=true;sound.paused=false;scene?.clearRun();
  ui.innerHTML=`<div class="menu"><div class="menu-top"><span class="brand-mark">E / P</span><span>TEMPORAL RESEARCH DIVISION</span><span class="live">SYSTEM ONLINE</span></div><div class="menu-copy">${tag('A TIME PARADOX EXPERIENCE / 001')}<h1>ECHO<span>: PARADOX</span></h1><p class="slogan">10초 전의 내가,<br>나를 죽인다.</p><p class="intro">모든 걸음은 기록된다.<br>과거의 나를 피해, 다음 순간을 설계하라.</p><div class="menu-actions">${button('new','<span>새로운 시간선</span><span>NEW GAME ↗</span>','class="primary"')}${button('continue','이어하기 <small>CONTINUE</small>',save.unlocked===1&&!save.records['1']?'disabled':'')}${button('stages','스토리 모드 <small>STORY MODE</small>')}${button('modes','다른 시간선 <small>GAME MODES</small>')}</div><div class="menu-links">${button('achievements','업적')}${button('records','기록')}${button('settings','설정')}</div></div><div class="menu-lore"><span class="coordinate">35° 40′ N / 139° 45′ E</span><div class="orbit-caption"><i></i> SUBJECT 001 <span>MEMORY INTEGRITY: 98.2%</span></div><div class="quote">“네 뒤를 쫓는 것은<br>너 자신이야.”</div></div><div class="menu-bottom"><span>WASD 이동 · SPACE 대시 · Q 시간 정지</span><span>LOCAL BUILD 0.1 / 20 CHAMBERS</span><span>HEADPHONES RECOMMENDED ◉</span></div></div>`;
}
function stages(chapter=Math.floor((save.unlocked-1)/4)){
  screen='stages';panel('기억을 선택하세요',`<p class="muted">과거에 남긴 걸음이 다음 방의 열쇠가 됩니다.</p><div class="chapter-tabs">${CHAPTERS.map((n,i)=>button(`chapter:${i}`,`0${i+1} <span>${n}</span>`,i===chapter?'class="selected"':'')).join('')}</div><div class="stage-grid">${LEVELS.slice(chapter*4,chapter*4+4).map(l=>{const r=save.records[l.id];return button(`stage:${l.id-1}`,`${tag(`CHAMBER ${String(l.id).padStart(2,'0')}`)}<h2>${l.name}</h2><p>${l.boss?`BOSS / ${l.boss}`:l.plates.length>1?'MULTIPLE ECHO SYNCHRONIZATION':'TEMPORAL MEMORY PUZZLE'}</p><div class="stage-info">${r?`${'◆'.repeat(r.medal)} · ${fmt(r.time)}`:l.id<=save.unlocked?'미탐색 / ENTER →':'잠긴 시간선 / LOCKED'}</div>`,l.id>save.unlocked?'disabled':'');}).join('')}</div>`);
}
function modes(){screen='modes';panel('다른 시간선',`<div class="mode-grid">${button('story','01 <h2>STORY MODE</h2><p>5개 챕터, 20개의 방.<br>시간 붕괴의 중심으로 향하세요.</p>')}${button('endless','02 <h2>ENDLESS MODE</h2><p>점점 늘어나는 에코와 시간 함정.<br>최고 생존: '+fmt(save.endless)+'</p>')}${button('time','03 <h2>TIME ATTACK</h2><p>최단 시간에 도전하세요.<br>이전 최고 기록의 경로가 표시됩니다.</p>')}${button('daily',`04 <h2>DAILY CHALLENGE</h2><p>${dayKey()} · 서울 기준 고정 도전<br>오늘 최고 기록: ${save.daily[dayKey()]?fmt(save.daily[dayKey()]):'—'}</p>`)}</div>`);}
function settings(back='menu'){
  screen='settings';const s=save.settings;panel('시스템 설정',`<div class="settings-grid"><div>${tag('SIMULATION')}<label>난이도<select id="difficulty"><option value="easy">EASY · HP 4 / ECHO 2</option><option value="normal">NORMAL · HP 3 / ECHO 3</option><option value="hard">HARD · HP 2 / ECHO 4</option></select></label><p class="muted">난이도 변경은 다음 시작부터 적용됩니다.</p><label>그래픽<select id="quality"><option value="low">LOW</option><option value="medium">MEDIUM</option><option value="high">HIGH</option></select></label><label>수트 색상<select id="skin"><option value="cyan">CYAN / 기본</option><option value="gold" ${save.achievements.includes('boss')?'':'disabled'}>GOLD / 감시자 격파</option><option value="rose" ${save.achievements.includes('perfect')?'':'disabled'}>ROSE / 무피해 클리어</option></select></label></div><div>${tag('AUDIO CHANNELS')}${(['master','music','sfx'] as const).map((k,i)=>`<label>${['전체 음량','배경음악','효과음'][i]}<input id="${k}" type="range" min="0" max="1" step="0.05" value="${s[k]}"></label>`).join('')}<p class="muted">직접 합성한 SF 시퀀서 · 모든 음원은 게임 내 생성</p>${button('reset','진행도 초기화','class="danger"')}</div></div>`,back);
  for(const k of ['difficulty','quality','skin'] as const){const e=document.querySelector<HTMLSelectElement>(`#${k}`)!;e.value=s[k];e.onchange=()=>{Object.assign(s,{[k]:e.value});store();};}
  for(const k of ['master','music','sfx'] as const)document.querySelector<HTMLInputElement>(`#${k}`)!.oninput=e=>{s[k]=Number((e.target as HTMLInputElement).value);store();};
}
function showAchievements(){screen='achievements';panel('시간에 남긴 흔적',`<p class="muted">${save.achievements.length} / ${Object.keys(achievements).length} 업적 해금</p><div class="achievement-grid">${Object.entries(achievements).map(([id,[title,desc]])=>`<article class="achievement ${save.achievements.includes(id)?'earned':''}"><div class="medallion">${save.achievements.includes(id)?'✧':'◇'}</div><div><h3>${title}</h3><p>${desc}</p></div><span>${save.achievements.includes(id)?'완료':'미달성'}</span></article>`).join('')}</div>`);}
function records(){screen='records';panel('시간선 기록',`<div class="record-list"><div><span>CHAMBER</span><span>BEST TIME</span><span>MEDAL</span></div>${LEVELS.map(l=>`<div><span>${String(l.id).padStart(2,'0')} / ${l.name}</span><span>${save.records[l.id]?fmt(save.records[l.id].time):'—'}</span><span class="gold">${save.records[l.id]?'◆'.repeat(save.records[l.id].medal):'—'}</span></div>`).join('')}</div>`);}
function start(index=selected){selected=index;screen='game';paused=false;previousHUD='';resetInputs();sound.menu=false;sound.paused=false;sound.chapter=Math.floor(index/4);sound.boss=!!LEVELS[index].boss;scene.begin(LEVELS[index]);ui.innerHTML='<div id="hud"></div>';setupTouch();hud();}
function setupTouch(){touch.innerHTML=`<div id="stick" aria-label="이동 조이스틱"><div id="knob"></div></div><div class="touch-actions"><button data-touch="lock">Q<span>정지</span></button><button data-touch="vision">E<span>비전</span></button><button data-touch="interact">F<span>상호작용</span></button><button data-touch="burst">R<span>버스트</span></button><button data-touch="dash">SPACE<span>대시</span></button></div>`;
  const stick=document.querySelector<HTMLDivElement>('#stick')!,knob=document.querySelector<HTMLDivElement>('#knob')!;
  let pointer:number|undefined;
  const update=(e:PointerEvent)=>{const r=stick.getBoundingClientRect(),x=e.clientX-r.x-r.width/2,y=e.clientY-r.y-r.height/2,n=Math.max(40,Math.hypot(x,y));joystick={x:x/n,y:y/n};knob.style.transform=`translate(${joystick.x*32}px,${joystick.y*32}px)`;};
  stick.onpointerdown=e=>{if(pointer!==undefined)return;pointer=e.pointerId;stick.setPointerCapture(e.pointerId);update(e);};
  stick.onpointermove=e=>{if(pointer===e.pointerId)update(e);};
  const release=(e:PointerEvent)=>{if(pointer===e.pointerId){pointer=undefined;joystick={x:0,y:0};knob.style.transform='';}};
  stick.onpointerup=release;stick.onpointercancel=release;stick.onlostpointercapture=release;
  touch.querySelectorAll<HTMLButtonElement>('[data-touch]').forEach(b=>b.onpointerdown=e=>{e.preventDefault();if(b.dataset.touch==='vision')visionToggle=!visionToggle;else Object.assign(buttons,{[b.dataset.touch!]:true});});
}
function hud(){const m=scene.sim;if(!m)return;const health=Array.from({length:RULES[m.difficulty].hp},(_,i)=>`<i class="${i<m.hp?'full':''}"></i>`).join('');
  const skill=(key:string,label:string,cd:number,locked=false)=>`<button data-action="skill:${key}" class="skill ${locked?'locked':''}"><kbd>${key==='dash'?'SPACE':key==='lock'?'Q':key==='vision'?'E':'R'}</kbd><span>${label}</span><b>${locked?'LOCKED':cd?`${(cd/60).toFixed(1)}s`:'READY'}</b></button>`;
  const html=`<div class="hud-top"><div class="hud-left">${tag(`CHAMBER ${String(selected+1).padStart(2,'0')} / ${CHAPTERS[Math.floor(selected/4)]}`)}<h2>${m.level.name}</h2><div class="health">${health}<span>VITAL SIGNS</span></div></div><div class="echo-clock ${m.echo.countdown<=2?'urgent':''}"><span>NEXT ECHO</span><strong>${m.echo.countdown.toFixed(1)}<small>s</small></strong><div class="clock-track"><i style="width:${m.echo.countdown*10}%"></i></div></div><div class="hud-right"><span>${fmt(m.seconds)} / ${mode==='endless'?'ENDLESS':mode==='daily'?'DAILY':mode==='time'?'TIME ATTACK':'STORY'}</span>${button('pause','Ⅱ','aria-label="일시정지"')}<div>ACTIVE ECHOES <b>${String(m.echo.echoes.length).padStart(2,'0')}</b> / ${m.echo.max}</div></div></div><div class="hud-bottom"><div class="objective">${tag('CURRENT OBJECTIVE')}<p>${m.boss?`${m.boss.name} · ${m.boss.hp?`에코로 방어막 해제 → 가까이서 F (${m.boss.hp}/${m.boss.max})`:'출구로 탈출'}`:`코어 ${m.collected}/${m.cores.length} · 에코 발판 ${m.plates.filter(p=>p.active).length}/${m.plates.length} → 출구로 탈출`}</p><small>${m.level.hint}</small></div><div class="skills">${skill('dash','DASH',m.dashCD)}${skill('lock','TIME LOCK',m.lockCD)}${skill('vision','VISION',0)}${skill('burst','BURST',m.burstCD,m.level.id<13)}</div></div>`;
  if(html!==previousHUD){document.querySelector('#hud')!.innerHTML=html;previousHUD=html;}
}
function pause(){if(screen!=='game'||scene.sim?.status!=='playing')return;paused=true;screen='pause';resetInputs();touch.style.visibility='hidden';sound.paused=true;panel('시간선 일시정지',`<p class="muted">다음 걸음을 생각할 시간.</p><div class="pause-actions">${button('resume','계속하기','class="primary"')}${button('restart','처음부터 다시')}${button('pause-settings','설정')}${button('menu','메인 메뉴')}</div>`,'resume');}
function resume(){if(!scene.sim)return;screen='game';paused=false;sound.paused=false;ui.innerHTML='<div id="hud"></div>';touch.style.visibility='';previousHUD='';resetInputs();hud();}
function finish(){const m=scene.sim!;screen=m.status;touch.innerHTML='';sound.menu=true;
  if(m.status==='dead'){
    if(mode==='endless'){save.endless=Math.max(save.endless,m.seconds);store();}
    panel('시간선 소실',`<p class="result-intro">과거의 너를 기억해. 다음엔 다른 길로.</p><div class="result-stat"><strong>${fmt(m.seconds)}</strong><span>생존 시간 · 에코 ${m.echo.echoes.length}개</span></div><div class="pause-actions">${button('restart','다시 시도','class="primary"')}${button('menu','메인 메뉴')}</div>`);return;
  }
  const medal=m.seconds<=m.level.target?(m.damage<=1?3:2):1,old=save.records[m.level.id];
  if(mode==='story'||mode==='time'){
    if(!old||m.seconds<old.time)save.records[m.level.id]={time:m.seconds,medal:Math.max(old?.medal??0,medal),route:m.route};else old.medal=Math.max(old.medal,medal);
    save.unlocked=Math.max(save.unlocked,Math.min(20,m.level.id+1));
  }
  if(mode==='daily'){const key=dayKey();save.daily[key]=Math.min(save.daily[key]??Infinity,m.seconds);}
  if(!m.damage)unlock('perfect');if(m.boss)unlock('boss');if(m.level.id===20)unlock('ending');
  if(LEVELS.every(l=>save.records[l.id]?.medal===3))unlock('gold');store();
  panel('기억 복원 완료',`<div class="medal-art">${'◆'.repeat(medal)}</div><p class="result-intro">CHAMBER ${String(m.level.id).padStart(2,'0')} / ${m.level.name}</p><div class="result-stat"><strong>${fmt(m.seconds)}</strong><span>${['','BRONZE','SILVER','GOLD'][medal]} · 피해 ${m.damage}회 · 목표 ${fmt(m.level.target)}</span></div><div class="pause-actions">${button(m.level.id===20?'ending':mode==='daily'?'modes':'next',m.level.id===20?'마지막 기록':'다음 시간선 →','class="primary"')}${button('restart','기록에 다시 도전')}${button('stages','챕터 선택')}</div>`);
}
function ending(){screen='ending';panel('다음 걸음은 너의 것',`<div class="ending"><span class="ending-symbol">∞</span><p>마지막 에코가 사라졌다.<br>처음으로, 발소리가 하나만 들린다.</p><h2>“나는 내가 남긴 기록보다 더 많은 존재다.”</h2><p class="muted">시간 붕괴는 멈췄다. 이제 너의 미래는 기록되지 않았다.</p>${button('menu','새로운 아침으로','class="primary"')}<small>ECHO: PARADOX · END OF THE FIRST TIMELINE</small></div>`);}
ui.addEventListener('click',e=>{const el=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');if(!el||el.disabled)return;sound.start();sound.play('click');const [action,arg]=el.dataset.action!.split(':');
  switch(action){case'menu':menu();break;case'new':mode='story';start(0);break;case'continue':mode='story';start(save.unlocked-1);break;case'story':mode='story';stages();break;case'stages':stages();break;case'chapter':stages(Number(arg));break;case'stage':start(Number(arg));break;case'modes':modes();break;case'endless':mode='endless';start(5);break;case'time':mode='time';stages();break;case'daily':mode='daily';start(dailyIndex(dayKey()));break;case'settings':settings();break;case'pause-settings':settings('resume');break;case'achievements':showAchievements();break;case'records':records();break;case'pause':pause();break;case'resume':resume();break;case'restart':start();break;case'next':start(Math.min(19,selected+1));break;case'ending':ending();break;case'skill':if(arg==='vision')visionToggle=!visionToggle;else Object.assign(buttons,{[arg]:true});break;case'reset':panel('기록을 지울까요?',`<p>해금, 메달, 업적, 최고 기록을 삭제합니다.</p><div class="pause-actions">${button('confirm-reset','모든 기록 삭제','class="danger"')}${button('settings','취소')}</div>`);break;case'confirm-reset':save=defaults();sound.settings=save.settings;store();menu();break;}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='game')pause();});
window.addEventListener('blur',()=>{if(screen==='game')pause();});

class World extends Phaser.Scene{
  sim?:Simulation;keys:Phaser.Input.Keyboard.Key[]=[];
  private keyboard!:Record<string,Phaser.Input.Keyboard.Key>;
  private accumulator=0;private g!:Phaser.GameObjects.Graphics;
  private player!:Phaser.GameObjects.Image;private ghosts=new Map<number,Phaser.GameObjects.Image>();
  private motes:Phaser.GameObjects.Image[]=[];private fx:Phaser.GameObjects.Image[]=[];
  private hudTick=0;private labels:Phaser.GameObjects.Text[]=[];private deathDelay=0;
  constructor(){super('world');}
  create(){scene=this;this.g=this.add.graphics();this.makeTextures();this.player=this.add.image(0,0,'suit').setDepth(5).setVisible(false);
    this.keyboard=this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,Q,E,F,R,ESC') as Record<string,Phaser.Input.Keyboard.Key>;this.keys=Object.values(this.keyboard);
    this.input.keyboard!.addCapture(['SPACE','UP','DOWN','LEFT','RIGHT']);
    this.keyboard.ESC.on('down',()=>{if(screen==='game')pause();else if(screen==='pause')resume();});
    for(let i=0;i<42;i++)this.motes.push(this.add.image(Phaser.Math.Between(0,960),Phaser.Math.Between(0,600),'mote').setAlpha(Phaser.Math.FloatBetween(.05,.25)).setDepth(9));
    this.cameras.main.setBackgroundColor('#070c16');menu();
    if(import.meta.env.DEV&&(new URLSearchParams(location.search).has('qa'))){(window as any).__ECHO__={get sim(){return scene.sim;},start:(i=0)=>start(i),step:(input:Input,n=1)=>{for(let i=0;i<n;i++)scene.sim?.step(input);hud();},get save(){return save;},get screen(){return screen;}};}
  }
  makeTextures(){
    const g=this.make.graphics({x:0,y:0});
    // Original compact astronaut art: layered suit, segmented limbs, visor and pack.
    g.fillStyle(0x000000,.3);g.fillEllipse(25,48,27,10);
    g.fillStyle(0x192e40);g.fillRoundedRect(9,18,32,25,5);
    g.fillStyle(0x31566b);g.fillRoundedRect(6,22,7,18,3);g.fillRoundedRect(37,22,7,18,3);
    g.fillStyle(0x77e4da);g.fillRoundedRect(15,34,8,15,2);g.fillRoundedRect(28,34,8,15,2);
    g.fillStyle(0x18394b);g.fillRect(14,45,10,5);g.fillRect(27,45,10,5);
    g.fillStyle(0xb1fff1);g.fillRoundedRect(13,20,25,20,5);
    g.fillStyle(0x346877);g.fillRoundedRect(17,26,17,11,2);
    g.fillStyle(0xf0fff8);g.fillRoundedRect(11,3,28,25,10);
    g.fillStyle(0x112b40);g.fillRoundedRect(14,9,23,12,5);
    g.fillStyle(0x64f9e0);g.fillRoundedRect(16,11,18,5,2);
    g.fillStyle(0xffffff,.8);g.fillRect(17,10,7,2);g.fillRect(20,29,4,2);
    g.lineStyle(1,0x65e9d4,.7);g.strokeRoundedRect(11,3,28,25,10);
    g.generateTexture('suit',50,54);g.clear();
    g.fillStyle(0xffffff);g.fillCircle(5,5,3);g.generateTexture('mote',10,10);g.clear();
    g.lineStyle(2,0xffffff,.8);g.strokeCircle(48,48,42);g.lineStyle(1,0xffffff,.2);g.strokeCircle(48,48,46);g.generateTexture('ring',96,96);g.destroy();
  }
  clearRun(){this.sim=undefined;this.player.setVisible(false);for(const e of this.ghosts.values())e.destroy();this.ghosts.clear();for(const t of this.labels)t.destroy();this.labels=[];for(const f of this.fx)f.destroy();this.fx=[];}
  begin(level:typeof LEVELS[number]){this.clearRun();this.sim=new Simulation(level,save.settings.difficulty,mode);this.player.setVisible(true);this.accumulator=0;this.deathDelay=0;visionToggle=false;this.cameras.main.fadeIn(450,7,12,22);toast(level.line);}
  just(k:string){return Phaser.Input.Keyboard.JustDown(this.keyboard[k]);}
  update(_time:number,delta:number){
    const m=this.sim;
    if(m&&screen==='game'&&!paused){
      const k=this.keyboard;
      const input:Input={x:(k.D.isDown||k.RIGHT.isDown?1:0)-(k.A.isDown||k.LEFT.isDown?1:0)+joystick.x,y:(k.S.isDown||k.DOWN.isDown?1:0)-(k.W.isDown||k.UP.isDown?1:0)+joystick.y,dash:this.just('SPACE')||buttons.dash,lock:this.just('Q')||buttons.lock,burst:this.just('R')||buttons.burst,interact:this.just('F')||buttons.interact,vision:k.E.isDown||visionToggle};
      this.accumulator+=delta;
      // Keep the remainder: rendering slowdown must not change simulation speed.
      // Tab changes pause explicitly, so no hidden-tab catch-up is performed.
      let steps=0;
      while(this.accumulator>=1000/60&&steps<240&&m.status==='playing'){
        m.step(input);this.handleEvents();this.accumulator-=1000/60;steps++;
        input.dash=input.lock=input.burst=input.interact=false;buttons={};
      }
      if(m.status!=='playing'){
        this.deathDelay+=delta;
        if(this.deathDelay>(m.status==='dead'?650:450))finish();
      }
      if(++this.hudTick%4===0)hud();
      sound.intensity=m.echo.echoes.length;
      if(mode==='endless'&&m.seconds>=120)unlock('survive');
    }
    this.renderWorld(_time);
    if(save.settings.quality!=='low')for(let i=0;i<this.motes.length;i++){const p=this.motes[i];p.visible=save.settings.quality==='high'||i<15;p.y-=delta*.004;if(p.y<0)p.y=600;}
    else this.motes.forEach(p=>p.visible=false);
  }
  handleEvents(){const m=this.sim!;for(const e of m.events){sound.play(e.type);
    if(['echo','expire','core','plate','lock','burst','phase','boss-death','clear'].includes(e.type))this.ring(e.x,e.y,e.type==='echo'?0xb58aff:e.type==='hurt'?0xff6b80:0x77f6df,e.type==='burst'?3:1);
    if(e.type==='echo'){unlock('first');if(m.echo.echoes.length>=3)unlock('three');}
    if(e.type==='lock'&&m.echo.echoes.some(e=>Math.hypot(m.x-e.frame.x,m.y-e.frame.y)<100))unlock('lock');
    if(e.type==='hurt'){this.cameras.main.shake(140,.004);this.cameras.main.flash(100,120,20,40);}
    if(e.type==='death'){this.ring(m.x,m.y,0xff6b80,1.8);this.cameras.main.shake(240,.006);}
    if(e.type==='phase'){this.cameras.main.flash(200,80,40,70);toast(`PHASE ${e.value} / 기억이 재구성됩니다`);}
    if(e.type==='unavailable')toast('아직 사용할 수 없습니다. 거리·방어막·쿨다운을 확인하세요.');
    if(e.type==='locked')toast('PARADOX BURST는 CHAMBER 13부터 해금됩니다.');
    if(e.type==='dash'&&save.settings.quality!=='low'){for(let i=1;i<5;i++){const f=this.add.image(m.x-m.dashX*i*10,m.y-m.dashY*i*10,'suit').setTint(0x65e9d4).setAlpha(.3-i*.045).setScale(.65).setDepth(3);this.trackFX(f,350);}}
  }}
  trackFX(f:Phaser.GameObjects.Image,duration:number){if(this.fx.length>45)this.fx.shift()?.destroy();this.fx.push(f);this.tweens.add({targets:f,alpha:0,duration,onComplete:()=>{f.destroy();this.fx=this.fx.filter(x=>x!==f);}});}
  ring(x:number,y:number,color:number,size=1){const f=this.add.image(x,y,'ring').setTint(color).setDepth(8).setScale(.15);this.tweens.add({targets:f,scaleX:size*1.8,scaleY:size*1.8,duration:650,ease:'Cubic.Out'});this.trackFX(f,650);}
  label(text:string,x:number,y:number,size=10,color='#638092'){const t=this.add.text(x,y,text,{fontFamily:'monospace',fontSize:size,color,letterSpacing:1}).setOrigin(.5);this.labels.push(t);return t;}
  renderWorld(time:number){
    const g=this.g;g.clear();for(const t of this.labels)t.destroy();this.labels=[];
    if(!this.sim){this.renderMenu(time);return;}
    const m=this.sim,c=COLORS[Math.floor((m.level.id-1)/4)];
    g.fillStyle(0x080f1c);g.fillRect(0,0,960,600);
    // Architectural floor plates and inlaid copper/cyan service lines.
    g.fillStyle(0x101c2b);g.fillRoundedRect(128,92,704,436,12);g.lineStyle(1,c,.22);g.strokeRoundedRect(128,92,704,436,12);
    g.fillStyle(0x0c1724);g.fillRect(154,120,650,380);
    for(let x=156;x<805;x+=32)for(let y=120;y<500;y+=32){g.lineStyle(1,0x26394a,.36);g.strokeRect(x,y,31,31);if((x+y)%3===0){g.fillStyle(0x365162,.3);g.fillRect(x+4,y+4,2,2);}}
    g.lineStyle(2,c,.1);g.strokeRect(167,132,623,354);
    for(let x=175;x<800;x+=80){g.fillStyle(c,.25+.1*Math.sin(time*.001+x));g.fillRect(x,123,35,2);g.fillRect(x,495,35,2);}
    if(m.level.conveyor){const [x,y,w,h,speed]=m.level.conveyor;g.fillStyle(0x25323b);g.fillRect(x,y,w,h);g.lineStyle(1,0xba8156,.4);for(let a=0;a<w;a+=20){const o=(a+time*.03*Math.sign(speed)+w*100)%w;g.beginPath();g.moveTo(x+o-7,y+10);g.lineTo(x+o+7,y+h/2);g.lineTo(x+o-7,y+h-10);g.strokePath();}}
    if(m.level.collapse){const r=m.collapseRect,st=m.collapseState;g.fillStyle(st==='on'?0x01050b:0x753b4c,st==='warning'?.5:.28);g.fillRect(r.x,r.y,r.w,r.h);g.lineStyle(1,0xff6e89,st==='warning'?(.5+.4*Math.sin(time*.02)):.25);g.strokeRect(r.x,r.y,r.w,r.h);this.label(st==='on'?'VOID':'UNSTABLE',r.x+r.w/2,r.y+r.h/2,9,'#c97c8d');}
    for(const w of m.walls){g.fillStyle(0x050b12,.8);g.fillRoundedRect(w.x+5,w.y+7,w.w,w.h,3);g.fillStyle(0x203040);g.fillRoundedRect(w.x,w.y,w.w,w.h,3);g.fillStyle(0x2d4354);g.fillRect(w.x+3,w.y+3,w.w-6,3);g.lineStyle(1,0x3d5a6d,.6);g.strokeRoundedRect(w.x,w.y,w.w,w.h,3);g.fillStyle(c,.6);if(w.w>w.h){g.fillRect(w.x+10,w.y+7,22,2);}else{g.fillRect(w.x+7,w.y+12,2,25);}}
    // Door socket, double chevrons and physical status light.
    const d=m.exit;g.fillStyle(m.door?0x165647:0x2a2d47);g.fillRoundedRect(d.x-18,d.y-37,36,74,5);g.lineStyle(2,m.door?0x7effcd:0xa58aec,.7);g.strokeRoundedRect(d.x-18,d.y-37,36,74,5);
    for(let i=0;i<3;i++){g.lineStyle(2,m.door?0x8affdc:0x77648c);g.beginPath();g.moveTo(d.x-7+i*5,d.y-9);g.lineTo(d.x+1+i*5,d.y);g.lineTo(d.x-7+i*5,d.y+9);g.strokePath();}this.label(m.door?'EXIT / OPEN':'EXIT / LOCKED',d.x,d.y+51,8,m.door?'#8affdc':'#8b789f');
    for(let i=0;i<m.plates.length;i++){const p=m.plates[i];g.fillStyle(0x0a0d1c);g.fillCircle(p.x,p.y,28);g.lineStyle(2,p.active?0xa0ffdc:0xa78cde,p.active?1:.55);g.strokeCircle(p.x,p.y,25);g.lineStyle(1,0xbda2f5,.2);g.strokeCircle(p.x,p.y,31);g.fillStyle(p.active?0x8dffcf:0x8665aa,.3);g.fillRoundedRect(p.x-16,p.y-16,32,32,5);g.lineStyle(2,p.active?0xb1ffe4:0xbaa0ef);g.strokePoints([{x:p.x,y:p.y-10},{x:p.x+9,y:p.y},{x:p.x,y:p.y+10},{x:p.x-9,y:p.y}],true);this.label(`ECHO ${String(i+1).padStart(2,'0')}`,p.x,p.y+42,8,p.active?'#9df5d3':'#a392c0');}
    for(const core of m.cores){if(core.taken)continue;const y=core.y+Math.sin(time*.003+core.x)*4;g.lineStyle(1,0xf2d994,.3);g.strokeCircle(core.x,core.y,19);g.fillStyle(0xf2d994);g.fillPoints([{x:core.x,y:y-12},{x:core.x+8,y},{x:core.x,y:y+12},{x:core.x-8,y}],true);g.lineStyle(1,0xfff5cc);g.lineBetween(core.x, y-9,core.x,y+8);}
    for(const l of m.level.lasers){const state=m.laserState(l);g.fillStyle(0x513747);g.fillRect(l[0]-6,l[1]-8,12,16);g.fillRect(l[2]-6,l[3]-8,12,16);if(state!=='off'){g.lineStyle(state==='on'?5:1,0xff5e7f,state==='on'?.7:.35+.25*Math.sin(time*.025));g.lineBetween(l[0],l[1],l[2],l[3]);if(state==='on'){g.lineStyle(1,0xffd0df,1);g.lineBetween(l[0],l[1],l[2],l[3]);}}}
    for(const t of m.traps){const danger=m.tick-t.born>=60;g.lineStyle(danger?3:1,0xff647d,danger?.9:.45);g.strokeCircle(t.x,t.y,danger?30:10+(m.tick-t.born)/3);if(danger){g.fillStyle(0xff647d,.18);g.fillCircle(t.x,t.y,30);}}
    if(mode==='time'){const route=save.records[m.level.id]?.route;if(route){g.lineStyle(1,0xd7c485,.18);for(let i=1;i<route.length;i+=4){const a=route[i-1],b=route[i];g.lineBetween(a.x,a.y,b.x,b.y);}}}
    if(m.boss)this.renderBoss(time);
    const current=new Set(m.echo.echoes.map(e=>e.id));for(const [id,sprite] of this.ghosts){if(!current.has(id)){sprite.destroy();this.ghosts.delete(id);}}
    for(const e of m.echo.echoes){let sprite=this.ghosts.get(e.id);if(!sprite){sprite=this.add.image(e.frame.x,e.frame.y,'suit').setDepth(4);this.ghosts.set(e.id,sprite);}
      const colors=[0xb28aff,0xff90c4,0x8ca6ff,0xe3aaff],color=e.kind==='corrupted'?0xff617a:colors[(e.id-1)%4];
      sprite.setPosition(e.frame.x,e.frame.y).setTint(color).setScale(.65).setAlpha(e.disabled?.12:m.lockTicks?.7:.45).setFlipX(Math.cos(e.frame.angle)<0);
      g.lineStyle(1,color,e.disabled?.1:.5);g.strokeCircle(e.frame.x,e.frame.y+4,e.kind==='phantom'?25:20);
      if(!e.disabled){g.lineStyle(1,color,.15);g.strokeEllipse(e.frame.x,e.frame.y+18,40,10);this.label(`${e.kind==='normal'?'ECHO':e.kind.toUpperCase()} / ${e.id}`,e.frame.x,e.frame.y-27,7,'#c2a5ec');}
      if((this.keyboard.E.isDown||visionToggle)&&!e.disabled){const future=m.echo.future(e);g.lineStyle(2,color,.5);for(let i=1;i<future.length;i+=2)g.lineBetween(future[i-1].x,future[i-1].y,future[i].x,future[i].y);}
    }
    const color=save.settings.skin==='gold'?0xffdb94:save.settings.skin==='rose'?0xffa2c4:0xffffff;
    this.player.setPosition(m.x,m.y+((m.tick%30<15)?0:1)).setScale(.65).setTint(color).setFlipX(Math.cos(m.angle)<0).setAlpha(m.status==='dead'?Math.max(0,1-this.deathDelay/500):m.inv>0&&m.tick%8<4?.3:1);
    g.lineStyle(1,0x6fffe0,.3);g.strokeEllipse(m.x,m.y+17,30,8);
    if(m.lockTicks){g.lineStyle(2,0x7fffe4,.35);g.strokeRoundedRect(126,90,708,440,13);this.label('TIME LOCK / ECHO PLAYBACK SUSPENDED',480,553,11,'#7fffe4');}
    this.label(`${m.level.id.toString().padStart(2,'0')} / SECTOR ${Math.ceil(m.level.id/4)}`,184,544,9);this.label('TEMPORAL RESEARCH DIVISION',710,544,9);
  }
  renderBoss(time:number){const m=this.sim!,b=m.boss!,g=this.g;if(b.hp===0){g.lineStyle(1,0x91bdb6,.3);g.strokeCircle(b.x,b.y,22);return;}
    const exposed=b.state==='exposed',color=exposed?0xffd795:0xd88dff;
    if(b.attackTick<65){g.lineStyle(1,0xff6885,.4+.25*Math.sin(time*.02));if(b.name==='WATCHER')g.strokeRect(350,b.attack.y-20,440,40);else g.strokeCircle(b.attack.x,b.attack.y,b.name==='ORIGINAL'?65:50);}
    else if(b.attackTick<=95){g.fillStyle(0xff5d7b,.25);if(b.name==='WATCHER')g.fillRect(350,b.attack.y-20,440,40);else g.fillCircle(b.attack.x,b.attack.y,b.name==='ORIGINAL'?65:50);g.lineStyle(3,0xffa0b2,.9);g.strokeCircle(b.attack.x,b.attack.y,40);}
    g.fillStyle(0x030817,.8);g.fillEllipse(b.x,b.y+36,90,20);
    g.lineStyle(1,color,.2);g.strokeCircle(b.x,b.y,51+Math.sin(time*.002)*3);
    g.lineStyle(3,color,.7);g.beginPath();g.arc(b.x,b.y,42,time*.001,time*.001+Math.PI*1.4);g.strokePath();
    g.fillStyle(0x302b47);g.fillPoints([{x:b.x,y:b.y-32},{x:b.x+31,y:b.y},{x:b.x,y:b.y+32},{x:b.x-31,y:b.y}],true);g.lineStyle(2,color,.8);g.strokePoints([{x:b.x,y:b.y-32},{x:b.x+31,y:b.y},{x:b.x,y:b.y+32},{x:b.x-31,y:b.y}],true);
    g.fillStyle(color,b.hitCD>0&&m.tick%10<5?.3:1);g.fillEllipse(b.x,b.y,29,12);g.fillStyle(0x111522);g.fillCircle(b.x,b.y,5);
    this.label(`${b.name} / PHASE ${b.phase}`,b.x,b.y-75,10,'#dcacfa');g.fillStyle(0x33213f);g.fillRect(b.x-60,b.y-58,120,4);g.fillStyle(color);g.fillRect(b.x-60,b.y-58,120*b.hp/b.max,4);this.label(exposed?'EXPOSED / [F]':'SHIELDED',b.x,b.y+64,9,exposed?'#ffe2a5':'#ab90c2');
  }
  renderMenu(time:number){const g=this.g,cx=670,cy=300;
    g.fillStyle(0x070c16);g.fillRect(0,0,960,600);
    for(let i=0;i<15;i++){g.lineStyle(1,0x54cdbd,.025+i*.001);g.strokeCircle(cx,cy,70+i*21);}
    for(let i=0;i<36;i++){const a=i*Math.PI/18+time*.000015,r=190;g.lineStyle(1,0x58c4bb,i%3===0?.3:.09);g.lineBetween(cx+Math.cos(a)*r,cy+Math.sin(a)*r,cx+Math.cos(a)*(r+8),cy+Math.sin(a)*(r+8));}
    g.lineStyle(1,0x4bc9bb,.15);g.lineBetween(cx-240,cy,cx+240,cy);g.lineBetween(cx,cy-240,cx,cy+240);
    g.lineStyle(2,0x60dfce,.6);g.beginPath();g.arc(cx,cy,155,time*.00015,time*.00015+2.1);g.strokePath();g.lineStyle(1,0xb487e8,.5);g.beginPath();g.arc(cx,cy,140,-time*.0001,-time*.0001+1.3);g.strokePath();
    // The large menu subject is the same original suit as the playable character.
    this.player.setVisible(true).setPosition(cx,cy).setScale(2.25).setTint(0xb4ffed).setAlpha(.9).setFlipX(false);
    for(let i=0;i<3;i++){g.lineStyle(1,0x75e4ce,.08);g.strokeEllipse(cx,cy+85+i*8,130+i*35,28+i*9);}
  }
}

ui.innerHTML='<div class="loading">E / P<span>INITIALIZING MEMORY BUFFER…</span></div>';
new Phaser.Game({type:Phaser.AUTO,parent:'game',width:960,height:600,backgroundColor:'#070c16',antialias:true,scene:World,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},input:{activePointers:4},render:{powerPreference:'high-performance'},audio:{noAudio:true}});
