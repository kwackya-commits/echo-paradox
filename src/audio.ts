import type {Settings} from './save';
export class Sound{
  ctx?:AudioContext;timer?:number;beat=0;intensity=0;chapter=0;boss=false;menu=true;paused=false;
  constructor(public settings:Settings){}
  start(){if(!this.ctx){try{this.ctx=new AudioContext();this.timer=window.setInterval(()=>this.music(),220);}catch{return;}}void this.ctx.resume();}
  tone(freq:number,duration=.12,type:OscillatorType='sine',volume=.15,slide=1,music=false){
    const c=this.ctx;if(!c||c.state!=='running'||this.paused)return;
    const level=this.settings.master*(music?this.settings.music:this.settings.sfx);if(!level)return;
    const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*slide),c.currentTime+duration);
    g.gain.setValueAtTime(0,c.currentTime);g.gain.linearRampToValueAtTime(volume*level,c.currentTime+.008);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);
    o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+duration+.01);
  }
  play(name:string){const notes:Record<string,[number,number,OscillatorType,number,number]>={click:[660,.06,'sine',.15,.6],dash:[180,.18,'sawtooth',.08,3],echo:[220,.6,'sine',.2,4],expire:[600,.25,'triangle',.1,.2],warning:[900,.12,'square',.04,.8],hurt:[130,.25,'sawtooth',.14,.3],death:[160,1.1,'sawtooth',.15,.15],lock:[600,.5,'triangle',.1,.2],burst:[90,.65,'sawtooth',.15,5],core:[880,.25,'sine',.2,1.5],plate:[440,.25,'triangle',.15,2],door:[330,.5,'sine',.15,2],clear:[523,.8,'triangle',.14,2],unavailable:[100,.08,'square',.04,.7],locked:[100,.08,'square',.04,.7],'boss-warning':[160,.3,'square',.05,1.2],'boss-hit':[110,.2,'sawtooth',.1,3],'boss-death':[220,1,'triangle',.15,4],phase:[90,.6,'sawtooth',.08,3]};const n=notes[name];if(n)this.tone(...n);}
  private music(){if(this.paused)return;const scales=[[0,7,12,14,19,14,12,7],[0,3,7,10,12,10,7,3],[0,7,10,14,17,14,10,7],[0,1,7,12,13,12,7,1],[0,7,12,16,19,16,12,7]];const scale=scales[this.chapter%5],base=this.menu?110:this.boss?73.42:82.41;this.tone(base*Math.pow(2,scale[this.beat%8]/12),.5,'sine',.07,1,true);if(this.beat%4===0)this.tone(base/2,.75,'triangle',.08,1,true);if(this.intensity>1&&this.beat%2===0)this.tone(1500,.025,'triangle',.025,0.5,true);this.beat++;}
}
