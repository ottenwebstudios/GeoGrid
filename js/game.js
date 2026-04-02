/* ═══════════════════════════════════════
   GAME MODULE
═══════════════════════════════════════ */
window.GameModule = (function(){

  var LOCS = [
    {lat:48.8566,lng:2.3522},{lat:35.6762,lng:139.6503},{lat:-33.8688,lng:151.2093},
    {lat:40.7128,lng:-74.006},{lat:51.5074,lng:-.1278},{lat:55.7558,lng:37.6173},
    {lat:-22.9068,lng:-43.1729},{lat:1.3521,lng:103.8198},{lat:25.2048,lng:55.2708},
    {lat:19.4326,lng:-99.1332},{lat:-34.6037,lng:-58.3816},{lat:28.6139,lng:77.209},
    {lat:39.9042,lng:116.4074},{lat:41.9028,lng:12.4964},{lat:-26.2041,lng:28.0473},
    {lat:30.0444,lng:31.2357},{lat:37.5665,lng:126.978},{lat:52.52,lng:13.405},
    {lat:13.7563,lng:100.5018},{lat:59.9139,lng:10.7522},{lat:-1.2921,lng:36.8219},
    {lat:48.2082,lng:16.3738},{lat:22.3964,lng:114.1095},{lat:43.6532,lng:-79.3832},
    {lat:41.0082,lng:28.9784},{lat:-12.0464,lng:-77.0428},{lat:23.1291,lng:113.2644},
    {lat:45.4642,lng:9.19},{lat:33.749,lng:-84.388},{lat:-4.4419,lng:15.2663},
  ];

  var G = {
    round:0, totalRounds:5,
    players:[], locs:[],
    timerID:null, timeLeft:120,
    satMap:null, gMap:null, rMap:null,
    pin:null, pinLat:null, pinLng:null,
    big:false, botTimers:[],
    mode:null, matchId:null, streetNames:false
  };

  function start(players, mode, matchId) {
    G.round=0;
    G.players = players.map(function(p){ return Object.assign({}, p, {total:0, guessed:false, dist:null, pts:0, gLat:null, gLng:null}); });
    G.totalRounds = (mode && mode.rounds) || 5;
    G.timeLeft    = (mode && mode.timer)  || 120;
    G.streetNames = !!(mode && mode.streetNames);
    G.mode        = mode;
    G.matchId     = matchId;
    G.locs = [].concat(LOCS).sort(function(){return Math.random()-.5;}).slice(0, G.totalRounds);

    LobbyModule.destroyThumbs();
    showPage('pgGame');
    initSat();
    initGMap();
    setTimeout(doRound, 120);
  }

  function initSat() {
    if(G.satMap){try{G.satMap.off();G.satMap.remove();}catch(e){} G.satMap=null;}
    G.satMap = L.map('satMap',{zoomControl:true,attributionControl:false,minZoom:11,maxZoom:17,zoomSnap:1});
    if (G.streetNames) {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:19}).addTo(G.satMap);
    } else {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19}).addTo(G.satMap);
    }
    G.satMap.zoomControl.setPosition('bottomleft');
    // Team bar shifts satmap
    var teamsNeeded = G.players.filter(function(p){return p.team===0;}).length > 1 ||
                      G.players.filter(function(p){return p.team===1;}).length > 1;
    if (teamsNeeded) {
      document.getElementById('satMap').classList.add('team-offset');
      document.getElementById('teamBar').classList.remove('hidden');
    } else {
      document.getElementById('satMap').classList.remove('team-offset');
      document.getElementById('teamBar').classList.add('hidden');
    }
  }

  function initGMap() {
    if(G.gMap){try{G.gMap.off();G.gMap.remove();}catch(e){} G.gMap=null;}
    G.pin=null; G.pinLat=null; G.pinLng=null;
    G.gMap=L.map('gmap',{center:[20,0],zoom:1,zoomControl:false,attributionControl:false,minZoom:1,maxZoom:5});
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',{subdomains:'abcd'}).addTo(G.gMap);
    G.gMap.on('click',function(e){ placePin(e.latlng.lat,e.latlng.lng); });
  }

  function doRound() {
    G.round++;
    G.pinLat=null; G.pinLng=null;
    if(G.pin){try{G.gMap.removeLayer(G.pin);}catch(e){} G.pin=null;}
    document.getElementById('bGss').classList.remove('rdy');
    document.getElementById('gpHint').textContent='Click the map to pin your guess';
    document.getElementById('gPanel').classList.remove('big');
    document.getElementById('gpXBtn').textContent='Expand';
    G.big=false;
    G.players.forEach(function(p){p.guessed=false;p.dist=null;p.pts=0;p.gLat=null;p.gLng=null;});

    var loc = G.locs[G.round-1];
    G.satMap.setView([loc.lat+(Math.random()-.5)*.03, loc.lng+(Math.random()-.5)*.03], 14, {animate:false});
    setTimeout(function(){G.satMap.invalidateSize();G.gMap.invalidateSize();},80);

    document.getElementById('gRnd').textContent='Round '+G.round+' of '+G.totalRounds;
    renderStrip();
    renderTeamBar();

    G.timeLeft = G.mode && G.mode.timer ? G.mode.timer : 120;
    renderTmr();
    clearInterval(G.timerID);
    G.timerID=setInterval(function(){
      G.timeLeft--;renderTmr();
      if(G.timeLeft<=0){clearInterval(G.timerID);clearBotTimers();timeUp();}
    },1000);

    clearBotTimers();
    G.players.filter(function(p){return p.isBot;}).forEach(function(bot){
      var d=(10+Math.floor(Math.random()*85))*1000;
      var t=setTimeout(function(){botGuess(bot,loc);},d);
      G.botTimers.push(t);
    });
  }

  function clearBotTimers(){ G.botTimers.forEach(clearTimeout); G.botTimers=[]; }

  function botGuess(bot,loc){
    if(bot.guessed)return;
    var sk=.45+Math.random()*.5, err=(1-sk)*32, a=Math.random()*Math.PI*2;
    bot.gLat=Math.max(-85,Math.min(85,loc.lat+Math.cos(a)*err*Math.random()));
    bot.gLng=loc.lng+Math.sin(a)*err*Math.random();
    var d=haversine(bot.gLat,bot.gLng,loc.lat,loc.lng);
    bot.dist=d; bot.pts=calcScore(d); bot.total+=bot.pts; bot.guessed=true;
    renderStrip(); renderTeamBar(); checkDone();
  }

  function placePin(lat,lng){
    G.pinLat=lat; G.pinLng=lng;
    if(G.pin){try{G.gMap.removeLayer(G.pin);}catch(e){}}
    G.pin=L.circleMarker([lat,lng],{radius:7,fillColor:'#7c6fff',color:'#fff',weight:2.5,fillOpacity:1}).addTo(G.gMap);
    document.getElementById('bGss').classList.add('rdy');
    document.getElementById('gpHint').textContent='Ready — confirm or move pin';
  }

  function submitGuess(){
    var me=G.players.find(function(p){return p.uid===window.APP.uid;});
    if(!me||me.guessed||G.pinLat==null)return;
    var loc=G.locs[G.round-1];
    var d=haversine(G.pinLat,G.pinLng,loc.lat,loc.lng);
    me.dist=d; me.pts=calcScore(d); me.total+=me.pts;
    me.gLat=G.pinLat; me.gLng=G.pinLng; me.guessed=true;
    renderStrip(); renderTeamBar();
    showToast('+'+me.pts.toLocaleString()+' pts  '+fmtDist(d));
    checkDone();
  }

  function timeUp(){
    var loc=G.locs[G.round-1];
    G.players.forEach(function(p){ if(!p.guessed){if(p.isBot){botGuess(p,loc);}else{p.guessed=true;p.dist=null;p.pts=0;}} });
    showResults();
  }

  function checkDone(){
    if(G.players.every(function(p){return p.guessed;})){
      clearInterval(G.timerID);clearBotTimers();setTimeout(showResults,500);
    }
  }

  function renderStrip(){
    var strip=document.getElementById('gStrip');
    if(!strip)return;
    strip.innerHTML=G.players.map(function(p,i){
      return (i?'<div class="spsep"></div>':'')+
        '<div class="spp"><div class="spav" style="background:'+p.ava+'"></div>'+
        '<div><div class="spn">'+p.name+'</div>'+
        '<div class="sps'+(p.guessed?' ok':'')+'">'+( p.guessed?'Guessed ✓':'Guessing…')+'</div></div></div>';
    }).join('');
  }

  function renderTeamBar(){
    var bar=document.getElementById('teamBar');
    if(!bar||bar.classList.contains('hidden'))return;
    var teams=[
      G.players.filter(function(p){return p.team===0;}),
      G.players.filter(function(p){return p.team===1;}),
    ];
    bar.innerHTML='<div class="team-title">Teams</div>'+teams.map(function(team,ti){
      var teamPts=team.reduce(function(s,p){return s+p.pts;},0);
      return '<div class="team-block">'+
        '<div class="team-name" style="color:'+(ti===0?'var(--ac)':'#4080c8')+'">Team '+(ti+1)+'</div>'+
        team.map(function(p){
          return '<div class="team-member"><div class="team-mav" style="background:'+p.ava+'"></div>'+
            '<div><div class="team-mn">'+p.name+'</div><div class="team-ms'+(p.guessed?' ok':'')+'">'+( p.guessed?'✓':'…')+'</div></div></div>';
        }).join('')+
        '<div class="team-pts">'+teamPts.toLocaleString()+' pts</div>'+
      '</div>';
    }).join('');
  }

  function renderTmr(){
    var el=document.getElementById('gTmr'); if(!el)return;
    el.textContent=G.timeLeft;
    el.className='gtmr'+(G.timeLeft<=10?' danger':G.timeLeft<=30?' warn':'');
  }

  function toggleGP(){
    G.big=!G.big;
    document.getElementById('gPanel').classList.toggle('big',G.big);
    document.getElementById('gpXBtn').textContent=G.big?'Collapse':'Expand';
    setTimeout(function(){if(G.gMap)G.gMap.invalidateSize();},380);
  }

  /* ── Results ── */
  function showResults(){
    var loc=G.locs[G.round-1];
    var ovR=document.getElementById('ovResults');
    if(ovR)ovR.classList.add('show');
    document.getElementById('rRnd').textContent='Round '+G.round+' of '+G.totalRounds;
    if(G.rMap){try{G.rMap.off();G.rMap.remove();}catch(e){} G.rMap=null;}
    setTimeout(function(){
      G.rMap=L.map('rmap',{zoomControl:false,attributionControl:false,dragging:true,scrollWheelZoom:false,doubleClickZoom:false});
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',{subdomains:'abcd'}).addTo(G.rMap);
      var ri=L.divIcon({className:'',html:'<div style="width:14px;height:14px;background:#e05050;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.25)"></div>',iconSize:[14,14],iconAnchor:[7,7]});
      L.marker([loc.lat,loc.lng],{icon:ri}).addTo(G.rMap).bindTooltip('Target',{permanent:false,direction:'top'});
      var bnds=[[loc.lat,loc.lng]];
      G.players.forEach(function(p){
        if(p.gLat==null)return;
        bnds.push([p.gLat,p.gLng]);
        var pi=L.divIcon({className:'',html:'<div style="width:12px;height:12px;background:'+p.color+';border:2px solid #fff;border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,.2)"></div>',iconSize:[12,12],iconAnchor:[6,6]});
        L.marker([p.gLat,p.gLng],{icon:pi}).addTo(G.rMap);
        L.polyline([[loc.lat,loc.lng],[p.gLat,p.gLng]],{color:p.color,weight:1.5,opacity:.6,dashArray:'5,5'}).addTo(G.rMap);
      });
      G.rMap.invalidateSize();
      try{if(bnds.length>1)G.rMap.fitBounds(bnds,{padding:[30,30],maxZoom:9,animate:false});else G.rMap.setView([loc.lat,loc.lng],4,{animate:false});}catch(e){}
    },80);

    var sorted=[].concat(G.players).sort(function(a,b){return b.pts-a.pts;});
    document.getElementById('rScores').innerHTML=sorted.map(function(p){
      return '<div class="rsp"><div class="rspn">'+p.name+'</div><div class="rsd">'+(p.dist!=null?fmtDist(p.dist):'--')+'</div>'+
        '<div class="rsdu">'+(p.dist!=null?'from target':'No guess')+'</div><span class="rspts">+'+p.pts.toLocaleString()+' pts</span></div>';
    }).join('');
    var me=G.players.find(function(p){return p.uid===window.APP.uid;});
    document.getElementById('rTot').innerHTML='Total: <strong>'+(me?me.total.toLocaleString():0)+' pts</strong>';
    document.getElementById('bNxt').textContent=G.round<G.totalRounds?'Next Round →':'See Final Scores →';
  }

  function nextRound(){
    var ovR=document.getElementById('ovResults');
    if(ovR)ovR.classList.remove('show');
    if(G.rMap){try{G.rMap.off();G.rMap.remove();}catch(e){} G.rMap=null;}
    if(G.round<G.totalRounds){
      setTimeout(function(){if(G.satMap)G.satMap.invalidateSize();if(G.gMap)G.gMap.invalidateSize();doRound();},80);
    } else {
      endGame();
    }
  }

  function endGame(){
    // Determine winner(s) by team or solo
    var sorted=[].concat(G.players).sort(function(a,b){return b.total-a.total;});
    var winnerUid=sorted[0].uid;
    var isRanked=G.mode&&G.mode.ranked;

    // Calc trophy deltas
    var deltas={};
    var me=G.players.find(function(p){return p.uid===window.APP.uid;});
    if(me){
      var iWon=(winnerUid===me.uid);
      var opp=sorted.find(function(p){return p.uid!==me.uid;});
      var delta=calcTrophyDelta(iWon, me.total, opp?(opp.trophies||100):100, me.trophies||100);
      deltas[me.uid]=delta;
      if(isRanked){
        // Save to Firestore
        db.collection('users').doc(me.uid).update({
          trophies: firebase.firestore.FieldValue.increment(delta),
          xp: firebase.firestore.FieldValue.increment(Math.round(me.total/100))
        }).catch(function(){});
        // Update APP cache
        if(window.APP&&window.APP.userData){ window.APP.userData.trophies=(window.APP.userData.trophies||0)+delta; }
      }
    }

    // Clean up match doc
    if(G.matchId){
      db.collection('matches').doc(G.matchId).update({status:'finished'}).catch(function(){});
    }
    // Set not in game
    if(window.APP&&window.APP.uid){
      db.collection('users').doc(window.APP.uid).update({inGame:false}).catch(function(){});
    }

    showEndCinema(G.players, G.mode?G.mode.name:'Game', isRanked?deltas:null, function(){
      cleanupAndGoLobby();
    });
  }

  function cleanupAndGoLobby(){
    clearInterval(G.timerID); clearBotTimers();
    ['satMap','gMap','rMap'].forEach(function(k){if(G[k]){try{G[k].off();G[k].remove();}catch(e){}G[k]=null;}});
    document.querySelectorAll('.ov').forEach(function(o){o.classList.remove('show');});
    showPage('pgLobby');
    LobbyModule.renderModes(LobbyModule.currentCat||'casual');
    // Refresh lobby header trophies
    if(window.APP&&window.APP.userData){
      var el=document.getElementById('headerTrophies');
      if(el)el.textContent=(window.APP.userData.trophies||0).toLocaleString();
    }
  }

  return { start:start, submitGuess:submitGuess, toggleGP:toggleGP, nextRound:nextRound };
})();
