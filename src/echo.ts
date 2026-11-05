export type EchoKind = 'normal' | 'phantom' | 'puzzle' | 'corrupted';
export type Frame = Readonly<{x:number;y:number;angle:number;dash:boolean;animation:'idle'|'walk'|'dash';interact:boolean}>;
export interface Echo { id:number; kind:EchoKind; frames:readonly Frame[]; cursor:number; age:number; disabled:number; frame:Frame }
export const HZ=60, CYCLE=600;
export class EchoSystem {
  recording:Frame[]=[];
  echoes:Echo[]=[];
  ticks=0;
  private serial=0;
  constructor(public max=3,public lifetime=1800){}
  get countdown(){return (CYCLE-this.recording.length)/HZ;}
  /** Playback clocks can stop. Birth and lifetime clocks always advance. */
  step(frame:Frame,frozen:boolean,kind:EchoKind='normal'):{born?:Echo;expired:Echo[]} {
    this.ticks++;
    const expired:Echo[]=[];
    for(const e of this.echoes){
      e.age++;
      if(e.disabled>0)e.disabled--;
      if(!frozen && e.disabled===0){e.cursor=(e.cursor+1)%e.frames.length;e.frame=e.frames[e.cursor];}
    }
    this.echoes=this.echoes.filter(e=>{if(e.age>=this.lifetime){expired.push(e);return false;}return true;});
    this.recording.push(Object.freeze({...frame}));
    let born:Echo|undefined;
    if(this.recording.length===CYCLE){
      const frames=Object.freeze(this.recording.slice());
      born={id:++this.serial,kind,frames,cursor:0,age:0,disabled:0,frame:frames[0]};
      this.echoes.push(born);this.recording=[];
      while(this.echoes.length>this.max)expired.push(this.echoes.shift()!);
    }
    return {born,expired};
  }
  future(e:Echo,frames=90):Frame[]{return Array.from({length:Math.ceil(frames/6)},(_,i)=>e.frames[(e.cursor+i*6)%e.frames.length]);}
}
