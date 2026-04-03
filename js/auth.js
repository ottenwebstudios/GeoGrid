/* ═══════════════════════════════════════
   AUTH MODULE
   Handles login, register, username pick
═══════════════════════════════════════ */
(function(){

  // Flag so onAuthStateChanged knows a registration batch is still in flight
  window._registering = false;

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
  function setLoading(btn, loading){
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait…' : btn.dataset.label;
  }

  // ── LOGIN ──
  var loginBtn = document.getElementById('btnLogin');
  loginBtn.dataset.label = 'Sign In';
  loginBtn.addEventListener('click', function(){
    var email = document.getElementById('loginEmail').value.trim();
    var pass  = document.getElementById('loginPass').value;
    if(!email || !pass){ showErr('loginErr','Please fill in all fields.'); return; }
    setLoading(loginBtn, true); clearErr();
    auth.signInWithEmailAndPassword(email, pass)
      .then(function(){
        // onAuthStateChanged will fire and navigate — just reset button in case of delay
        setLoading(loginBtn, false);
      })
      .catch(function(e){
        setLoading(loginBtn, false);
        showErr('loginErr', friendlyError(e));
      });
  });

  // ── REGISTER ──
  var regBtn = document.getElementById('btnRegister');
  regBtn.dataset.label = 'Create Account';
  regBtn.addEventListener('click', function(){
    var email    = document.getElementById('regEmail').value.trim();
    var pass     = document.getElementById('regPass').value;
    var username = document.getElementById('regUsername').value.trim().toUpperCase();
    if(!email || !pass || !username){ showErr('regErr','Please fill in all fields.'); return; }
    if(username.length < 3 || username.length > 18){ showErr('regErr','Username must be 3–18 characters.'); return; }
    if(!/^[A-Z0-9_]+$/.test(username)){ showErr('regErr','Username: only letters, numbers and underscores.'); return; }
    setLoading(regBtn, true); clearErr();

    // Step 1 — check username availability
    db.collection('usernames').doc(username).get()
      .then(function(snap){
        if(snap.exists){
          showErr('regErr','Username already taken — choose another.');
          setLoading(regBtn, false);
          return Promise.reject('taken'); // abort chain cleanly
        }
        // Step 2 — create Firebase Auth account
        // Set flag BEFORE createUser so onAuthStateChanged waits for our batch
        window._registering = true;
        return auth.createUserWithEmailAndPassword(email, pass);
      })
      .then(function(cred){
        var uid = cred.user.uid;
        var ava = pickAva();
        // Step 3 — write user doc + reserve username atomically
        var batch = db.batch();
        batch.set(db.collection('users').doc(uid), {
          username: username,
          ava: ava,
          trophies: 100,
          xp: 0,
          level: 1,
          friends: [],
          inGame: false,
          lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        batch.set(db.collection('usernames').doc(username), { uid: uid });
        return batch.commit();
      })
      .then(function(){
        // Batch done — now let onAuthStateChanged proceed
        window._registering = false;
        // Manually trigger the lobby navigation since onAuthStateChanged
        // may have already fired and bailed while _registering was true
        var user = auth.currentUser;
        if(user){
          window.APP.enterLobby(user.uid);
        }
        setLoading(regBtn, false);
      })
      .catch(function(e){
        window._registering = false;
        setLoading(regBtn, false);
        if(e === 'taken') return; // already shown error above
        showErr('regErr', friendlyError(e));
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

  function friendlyError(e){
    var code = e.code || '';
    if(code === 'auth/email-already-in-use') return 'That email is already registered.';
    if(code === 'auth/weak-password')         return 'Password must be at least 6 characters.';
    if(code === 'auth/invalid-email')         return 'Please enter a valid email address.';
    if(code === 'auth/user-not-found')        return 'No account found with that email.';
    if(code === 'auth/wrong-password')        return 'Incorrect password.';
    if(code === 'auth/too-many-requests')     return 'Too many attempts — please wait a moment.';
    return e.message || 'Something went wrong. Please try again.';
  }

})();
