/* ═══════════════════════════════════════
   AUTH MODULE
   Handles login, register, guest, username
═══════════════════════════════════════ */
(function(){

  window._registering = false;

  /* ── tab switching ── */
  document.querySelectorAll('.auth-tab').forEach(function(tab){
    tab.addEventListener('click', function(){
      document.querySelectorAll('.auth-tab').forEach(function(t){t.classList.remove('on');});
      document.querySelectorAll('.auth-panel').forEach(function(p){p.classList.remove('on');});
      tab.classList.add('on');
      document.getElementById(tab.dataset.panel).classList.add('on');
      clearErr();
    });
  });

  function clearErr(){ document.querySelectorAll('.auth-err').forEach(function(e){e.classList.remove('show');}); }
  function showErr(id, msg){ var el=document.getElementById(id); if(!el)return; el.textContent=msg; el.classList.add('show'); }
  function setBtn(btn, loading, label){
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait…' : (label || btn.dataset.label || btn.textContent);
  }

  /* ── LOGIN ── */
  var loginBtn = document.getElementById('btnLogin');
  if(loginBtn){
    loginBtn.dataset.label = 'Sign In';
    loginBtn.addEventListener('click', function(){
      var email = document.getElementById('loginEmail').value.trim();
      var pass  = document.getElementById('loginPass').value;
      if(!email||!pass){ showErr('loginErr','Please fill in all fields.'); return; }
      setBtn(loginBtn, true); clearErr();
      auth.signInWithEmailAndPassword(email, pass)
        .then(function(){ setBtn(loginBtn, false); })
        .catch(function(e){ setBtn(loginBtn, false); showErr('loginErr', friendly(e)); });
    });
  }

  /* ── REGISTER ── */
  var regBtn = document.getElementById('btnRegister');
  if(regBtn){
    regBtn.dataset.label = 'Create Account';
    regBtn.addEventListener('click', function(){
      var email    = document.getElementById('regEmail').value.trim();
      var pass     = document.getElementById('regPass').value;
      var username = document.getElementById('regUsername').value.trim().toUpperCase();
      if(!email||!pass||!username){ showErr('regErr','Please fill in all fields.'); return; }
      if(username.length<3||username.length>18){ showErr('regErr','Username must be 3–18 characters.'); return; }
      if(!/^[A-Z0-9_]+$/.test(username)){ showErr('regErr','Only letters, numbers and underscores.'); return; }
      setBtn(regBtn, true); clearErr();

      db.collection('usernames').doc(username).get()
        .then(function(snap){
          if(snap.exists){ showErr('regErr','Username taken — pick another.'); setBtn(regBtn,false); return Promise.reject('taken'); }
          window._registering = true;
          return auth.createUserWithEmailAndPassword(email, pass);
        })
        .then(function(cred){
          var uid = cred.user.uid;
          var ava = pickAva();
          var batch = db.batch();
          batch.set(db.collection('users').doc(uid),{
            username:username, ava:ava, trophies:100, xp:0, level:1,
            friends:[], inGame:false, isGuest:false,
            lastSeen:firebase.firestore.FieldValue.serverTimestamp(),
            createdAt:firebase.firestore.FieldValue.serverTimestamp()
          });
          batch.set(db.collection('usernames').doc(username),{uid:uid});
          return batch.commit().then(function(){ return uid; });
        })
        .then(function(uid){
          window._registering = false;
          setBtn(regBtn, false);
          window.APP.enterLobby(uid);
        })
        .catch(function(e){
          window._registering = false;
          setBtn(regBtn, false);
          if(e==='taken') return;
          showErr('regErr', friendly(e));
        });
    });
  }

  /* ── PLAY AS GUEST ── */
  var guestBtn = document.getElementById('btnGuest');
  if(guestBtn){
    guestBtn.addEventListener('click', function(){
      setBtn(guestBtn, true, 'Joining…');
      clearErr();

      var adj  = ['SWIFT','BOLD','DARK','IRON','COOL','WILD','FAST','KEEN','SLIM','NEON'];
      var noun = ['FOX','HAWK','WOLF','BEAR','LYNX','DART','FLUX','EDGE','NOVA','PEAK'];
      var name = 'GUEST_'+adj[Math.floor(Math.random()*adj.length)]+'_'+noun[Math.floor(Math.random()*noun.length)]+(Math.floor(Math.random()*900)+100);
      var ava  = pickAva();

      window._registering = true;

      auth.signInAnonymously()
        .then(function(cred){
          var uid = cred.user.uid;
          return db.collection('users').doc(uid).set({
            username:name, ava:ava, trophies:100, xp:0, level:1,
            friends:[], inGame:false, isGuest:true,
            lastSeen:firebase.firestore.FieldValue.serverTimestamp(),
            createdAt:firebase.firestore.FieldValue.serverTimestamp()
          }).then(function(){ return uid; });
        })
        .then(function(uid){
          window._registering = false;
          setBtn(guestBtn, false, 'Play Without Account');
          window.APP.enterLobby(uid);
        })
        .catch(function(e){
          window._registering = false;
          setBtn(guestBtn, false, 'Play Without Account');
          showErr('loginErr', friendly(e));
        });
    });
  }

  function pickAva(){
    var avas=['linear-gradient(135deg,#b8aaff,#7c6fff)','linear-gradient(135deg,#a0c8f8,#4080c8)','linear-gradient(135deg,#a0e0b8,#2da860)','linear-gradient(135deg,#f0c0d8,#c04080)','linear-gradient(135deg,#ffd0a0,#f08030)','linear-gradient(135deg,#a0e0f0,#3090c0)'];
    return avas[Math.floor(Math.random()*avas.length)];
  }

  function friendly(e){
    var c=e.code||'';
    if(c==='auth/email-already-in-use') return 'That email is already registered.';
    if(c==='auth/weak-password')         return 'Password needs at least 6 characters.';
    if(c==='auth/invalid-email')         return 'Please enter a valid email address.';
    if(c==='auth/user-not-found')        return 'No account with that email.';
    if(c==='auth/wrong-password')        return 'Incorrect password.';
    if(c==='auth/too-many-requests')     return 'Too many attempts — wait a moment.';
    if(c==='auth/operation-not-allowed') return 'Guest login is not enabled — enable Anonymous Auth in Firebase Console.';
    return e.message||'Something went wrong.';
  }

})();
