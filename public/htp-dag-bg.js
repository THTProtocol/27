(function(){
  if(document.getElementById('htp-dag-canvas')) return; // idempotent
  const DPR = Math.min(window.devicePixelRatio||1, 2);
  const c = document.createElement('canvas');
  c.id = 'htp-dag-canvas';
  c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:0;pointer-events:none;opacity:0.55';
  document.body.prepend(c);

  const ctx = c.getContext('2d');
  let W=0,H=0,nodes=[],pulses=[],raf,frame=0,lastPulse=0;
  const N = window.innerWidth > 900 ? 42 : 24;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize(){
    W = window.innerWidth; H = window.innerHeight;
    c.width = W*DPR; c.height = H*DPR;
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  function init(){
    nodes=[];
    for(let i=0;i<N;i++){
      const tier = Math.random()<0.33?0:(Math.random()<0.66?1:2);
      nodes.push({
        x:Math.random()*W,y:Math.random()*H,
        vx:(Math.random()-0.5)*(0.12+tier*0.05),
        vy:(Math.random()-0.5)*(0.12+tier*0.05),
        r:1.2+Math.random()*1.2,
        pulse:Math.random()*Math.PI*2,
        tier
      });
    }
  }
  function neighborsOf(n){
    return nodes
      .filter(m=>m!==n && m.x>n.x)
      .map(m=>({m,d:Math.hypot(m.x-n.x,m.y-n.y)}))
      .sort((a,b)=>a.d-b.d)
      .slice(0,2+(Math.random()<0.4?1:0));
  }

  function draw(){
    frame++;
    ctx.clearRect(0,0,W,H);

    // edges
    for(const n of nodes){
      for(const {m,d} of neighborsOf(n)){
        if(d>W*0.32) continue;
        const a = Math.max(0,0.09*(1-d/(W*0.32)));
        ctx.strokeStyle = `rgba(0,255,163,${a})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(n.x,n.y); ctx.lineTo(m.x,m.y); ctx.stroke();
      }
    }

    // nodes
    for(const n of nodes){
      if(!reduce){ n.x+=n.vx; n.y+=n.vy; n.pulse+=0.01; }
      if(n.x<0||n.x>W) n.vx*=-1;
      if(n.y<0||n.y>H) n.vy*=-1;
      const alpha = 0.35 + Math.sin(n.pulse)*0.25 + 0.25;
      const tierDim = n.tier===0?1:(n.tier===1?0.7:0.45);
      ctx.beginPath(); ctx.arc(n.x,n.y,n.r,0,Math.PI*2);
      ctx.fillStyle = `rgba(0,255,163,${alpha*tierDim})`;
      ctx.fill();
    }

    // soft confirmation pulse
    if(!reduce && frame-lastPulse>120){
      lastPulse=frame;
      const src = nodes[Math.floor(Math.random()*nodes.length)];
      pulses.push({x:src.x,y:src.y,r:0,a:0.6});
    }
    for(let i=pulses.length-1;i>=0;i--){
      const p = pulses[i];
      p.r+=0.8; p.a*=0.96;
      if(p.a<0.02){ pulses.splice(i,1); continue; }
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.strokeStyle = `rgba(0,255,163,${p.a})`;
      ctx.lineWidth=1; ctx.stroke();
    }

    raf=requestAnimationFrame(draw);
  }

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden) cancelAnimationFrame(raf);
    else raf=requestAnimationFrame(draw);
  });

  let rt;
  window.addEventListener('resize',()=>{
    clearTimeout(rt);
    rt=setTimeout(()=>{ resize(); init(); },150);
  });

  resize(); init(); draw();
})();
