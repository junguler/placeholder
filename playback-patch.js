(async function(){
  async function resolveStreamUrl(originalUrl, depth=0){
    if(!originalUrl) return originalUrl;
    if(depth>4) return originalUrl;
    try{
      const resp = await fetch(originalUrl, { method: 'GET', mode: 'cors', redirect: 'follow', cache: 'no-store' });
      const finalUrl = (resp && resp.url) ? resp.url : originalUrl;
      const ct = (resp && resp.headers) ? (resp.headers.get('content-type') || '') : '';
      const looksLikePlaylist = /\.m3u8?$/.test(new URL(finalUrl).pathname) || /application\/vnd\.apple\.mpegurl|application\/x-mpegURL|audio\/x-mpegurl|text\/plain/i.test(ct);
      if(looksLikePlaylist){
        const text = await resp.text();
        if(!text) return finalUrl;
        const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
        for(const l of lines){
          if(l.startsWith('#')) continue;
          try{ const candidate = new URL(l, finalUrl).href; if(/\.m3u8?$/.test(new URL(candidate).pathname) && candidate!==originalUrl) return await resolveStreamUrl(candidate, depth+1); return candidate; }catch(e){ continue; }
        }
        return finalUrl;
      }
      return finalUrl;
    }catch(e){ console.warn('resolveStreamUrl failed for', originalUrl, e); return originalUrl; }
  }

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      if(document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script'); s.src = src; s.async = true; s.onload = ()=>resolve(); s.onerror = (e)=>reject(e); document.head.appendChild(s);
    });
  }

  const orig = window.playPlaylistTrack;
  if(typeof orig === 'function'){
    window.playPlaylistTrack = async function(idx){
      try{
        if(typeof idx !== 'number') return orig(idx);
        if(idx < 0 || idx >= (window.currentPlaylist || []).length) return orig(idx);
        const t = window.currentPlaylist[idx];
        const resolved = await resolveStreamUrl(t);
        if(resolved && resolved !== t) window.currentPlaylist[idx] = resolved;
        await orig(idx);
        setTimeout(async ()=>{
          const modal = document.getElementById('modalBody');
          if(!modal) return;
          const audioEl = modal.querySelector('audio.preview-audio');
          if(!audioEl) return;
          const src = audioEl.currentSrc || audioEl.src || (audioEl.querySelector('source') && audioEl.querySelector('source').src);
          if(!src) return;
          let isHls = false;
          try{ isHls = /\.m3u8(\?|$)/i.test(new URL(src).pathname); }catch(e){ isHls = src.toLowerCase().includes('.m3u8'); }
          if(!isHls) return;
          if(audioEl.canPlayType('application/vnd.apple.mpegurl')){ audioEl.src = src; audioEl.play().catch(()=>{}); return; }
          try{
            await loadScript('https://cdn.jsdelivr.net/npm/hls.js@1.4.0/dist/hls.min.js');
            if(window.Hls && window.Hls.isSupported()){
              if(window._hlsInstance){ try{ window._hlsInstance.destroy(); }catch(e){} window._hlsInstance = null; }
              window._hlsInstance = new window.Hls();
              window._hlsInstance.attachMedia(audioEl);
              window._hlsInstance.on(window.Hls.Events.MEDIA_ATTACHED, ()=>{ window._hlsInstance.loadSource(src); });
            }
          }catch(err){ console.warn('hls attach failed', err); }
        }, 150);
      }catch(err){ console.warn('patched playPlaylistTrack error', err); return orig(idx); }
    };
  }
})();
