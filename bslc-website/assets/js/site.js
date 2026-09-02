/* Bihar State Law Commission — page interactivity: demo login flow and
   the Document Archive search/filter. This is a front-end demo only —
   there is no server here, so "authentication" is a sessionStorage flag
   and the archive contents are a small hard-coded dataset. Wiring this
   to the real NIC authentication service (Jan Parichay / Bihar SSO) and
   the actual document repository is backend work outside this mockup. */
(function(){
  "use strict";

  /* ---------------- demo captcha + OTP login (login.html) ---------------- */
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
    var DEMO_OTP = "123456";

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
      if(attempts >= 5){
        showMsg("This account is locked after 5 failed attempts. Contact the Records Officer to unlock it, or try again after 30 minutes.", false);
        if(sendBtn) sendBtn.disabled = true;
        if(signInBtn) signInBtn.disabled = true;
        return true;
      }
      return false;
    }

    newCaptcha();
    lockCheck();
    var refreshBtn = document.getElementById("captchaRefresh");
    if(refreshBtn) refreshBtn.addEventListener("click", function(e){ e.preventDefault(); newCaptcha(); });

    loginForm.addEventListener("submit", function(e){ e.preventDefault(); });

    if(sendBtn) sendBtn.addEventListener("click", function(){
      if(lockCheck()) return;
      var u = document.getElementById("u").value.trim();
      var p = document.getElementById("p").value.trim();
      var c = (captchaInput.value||"").trim().toUpperCase();
      if(!u || !p){ showMsg("Enter your User ID and Password.", false); return; }
      if(c !== captchaText){
        attempts++; sessionStorage.setItem("bslc_attempts", attempts);
        showMsg("Captcha does not match. Attempt " + attempts + " of 5.", false);
        newCaptcha(); captchaInput.value = "";
        lockCheck();
        return;
      }
      otpBlock.hidden = false;
      if(otpSentTo) otpSentTo.textContent = "an OTP has been sent to the mobile number registered against " + u + " (demo OTP: " + DEMO_OTP + ")";
      showMsg("OTP sent. This is a front-end demo, so the OTP is shown above instead of by SMS.", true);
      sendBtn.disabled = true;
      otpInput.focus();
    });

    if(signInBtn) signInBtn.addEventListener("click", function(){
      if(lockCheck()) return;
      var u = document.getElementById("u").value.trim();
      if(otpBlock.hidden){ showMsg("Request an OTP first.", false); return; }
      if((otpInput.value||"").trim() !== DEMO_OTP){
        attempts++; sessionStorage.setItem("bslc_attempts", attempts);
        showMsg("Incorrect OTP. Attempt " + attempts + " of 5.", false);
        lockCheck();
        return;
      }
      sessionStorage.setItem("bslc_auth", "1");
      sessionStorage.setItem("bslc_user", u || "guest");
      sessionStorage.removeItem("bslc_attempts");
      var params = new URLSearchParams(location.search);
      location.href = params.get("redirect") || "document-archive.html";
    });

    var janParichay = document.getElementById("janParichayBtn");
    if(janParichay) janParichay.addEventListener("click", function(e){
      e.preventDefault();
      showMsg("Jan Parichay / Bihar SSO sign-on is provided by the state identity platform and is out of scope for this front-end demo.", false);
    });
  }

  /* ---------------- Document Archive (document-archive.html) ---------------- */
  var archiveRoot = document.getElementById("archiveRoot");
  if(archiveRoot){
    if(sessionStorage.getItem("bslc_auth") !== "1"){
      location.href = "login.html?redirect=document-archive.html";
    } else {
      var userTag = document.getElementById("archiveUser");
      if(userTag) userTag.textContent = sessionStorage.getItem("bslc_user") || "guest";

      var DOCS = [
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
      ];

      var yearsBar = document.getElementById("yearsBar");
      var chipsBar = document.getElementById("chipsBar");
      var searchBox = document.getElementById("archiveSearch");
      var tbody = document.getElementById("archiveBody");
      var countTag = document.getElementById("archiveCount");
      var state = { year: "all", type: "All Types", q: "" };

      var years = Array.from(new Set(DOCS.map(function(d){return d.year;}))).sort(function(a,b){return b-a;});
      yearsBar.innerHTML = '<button class="yr on" data-yr="all">All Years</button>' +
        years.map(function(y){ return '<button class="yr" data-yr="'+y+'">'+y+'</button>'; }).join("");

      var types = ["All Types","Report","Minutes","Notification","Correspondence","Working Paper"];
      chipsBar.innerHTML = types.map(function(t,i){
        return '<button type="button" class="chip'+(i===0?' on':'')+'" data-type="'+t+'">'+t+'</button>';
      }).join("");

      var ACCESS_LABEL = {pub:"Public", res:"Restricted", conf:"Confidential"};

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
            var canView = d.access !== "conf-only-never";
            var action = d.access === "conf" ? '<a href="#" data-view="'+encodeURIComponent(d.title)+'">View only</a>' : '<a href="#" data-view="'+encodeURIComponent(d.title)+'">View</a>';
            return '<tr><td>'+d.title+'</td><td>'+d.type+'</td><td>'+d.date+'</td>'+
              '<td><span class="tag '+d.access+'">'+ACCESS_LABEL[d.access]+'</span></td>'+
              '<td>'+d.pages+'</td><td>'+action+'</td></tr>';
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
        if(v){ e.preventDefault(); alert("Demo only — \"" + decodeURIComponent(v.dataset.view) + "\" would open the signed, watermarked PDF from the records store."); }
      });

      render();
    }
  }

  /* sign-out links present in the archive left menu */
  document.addEventListener("click", function(e){
    var so = e.target.closest("[data-signout]");
    if(!so) return;
    e.preventDefault();
    sessionStorage.removeItem("bslc_auth");
    sessionStorage.removeItem("bslc_user");
    location.href = "index.html";
  });
})();
