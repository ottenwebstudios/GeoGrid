/* ═══════════════════════════════════════
   FRIENDS MODULE
═══════════════════════════════════════ */
window.FriendsModule = (function(){
  var _unsubs = [];
  var _uid, _userData;

  function init(uid, userData) {
    _uid = uid; _userData = userData;
    _unsubs.forEach(function(u){u();}); _unsubs = [];
    listenFriends();
    listenRequests();
  }

  // ── Listen to friends list in realtime ──
  function listenFriends() {
    if (!_uid) return;
    var u = db.collection('users').doc(_uid)
      .onSnapshot(function(snap) {
        _userData = snap.data();
        renderFriends(_userData.friends || []);
      });
    _unsubs.push(u);
  }

  // ── Listen for incoming friend requests ──
  function listenRequests() {
    var u = db.collection('friendRequests')
      .where('to', '==', _uid)
      .where('status', '==', 'pending')
      .onSnapshot(function(snap) {
        renderRequests(snap.docs);
      });
    _unsubs.push(u);
  }

  function renderFriends(friendUids) {
    var list = document.getElementById('friendList');
    if (!list) return;
    if (!friendUids || friendUids.length === 0) {
      list.innerHTML = '<div style="padding:12px 14px;font-size:11px;color:var(--sub);">No friends yet — add one above!</div>';
      return;
    }
    // fetch each friend's data
    var promises = friendUids.map(function(fuid) {
      return db.collection('users').doc(fuid).get();
    });
    Promise.all(promises).then(function(snaps) {
      list.innerHTML = '';
      snaps.forEach(function(snap) {
        if (!snap.exists) return;
        var d = snap.data();
        var isOnline = isRecentlyOnline(d.lastSeen);
        var inGame   = d.inGame;
        var statusCls = inGame ? 'ig' : isOnline ? 'on' : '';
        var statusTxt = inGame ? 'In Match' : isOnline ? 'Online' : 'Offline';
        var row = document.createElement('div');
        row.className = 'fri';
        row.innerHTML =
          '<div class="fav"><div class="fai" style="background:'+d.ava+'"></div><div class="fst '+statusCls+'"></div></div>' +
          '<div class="fif"><div class="fnm">'+d.username+'</div><div class="fac'+(inGame?' ig':'')+'" >'+statusTxt+'</div></div>' +
          '<div class="fri-actions">' +
            (isOnline && !inGame ? '<button class="binv" onclick="FriendsModule.inviteFriend(\''+snap.id+'\')">Invite</button>' : '') +
          '</div>';
        list.appendChild(row);
      });
    });
  }

  function renderRequests(docs) {
    var area = document.getElementById('friendRequests');
    if (!area) return;
    area.innerHTML = '';
    docs.forEach(function(doc) {
      var d = doc.data();
      db.collection('users').doc(d.from).get().then(function(snap){
        if (!snap.exists) return;
        var row = document.createElement('div');
        row.className = 'friend-req-row';
        row.innerHTML =
          '<div class="freq-txt"><strong>'+snap.data().username+'</strong> wants to be friends</div>' +
          '<button class="freq-accept" onclick="FriendsModule.acceptRequest(\''+doc.id+'\',\''+d.from+'\')">✓</button>' +
          '<button class="freq-decline" onclick="FriendsModule.declineRequest(\''+doc.id+'\')">✕</button>';
        area.appendChild(row);
      });
    });
  }

  function isRecentlyOnline(ts) {
    if (!ts) return false;
    var now = Date.now();
    var last = ts.toMillis ? ts.toMillis() : 0;
    return (now - last) < 3 * 60 * 1000; // 3 minutes
  }

  // ── Add friend by username ──
  function addFriend() {
    var input = document.getElementById('addFriendInput');
    var username = input.value.trim().toUpperCase();
    if (!username) return;
    input.value = '';
    // look up username doc
    db.collection('usernames').doc(username).get().then(function(snap){
      if (!snap.exists) { showToast('User not found.'); return; }
      var targetUid = snap.data().uid;
      if (targetUid === _uid) { showToast('That\'s you!'); return; }
      if ((_userData.friends||[]).includes(targetUid)) { showToast('Already friends.'); return; }
      // send friend request
      return db.collection('friendRequests').add({
        from: _uid,
        to: targetUid,
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }).then(function(){
      if (arguments[0]) showToast('Friend request sent to '+username+'!');
    }).catch(function(e){ showToast('Error: '+e.message); });
  }

  function acceptRequest(reqId, fromUid) {
    var batch = db.batch();
    // add each to the other's friends array
    batch.update(db.collection('users').doc(_uid), {
      friends: firebase.firestore.FieldValue.arrayUnion(fromUid)
    });
    batch.update(db.collection('users').doc(fromUid), {
      friends: firebase.firestore.FieldValue.arrayUnion(_uid)
    });
    batch.update(db.collection('friendRequests').doc(reqId), { status: 'accepted' });
    batch.commit().then(function(){ showToast('Friend added!'); });
  }

  function declineRequest(reqId) {
    db.collection('friendRequests').doc(reqId).update({ status: 'declined' });
  }

  function inviteFriend(friendUid) {
    // Write invite to their notifications subcollection
    db.collection('users').doc(friendUid).collection('notifications').add({
      type: 'invite',
      from: _uid,
      fromName: _userData.username,
      modeId: window.APP && window.APP.selectedMode ? window.APP.selectedMode.id : 'c1',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(){ showToast('Invite sent!'); });
  }

  // ── Update own presence ──
  function heartbeat() {
    if (!_uid) return;
    db.collection('users').doc(_uid).update({
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function(){});
  }

  function destroy() {
    _unsubs.forEach(function(u){u();}); _unsubs=[];
  }

  return { init:init, addFriend:addFriend, acceptRequest:acceptRequest, declineRequest:declineRequest, inviteFriend:inviteFriend, heartbeat:heartbeat, destroy:destroy };
})();
