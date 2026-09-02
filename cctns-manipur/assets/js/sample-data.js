/**
 * Offline fallback dataset.
 *
 * Mirrors server/data/*.json exactly (same shapes, same sample records)
 * so the site is fully workable even with no backend running - open
 * index.html directly, or host it as static files, and assets/js/api.js
 * will use this object whenever a fetch to apiBaseUrl fails.
 *
 * When wiring up a real backend, this file does not need to change: it
 * only ever gets used as a fallback. When onboarding a new state without
 * a backend, replace the contents below with that state's sample data
 * (keep the same top-level keys).
 */
window.SAMPLE_DATA = {
  districts: [
    { code: "BSN", name: "Bishnupur" },
    { code: "CDL", name: "Chandel" },
    { code: "CCP", name: "Churachandpur" },
    { code: "IEA", name: "Imphal East" },
    { code: "IWT", name: "Imphal West" },
    { code: "JRB", name: "Jiribam" },
    { code: "KKC", name: "Kakching" },
    { code: "KMJ", name: "Kamjong" },
    { code: "KPK", name: "Kangpokpi" },
    { code: "NNY", name: "Noney" },
    { code: "PHZ", name: "Pherzawl" },
    { code: "SNP", name: "Senapati" },
    { code: "TML", name: "Tamenglong" },
    { code: "TNP", name: "Tengnoupal" },
    { code: "TBL", name: "Thoubal" },
    { code: "UKR", name: "Ukhrul" }
  ],

  stations: [
    { code: "IWT-LMP", name: "Lamphel PS", districtCode: "IWT" },
    { code: "IWT-SNJ", name: "Singjamei PS", districtCode: "IWT" },
    { code: "IWT-WNG", name: "Wangoi PS", districtCode: "IWT" },
    { code: "IEA-PRM", name: "Porompat PS", districtCode: "IEA" },
    { code: "IEA-KHR", name: "Khurai PS", districtCode: "IEA" },
    { code: "IEA-IRB", name: "Irilbung PS", districtCode: "IEA" },
    { code: "TBL-TBM", name: "Thoubal PS", districtCode: "TBL" },
    { code: "TBL-WJG", name: "Wangjing PS", districtCode: "TBL" },
    { code: "BSN-BSP", name: "Bishnupur PS", districtCode: "BSN" },
    { code: "BSN-MRG", name: "Moirang PS", districtCode: "BSN" },
    { code: "CCP-CCP", name: "Churachandpur PS", districtCode: "CCP" },
    { code: "CCP-SGT", name: "Singngat PS", districtCode: "CCP" },
    { code: "KKC-KKC", name: "Kakching PS", districtCode: "KKC" },
    { code: "KKC-SGN", name: "Sugnu PS", districtCode: "KKC" },
    { code: "CDL-CDL", name: "Chandel PS", districtCode: "CDL" },
    { code: "CDL-MCH", name: "Machi PS", districtCode: "CDL" },
    { code: "TNP-MRE", name: "Moreh PS", districtCode: "TNP" },
    { code: "KPK-KPK", name: "Kangpokpi PS", districtCode: "KPK" },
    { code: "KPK-SKL", name: "Saikul PS", districtCode: "KPK" },
    { code: "SNP-SNP", name: "Senapati PS", districtCode: "SNP" },
    { code: "SNP-MAO", name: "Mao PS", districtCode: "SNP" },
    { code: "TML-TML", name: "Tamenglong PS", districtCode: "TML" },
    { code: "NNY-NNY", name: "Noney PS", districtCode: "NNY" },
    { code: "JRB-JRB", name: "Jiribam PS", districtCode: "JRB" },
    { code: "UKR-UKR", name: "Ukhrul PS", districtCode: "UKR" },
    { code: "KMJ-KMJ", name: "Kamjong PS", districtCode: "KMJ" },
    { code: "PHZ-PHZ", name: "Pherzawl PS", districtCode: "PHZ" }
  ],

  cases: [
    { district: "Imphal West", station: "Lamphel PS", firNo: "0001/2026", firDate: "02/01/2026", sections: "NDPS Act 1985 s.20(b)(ii)(C)", status: "Pending Investigation", category: "NDPS", pendingDays: 76 },
    { district: "Imphal East", station: "Porompat PS", firNo: "0007/2026", firDate: "04/01/2026", sections: "BNS 2023 s.303(2), s.317(2)", status: "Charge Sheeted", category: "Property", pendingDays: 69 },
    { district: "Thoubal", station: "Thoubal PS", firNo: "0012/2026", firDate: "06/01/2026", sections: "Arms Act 1959 s.25, BNS s.109", status: "Charge Sheeted", category: "Arms", pendingDays: 65 },
    { district: "Bishnupur", station: "Bishnupur PS", firNo: "0019/2026", firDate: "09/01/2026", sections: "BNS 2023 s.106(1)", status: "Final Report / ML", category: "Accident", pendingDays: 60 },
    { district: "Churachandpur", station: "Churachandpur PS", firNo: "0024/2026", firDate: "11/01/2026", sections: "BNS 2023 s.351(2), s.352", status: "Pending Investigation", category: "Misc", pendingDays: 57 },
    { district: "Kakching", station: "Kakching PS", firNo: "0031/2026", firDate: "14/01/2026", sections: "BNS 2023 s.318(4)", status: "Pending Investigation", category: "Cheating", pendingDays: 54 },
    { district: "Chandel", station: "Chandel PS", firNo: "0038/2026", firDate: "17/01/2026", sections: "BNS 2023 s.64, BNSS s.180", status: "Charge Sheeted", category: "Crime vs Women", pendingDays: 50 },
    { district: "Tengnoupal", station: "Moreh PS", firNo: "0044/2026", firDate: "19/01/2026", sections: "NDPS Act 1985 s.21, s.29", status: "Pending Investigation", category: "NDPS", pendingDays: 48 },
    { district: "Kangpokpi", station: "Kangpokpi PS", firNo: "0049/2026", firDate: "22/01/2026", sections: "BNS 2023 s.305", status: "Pending Investigation", category: "Property", pendingDays: 45 },
    { district: "Senapati", station: "Senapati PS", firNo: "0055/2026", firDate: "25/01/2026", sections: "BNS 2023 s.109, Arms Act s.25", status: "Charge Sheeted", category: "Arms", pendingDays: 41 },
    { district: "Tamenglong", station: "Tamenglong PS", firNo: "0061/2026", firDate: "28/01/2026", sections: "BNS 2023 s.303(2)", status: "Pending Investigation", category: "Property", pendingDays: 38 },
    { district: "Noney", station: "Noney PS", firNo: "0066/2026", firDate: "30/01/2026", sections: "BNS 2023 s.106(1)", status: "Final Report / ML", category: "Accident", pendingDays: 34 },
    { district: "Jiribam", station: "Jiribam PS", firNo: "0070/2026", firDate: "02/02/2026", sections: "BNS 2023 s.64, BNSS s.180", status: "Charge Sheeted", category: "Crime vs Women", pendingDays: 30 },
    { district: "Ukhrul", station: "Ukhrul PS", firNo: "0075/2026", firDate: "05/02/2026", sections: "BNS 2023 s.318(4)", status: "Pending Investigation", category: "Cheating", pendingDays: 26 }
  ],

  iifForms: [
    { code: "IIF-1", name: "First Information Report", count: 6142, health: "Complete" },
    { code: "IIF-2", name: "Crime Details Form", count: 6055, health: "Complete" },
    { code: "IIF-3", name: "Arrest / Court Surrender Memo", count: 3318, health: "Attention" },
    { code: "IIF-4", name: "Property Seizure Memo", count: 2810, health: "Complete" },
    { code: "IIF-5", name: "Property Search Memo", count: 1394, health: "Complete" },
    { code: "IIF-6", name: "Case Diary", count: 5820, health: "Attention" },
    { code: "IIF-7", name: "Final Report / Charge Sheet", count: 4412, health: "Complete" },
    { code: "IIF-8", name: "Missing / Unidentified Person", count: 1108, health: "Complete" },
    { code: "IIF-9", name: "Unidentified Dead Body", count: 279, health: "Complete" },
    { code: "IIF-10", name: "Post-Mortem Report", count: 268, health: "Attention" },
    { code: "IIF-11", name: "Accident Report", count: 1997, health: "Complete" },
    { code: "IIF-12", name: "Absconder / Proclaimed Offender", count: 482, health: "Complete" },
    { code: "IIF-13", name: "Court Disposal / Judgement", count: 3196, health: "Attention" },
    { code: "IIF-14", name: "Prisoner Details", count: 911, health: "Complete" },
    { code: "IIF-15", name: "Suspect / Accused Personal File", count: 4497, health: "Complete" },
    { code: "IIF-16", name: "Chargesheet Annexure", count: 4318, health: "Complete" },
    { code: "IIF-17", name: "Witness Statement (BNSS 180)", count: 5158, health: "Attention" },
    { code: "IIF-18", name: "Notice to Accused (BNSS 35)", count: 1904, health: "Complete" },
    { code: "IIF-19", name: "Forensic Requisition", count: 1512, health: "Attention" },
    { code: "IIF-20", name: "Forensic Result Receipt", count: 1196, health: "Weak" },
    { code: "IIF-21", name: "Videography / e-Sakshya Upload", count: 2337, health: "Weak" },
    { code: "IIF-22", name: "Zero FIR Transfer Record", count: 156, health: "Attention" },
    { code: "IIF-23", name: "e-Summons Service Record", count: 1478, health: "Complete" },
    { code: "IIF-24", name: "Malkhana Disposal Record", count: 817, health: "Attention" }
  ],

  officers: [
    { name: "Insp. R. K. Somorjit", station: "Lamphel PS", district: "Imphal West", assigned: 58, chargesheeted: 46, pending: 8, beyond90: 4, disposalPct: 87.6, qualityIndex: 78 },
    { name: "SI L. Ibemhal", station: "Porompat PS", district: "Imphal East", assigned: 49, chargesheeted: 35, pending: 10, beyond90: 4, disposalPct: 82.3, qualityIndex: 71 },
    { name: "Insp. N. Bijoykumar", station: "Thoubal PS", district: "Thoubal", assigned: 45, chargesheeted: 37, pending: 6, beyond90: 2, disposalPct: 90.2, qualityIndex: 81 },
    { name: "SI Th. Rajkumar", station: "Bishnupur PS", district: "Bishnupur", assigned: 40, chargesheeted: 24, pending: 13, beyond90: 3, disposalPct: 70.5, qualityIndex: 58 },
    { name: "SI K. Momon", station: "Churachandpur PS", district: "Churachandpur", assigned: 37, chargesheeted: 28, pending: 7, beyond90: 2, disposalPct: 85.1, qualityIndex: 75 },
    { name: "Insp. H. Dilip", station: "Kakching PS", district: "Kakching", assigned: 33, chargesheeted: 19, pending: 11, beyond90: 3, disposalPct: 68.4, qualityIndex: 54 },
    { name: "SI Y. Sanajaoba", station: "Chandel PS", district: "Chandel", assigned: 28, chargesheeted: 21, pending: 6, beyond90: 1, disposalPct: 84.0, qualityIndex: 74 },
    { name: "SI M. Priyoranjan", station: "Senapati PS", district: "Senapati", assigned: 25, chargesheeted: 16, pending: 7, beyond90: 2, disposalPct: 69.9, qualityIndex: 56 }
  ],

  icjsPillars: [
    { pillar: "Police (CCTNS)", exchange: "6,142 FIR pushed to ICJS", ackRate: "98.9%", health: "good" },
    { pillar: "Courts (eCourts)", exchange: "3,196 judgements consumed", ackRate: "95.7%", health: "good" },
    { pillar: "Prosecution (eProsecution)", exchange: "2,714 case files linked", ackRate: "90.4%", health: "good" },
    { pillar: "Prisons (ePrisons)", exchange: "911 custody records matched", ackRate: "86.9%", health: "watch" },
    { pillar: "Forensics (eForensics)", exchange: "1,512 requisitions, 1,196 results", ackRate: "77.5%", health: "watch" },
    { pillar: "e-Sakshya / videography", exchange: "2,337 uploads against 2,810 seizures", ackRate: "68.9%", health: "action" }
  ],

  cctvFeeds: [
    { station: "Lamphel PS", location: "Lock-up corridor", status: "up" },
    { station: "Lamphel PS", location: "Reception / GD", status: "up" },
    { station: "Porompat PS", location: "Malkhana entry", status: "up" },
    { station: "Thoubal PS", location: "Lock-up corridor", status: "down" },
    { station: "Bishnupur PS", location: "Front gate", status: "up" },
    { station: "Churachandpur PS", location: "Interview room", status: "up" },
    { station: "Kakching PS", location: "Malkhana entry", status: "down" },
    { station: "Chandel PS", location: "Reception / GD", status: "up" },
    { station: "Moreh PS", location: "Lock-up corridor", status: "up" },
    { station: "Senapati PS", location: "Front gate", status: "up" }
  ],

  dashboard: {
    kpis: [
      { label: "Cognizable cases (2026)", value: "6,142", delta: "24,860 since 2015", tone: "" },
      { label: "Investigation pending", value: "1,414", delta: "318 beyond 90 days", tone: "bad" },
      { label: "Charge sheeted", value: "4,412", delta: "71.8% disposal rate", tone: "good" },
      { label: "Zero FIR pending transfer", value: "19", delta: "of 156 registered", tone: "warn" },
      { label: "Arrest memo within 48 hrs", value: "85.1%", delta: "BNSS compliance", tone: "good" },
      { label: "e-Sakshya upload rate", value: "68.9%", delta: "target 95%", tone: "warn" }
    ],
    monthlyTrend: {
      labels: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
      registered: [980, 1040, 970, 1090, 1010, 690],
      chargesheeted: [700, 760, 705, 790, 730, 480]
    },
    ageing: {
      labels: ["Under 30 days", "30-60 days", "60-90 days", "Beyond 90 days"],
      values: [612, 331, 153, 318]
    },
    malkhana: { label: "Property seized 51,340 - acceptance pending 21,190", percent: 59 },
    missingPersons: { label: "Registered 2,914 - traced 2,196", percent: 75 },
    citizenService: { label: "Received 74,120 - closed 64,890", percent: 88 }
  },

  analytics: {
    yearlyTrendByCategory: {
      labels: ["2021", "2022", "2023", "2024", "2025", "2026"],
      series: [
        { label: "Property", color: "#0b3c7e", data: [1420, 1510, 1640, 1590, 1710, 1220] },
        { label: "Crime against women", color: "#c0392b", data: [640, 670, 720, 745, 775, 545] },
        { label: "NDPS", color: "#138808", data: [520, 610, 705, 780, 860, 615] },
        { label: "Cyber", color: "#ff9933", data: [180, 240, 340, 460, 605, 510] }
      ]
    },
    timeOfDay: { labels: ["00", "03", "06", "09", "12", "15", "18", "21"], values: [64, 39, 47, 118, 168, 201, 272, 189] },
    categoryShare: {
      labels: ["Property", "Body", "Women", "NDPS", "Cyber", "Misc"],
      values: [1220, 812, 545, 420, 510, 615],
      colors: ["#0b3c7e", "#16549b", "#c0392b", "#138808", "#ff9933", "#0e7c86"]
    },
    districtHotspots: {
      labels: ["Imphal West", "Imphal East", "Thoubal", "Bishnupur", "Churachandpur", "Kakching"],
      values: [918, 822, 647, 599, 513, 467]
    }
  },

  ncl: {
    kpis: [
      { label: "FIR under BNS (share)", value: "99.2%", delta: "legacy IPC cases 0.8%", tone: "good" },
      { label: "e-Sakshya videography", value: "68.9%", delta: "BSA s.63 - target 95%", tone: "warn" },
      { label: "Charge sheet within 90 days", value: "80.6%", delta: "BNSS s.193(3)", tone: "good" },
      { label: "Forensic visit - 7 yr+ offences", value: "74.3%", delta: "BNSS s.176(3) mandatory", tone: "warn" },
      { label: "Zero FIR transferred in 24 hrs", value: "85.9%", delta: "BNSS s.173(1)", tone: "good" },
      { label: "e-Summons served electronically", value: "59.7%", delta: "BNSS s.63-64", tone: "bad" }
    ],
    complianceByDistrict: {
      labels: ["Imphal West", "Imphal East", "Thoubal", "Bishnupur", "Churachandpur", "Kangpokpi"],
      series: [
        { label: "e-Sakshya", color: "#16549b", data: [79, 72, 67, 63, 55, 69] },
        { label: "Forensic visit", color: "#138808", data: [86, 78, 74, 68, 60, 76] },
        { label: "e-Summons", color: "#ff9933", data: [68, 61, 55, 52, 46, 58] }
      ]
    },
    timelineTrend: {
      labels: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
      series: [
        { label: "Charge sheet <= 90 days", color: "#138808", data: [72, 75, 77, 79, 80, 80] },
        { label: "Zero FIR <= 24 hrs", color: "#0b3c7e", data: [78, 80, 83, 84, 86, 86] },
        { label: "Case diary same day", color: "#ff9933", data: [60, 63, 66, 68, 71, 73] }
      ]
    }
  },

  quality: {
    kpis: [
      { label: "Composite quality index", value: "83.9", delta: "state average, out of 100", tone: "good" },
      { label: "Mandatory field completeness", value: "92.4%", delta: "across IIF-1 to IIF-24", tone: "good" },
      { label: "Entered within 24 hrs", value: "77.0%", delta: "FIR to CCTNS entry lag", tone: "warn" },
      { label: "Duplicate / conflicting records", value: "186", delta: "pending reconciliation", tone: "bad" },
      { label: "ICJS push failures", value: "97", delta: "unacknowledged beyond 48 hrs", tone: "warn" },
      { label: "Accused without biometric link", value: "462", delta: "NAFIS mapping gap", tone: "bad" }
    ],
    dimensions: {
      labels: ["Completeness", "Accuracy", "Timeliness", "Consistency", "Uniqueness", "Integration"],
      state: [92, 85, 77, 80, 83, 79],
      target: [98, 95, 95, 95, 99, 98]
    },
    weakestForms: [
      { form: "IIF-20 Forensic result receipt", percent: 63 },
      { form: "IIF-21 e-Sakshya upload", percent: 69 },
      { form: "IIF-24 Malkhana disposal", percent: 76 },
      { form: "IIF-13 Court disposal", percent: 81 },
      { form: "IIF-6 Case diary", percent: 85 }
    ],
    exceptions: [
      { exception: "Section of law not mapped to BNS", form: "IIF-2", district: "Ukhrul", station: "Multiple", count: 58, ageing: "14 days", owner: "DCRB Ukhrul" },
      { exception: "Arrest memo without witness details", form: "IIF-3", district: "Chandel", station: "Chandel PS", count: 41, ageing: "9 days", owner: "SDPO Chandel" },
      { exception: "Seizure without e-Sakshya reference", form: "IIF-21", district: "Thoubal", station: "Thoubal PS", count: 33, ageing: "21 days", owner: "IIC Thoubal" },
      { exception: "Duplicate accused identity", form: "IIF-15", district: "Imphal East", station: "Porompat PS", count: 27, ageing: "6 days", owner: "DCRB Imphal East" },
      { exception: "ICJS acknowledgement not received", form: "IIF-7", district: "Senapati", station: "Senapati PS", count: 19, ageing: "3 days", owner: "SCRB integration cell" }
    ]
  },

  projects: {
    alignedProjects: [
      { project: "Safe City / ICSS surveillance", coverage: "184 of 220 sites live", status: "good" },
      { project: "Dial 112 ERSS", coverage: "All 16 districts", status: "good" },
      { project: "NAFIS biometric linkage", coverage: "74% accused mapped", status: "watch" },
      { project: "e-Sakshya rollout", coverage: "62 of 92 PS", status: "watch" },
      { project: "State forensic lab digitisation", coverage: "2 of 4 labs integrated", status: "action" }
    ],
    pillarAckTrend: {
      labels: ["Apr", "May", "Jun", "Jul", "Aug", "Sep"],
      series: [
        { label: "Courts", color: "#0b3c7e", data: [91, 92, 93, 95, 95, 96] },
        { label: "Prisons", color: "#16549b", data: [81, 82, 83, 85, 86, 87] },
        { label: "Forensics", color: "#ff9933", data: [68, 70, 72, 75, 76, 78] },
        { label: "e-Sakshya", color: "#c0392b", data: [48, 53, 58, 62, 66, 69] }
      ]
    }
  }
};
