/* ═══════════════════════════════════════
   BLOB ANIMATION UTILITY
   Colors MUST be "r,g,b" strings
═══════════════════════════════════════ */
function blobAnim(canvas, rgbCols, alpha, bgCss) {
  var cx = canvas.getContext('2d');
  var W = 0, H = 0, blobs = [], noiseC = null, rafId, stopped = false;
  function setSize() {
    W = canvas.width  = (canvas.offsetWidth  || parseInt(canvas.getAttribute('width'))  || innerWidth);
    H = canvas.height = (canvas.offsetHeight || parseInt(canvas.getAttribute('height')) || innerHeight);
    noiseC = null;
  }
  function mkNoise() {
    var n = document.createElement('canvas'); n.width = W; n.height = H;
    var nx = n.getContext('2d'), d = nx.createImageData(W, H);
    for (var i = 0; i < d.data.length; i += 4) { var v = Math.random()*255|0; d.data[i]=d.data[i+1]=d.data[i+2]=v; d.data[i+3]=15; }
    nx.putImageData(d,0,0); return n;
  }
  function init() {
    blobs = rgbCols.map(function(c) {
      return { x:W*(.15+Math.random()*.7), y:H*(.15+Math.random()*.7),
               r:Math.min(W,H)*(.25+Math.random()*.35),
               vx:(Math.random()-.5)*.35, vy:(Math.random()-.5)*.25, c:c };
    });
  }
  function draw() {
    if (stopped) return;
    cx.clearRect(0,0,W,H);
    cx.fillStyle = bgCss || '#f9f9fb'; cx.fillRect(0,0,W,H);
    blobs.forEach(function(b) {
      b.x+=b.vx; b.y+=b.vy;
      if(b.x<-b.r||b.x>W+b.r)b.vx*=-1;
      if(b.y<-b.r||b.y>H+b.r)b.vy*=-1;
      var g = cx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r);
      g.addColorStop(0,'rgba('+b.c+','+(alpha||.15)+')');
      g.addColorStop(1,'rgba('+b.c+',0)');
      cx.fillStyle=g; cx.fillRect(0,0,W,H);
    });
    if(!noiseC) noiseC=mkNoise();
    cx.drawImage(noiseC,0,0);
    rafId = requestAnimationFrame(draw);
  }
  setSize(); init(); draw();
  return {
    stop: function(){ stopped=true; cancelAnimationFrame(rafId); },
    resize: function(){ setSize(); init(); }
  };
}

/* hex "#rrggbb" → "r,g,b" */
function h2rgb(hex) {
  hex = hex.replace('#','');
  return parseInt(hex.substr(0,2),16)+','+parseInt(hex.substr(2,2),16)+','+parseInt(hex.substr(4,2),16);
}
/* hex → "rgb(r,g,b)" */
function h2css(hex) { var p=h2rgb(hex).split(','); return 'rgb('+p[0]+','+p[1]+','+p[2]+')'; }

/* extract hex colors from gradient string, return as "r,g,b" array */
function avaToRgbs(avaStr) {
  var hexes = avaStr.match(/#[0-9a-fA-F]{6}/g) || ['#b8aaff','#7c6fff'];
  return hexes.map(h2rgb);
}

/* ═══════════════════════════════════════
   GEOGRAPHY MATH
═══════════════════════════════════════ */
function haversine(la1,lo1,la2,lo2) {
  var R=6371, dLa=(la2-la1)*Math.PI/180, dLo=(lo2-lo1)*Math.PI/180;
  var a=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)*Math.sin(dLo/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function calcScore(km) {
  if(km<1) return 5000;
  return Math.max(0,Math.min(5000,Math.round(5000*Math.exp(-km/1800))));
}
function fmtDist(km) {
  if(km<1) return Math.round(km*1000)+' m';
  if(km<100) return km.toFixed(1)+' km';
  return Math.round(km).toLocaleString()+' km';
}

/* ═══════════════════════════════════════
   TROPHY / RANK HELPERS
═══════════════════════════════════════ */
var RANKS = [
  {name:'Bronze',   cls:'bronze', min:0,    max:299,  icon:'🥉'},
  {name:'Silver',   cls:'silver', min:300,  max:699,  icon:'🥈'},
  {name:'Gold',     cls:'gold',   min:700,  max:1299, icon:'🥇'},
  {name:'Platinum', cls:'plat',   min:1300, max:2199, icon:'💎'},
  {name:'Diamond',  cls:'dia',    min:2200, max:99999, icon:'👑'},
];

function getRank(trophies) {
  for (var i = RANKS.length-1; i >= 0; i--) {
    if (trophies >= RANKS[i].min) return RANKS[i];
  }
  return RANKS[0];
}

function calcTrophyDelta(won, score, opponentTrophies, myTrophies) {
  var base = won ? 10 : -8;
  var scoreMult = Math.min(1.5, score / 3000);
  var trophyDiff = opponentTrophies - myTrophies;
  var diffBonus = won ? Math.max(0, trophyDiff * 0.05) : 0;
  var result = Math.round(base * (won ? scoreMult : 1) + diffBonus);
  return Math.max(won ? 3 : -15, Math.min(25, result));
}

/* ═══════════════════════════════════════
   TOAST
═══════════════════════════════════════ */
function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 2600);
}

/* ═══════════════════════════════════════
   CINEMA HELPERS
═══════════════════════════════════════ */
var _cinBlobMain = null;
var _cinBlobList = [];

function openCinema(innerHtml, durMs, onDone) {
  _cinBlobList.forEach(function(r){ r.stop(); }); _cinBlobList = [];
  var cv = document.getElementById('cinBg');
  cv.width = innerWidth; cv.height = innerHeight;
  if (_cinBlobMain) _cinBlobMain.stop();
  _cinBlobMain = blobAnim(cv,
    ['60,40,120','80,20,100','40,60,140','100,40,80'], .35, '#08080f');

  document.getElementById('cinInner').innerHTML = innerHtml;
  var el = document.getElementById('ovCinema');
  el.style.display = 'flex';

  var fill = document.getElementById('cinFill');
  fill.style.transition = 'none'; fill.style.width = '0%';
  setTimeout(function(){ fill.style.transition='width '+durMs+'ms linear'; fill.style.width='100%'; }, 60);

  // spin up canvas avatars
  setTimeout(function(){
    el.querySelectorAll('canvas[data-blobs]').forEach(function(ac){
      var hexes = ac.getAttribute('data-blobs').split(',');
      ac.width  = parseInt(ac.getAttribute('width'))  || 80;
      ac.height = parseInt(ac.getAttribute('height')) || 80;
      var r = blobAnim(ac, hexes.map(h2rgb), .9, h2css(hexes[0]));
      _cinBlobList.push(r);
    });
  }, 40);

  setTimeout(function(){
    el.style.display = 'none';
    if (_cinBlobMain){ _cinBlobMain.stop(); _cinBlobMain=null; }
    _cinBlobList.forEach(function(r){ r.stop(); }); _cinBlobList=[];
    if (onDone) onDone();
  }, durMs);
}

function cinAvaCanvas(avaGrad, w, h) {
  var hexes = (avaGrad.match(/#[0-9a-fA-F]{6}/g)||['#b8aaff','#7c6fff']).join(',');
  return '<canvas width="'+(w||80)+'" height="'+(h||80)+'" data-blobs="'+hexes+'"></canvas>';
}

function showIntroCinema(players, modeName, onDone) {
  // support any number of players (2v2 = 4 players split into teams)
  var perTeam = players.length > 2 ? Math.ceil(players.length / 2) : null;
  var pH;
  if (perTeam && players.length > 2) {
    // show two team columns
    var t1 = players.slice(0, perTeam);
    var t2 = players.slice(perTeam);
    var makeCol = function(team, delay) {
      return team.map(function(p, i) {
        return '<div class="cin-player cfadeup" style="animation-delay:'+(delay+i*.15)+'s">' +
          '<div class="cin-ava-wrap">'+cinAvaCanvas(p.ava,80,80)+'</div>' +
          '<div class="cin-pname">'+p.name+'</div>' +
          '<div class="cin-ptag">'+(p.isBot?'Bot':p.uid===window.APP.uid?'You':'Ally')+'</div>' +
        '</div>';
      }).join('');
    };
    pH = '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;">' + makeCol(t1,.2) + '</div>' +
         '<div class="cin-vs cfadeup" style="animation-delay:.42s">vs</div>' +
         '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;">' + makeCol(t2,.5) + '</div>';
  } else {
    pH = players.map(function(p,i){
      return '<div class="cin-player cfadeup" style="animation-delay:'+(0.25+i*.2)+'s">' +
        '<div class="cin-ava-wrap">'+cinAvaCanvas(p.ava,80,80)+'</div>' +
        '<div class="cin-pname">'+p.name+'</div>' +
        '<div class="cin-ptag">'+(p.isBot?'Opponent':p.uid===window.APP.uid?'You':'Ally')+'</div>' +
      '</div>' + (i<players.length-1?'<div class="cin-vs cfadeup" style="animation-delay:.42s">vs</div>':'');
    }).join('');
  }
  var html = '<div class="cin-label cfadeup" style="animation-delay:.1s">Get Ready</div>' +
    '<div class="cin-players">'+pH+'</div>' +
    '<div class="cin-mode cfadeup" style="animation-delay:.65s">'+modeName+'</div>';
  openCinema(html, 3400, onDone);
}

function showEndCinema(players, modeName, trophyDeltas, onDone) {
  var sorted = [].concat(players).sort(function(a,b){ return b.total-a.total; });
  var winnerTeam = sorted[0].team !== undefined ? sorted[0].team : null;
  var rows = sorted.map(function(p,i){
    var delta = trophyDeltas ? trophyDeltas[p.uid] : null;
    var trophyTag = delta!=null
      ? '<span class="cin-trophy '+(delta>=0?'gain':'lose')+'">'+(delta>=0?'+':'')+delta+' 🏆</span>'
      : '';
    return '<div class="cin-srow">' +
      '<div class="cin-srank'+(i===0?' f':'')+'">'+( i+1)+'</div>' +
      '<div class="cin-sava">'+cinAvaCanvas(p.ava,34,34)+'</div>' +
      '<div class="cin-snm">'+p.name+'</div>' +
      '<div class="cin-ssc">'+p.total.toLocaleString()+' pts'+trophyTag+'</div>' +
    '</div>';
  }).join('');
  var iWon = sorted[0].uid === window.APP.uid || (winnerTeam !== null && players.find(function(p){return p.uid===window.APP.uid && p.team===winnerTeam;}));
  var html =
    '<div class="cin-label cfadeup" style="animation-delay:.08s">'+modeName+' — Complete</div>' +
    '<div class="cin-win cfadeup" style="animation-delay:.22s">'+(iWon?'You<br><em>Won!</em>':'Good<br><em>game!</em>')+'</div>' +
    '<div class="cin-scorelist cfadeup" style="animation-delay:.48s">'+rows+'</div>';
  openCinema(html, 5000, onDone);
}
