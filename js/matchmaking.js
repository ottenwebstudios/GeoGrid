/* ═══════════════════════════════════════
   MATCHMAKING MODULE
   - Writes a queue entry to Firestore
   - Polls for a match doc
   - Falls back to bot after 6 seconds
═══════════════════════════════════════ */
window.MatchmakingModule = (function(){

  var BOT_NAMES = ['KIRA_X','NOVA99','SHARD','FLUX','DRIFT','ECHO_7','RAZE','PHANTOM','VECTOR','BLAZE'];
  var BOT_AVAS  = [
    'linear-gradient(135deg,#c0a8ff,#7c6fff)',
    'linear-gradient(135deg,#a0c8f8,#4080c8)',
    'linear-gradient(135deg,#a0e0b8,#2da860)',
    'linear-gradient(135deg,#f0c0d8,#c04080)',
    'linear-gradient(135deg,#ffd0a0,#f08030)',
  ];

  var _queueDocId = null;
  var _matchUnsub = null;
  var _fallbackTimer = null;
  var _onMatchFound = null;
  var _mode = null;
  var _uid = null;
  var _userData = null;

  var _mmInterval = null;
  var _searchSec = 0;

  function start(uid, userData, mode, customOpts, onMatchFound) {
    _uid = uid; _userData = userData; _mode = mode;
    _onMatchFound = onMatchFound;
    _searchSec = 0;

    // Show MM overlay
    showMMOverlay(mode, userData);

    var teamSize = (mode.isCustomBuilder ? (customOpts||{}).teamSize : mode.teamSize) || 1;
    var modeId   = mode.id;
    var trophies = userData.trophies || 0;

    // Write queue entry
    db.collection('matchQueue').add({
      uid:      uid,
      username: userData.username,
      ava:      userData.ava,
      trophies: trophies,
      modeId:   modeId,
      teamSize: teamSize,
      status:   'searching',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(ref) {
      _queueDocId = ref.id;
      listenForMatch(ref.id, uid, teamSize, modeId, trophies);
    }).catch(function(e) {
      console.error('Queue write failed:', e);
      fallbackToBots(mode, userData, teamSize, customOpts);
    });

    // Count-up timer display
    _mmInterval = setInterval(function(){
      _searchSec++;
      var el = document.getElementById('mmTimerDisplay');
      if (el) el.textContent = _searchSec + 's';
    }, 1000);

    // Bot fallback after 6 seconds
    _fallbackTimer = setTimeout(function(){
      cancelSearch();
      fallbackToBots(mode, userData, teamSize, customOpts);
    }, 6000);
  }

  function listenForMatch(queueId, uid, teamSize, modeId, myTrophies) {
    // Listen on the queue doc — another player (or server logic) may update it
    _matchUnsub = db.collection('matchQueue').doc(queueId)
      .onSnapshot(function(snap) {
        if (!snap.exists) return;
        var d = snap.data();
        if (d.status === 'matched' && d.matchId) {
          cancelSearch();
          joinMatch(d.matchId, uid, modeId, teamSize);
        }
      });

    // Also try to find an existing searching player
    db.collection('matchQueue')
      .where('modeId', '==', modeId)
      .where('status', '==', 'searching')
      .get().then(function(snap) {
        var candidates = snap.docs.filter(function(doc) {
          return doc.id !== queueId &&
                 doc.data().uid !== uid &&
                 Math.abs((doc.data().trophies||0) - myTrophies) < 500;
        });
        if (candidates.length === 0) return;

        // Sort by trophy closeness
        candidates.sort(function(a,b){
          return Math.abs(a.data().trophies-myTrophies) - Math.abs(b.data().trophies-myTrophies);
        });

        var opponent = candidates[0];

        // Need enough players for the team size
        var totalNeeded = teamSize * 2;
        // For now: grab up to totalNeeded-1 other players (simple greedy match)
        var matched = [opponent];
        if (totalNeeded > 2 && candidates.length >= totalNeeded - 1) {
          matched = candidates.slice(0, totalNeeded - 1);
        }

        // Build player list
        var team1Uids = [uid];
        var team2Uids = matched.map(function(c){ return c.data().uid; });
        for (var i=1; i < teamSize; i++) {
          if (candidates[matched.length+i-1]) team1Uids.push(candidates[matched.length+i-1].data().uid);
        }

        var allDocIds = [queueId].concat(matched.map(function(m){return m.id;}));

        // Create a match document
        var matchRef = db.collection('matches').doc();
        var playerList = [{ uid:uid, username:userData_from_snap(), ava:_userData.ava, trophies:myTrophies, team:0, isBot:false }]
          .concat(matched.map(function(c,i){
            return { uid:c.data().uid, username:c.data().username, ava:c.data().ava, trophies:c.data().trophies||0, team:1, isBot:false };
          }));

        var batch = db.batch();
        batch.set(matchRef, {
          modeId: modeId, teamSize: teamSize,
          players: playerList,
          status: 'waiting',
          round: 0,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Mark all queue entries as matched
        allDocIds.forEach(function(id){
          batch.update(db.collection('matchQueue').doc(id), { status:'matched', matchId:matchRef.id });
        });
        return batch.commit();
      }).catch(function(){});
  }

  function userData_from_snap(){ return _userData ? _userData.username : 'VELOX'; }

  function joinMatch(matchId, uid, modeId, teamSize) {
    db.collection('matches').doc(matchId).get().then(function(snap){
      if (!snap.exists) {
        fallbackToBots(_mode, _userData, teamSize, null);
        return;
      }
      var d = snap.data();
      // Build local player objects
      var players = d.players.map(function(p){
        return {
          uid:      p.uid,
          name:     p.username,
          isBot:    false,
          color:    p.uid === uid ? '#7c6fff' : '#4080c8',
          ava:      p.ava,
          total:    0,
          trophies: p.trophies||0,
          team:     p.team
        };
      });
      cancelSearch();
      showMMPlayers(players);
      setTimeout(function(){
        if (_onMatchFound) _onMatchFound(players, matchId);
      }, 1200);
    });
  }

  function fallbackToBots(mode, userData, teamSize, customOpts) {
    var ts = teamSize || 1;
    var players = [{
      uid:      userData.uid,
      name:     userData.username,
      isBot:    false,
      color:    '#7c6fff',
      ava:      userData.ava,
      total:    0,
      trophies: userData.trophies||0,
      team:     0
    }];
    // Fill slots with bots
    for (var i=1; i < ts*2; i++) {
      var botName = BOT_NAMES[Math.floor(Math.random()*BOT_NAMES.length)];
      var botAva  = BOT_AVAS[Math.floor(Math.random()*BOT_AVAS.length)];
      players.push({
        uid:      'bot_'+Math.random().toString(36).substr(2,6),
        name:     botName,
        isBot:    true,
        color:    '#4080c8',
        ava:      botAva,
        total:    0,
        trophies: Math.max(0,(userData.trophies||100)+Math.round((Math.random()-.5)*150)),
        team:     Math.floor(i / ts) // team 0 or 1
      });
    }
    showMMPlayers(players);
    setTimeout(function(){
      if (_onMatchFound) _onMatchFound(players, null);
    }, 800);
  }

  function showMMOverlay(mode, userData) {
    var el = document.getElementById('ovMM');
    if (!el) return;
    el.classList.add('show');
    var ps = document.getElementById('mmPs');
    if (ps) ps.innerHTML = '<div class="mm-player"><div class="mm-ava" style="background:'+(userData.ava||'var(--ac)')+'"></div><div class="mm-pname">'+(userData.username||'YOU')+'</div></div>';
    var st = document.getElementById('mmSt');
    if (st) st.textContent = 'Searching for players…';
    var td = document.getElementById('mmTimerDisplay');
    if (td) td.textContent = '0s';
  }

  function showMMPlayers(players) {
    var ps = document.getElementById('mmPs');
    if (!ps) return;
    var team1 = players.filter(function(p){return p.team===0;});
    var team2 = players.filter(function(p){return p.team===1;});
    function col(team){ return team.map(function(p){ return '<div class="mm-player"><div class="mm-ava" style="background:'+p.ava+'"></div><div class="mm-pname">'+p.name+'</div></div>'; }).join(''); }
    ps.innerHTML = col(team1) + (team2.length?'<div class="mm-vs">vs</div>'+col(team2):'');
    var st = document.getElementById('mmSt');
    if(st) st.textContent = 'Match found!';
  }

  function cancel() {
    cancelSearch();
    var el = document.getElementById('ovMM');
    if (el) el.classList.remove('show');
  }

  function cancelSearch() {
    clearTimeout(_fallbackTimer); _fallbackTimer = null;
    clearInterval(_mmInterval);   _mmInterval = null;
    if (_matchUnsub){ _matchUnsub(); _matchUnsub=null; }
    if (_queueDocId){
      db.collection('matchQueue').doc(_queueDocId).delete().catch(function(){});
      _queueDocId = null;
    }
  }

  return { start:start, cancel:cancel };
})();
