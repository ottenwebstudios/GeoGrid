/* ═══════════════════════════════════════
   AUTH MODULE
   Handles login, register, username pick
═══════════════════════════════════════ */
(function(){

  // ── tab switching ──
  document.querySelectorAll('.auth-tab').forEach(function(tab) {
    tab.addEventListener('click', function(){
      document.querySelectorAll('.auth-tab').forEach(function(t){t.classList.remove('on');});
      document.querySelectorAll('.auth-panel').forEach(function(p){p.classList.remove('on');});
      tab.classList.add('on');
      document.getElementById(tab.dataset.panel).classList.add('on');
      clearErr();
    });
  });

  function clearErr(){ document.querySelectorAll('.auth-err').forEach(function(e){e.classList.remove('show');}); }
  function showErr(id, msg){ var el=document.getElementById(id); el.textContent=msg; el.classList.add('show'); }
  function setLoading(btn, loading){ btn.disabled=loading; btn.textContent=loading?'Please wait…':btn.dataset.label; }

  // ── LOGIN ──
  var loginBtn = document.getElementById('btnLogin');
  loginBtn.dataset.label = 'Sign In';
  loginBtn.addEventListener('click', function(){
    var email = document.getElementById('loginEmail').value.trim();
    var pass  = document.getElementById('loginPass').value;
    if(!email||!pass){ showErr('loginErr','Please fill in all fields.'); return; }
    setLoading(loginBtn, true); clearErr();
    auth.signInWithEmailAndPassword(email, pass).catch(function(e){
      setLoading(loginBtn, false);
      showErr('loginErr', e.message);
    });
  });

  // ── REGISTER ──
  var regBtn = document.getElementById('btnRegister');
  regBtn.dataset.label = 'Create Account';
  regBtn.addEventListener('click', function(){
    var email    = document.getElementById('regEmail').value.trim();
    var pass     = document.getElementById('regPass').value;
    var username = document.getElementById('regUsername').value.trim().toUpperCase();
    if(!email||!pass||!username){ showErr('regErr','Please fill in all fields.'); return; }
    if(username.length < 3 || username.length > 18){ showErr('regErr','Username must be 3–18 characters.'); return; }
    if(!/^[A-Z0-9_]+$/.test(username)){ showErr('regErr','Username: letters, numbers, underscores only.'); return; }
    setLoading(regBtn, true); clearErr();

    // Check username taken
    db.collection('usernames').doc(username).get().then(function(snap){
      if(snap.exists){ showErr('regErr','Username already taken.'); setLoading(regBtn,false); return; }
      return auth.createUserWithEmailAndPassword(email, pass);
    }).then(function(cred){
      if(!cred) return; // username taken branch
      var uid = cred.user.uid;
      var ava = pickAva();
      // Batch: create user doc + reserve username
      var batch = db.batch();
      batch.set(db.collection('users').doc(uid), {
        username: username,
        ava: ava,
        trophies: 100,
        xp: 0,
        level: 1,
        friends: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      batch.set(db.collection('usernames').doc(username), { uid: uid });
      return batch.commit();
    }).then(function(){
      // auth state observer will handle nav to lobby
    }).catch(function(e){
      setLoading(regBtn, false);
      showErr('regErr', e.message);
    });
  });

  function pickAva(){
    var avas = [
      'linear-gradient(135deg,#b8aaff,#7c6fff)',
      'linear-gradient(135deg,#a0c8f8,#4080c8)',
      'linear-gradient(135deg,#a0e0b8,#2da860)',
      'linear-gradient(135deg,#f0c0d8,#c04080)',
      'linear-gradient(135deg,#ffd0a0,#f08030)',
      'linear-gradient(135deg,#a0e0f0,#3090c0)',
    ];
    return avas[Math.floor(Math.random()*avas.length)];
  }

})();
