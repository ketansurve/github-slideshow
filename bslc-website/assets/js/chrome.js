/* Bihar State Law Commission — shared header, top navigation and footer.
   Injected on every page so nav/footer stay identical across the site
   without a server-side templating step. */
(function(){
  "use strict";

  var NAV = [
    {slug:"home",         href:"index.html",                 en:"Home",                     hi:"मुख पृष्ठ"},
    {slug:"about",        href:"about-us.html",               en:"About Us",                 hi:"हमारे बारे में"},
    {slug:"whoswho",      href:"whos-who.html",               en:"Who's Who",                hi:"कौन क्या है"},
    {slug:"acts",         href:"acts-rules.html",             en:"Acts &amp; Rules",         hi:"अधिनियम एवं नियम"},
    {slug:"reports",      href:"reports.html",                en:"Reports",                  hi:"प्रतिवेदन"},
    {slug:"notification", href:"notification-circular.html",  en:"Notification / Circular",  hi:"अधिसूचना / परिपत्र"},
    {slug:"consultation", href:"public-consultation.html",    en:"Public Consultation",      hi:"जन परामर्श"},
    {slug:"archive",      href:"document-archive.html",       en:"Document Archive",         hi:"दस्तावेज़ अभिलेखागार"},
    {slug:"rti",          href:"rti.html",                    en:"RTI",                      hi:"सूचना का अधिकार"},
    {slug:"tender",       href:"tender.html",                 en:"Tender",                   hi:"निविदा"},
    {slug:"downloads",    href:"downloads.html",              en:"Downloads",                hi:"डाउनलोड"},
    {slug:"contact",      href:"contact-us.html",             en:"Contact Us",               hi:"संपर्क करें"}
  ];
  window.BSLC_NAV = NAV;

  var LEFTNAV = [
    {slug:"about-commission",   href:"about-us.html",               en:"About the Commission",           hi:"आयोग के बारे में"},
    {slug:"terms-of-reference", href:"terms-of-reference.html",     en:"Terms of Reference",              hi:"कार्य-क्षेत्र"},
    {slug:"functions-powers",   href:"functions-powers.html",       en:"Functions &amp; Powers",          hi:"कार्य एवं शक्तियाँ"},
    {slug:"whoswho",            href:"whos-who.html",               en:"Who's Who",                       hi:"कौन क्या है"},
    {slug:"org-chart",          href:"organisation-chart.html",     en:"Organisation Chart",              hi:"संगठन चार्ट"},
    {slug:"reports-pub",        href:"reports.html",                en:"Reports &amp; Publications",      hi:"प्रतिवेदन एवं प्रकाशन"},
    {slug:"action-taken",       href:"action-taken.html",           en:"Action Taken by Government",      hi:"सरकार द्वारा की गई कार्रवाई"},
    {slug:"acts-rules",         href:"acts-rules.html",             en:"Acts &amp; Rules",                hi:"अधिनियम एवं नियम"},
    {slug:"notification",       href:"notification-circular.html",  en:"Notification / Circular",         hi:"अधिसूचना / परिपत्र"},
    {slug:"consultation",       href:"public-consultation.html",    en:"Public Consultation",             hi:"जन परामर्श"},
    {slug:"archive-login",      href:"document-archive.html",       en:"Document Archive (Login)",        hi:"दस्तावेज़ अभिलेखागार (लॉगिन)"},
    {slug:"rti",                href:"rti.html",                    en:"RTI &mdash; Sec 4(1)(b)",         hi:"सूचना का अधिकार &mdash; धारा 4(1)(ख)"},
    {slug:"tender",             href:"tender.html",                 en:"Tender",                          hi:"निविदा"},
    {slug:"recruitment",        href:"recruitment.html",            en:"Recruitment",                     hi:"नियुक्ति"},
    {slug:"downloads",          href:"downloads.html",              en:"Downloads",                       hi:"डाउनलोड"},
    {slug:"photo-gallery",      href:"photo-gallery.html",          en:"Photo Gallery",                   hi:"फोटो गैलरी"},
    {slug:"grievance",          href:"grievance.html",              en:"Grievance",                       hi:"शिकायत"},
    {slug:"contact",            href:"contact-us.html",             en:"Contact Us",                      hi:"संपर्क करें"}
  ];

  function leftNavHtml(active){
    return '<h3 data-i18n="lnv_title">Department Menu</h3>' + LEFTNAV.map(function(i){
      var current = i.slug===active ? ' aria-current="page"' : "";
      return '<a href="'+i.href+'"'+current+' data-i18n="lnv_'+i.slug+'">'+i.en+"</a>";
    }).join("");
  }

  function navHtml(active){
    return NAV.map(function(i){
      var current = i.slug===active ? ' aria-current="page" class="on"' : "";
      return '<a href="'+i.href+'"'+current+' data-i18n="'+i.slug+'">'+i.en+"</a>";
    }).join("");
  }

  function headerHtml(active){
    return ''+
    '<a class="skip-link" href="#main">Skip to Main Content</a>'+
    '<div class="utility">'+
      '<div><a href="#main">Skip to Main Content</a> <span class="sep">|</span> '+
        '<a href="faq.html#reader">Screen Reader Access</a> <span class="sep">|</span> '+
        '<a href="sitemap.html">Site Map</a> <span class="sep">|</span> '+
        '<a href="feedback.html">Feedback</a> <span class="sep">|</span> '+
        '<a href="faq.html">FAQ</a></div>'+
      '<div>'+
        '<button class="fs" data-fs="down" title="Decrease text size">A-</button> '+
        '<button class="fs" data-fs="reset" title="Reset text size">A</button> '+
        '<button class="fs" data-fs="up" title="Increase text size">A+</button> '+
        '<span class="sep">|</span> '+
        '<button class="fs" id="contrastToggle" aria-pressed="false">&#9680; High Contrast</button> '+
        '<span class="sep">|</span> '+
        '<button class="langbtn on" data-lang="en">English</button>'+
        '<button class="langbtn" data-lang="hi" style="font-family:\'Noto Sans Devanagari\'">हिन्दी</button>'+
      '</div>'+
    '</div>'+
    '<div class="tricolor"></div>'+
    '<div class="banner">'+
      '<div class="emblem" aria-hidden="true">भारत<br>Emblem</div>'+
      '<div><div class="hi">बिहार राज्य विधि आयोग</div>'+
        '<h1>Bihar State Law Commission</h1>'+
        '<div class="sub">Government of Bihar</div></div>'+
      '<div class="breadcrumbtag">state.bihar.gov.in/lawcommission/<br>Helpline 0612-2200000</div>'+
    '</div>'+
    '<nav class="top" aria-label="Primary">'+navHtml(active)+'</nav>';
  }

  function footerHtml(){
    var year = new Date().getFullYear();
    return ''+
    '<div class="fg">'+
      '<div><h5 data-i18n="f_commission">The Commission</h5>'+
        '<a href="about-us.html" data-i18n="f_about">About Us</a>'+
        '<a href="terms-of-reference.html" data-i18n="f_tor">Terms of Reference</a>'+
        '<a href="whos-who.html" data-i18n="whoswho">Who\'s Who</a>'+
        '<a href="organisation-chart.html" data-i18n="f_orgchart">Organisation Chart</a></div>'+
      '<div><h5 data-i18n="f_info">Information</h5>'+
        '<a href="reports.html" data-i18n="reports">Reports</a>'+
        '<a href="notification-circular.html" data-i18n="notification">Notification / Circular</a>'+
        '<a href="rti.html" data-i18n="rti">RTI</a>'+
        '<a href="downloads.html" data-i18n="downloads">Downloads</a>'+
        '<a href="tender.html" data-i18n="tender">Tender</a></div>'+
      '<div><h5 data-i18n="f_policies">Website Policies</h5>'+
        '<a href="terms-conditions.html" data-i18n="f_tc">Terms &amp; Conditions</a>'+
        '<a href="privacy-policy.html" data-i18n="f_privacy">Privacy Policy</a>'+
        '<a href="copyright-policy.html" data-i18n="f_copyright">Copyright Policy</a>'+
        '<a href="hyperlinking-policy.html" data-i18n="f_hyperlink">Hyperlinking Policy</a>'+
        '<a href="accessibility-statement.html" data-i18n="f_access">Accessibility Statement</a>'+
        '<a href="disclaimer.html" data-i18n="f_disclaimer">Disclaimer</a>'+
        '<a href="faq.html" data-i18n="faq">Help</a></div>'+
      '<div><h5 data-i18n="f_contact">Contact</h5>'+
        '<p style="margin:0" data-i18n="f_address">Bihar State Law Commission<br>5th Floor, Vikas Bhawan, Bailey Road<br>Patna &ndash; 800 001, Bihar<br>0612-2200000<br>lawcommission-bih@nic.in</p></div>'+
    '</div>'+
    '<div class="fbar">'+
      '<span data-i18n="f_owned">Content owned and maintained by the Bihar State Law Commission, Government of Bihar.</span>'+
      '<span>&copy; '+year+'</span>'+
    '</div>'+
    '<div style="margin-top:8px;font-size:.79rem;opacity:.75">Designed, developed and hosted by the Department of IT &middot; GIGW 3.0 &middot; WCAG 2.1 AA</div>';
  }

  function fontScale(action){
    var steps = [0.9,1,1.1,1.25];
    var cur = parseFloat(localStorage.getItem("bslc-font")||"1");
    var idx = steps.indexOf(cur); if(idx===-1) idx=1;
    if(action==="up") idx = Math.min(idx+1, steps.length-1);
    else if(action==="down") idx = Math.max(idx-1, 0);
    else idx = 1;
    var v = steps[idx];
    document.documentElement.style.setProperty("--font-scale", v);
    localStorage.setItem("bslc-font", v);
  }

  function applyContrast(on){
    document.body.classList.toggle("contrast", on);
    var btn = document.getElementById("contrastToggle");
    if(btn) btn.setAttribute("aria-pressed", on ? "true":"false");
    localStorage.setItem("bslc-contrast", on ? "1":"0");
  }

  document.addEventListener("DOMContentLoaded", function(){
    var hSlot = document.getElementById("chrome-header");
    var fSlot = document.getElementById("chrome-footer");
    var lSlot = document.getElementById("chrome-leftnav");
    var active = document.body.getAttribute("data-nav") || "";
    var activeLeft = document.body.getAttribute("data-leftnav") || "";
    if(hSlot) hSlot.innerHTML = headerHtml(active);
    if(fSlot) fSlot.innerHTML = footerHtml();
    if(lSlot) lSlot.innerHTML = leftNavHtml(activeLeft);

    document.documentElement.style.setProperty("--font-scale", localStorage.getItem("bslc-font")||"1");
    applyContrast(localStorage.getItem("bslc-contrast")==="1");

    document.addEventListener("click", function(e){
      var fs = e.target.closest(".fs[data-fs]");
      if(fs){ fontScale(fs.dataset.fs); return; }
      var ct = e.target.closest("#contrastToggle");
      if(ct){ applyContrast(!document.body.classList.contains("contrast")); return; }
    });

    if(window.BSLC_I18N) window.BSLC_I18N.init();
  });
})();
