/* Bihar State Law Commission — Site Administration (admin.html).

   This page is only a client for the departmental API. Hiding a tab or a
   button here protects nothing: every request is authorised by the server
   against the signed-in user's role (ADMIN or EDITOR), and refused (403)
   otherwise. All values from the server are HTML-escaped before display. */
(function(){
  "use strict";
  var root = document.getElementById("admRoot");
  if(!root) return;
  var B = window.BSLC, esc = B.escapeHtml;
  var LOGIN = "login.html?redirect=admin.html";
  var msgEl = document.getElementById("admMsg");
  var me = null;

  function show(text, ok){ msgEl.textContent = text; msgEl.className = "formmsg on " + (ok ? "ok" : "err"); window.scrollTo(0, 0); }
  function clearMsg(){ msgEl.className = "formmsg"; msgEl.textContent = ""; }
  function hideTabs(){ document.querySelectorAll("#admNav [data-tab]").forEach(function(a){ a.hidden = true; }); }

  if(!B.apiEnabled()){
    hideTabs();
    root.innerHTML = '<div class="stub">Site administration needs the departmental API. Set <code>BSLC_API_BASE</code> in ' +
      '<code>assets/js/config.js</code> to the API address. The public GitHub Pages site currently runs in demo mode, where no ' +
      'content can be managed.</div>';
    return;
  }
  if(!B.getToken()){ location.href = LOGIN; return; }

  /* API call with uniform error handling. Resolves with data on success. */
  function call(method, path, body){
    return B.api(method, path, body).then(function(r){
      if(r.status === 401){ location.href = LOGIN; throw new Error("signed out"); }
      if(!r.ok){
        var issues = r.data && r.data.issues ? " (" + r.data.issues.map(function(i){ return i.path + ": " + i.message; }).join("; ") + ")" : "";
        var m = ((r.data && r.data.error) || ("Request failed (" + r.status + ")")) + issues;
        show(m, false);
        throw new Error(m);
      }
      return r.data;
    });
  }
  function q(s){ return encodeURIComponent(s); }
  function ddmmyyyy(iso){ if(!iso) return ""; var p = String(iso).slice(0,10).split("-"); return p[2]+"."+p[1]+"."+p[0]; }
  function opts(list, sel){ return list.map(function(o){ var v = o[0], t = o[1]; return '<option value="'+esc(v)+'"'+(v===sel?" selected":"")+'>'+esc(t)+'</option>'; }).join(""); }
  function table(head, rows, empty){
    if(!rows.length) return '<p style="color:var(--ink-soft)">' + esc(empty || "Nothing here yet.") + '</p>';
    return '<table><thead><tr>' + head.map(function(h){ return "<th>" + esc(h) + "</th>"; }).join("") + '</tr></thead><tbody>' +
      rows.map(function(r){ return "<tr>" + r.map(function(c){ return "<td>" + c + "</td>"; }).join("") + "</tr>"; }).join("") + '</tbody></table>';
  }
  function btn(act, id, label, extra){ return '<button type="button" data-act="'+esc(act)+'" data-id="'+esc(id)+'"'+(extra||"")+'>'+esc(label)+'</button>'; }
  /* Form → object, leaving out empty fields so the server applies defaults. */
  function formData(form){
    var o = {};
    Array.prototype.forEach.call(form.elements, function(el){
      if(!el.name || el.type === "file" || el.value === "") return;
      o[el.name] = el.type === "number" ? Number(el.value) : el.value;
    });
    return o;
  }
  var ACCESS = { PUB:"Public", RES:"Restricted", CONF:"Confidential" };

  /* ================= Notices & Circulars ================= */
  var KINDS = [["CIRCULAR","Circular"],["NOTIFICATION","Notification"],["NOTICE","Notice"],["LINK","External link / URL"],["RECORD","Record"]];
  function renderContent(){
    root.innerHTML =
      '<div class="adm-panel"><h3>Publish a circular, notification, notice, link or record</h3>' +
      '<form id="fContent"><div class="adm-grid">' +
        '<div><label for="cKind">Kind</label><select id="cKind" name="kind">' + opts(KINDS) + '</select></div>' +
        '<div><label for="cRef">Reference No.</label><input id="cRef" name="refNo" maxlength="120"></div>' +
        '<div><label for="cDate">Date issued</label><input id="cDate" type="date" name="issuedOn"></div>' +
        '<div><label for="cAcc">Visible to</label><select id="cAcc" name="accessLevel">' + opts([["PUB","Everyone"],["RES","Signed-in users"]]) + '</select></div>' +
        '<div><label for="cStatus">Status</label><select id="cStatus" name="status">' + opts([["DRAFT","Draft"],["PUBLISHED","Published"]]) + '</select></div>' +
      '</div>' +
      '<label for="cTitle">Title (English)</label><input id="cTitle" name="titleEn" required maxlength="300">' +
      '<label for="cTitleHi">Title (Hindi)</label><input id="cTitleHi" name="titleHi" maxlength="300">' +
      '<label for="cUrl">External link (https://…)</label><input id="cUrl" name="url" type="url" maxlength="1000">' +
      '<label for="cDoc">Linked document ID (optional, from the Documents tab)</label><input id="cDoc" name="documentId">' +
      '<label for="cBody">Details (optional)</label><textarea id="cBody" name="bodyEn" rows="3" maxlength="20000"></textarea>' +
      '<button class="sb">Save</button></form>' +
      '<h3>Existing items</h3><div class="adm-scroll" id="contentTable">Loading…</div></div>';
    document.getElementById("fContent").addEventListener("submit", function(e){
      e.preventDefault(); clearMsg();
      call("POST", "/content", formData(e.target)).then(function(){ e.target.reset(); show("Saved.", true); loadContent(); });
    });
    loadContent();
  }
  function loadContent(){
    call("GET", "/content/manage").then(function(items){
      document.getElementById("contentTable").innerHTML = table(["Title","Kind","Date","Status","Visible to",""], items.map(function(i){
        var a = '<span class="adm-actions">' +
          (i.status !== "PUBLISHED" ? btn("content-status", i.id, "Publish", ' data-v="PUBLISHED"') : btn("content-status", i.id, "Unpublish", ' data-v="DRAFT"')) +
          (i.status !== "ARCHIVED" ? btn("content-status", i.id, "Archive", ' data-v="ARCHIVED"') : "") + '</span>';
        return [esc(i.titleEn) + (i.refNo ? '<br><small>' + esc(i.refNo) + '</small>' : ""), esc(i.kind), esc(ddmmyyyy(i.issuedOn)), esc(i.status), esc(i.accessLevel === "RES" ? "Signed-in" : "Everyone"), a];
      }));
    }).catch(function(){});
  }

  /* ================= Documents ================= */
  var DOC_TYPES = ["Report","Minutes","Notification","Circular","Correspondence","Working Paper","Consultation Paper","Order","Other"];
  function renderDocuments(){
    root.innerHTML =
      '<div class="adm-panel"><h3>Upload a document</h3>' +
      '<p style="font-size:.87rem;color:var(--ink-soft)">Accepted: PDF, DOCX, XLSX, ODT, ODS, PNG, JPEG, TXT, CSV. Files are checked by type and content on the server, ' +
      'and scanned for malware where a scanner is installed. Until scanned or released by an administrator, only administrators can open a file.</p>' +
      '<form id="fUpload"><label for="dFile">File</label><input id="dFile" type="file" name="file" required accept=".pdf,.docx,.xlsx,.odt,.ods,.png,.jpg,.jpeg,.txt,.csv">' +
      '<label for="dTitle">Title</label><input id="dTitle" name="title" required maxlength="300">' +
      '<div class="adm-grid">' +
        '<div><label for="dType">Type</label><select id="dType" name="docType">' + opts(DOC_TYPES.map(function(t){ return [t,t]; })) + '</select></div>' +
        '<div><label for="dDate">Date issued</label><input id="dDate" type="date" name="issuedOn" required></div>' +
        '<div><label for="dAcc">Access</label><select id="dAcc" name="accessLevel">' + opts([["PUB","Public"],["RES","Restricted (signed-in users)"],["CONF","Confidential (named users, view only)"]], "RES") + '</select></div>' +
        '<div><label for="dPages">Pages</label><input id="dPages" type="number" min="1" name="pages"></div>' +
      '</div><button class="sb">Upload</button></form>' +
      '<h3>Documents</h3><div class="adm-scroll" id="docTable">Loading…</div></div>';
    document.getElementById("fUpload").addEventListener("submit", function(e){
      e.preventDefault(); clearMsg();
      var f = e.target, fd = new FormData();
      Array.prototype.forEach.call(f.elements, function(el){
        if(!el.name) return;
        if(el.type === "file"){ if(el.files[0]) fd.append("file", el.files[0]); }
        else if(el.value !== "") fd.append(el.name, el.value);
      });
      var b = f.querySelector("button"); b.disabled = true;
      call("POST", "/documents", fd).then(function(d){
        b.disabled = false; f.reset();
        show("Uploaded “" + d.title + "” (" + (d.scanStatus === "CLEAN" ? "scanned clean" : "awaiting scan") + ").", true);
        loadDocuments();
      }).catch(function(){ b.disabled = false; });
    });
    loadDocuments();
  }
  function loadDocuments(){
    call("GET", "/documents").then(function(docs){
      document.getElementById("docTable").innerHTML = table(["Title","Type","Date","Access","Scan","ID",""], docs.map(function(d){
        var a = '<span class="adm-actions">' +
          (me.role === "ADMIN" && d.scanStatus === "PENDING" ? btn("doc-release", d.id, "Release") : "") +
          btn("doc-withdraw", d.id, d.withdrawn ? "Restore" : "Withdraw", ' data-v="' + (d.withdrawn ? "0" : "1") + '"') +
          (d.accessLevel === "CONF" ? btn("doc-grants", d.id, "Named users") : "") + '</span>';
        return [esc(d.title) + (d.withdrawn ? ' <span class="tag res">Withdrawn</span>' : ""), esc(d.docType), esc(ddmmyyyy(d.issuedOn) || d.year),
          '<span class="tag ' + esc(d.accessLevel.toLowerCase()) + '">' + esc(ACCESS[d.accessLevel]) + '</span>', esc(d.scanStatus),
          '<code style="font-size:.75rem">' + esc(d.id) + '</code>', a];
      }), "No documents uploaded yet.");
    }).catch(function(){});
  }
  function editGrants(id){
    call("GET", "/documents/" + q(id) + "/grants").then(function(users){
      var current = users.map(function(u){ return u.userId; }).join(", ") || "(none)";
      var who = window.prompt("Named users who may view this confidential document: " + current +
        "\n\nEnter a sign-in ID to add, or -ID to remove:");
      if(!who) return;
      who = who.trim();
      var remove = who.charAt(0) === "-";
      var uid = remove ? who.slice(1).trim() : who;
      var found = users.filter(function(u){ return u.userId === uid; })[0];
      var next = function(addId){
        var ids = users.map(function(u){ return u.id; }).filter(function(x){ return !(remove && found && x === found.id); });
        if(addId && ids.indexOf(addId) === -1) ids.push(addId);
        return call("PUT", "/documents/" + q(id) + "/grants", { userIds: ids }).then(function(){ show("Named users updated.", true); });
      };
      if(remove){ if(found) next(null); else show("That user is not on the list.", false); }
      else call("GET", "/users/lookup?userId=" + q(uid)).then(function(u){ return next(u.id); }).catch(function(){});
    }).catch(function(){});
  }

  /* ================= Consultations ================= */
  function renderConsultations(){
    root.innerHTML =
      '<div class="adm-panel"><h3>New consultation</h3>' +
      '<form id="fCons"><label for="kTitle">Title</label><input id="kTitle" name="title" required maxlength="300">' +
      '<label for="kSum">Summary</label><textarea id="kSum" name="summary" rows="3" required maxlength="5000"></textarea>' +
      '<div class="adm-grid">' +
        '<div><label for="kOpen">Opens</label><input id="kOpen" type="datetime-local" name="opensAt" required></div>' +
        '<div><label for="kClose">Closes</label><input id="kClose" type="datetime-local" name="closesAt" required></div>' +
        '<div><label for="kStatus">Status</label><select id="kStatus" name="status">' + opts([["DRAFT","Draft"],["OPEN","Open"],["CLOSED","Closed"]]) + '</select></div>' +
        '<div><label for="kDoc">Consultation paper (document ID)</label><input id="kDoc" name="documentId"></div>' +
      '</div><button class="sb">Create</button></form>' +
      '<p style="font-size:.87rem;color:var(--ink-soft)">Only users you add as participants can read and post comments. Add them with their sign-in ID.</p>' +
      '<h3>Consultations</h3><div id="consTable">Loading…</div></div>';
    document.getElementById("fCons").addEventListener("submit", function(e){
      e.preventDefault(); clearMsg();
      var o = formData(e.target);
      o.opensAt = new Date(o.opensAt).toISOString();
      o.closesAt = new Date(o.closesAt).toISOString();
      call("POST", "/consultations", o).then(function(){ e.target.reset(); show("Consultation created.", true); loadConsultations(); });
    });
    loadConsultations();
  }
  function loadConsultations(){
    call("GET", "/consultations").then(function(list){
      var el = document.getElementById("consTable");
      if(!list.length){ el.innerHTML = '<p style="color:var(--ink-soft)">No consultations yet.</p>'; return; }
      el.innerHTML = list.map(function(c){
        return '<div class="ccard"><h3>' + esc(c.title) + ' <span class="tag ' + (c.isOpen ? "pub" : "res") + '">' + esc(c.status) + '</span></h3>' +
          '<p class="cdates">' + esc(new Date(c.opensAt).toLocaleString("en-IN")) + ' to ' + esc(new Date(c.closesAt).toLocaleString("en-IN")) + '</p>' +
          '<span class="adm-actions">' +
            (c.status !== "OPEN" ? btn("cons-status", c.id, "Open for comments", ' data-v="OPEN"') : btn("cons-status", c.id, "Close", ' data-v="CLOSED"')) +
          '</span>' +
          '<div style="margin-top:8px"><b style="font-size:.85rem">Authorised participants</b><div id="parts-' + esc(c.id) + '">Loading…</div>' +
          '<form class="fPart" data-id="' + esc(c.id) + '" style="display:flex;gap:6px;margin-top:6px"><input name="userId" placeholder="Sign-in ID to add" style="margin:0">' +
          '<button class="sb" style="width:auto;padding:6px 12px">Add</button></form></div></div>';
      }).join("");
      list.forEach(function(c){ loadParticipants(c.id); });
    }).catch(function(){});
  }
  function loadParticipants(id){
    call("GET", "/consultations/" + q(id) + "/participants").then(function(users){
      var el = document.getElementById("parts-" + id); if(!el) return;
      el.innerHTML = users.length ? users.map(function(u){
        return '<span class="adm-actions" style="display:inline-block;margin-right:10px">' + esc(u.name) + ' (' + esc(u.userId) + ') ' +
          btn("part-remove", id, "Remove", ' data-user="' + esc(u.id) + '"') + '</span>';
      }).join("") : '<span style="color:var(--ink-soft);font-size:.87rem">None yet.</span>';
    }).catch(function(){});
  }

  /* ================= Users (ADMIN) ================= */
  var ROLES = [["OFFICIAL","Official (internal)"],["EDITOR","Editor (content manager)"],["ADMIN","Administrator"],["PUBLIC","Public visitor"]];
  function renderUsers(){
    root.innerHTML =
      '<div class="adm-panel"><h3>Create an account</h3>' +
      '<form id="fUser"><div class="adm-grid">' +
        '<div><label for="uId">Sign-in ID</label><input id="uId" name="userId" required maxlength="120"></div>' +
        '<div><label for="uName">Name</label><input id="uName" name="name" required maxlength="120"></div>' +
        '<div><label for="uMail">E-mail</label><input id="uMail" type="email" name="email"></div>' +
        '<div><label for="uMob">Mobile</label><input id="uMob" name="mobile" inputmode="numeric"></div>' +
        '<div><label for="uRole">Role</label><select id="uRole" name="role">' + opts(ROLES) + '</select></div>' +
        '<div><label for="uPw">Initial password</label><input id="uPw" type="password" name="password" required autocomplete="new-password"></div>' +
      '</div><button class="sb">Create</button></form>' +
      '<h3>Accounts</h3><label for="uFilter">Show</label><select id="uFilter" style="max-width:240px">' +
        opts([["","All"],["PENDING","Awaiting approval"],["ACTIVE","Active"],["LOCKED","Locked"],["DISABLED","Disabled"]]) + '</select>' +
      '<div class="adm-scroll" id="userTable">Loading…</div></div>';
    document.getElementById("fUser").addEventListener("submit", function(e){
      e.preventDefault(); clearMsg();
      call("POST", "/users", formData(e.target)).then(function(){ e.target.reset(); show("Account created.", true); loadUsers(); });
    });
    document.getElementById("uFilter").addEventListener("change", loadUsers);
    loadUsers();
  }
  function loadUsers(){
    var f = document.getElementById("uFilter").value;
    call("GET", "/users" + (f ? "?status=" + q(f) : "")).then(function(users){
      document.getElementById("userTable").innerHTML = table(["Sign-in ID","Name","Role","Status",""], users.map(function(u){
        var self = u.id === me.id;
        var role = self ? esc(u.role) : '<select data-act="user-role" data-id="' + esc(u.id) + '" style="margin:0">' + opts(ROLES, u.role) + '</select>';
        var a = self ? "(you)" : '<span class="adm-actions">' +
          (u.status !== "ACTIVE" ? btn("user-status", u.id, u.status === "PENDING" ? "Approve" : u.status === "LOCKED" ? "Unlock" : "Re-enable", ' data-v="ACTIVE"') : "") +
          (u.status !== "DISABLED" ? btn("user-status", u.id, "Disable", ' data-v="DISABLED"') : "") +
          btn("user-password", u.id, "Reset password") + '</span>';
        return [esc(u.userId), esc(u.name), role, esc(u.status) + (u.failedAttempts ? " (" + esc(u.failedAttempts) + " failed)" : ""), a];
      }));
    }).catch(function(){});
  }

  /* ================= Audit (ADMIN) ================= */
  function renderAudit(){
    root.innerHTML = '<div class="adm-panel"><h3>Audit log (latest 200)</h3>' +
      '<form id="fAudit" style="display:flex;gap:6px"><input name="action" placeholder="Filter by action, e.g. DOCUMENT_VIEW" style="margin:0">' +
      '<button class="sb" style="width:auto;padding:6px 14px">Filter</button></form>' +
      '<p style="font-size:.85rem;color:var(--ink-soft)">Entries cannot be changed or deleted, by this page or directly in the database.</p>' +
      '<div class="adm-scroll" id="auditTable">Loading…</div></div>';
    document.getElementById("fAudit").addEventListener("submit", function(e){ e.preventDefault(); loadAudit(e.target.action.value.trim()); });
    loadAudit("");
  }
  function loadAudit(action){
    call("GET", "/audit?limit=200" + (action ? "&action=" + q(action) : "")).then(function(rows){
      document.getElementById("auditTable").innerHTML = table(["Time","User","Action","Record","IP","Detail"], rows.map(function(r){
        return [esc(new Date(r.at).toLocaleString("en-IN")), esc(r.actorUser || "—"), esc(r.action),
          esc((r.entity || "") + (r.entityId ? " " + r.entityId.slice(0, 8) : "")), esc(r.ip || ""),
          '<small>' + esc(r.detail ? JSON.stringify(r.detail).slice(0, 160) : "") + '</small>'];
      }));
    }).catch(function(){});
  }

  /* ================= actions (event delegation) ================= */
  root.addEventListener("click", function(e){
    var b = e.target.closest("button[data-act]"); if(!b) return;
    var id = b.dataset.id, v = b.dataset.v; clearMsg();
    switch(b.dataset.act){
      case "content-status": call("PATCH", "/content/" + q(id), { status: v }).then(loadContent).catch(function(){}); break;
      case "doc-release":
        var note = window.prompt("Confirm this file was checked for malware by other means. Note for the audit log:");
        if(note) call("POST", "/documents/" + q(id) + "/release", { note: note }).then(loadDocuments).catch(function(){});
        break;
      case "doc-withdraw": call("PATCH", "/documents/" + q(id), { withdrawn: v === "1" }).then(loadDocuments).catch(function(){}); break;
      case "doc-grants": editGrants(id); break;
      case "cons-status": call("PATCH", "/consultations/" + q(id), { status: v }).then(loadConsultations).catch(function(){}); break;
      case "part-remove": call("DELETE", "/consultations/" + q(id) + "/participants/" + q(b.dataset.user)).then(function(){ loadParticipants(id); }).catch(function(){}); break;
      case "user-status": call("PATCH", "/users/" + q(id), { status: v }).then(loadUsers).catch(function(){}); break;
      case "user-password":
        var pw = window.prompt("New password (10+ characters, with a letter and a digit). The user's open sessions will be signed out:");
        if(pw) call("POST", "/users/" + q(id) + "/password", { password: pw }).then(function(){ show("Password reset.", true); }).catch(function(){});
        break;
    }
  });
  root.addEventListener("change", function(e){
    var s = e.target.closest("select[data-act='user-role']"); if(!s) return;
    clearMsg();
    call("PATCH", "/users/" + q(s.dataset.id), { role: s.value }).then(function(){ show("Role updated.", true); }).catch(loadUsers);
  });
  root.addEventListener("submit", function(e){
    var f = e.target.closest(".fPart"); if(!f) return;
    e.preventDefault(); clearMsg();
    var id = f.dataset.id, uid = f.userId.value.trim(); if(!uid) return;
    call("GET", "/users/lookup?userId=" + q(uid)).then(function(u){
      return call("POST", "/consultations/" + q(id) + "/participants", { userId: u.id });
    }).then(function(){ f.reset(); loadParticipants(id); }).catch(function(){});
  });

  /* ================= start ================= */
  var PANELS = { content: renderContent, documents: renderDocuments, consultations: renderConsultations, users: renderUsers, audit: renderAudit };
  function route(){
    var tab = (location.hash || "#content").slice(1);
    if(!PANELS[tab] || (me.role !== "ADMIN" && (tab === "users" || tab === "audit"))) tab = "content";
    document.querySelectorAll("#admNav [data-tab]").forEach(function(a){
      if(a.dataset.tab === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    clearMsg();
    PANELS[tab]();
  }

  call("GET", "/auth/me").then(function(u){
    document.getElementById("admUser").textContent = u.userId;
    if(u.role !== "ADMIN" && u.role !== "EDITOR"){
      hideTabs();
      root.innerHTML = '<div class="stub">Your account (' + esc(u.role) + ') does not have site management access. ' +
        'Contact the Commission’s administrator if you need it.</div>';
      return;
    }
    me = u;
    if(u.role !== "ADMIN") document.querySelectorAll("#admNav [data-admin-only]").forEach(function(a){ a.hidden = true; });
    window.addEventListener("hashchange", route);
    route();
  }).catch(function(){ /* error already shown */ });
})();
