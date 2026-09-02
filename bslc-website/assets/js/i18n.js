/* Bihar State Law Commission — English / Hindi text switch.
   Elements opt in with data-i18n="key" (innerHTML) or
   data-i18n-ph="key" (placeholder attribute). Pages may add extra
   keys via a window.BSLC_I18N_EXTRA object defined before this script runs. */
(function(){
  "use strict";

  var DICT = {
    home:{en:"Home", hi:"मुख पृष्ठ"},
    about:{en:"About Us", hi:"हमारे बारे में"},
    whoswho:{en:"Who's Who", hi:"कौन क्या है"},
    acts:{en:"Acts &amp; Rules", hi:"अधिनियम एवं नियम"},
    reports:{en:"Reports", hi:"प्रतिवेदन"},
    notification:{en:"Notification / Circular", hi:"अधिसूचना / परिपत्र"},
    consultation:{en:"Public Consultation", hi:"जन परामर्श"},
    archive:{en:"Document Archive", hi:"दस्तावेज़ अभिलेखागार"},
    rti:{en:"RTI", hi:"सूचना का अधिकार"},
    tender:{en:"Tender", hi:"निविदा"},
    downloads:{en:"Downloads", hi:"डाउनलोड"},
    contact:{en:"Contact Us", hi:"संपर्क करें"},
    faq:{en:"Help", hi:"सहायता"},

    f_commission:{en:"The Commission", hi:"आयोग"},
    f_about:{en:"About Us", hi:"हमारे बारे में"},
    f_tor:{en:"Terms of Reference", hi:"कार्य-क्षेत्र"},
    f_orgchart:{en:"Organisation Chart", hi:"संगठन चार्ट"},
    f_info:{en:"Information", hi:"सूचना"},
    f_policies:{en:"Website Policies", hi:"वेबसाइट नीतियाँ"},
    f_tc:{en:"Terms &amp; Conditions", hi:"नियम एवं शर्तें"},
    f_privacy:{en:"Privacy Policy", hi:"गोपनीयता नीति"},
    f_copyright:{en:"Copyright Policy", hi:"कॉपीराइट नीति"},
    f_hyperlink:{en:"Hyperlinking Policy", hi:"हाइपरलिंकिंग नीति"},
    f_access:{en:"Accessibility Statement", hi:"सुगम्यता वक्तव्य"},
    f_disclaimer:{en:"Disclaimer", hi:"अस्वीकरण"},
    f_contact:{en:"Contact", hi:"संपर्क"},
    f_address:{en:"Bihar State Law Commission<br>5th Floor, Vikas Bhawan, Bailey Road<br>Patna &ndash; 800 001, Bihar<br>0612-2200000<br>lawcommission-bih@nic.in",
                hi:"बिहार राज्य विधि आयोग<br>5वीं मंज़िल, विकास भवन, बेली रोड<br>पटना &ndash; 800 001, बिहार<br>0612-2200000<br>lawcommission-bih@nic.in"},
    f_owned:{en:"Content owned and maintained by the Bihar State Law Commission, Government of Bihar.",
              hi:"सामग्री का स्वामित्व एवं अनुरक्षण बिहार राज्य विधि आयोग, बिहार सरकार द्वारा।"},

    lnv_title:{en:"Department Menu", hi:"विभाग मेनू"},
    "lnv_about-commission":{en:"About the Commission", hi:"आयोग के बारे में"},
    "lnv_terms-of-reference":{en:"Terms of Reference", hi:"कार्य-क्षेत्र"},
    "lnv_functions-powers":{en:"Functions &amp; Powers", hi:"कार्य एवं शक्तियाँ"},
    lnv_whoswho:{en:"Who's Who", hi:"कौन क्या है"},
    "lnv_org-chart":{en:"Organisation Chart", hi:"संगठन चार्ट"},
    "lnv_reports-pub":{en:"Reports &amp; Publications", hi:"प्रतिवेदन एवं प्रकाशन"},
    "lnv_action-taken":{en:"Action Taken by Government", hi:"सरकार द्वारा की गई कार्रवाई"},
    "lnv_acts-rules":{en:"Acts &amp; Rules", hi:"अधिनियम एवं नियम"},
    lnv_notification:{en:"Notification / Circular", hi:"अधिसूचना / परिपत्र"},
    lnv_consultation:{en:"Public Consultation", hi:"जन परामर्श"},
    "lnv_archive-login":{en:"Document Archive (Login)", hi:"दस्तावेज़ अभिलेखागार (लॉगिन)"},
    lnv_rti:{en:"RTI &mdash; Sec 4(1)(b)", hi:"सूचना का अधिकार &mdash; धारा 4(1)(ख)"},
    lnv_tender:{en:"Tender", hi:"निविदा"},
    lnv_recruitment:{en:"Recruitment", hi:"नियुक्ति"},
    lnv_downloads:{en:"Downloads", hi:"डाउनलोड"},
    "lnv_photo-gallery":{en:"Photo Gallery", hi:"फोटो गैलरी"},
    lnv_grievance:{en:"Grievance", hi:"शिकायत"},
    lnv_contact:{en:"Contact Us", hi:"संपर्क करें"}
  };

  function currentLang(){
    return localStorage.getItem("bslc-lang") || "en";
  }

  function apply(lang){
    document.documentElement.lang = lang;
    var d = Object.assign({}, DICT, window.BSLC_I18N_EXTRA||{});
    document.querySelectorAll("[data-i18n]").forEach(function(el){
      var k = el.getAttribute("data-i18n");
      if(d[k] && d[k][lang]) el.innerHTML = d[k][lang];
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(function(el){
      var k = el.getAttribute("data-i18n-ph");
      if(d[k] && d[k][lang]) el.placeholder = d[k][lang];
    });
    document.querySelectorAll(".langbtn").forEach(function(b){
      b.classList.toggle("on", b.dataset.lang===lang);
    });
    localStorage.setItem("bslc-lang", lang);
  }

  document.addEventListener("click", function(e){
    var b = e.target.closest(".langbtn");
    if(!b) return;
    e.preventDefault();
    apply(b.dataset.lang);
  });

  window.BSLC_I18N = { init: function(){ apply(currentLang()); }, apply: apply };
})();
