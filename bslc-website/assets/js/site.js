/* Bihar State Law Commission — page interactivity: login flow, Document
   Archive, Notification / Circular list and Public Consultation.

   Two modes, chosen by window.BSLC_API_BASE (assets/js/config.js):
   - empty (default, what GitHub Pages serves today): the original
     front-end demo. "Authentication" is a sessionStorage flag and the
     archive is a small hard-coded dataset. NOT SECURE.
   - set: every sign-in, listing and file access goes to the departmental
     API, which enforces roles, access levels and audit logging. The
     checks in this file only decide what to show; they protect nothing. */
(function(){
  "use strict";

  var B = window.BSLC;                                   // assets/js/api.js
  var API = !!(B && B.apiEnabled());
  var esc = B ? B.escapeHtml : function(s){ return String(s); };
  function lang(){ return document.documentElement.lang === "hi" ? "hi" : "en"; }
  function ddmmyyyy(iso){ if(!iso) return ""; var p = String(iso).slice(0,10).split("-"); return p[2]+"."+p[1]+"."+p[0]; }

  /* ---------------- captcha + OTP login (login.html) ---------------- */
  var loginForm = document.getElementById("loginForm");
  if(loginForm){
    var captchaText, attempts = parseInt(sessionStorage.getItem("bslc_attempts")||"0",10);
    var captchaEl = document.getElementById("captchaCode");
    var captchaInput = document.getElementById("c");
    var otpBlock = document.getElementById("otpBlock");
    var otpInput = document.getElementById("otp");
    var msg = document.getElementById("loginMsg");
    var sendBtn = document.getElementById("sendOtpBtn");
    var signInBtn = document.getElementById("signInBtn");
    var otpSentTo = document.getElementById("otpSentTo");
    var quickDemoBtn = document.getElementById("quickDemoBtn");
    var DEMO_OTP = "123456";
    var challengeId = null;

    if(API){
      /* Real sign-in: no demo auto-fill, and the note explains the flow. */
      if(quickDemoBtn) quickDemoBtn.parentNode.hidden = true;
      var note = document.querySelector('[data-i18n="demo_note"]');
      if(note) note.setAttribute("data-i18n", "live_note");
      if(note && window.BSLC_I18N_EXTRA && window.BSLC_I18N_EXTRA.live_note) note.innerHTML = window.BSLC_I18N_EXTRA.live_note[lang()];
    }

    function newCaptcha(){
      var chars = "ACEFHJKMNPQRTWXY3479";
      captchaText = "";
      for(var i=0;i<5;i++) captchaText += chars[Math.floor(Math.random()*chars.length)];
      if(captchaEl) captchaEl.textContent = captchaText.split("").join(" ");
    }
    function showMsg(text, ok){
      if(!msg) return;
      msg.textContent = text;
      msg.className = "formmsg on " + (ok ? "ok" : "err");
    }
    function lockCheck(){
      if(API) return false;            // the server enforces the lockout in API mode
      if(attempts >= 5){
        showMsg("This account is locked after 5 failed attempts. Click 'Refresh' to reset the lockout in this demo, or contact the Records Officer.", false);
        if(sendBtn) sendBtn.disabled = true;
        if(signInBtn) signInBtn.disabled = true;
        return true;
      }
      if(sendBtn) sendBtn.disabled = false;
      if(signInBtn) signInBtn.disabled = false;
      return false;
    }
    function goToTarget(){
      var params = new URLSearchParams(location.search);
      /* Only same-site pages are accepted (see assets/js/api.js); anything
         else, or a missing value, falls back to document-archive.html. */
      var target = window.BSLC ? window.BSLC.safeRedirect(params.get("redirect")) : "document-archive.html";
      location.href = target;
    }

    newCaptcha();
    lockCheck();
    var refreshBtn = document.getElementById("captchaRefresh");
    if(refreshBtn) refreshBtn.addEventListener("click", function(e){
      e.preventDefault();
      attempts = 0;
      sessionStorage.removeItem("bslc_attempts");
      newCaptcha();
      lockCheck();
      if(captchaInput) captchaInput.value = "";
      showMsg(API ? "Captcha refreshed." : "Captcha refreshed and attempt lock reset.", true);
    });

    function apiSendOtp(u, p){
      sendBtn.disabled = true;
      B.api("POST", "/auth/login", { userId: u, password: p }).then(function(r){
        if(!r.ok){
          sendBtn.disabled = false;
          newCaptcha(); captchaInput.value = "";
          showMsg((r.data && r.data.error) || "Sign-in failed.", false);
          return;
        }
        challengeId = r.data.challengeId;
        otpBlock.hidden = false;
        if(otpSentTo) otpSentTo.textContent = "an OTP has been sent to " + r.data.sentTo + ". It is valid for " + Math.round(r.data.expiresInSeconds/60) + " minutes.";
        showMsg("OTP sent.", true);
        otpInput.focus();
      }).catch(function(){
        sendBtn.disabled = false;
        showMsg("The sign-in service could not be reached. Please try again later.", false);
      });
    }

    function apiSignIn(){
      signInBtn.disabled = true;
      B.api("POST", "/auth/otp/verify", { challengeId: challengeId, otp: (otpInput.value||"").trim() }).then(function(r){
        signInBtn.disabled = false;
        if(!r.ok){
          showMsg((r.data && r.data.error) || "Incorrect OTP.", false);
          if(r.data && (r.data.code === "OTP_EXPIRED" || r.data.code === "LOCKED")){
            otpBlock.hidden = true; sendBtn.disabled = false; challengeId = null; newCaptcha(); captchaInput.value = "";
          }
          return;
        }
        B.setSession(r.data.token, r.data.user);
        sessionStorage.removeItem("bslc_attempts");
        goToTarget();
      }).catch(function(){
        signInBtn.disabled = false;
        showMsg("The sign-in service could not be reached. Please try again later.", false);
      });
    }

    function triggerSendOtp(){
      if(lockCheck()) return;
      var u = document.getElementById("u").value.trim();
      var p = document.getElementById("p").value.trim();
      var c = (captchaInput.value||"").trim().toUpperCase();
      if(!u || !p){ showMsg("Enter your User ID and Password.", false); return; }
      if(c !== captchaText){
        attempts++; sessionStorage.setItem("bslc_attempts", attempts);
        showMsg(API ? "Captcha does not match." : "Captcha does not match. Attempt " + attempts + " of 5.", false);
        newCaptcha(); captchaInput.value = "";
        lockCheck();
        return;
      }
      if(API){ apiSendOtp(u, document.getElementById("p").value); return; }
      otpBlock.hidden = false;
      if(otpSentTo) otpSentTo.textContent = "an OTP has been sent to the mobile number registered against " + u + " (demo OTP: " + DEMO_OTP + ")";
      showMsg("OTP sent. This is a front-end demo, so the OTP is shown above instead of by SMS.", true);
      sendBtn.disabled = true;
      otpInput.focus();
    }

    function triggerSignIn(){
      if(lockCheck()) return;
      var u = document.getElementById("u").value.trim();
      if(otpBlock.hidden){ showMsg("Request an OTP first.", false); return; }
      if(API){ apiSignIn(); return; }
      if((otpInput.value||"").trim() !== DEMO_OTP){
        attempts++; sessionStorage.setItem("bslc_attempts", attempts);
        showMsg("Incorrect OTP. Attempt " + attempts + " of 5.", false);
        lockCheck();
        return;
      }
      sessionStorage.setItem("bslc_auth", "1");
      sessionStorage.setItem("bslc_user", u || "guest");
      sessionStorage.removeItem("bslc_attempts");
      goToTarget();
    }

    if(sendBtn) sendBtn.addEventListener("click", triggerSendOtp);
    if(signInBtn) signInBtn.addEventListener("click", triggerSignIn);

    loginForm.addEventListener("submit", function(e){
      e.preventDefault();
      if(otpBlock && !otpBlock.hidden){
        triggerSignIn();
      } else {
        triggerSendOtp();
      }
    });

    var inputs = [document.getElementById("u"), document.getElementById("p"), captchaInput, otpInput];
    inputs.forEach(function(inputEl){
      if(inputEl){
        inputEl.addEventListener("keydown", function(e){
          if(e.key === "Enter"){
            e.preventDefault();
            if(otpBlock && !otpBlock.hidden){
              triggerSignIn();
            } else {
              triggerSendOtp();
            }
          }
        });
      }
    });

    if(quickDemoBtn && !API){
      quickDemoBtn.addEventListener("click", function(e){
        e.preventDefault();
        attempts = 0;
        sessionStorage.removeItem("bslc_attempts");
        lockCheck();
        document.getElementById("u").value = "officer@bihar.gov.in";
        document.getElementById("p").value = "DemoPass123";
        captchaInput.value = captchaText;
        triggerSendOtp();
        if(otpInput) otpInput.value = DEMO_OTP;
        if(signInBtn) signInBtn.focus();
      });
    }

    var janParichay = document.getElementById("janParichayBtn");
    if(janParichay) janParichay.addEventListener("click", function(e){
      e.preventDefault();
      showMsg("Jan Parichay / Bihar SSO sign-on is provided by the state identity platform and is out of scope for this front-end demo.", false);
    });
  }

  /* ---------------- Document Archive (document-archive.html) ---------------- */
  var ARCHIVE_LOGIN = "login.html?redirect=document-archive.html";
  var archiveRoot = document.getElementById("archiveRoot");
  if(archiveRoot){
    if(sessionStorage.getItem("bslc_auth") !== "1" || (API && !B.getToken())){
      location.href = ARCHIVE_LOGIN;
    } else if(API){
      B.api("GET", "/auth/me").then(function(me){
        if(me.status === 401){ location.href = ARCHIVE_LOGIN; return null; }
        setArchiveUser(me.data.userId);
        if(me.data.role === "ADMIN" || me.data.role === "EDITOR") addAdminLink();
        return B.api("GET", "/documents");
      }).then(function(r){
        if(!r) return;
        if(r.status === 401){ location.href = ARCHIVE_LOGIN; return; }
        startArchive(r.data.map(function(d){
          return { id: d.id, title: d.title, type: d.docType, date: ddmmyyyy(d.issuedOn), year: d.year,
                   access: d.accessLevel.toLowerCase(), pages: d.pages || "", canOpen: d.canOpen, canDownload: d.canDownload };
        }));
      }).catch(function(){
        document.getElementById("archiveBody").innerHTML = '<tr class="empty-row"><td colspan="6">The archive service could not be reached. Please try again later.</td></tr>';
      });
    } else {
      setArchiveUser(sessionStorage.getItem("bslc_user") || "guest");
      startArchive([
        {title:"Report No. 41 — Review of the Bihar Public Demands Recovery Act", type:"Report", date:"12.08.2026", year:2026, access:"pub", pages:142},
        {title:"Notification No. 4127 — Reconstitution of the Commission", type:"Notification", date:"15.06.2026", year:2026, access:"pub", pages:3},
        {title:"Office Order — Sittings calendar for FY 2026-27", type:"Notification", date:"02.05.2026", year:2026, access:"pub", pages:2},
        {title:"Report No. 40 — Reform of tenancy dispute procedure", type:"Report", date:"22.04.2026", year:2026, access:"pub", pages:118},
        {title:"Working Paper — Digitisation of subordinate court records", type:"Working Paper", date:"06.02.2026", year:2026, access:"res", pages:34},
        {title:"Report No. 36 — Review of the Bihar Excise Act", type:"Report", date:"18.11.2024", year:2024, access:"pub", pages:142},
        {title:"Minutes — 84th sitting of the Commission", type:"Minutes", date:"02.10.2024", year:2024, access:"res", pages:11},
        {title:"Draft recommendations — tenancy procedure", type:"Working Paper", date:"27.08.2024", year:2024, access:"conf", pages:38},
        {title:"Notification — reconstitution of the Commission", type:"Notification", date:"15.06.2024", year:2024, access:"pub", pages:3},
        {title:"Correspondence file — LD/2024/117", type:"Correspondence", date:"09.03.2024", year:2024, access:"res", pages:64},
        {title:"Report No. 33 — Simplification of stamp duty procedure", type:"Report", date:"14.09.2022", year:2022, access:"pub", pages:96},
        {title:"Minutes — 71st sitting of the Commission", type:"Minutes", date:"20.05.2022", year:2022, access:"res", pages:9},
        {title:"Correspondence file — LD/2022/054", type:"Correspondence", date:"11.02.2022", year:2022, access:"res", pages:22},
        {title:"Report No. 28 — Review of the Bihar Tenancy Act, 1885", type:"Report", date:"30.07.2020", year:2020, access:"pub", pages:210},
        {title:"Minutes — 58th sitting of the Commission", type:"Minutes", date:"12.03.2020", year:2020, access:"res", pages:14}
      ]);
    }
  }

  function setArchiveUser(name){
    var userTag = document.getElementById("archiveUser");
    if(userTag) userTag.textContent = name;
  }

  function addAdminLink(){
    var nav = document.querySelector("#archiveRoot .leftnav [data-signout]");
    if(!nav || document.getElementById("adminLink")) return;
    var a = document.createElement("a");
    a.href = "admin.html"; a.id = "adminLink"; a.textContent = "Site Administration";
    nav.parentNode.insertBefore(a, nav);
  }

  /* Opens a file through the API with the bearer token (a plain link
     cannot carry it). The server decides whether this user may see it. */
  function openFile(id, download){
    var w = download ? null : window.open("", "_blank");
    fetch(B.apiBase() + "/documents/" + encodeURIComponent(id) + "/file" + (download ? "?download=1" : ""), {
      headers: { Authorization: "Bearer " + B.getToken() }, credentials: "omit"
    }).then(function(res){
      if(res.status === 401){ if(w) w.close(); location.href = ARCHIVE_LOGIN; return null; }
      if(!res.ok){ return res.json().then(function(j){ throw new Error(j.error || "Not permitted"); }); }
      var cd = res.headers.get("Content-Disposition") || "";
      var m = /filename="([^"]+)"/.exec(cd);
      return res.blob().then(function(b){ return { blob: b, name: m ? m[1] : "document" }; });
    }).then(function(f){
      if(!f) return;
      var url = URL.createObjectURL(f.blob);
      if(download){
        var a = document.createElement("a"); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
      } else if(w){ w.location.href = url; }
      setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
    }).catch(function(err){
      if(w) w.close();
      alert(err.message || "The document could not be opened.");
    });
  }

  function startArchive(DOCS){
    var yearsBar = document.getElementById("yearsBar");
    var chipsBar = document.getElementById("chipsBar");
    var searchBox = document.getElementById("archiveSearch");
    var tbody = document.getElementById("archiveBody");
    var countTag = document.getElementById("archiveCount");
    var state = { year: "all", type: "All Types", q: "" };

    var years = Array.from(new Set(DOCS.map(function(d){return d.year;}))).sort(function(a,b){return b-a;});
    yearsBar.innerHTML = '<button class="yr on" data-yr="all">All Years</button>' +
      years.map(function(y){ return '<button class="yr" data-yr="'+esc(y)+'">'+esc(y)+'</button>'; }).join("");

    var types = ["All Types","Report","Minutes","Notification","Correspondence","Working Paper"];
    DOCS.forEach(function(d){ if(types.indexOf(d.type) === -1) types.push(d.type); });
    chipsBar.innerHTML = types.map(function(t,i){
      return '<button type="button" class="chip'+(i===0?' on':'')+'" data-type="'+esc(t)+'">'+esc(t)+'</button>';
    }).join("");

    var ACCESS_LABEL = {pub:"Public", res:"Restricted", conf:"Confidential"};

    function actions(d){
      if(!API){
        return d.access === "conf" ? '<a href="#" data-view="'+encodeURIComponent(d.title)+'">View only</a>' : '<a href="#" data-view="'+encodeURIComponent(d.title)+'">View</a>';
      }
      if(!d.canOpen) return '<span style="color:var(--ink-soft)">Awaiting scan</span>';
      var v = '<a href="#" data-open="'+esc(d.id)+'">'+(d.canDownload ? "View" : "View only")+'</a>';
      return d.canDownload ? v + ' &middot; <a href="#" data-download="'+esc(d.id)+'">Download</a>' : v;
    }

    function render(){
      var q = state.q.trim().toLowerCase();
      var rows = DOCS.filter(function(d){
        if(state.year !== "all" && d.year !== state.year) return false;
        if(state.type !== "All Types" && d.type !== state.type) return false;
        if(q && d.title.toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
      if(!rows.length){
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No documents match this year, type and search combination.</td></tr>';
      } else {
        tbody.innerHTML = rows.map(function(d){
          return '<tr><td>'+esc(d.title)+'</td><td>'+esc(d.type)+'</td><td>'+esc(d.date)+'</td>'+
            '<td><span class="tag '+esc(d.access)+'">'+ACCESS_LABEL[d.access]+'</span></td>'+
            '<td>'+esc(d.pages)+'</td><td>'+actions(d)+'</td></tr>';
        }).join("");
      }
      countTag.textContent = "Showing " + rows.length + " of " + DOCS.length + " documents" + (state.year!=="all" ? " for " + state.year : "") + " · Metadata as per MDDS";
    }

    yearsBar.addEventListener("click", function(e){
      var b = e.target.closest(".yr"); if(!b) return;
      yearsBar.querySelectorAll(".yr").forEach(function(x){x.classList.remove("on");});
      b.classList.add("on");
      state.year = b.dataset.yr === "all" ? "all" : parseInt(b.dataset.yr,10);
      render();
    });
    chipsBar.addEventListener("click", function(e){
      var b = e.target.closest(".chip"); if(!b) return;
      chipsBar.querySelectorAll(".chip").forEach(function(x){x.classList.remove("on");});
      b.classList.add("on");
      state.type = b.dataset.type;
      render();
    });
    searchBox.addEventListener("input", function(){ state.q = searchBox.value; render(); });
    tbody.addEventListener("click", function(e){
      var v = e.target.closest("[data-view]");
      if(v){ e.preventDefault(); alert("Demo only — \"" + decodeURIComponent(v.dataset.view) + "\" would open the signed, watermarked PDF from the records store."); return; }
      var o = e.target.closest("[data-open]");
      if(o){ e.preventDefault(); openFile(o.dataset.open, false); return; }
      var dl = e.target.closest("[data-download]");
      if(dl){ e.preventDefault(); openFile(dl.dataset.download, true); }
    });

    render();
  }

  /* ---------------- Notification / Circular (dynamic list) ---------------- */
  var contentList = document.getElementById("contentList");
  if(contentList && API){
    B.api("GET", "/content").then(function(r){
      if(!r.ok || !r.data.length) return;                 // keep the static list
      var KIND = { CIRCULAR:"Circular", NOTIFICATION:"Notification", NOTICE:"Notice", RECORD:"Record" };
      var items = r.data.filter(function(i){ return i.kind !== "LINK"; });
      var links = r.data.filter(function(i){ return i.kind === "LINK" && /^https?:\/\//i.test(i.url || ""); });
      function title(i){ return (lang() === "hi" && i.titleHi) ? i.titleHi : i.titleEn; }
      function href(i){
        if(i.documentId) return B.apiBase() + "/documents/" + encodeURIComponent(i.documentId) + "/file";
        return /^https?:\/\//i.test(i.url || "") ? i.url : null;
      }
      if(items.length){
        contentList.innerHTML = '<ul class="list">' + items.map(function(i){
          var h = href(i);
          var t = esc(title(i)) + (i.issuedOn ? " (" + esc(ddmmyyyy(i.issuedOn)) + ")" : "");
          return '<li><span class="tag pub">' + esc(KIND[i.kind] || i.kind) + '</span> ' +
            (h ? '<a href="' + esc(h) + '" target="_blank" rel="noopener noreferrer">' + t + '</a>' : t) +
            (i.refNo ? ' <span style="color:var(--ink-soft)">&middot; ' + esc(i.refNo) + '</span>' : "") + '</li>';
        }).join("") + '</ul>';
        contentList.hidden = false;
        var stat = document.getElementById("staticList"); if(stat) stat.hidden = true;
        var stub = document.querySelector("#main .stub"); if(stub) stub.hidden = true;
      }
      var linkBox = document.getElementById("linkList");
      if(linkBox && links.length){
        linkBox.innerHTML = links.map(function(i){
          return '<a href="' + esc(i.url) + '" target="_blank" rel="noopener noreferrer">' + esc(title(i)) + '</a>';
        }).join("");
        linkBox.hidden = false;
        var lh = document.getElementById("linkHead"); if(lh) lh.hidden = false;
      }
    }).catch(function(){ /* keep the static list */ });
  }

  /* ---------------- Public Consultation (dynamic) ---------------- */
  var consultList = document.getElementById("consultList");
  if(consultList && API){
    var CONSULT_LOGIN = "login.html?redirect=public-consultation.html";
    var signedIn = !!B.getToken();

    var loadConsultations = function(){
      return B.api("GET", "/consultations").then(function(r){
        if(!r.ok) return;
        if(!r.data.length){ return; }
        consultList.innerHTML = r.data.map(function(c){
          var status = c.isOpen ? '<span class="tag pub">Open</span>' : '<span class="tag res">Closed</span>';
          var action;
          if(c.canComment){
            action = '<form class="cform" data-cid="' + esc(c.id) + '">' +
              '<label for="cm-' + esc(c.id) + '">Your comments</label>' +
              '<textarea id="cm-' + esc(c.id) + '" name="body" rows="5" maxlength="5000" required></textarea>' +
              '<button type="submit" class="sb" style="width:auto;padding:8px 16px">Submit comments</button></form>';
          } else if(c.isParticipant){
            action = '<p class="cnote">This consultation is closed for comments.</p>';
          } else if(!signedIn && c.isOpen){
            action = '<p class="cnote">Participation is limited to officials and users authorised by the Commission. ' +
              '<a href="' + CONSULT_LOGIN + '">Sign in to take part</a>.</p>';
          } else if(c.isOpen){
            action = '<p class="cnote">Your account is not on the list of authorised participants for this consultation.</p>';
          } else { action = ""; }
          var thread = c.isParticipant ? '<div class="cthread" id="th-' + esc(c.id) + '"></div>' : "";
          return '<div class="ccard"><h3>' + esc(c.title) + ' ' + status + '</h3>' +
            '<p class="cdates">Comments invited ' + esc(ddmmyyyy(c.opensAt)) + ' to ' + esc(ddmmyyyy(c.closesAt)) + '</p>' +
            '<p>' + esc(c.summary) + '</p>' + thread + action + '</div>';
        }).join("");
        consultList.hidden = false;
        var stat = document.getElementById("staticList"); if(stat) stat.hidden = true;
        var stub = document.querySelector("#main .stub"); if(stub) stub.hidden = true;
        r.data.forEach(function(c){ if(c.isParticipant) loadThread(c.id); });
      });
    };

    var loadThread = function(id){
      B.api("GET", "/consultations/" + encodeURIComponent(id) + "/comments").then(function(r){
        var el = document.getElementById("th-" + id);
        if(!el || !r.ok) return;
        el.innerHTML = r.data.length ? '<h4>Comments received (' + r.data.length + ')</h4>' + r.data.map(function(m){
          return '<div class="cmsg"><b>' + esc(m.author) + '</b> <span>' + esc(new Date(m.createdAt).toLocaleString("en-IN")) + '</span><p>' + esc(m.body) + '</p></div>';
        }).join("") : "";
      });
    };

    consultList.addEventListener("submit", function(e){
      var f = e.target.closest(".cform"); if(!f) return;
      e.preventDefault();
      var btn = f.querySelector("button"); btn.disabled = true;
      var id = f.dataset.cid;
      B.api("POST", "/consultations/" + encodeURIComponent(id) + "/comments", { body: f.body.value }).then(function(r){
        btn.disabled = false;
        if(r.status === 401){ location.href = CONSULT_LOGIN; return; }
        if(!r.ok){ alert((r.data && r.data.error) || "Your comments could not be submitted."); return; }
        f.body.value = "";
        loadThread(id);
      });
    });

    loadConsultations().catch(function(){ /* keep the static text */ });
  }

  /* sign-out links present in the archive left menu */
  document.addEventListener("click", function(e){
    var so = e.target.closest("[data-signout]");
    if(!so) return;
    e.preventDefault();
    if(API && B.getToken()){
      // Revoke the session on the server; navigate regardless of the result.
      try { fetch(B.apiBase() + "/auth/logout", { method: "POST", keepalive: true, headers: { Authorization: "Bearer " + B.getToken() } }); } catch(err){}
      B.clearSession();
    }
    sessionStorage.removeItem("bslc_auth");
    sessionStorage.removeItem("bslc_user");
    location.href = "index.html";
  });
})();
