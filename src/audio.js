const FILES={music:'courtyard-story-v1.wav',pages:'pages-turn-v3.wav',wood:'scroll-wood-v3.wav',exchange:'exchange-success-v1.wav'};

export class GameAudio {
  constructor(getSettings, {Context=globalThis.AudioContext||globalThis.webkitAudioContext, fetcher=globalThis.fetch?.bind(globalThis)}={}) {
    this.getSettings=getSettings;this.Context=Context;this.fetcher=fetcher;
    this.buffers=new Map();this.pending=new Map();this.effects=new Map();
    this.hidden=false;this.unlocked=false;this.music=null;this.musicLoading=false;this.pageToken=0;this.woodToken=0;this.exchangeToken=0;
  }
  get enabled(){return this.getSettings().sound!==false&&!this.hidden;}
  async unlock(){
    if(!this.enabled||!this.Context)return;
    try{
      if(!this.ctx){
        this.ctx=new this.Context();this.master=this.ctx.createGain();this.musicGain=this.ctx.createGain();this.effectGain=this.ctx.createGain();
        this.master.connect(this.ctx.destination);this.musicGain.connect(this.master);this.effectGain.connect(this.master);
        this.effectGain.gain.value=.85;
      }
      // Called directly from a gesture, before any download or decode.
      await this.ctx.resume();this.unlocked=true;this.sync();
      if(this.getSettings().effects!==false)for(const key of ['pages','wood','exchange'])this.buffer(key).catch(()=>{});
    }catch{/* Unsupported or blocked audio never blocks game input. */}
  }
  async buffer(key){
    if(this.buffers.has(key))return this.buffers.get(key);
    if(!this.pending.has(key)){
      const task=this.fetcher(new URL('../assets/audio/'+FILES[key],import.meta.url)).then(r=>{
        if(!r.ok)throw Error('Audio unavailable');return r.arrayBuffer();
      }).then(b=>this.ctx.decodeAudioData(b)).then(b=>{this.buffers.set(key,b);return b;}).finally(()=>this.pending.delete(key));
      this.pending.set(key,task);
    }
    return this.pending.get(key);
  }
  ramp(gain,value){gain.cancelScheduledValues(this.ctx.currentTime);gain.setTargetAtTime(value,this.ctx.currentTime,.06);}
  sync(){
    if(!this.ctx)return;
    const s=this.getSettings();this.ramp(this.master.gain,this.enabled?Math.max(0,Math.min(1,s.volume??.35)):0);
    this.ramp(this.musicGain.gain,this.enabled&&s.music!==false?(this.effects.size?.12:.32):0);
    if(!this.enabled||s.effects===false){this.stopPages();this.stopEffect('wood');this.woodToken++;this.stopExchange();}
    if(this.enabled&&s.music!==false&&this.unlocked)this.startMusic();
    else if(this.music){this.music.stop();this.music=null;}
  }
  async startMusic(){
    if(this.music||this.musicLoading)return;
    this.musicLoading=true;
    try{
      const buffer=await this.buffer('music');
      if(!this.enabled||this.getSettings().music===false||this.music)return;
      const source=this.ctx.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(this.musicGain);source.start();this.music=source;
    }catch{/* Next gesture can retry a failed download. */}finally{this.musicLoading=false;}
  }
  stopEffect(key){const source=this.effects.get(key);if(source){this.effects.delete(key);source.stop();source.disconnect();}this.duck();}
  duck(){if(this.musicGain)this.ramp(this.musicGain.gain,this.enabled&&this.getSettings().music!==false?(this.effects.size?.12:.32):0);}
  stopPages(){this.pageToken++;this.stopEffect('pages');}
  stopExchange(){this.exchangeToken++;this.stopEffect('exchange');}
  async play(key){
    const tokenKey=key==='pages'?'pageToken':key==='wood'?'woodToken':'exchangeToken',token=++this[tokenKey];
    this.stopEffect(key);
    if(!this.enabled||this.getSettings().effects===false)return;
    try{
      await this.unlock();if(!this.ctx)return;
      const buffer=await this.buffer(key);
      if(token!==this[tokenKey]||!this.enabled||this.getSettings().effects===false)return;
      const source=this.ctx.createBufferSource();source.buffer=buffer;source.connect(this.effectGain);this.effects.set(key,source);this.duck();
      source.onended=()=>{if(this.effects.get(key)===source)this.effects.delete(key);source.disconnect();this.duck();};source.start();
    }catch{/* Audio errors do not block drawing or closing. */}
  }
  playPages(){this.stopExchange();this.woodToken++;this.stopEffect('wood');return this.play('pages');}
  playClose(){this.stopExchange();this.stopPages();return this.play('wood');}
  playExchange(){this.stopPages();this.woodToken++;this.stopEffect('wood');return this.play('exchange');}
  async setHidden(hidden){
    this.hidden=hidden;if(!this.ctx)return;
    if(hidden){this.stopPages();this.stopExchange();this.woodToken++;this.stopEffect('wood');await this.ctx.suspend().catch(()=>{});}
    else if(this.unlocked&&this.enabled){await this.ctx.resume().catch(()=>{});this.sync();}
  }
}
