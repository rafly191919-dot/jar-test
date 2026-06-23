const form = document.getElementById("dosingForm");
const resetBtn = document.getElementById("resetBtn");
const sampleBtn = document.getElementById("sampleBtn");

const phBeforeInput = document.getElementById("phBefore");
const turbidityInput = document.getElementById("turbidity");
const alkalinityInput = document.getElementById("alkalinity");
const phTargetInput = document.getElementById("phTarget");

const mainStatus = document.getElementById("mainStatus");
const mainStatusText = document.getElementById("mainStatusText");
const statusBadge = document.getElementById("statusBadge");

const alumDose = document.getElementById("alumDose");
const sodaDose = document.getElementById("sodaDose");
const polymerDose = document.getElementById("polymerDose");
const alumStatus = document.getElementById("alumStatus");
const sodaStatus = document.getElementById("sodaStatus");
const polymerStatus = document.getElementById("polymerStatus");

const phAfterEl = document.getElementById("phAfter");
const turbAfterEl = document.getElementById("turbAfter");
const phBar = document.getElementById("phBar");
const turbBar = document.getElementById("turbBar");

const rapidMix = document.getElementById("rapidMix");
const rapidTime = document.getElementById("rapidTime");
const sodaMix = document.getElementById("sodaMix");
const sodaTime = document.getElementById("sodaTime");
const slowMix = document.getElementById("slowMix");
const slowTime = document.getElementById("slowTime");
const settlingTime = document.getElementById("settlingTime");
const settlingNote = document.getElementById("settlingNote");

const warnings = document.getElementById("warnings");
const operatorActions = document.getElementById("operatorActions");
const calculationTable = document.getElementById("calculationTable");

const model = {
  phOptimum: 6.85,
  phMin: 6.5,
  phMax: 7.2,
  turbidityTarget: 4,
  alum: {
    intercept: 1.0724,
    turbidity: 0.1059,
    phError: 0.4241,
    alkalinity: -0.0109
  },
  soda: {
    intercept: -0.0436,
    phGap: 2.5247,
    alkalinity: -0.0135,
    alum: 0.1710
  },
  polymer: {
    intercept: 0.2734,
    turbidity: 0.0103,
    alum: 0.0735,
    alkalinity: -0.0027
  },
  limit: {
    alumMin: 0,
    alumMax: 14,
    sodaMin: 0,
    sodaMax: 12,
    polymerMin: 0,
    polymerMax: 4
  }
};

function n(input, fallback = 0) {
  const value = parseFloat(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function round(value, digits = 2) {
  return Number(value).toFixed(digits);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function calculateDosing(data) {
  const phError = Math.abs(data.ph - model.phOptimum);
  const phGap = Math.max(data.phTarget - data.ph, 0);

  const alumRaw =
    model.alum.intercept +
    model.alum.turbidity * data.turbidity +
    model.alum.phError * phError +
    model.alum.alkalinity * data.alkalinity;

  const alum = clamp(alumRaw, model.limit.alumMin, model.limit.alumMax);

  const sodaRaw =
    model.soda.intercept +
    model.soda.phGap * phGap +
    model.soda.alkalinity * data.alkalinity +
    model.soda.alum * alum;

  const soda = clamp(sodaRaw, model.limit.sodaMin, model.limit.sodaMax);

  const polymerRaw =
    model.polymer.intercept +
    model.polymer.turbidity * data.turbidity +
    model.polymer.alum * alum +
    model.polymer.alkalinity * data.alkalinity;

  const polymer = clamp(polymerRaw, model.limit.polymerMin, model.limit.polymerMax);

  const phAfter = clamp(
    data.ph + 0.31 * soda - 0.052 * alum + 0.0022 * data.alkalinity,
    4,
    9
  );

  const turbidityAfter = Math.max(
    data.turbidity - 2.15 * alum - 1.20 * polymer + 0.018 * Math.max(30 - data.alkalinity, 0),
    0.2
  );

  return {
    phError,
    phGap,
    alumRaw,
    alum,
    sodaRaw,
    soda,
    polymerRaw,
    polymer,
    phAfter,
    turbidityAfter
  };
}

function classifyTurbidity(turbidity) {
  if (turbidity < 20) return "rendah";
  if (turbidity < 60) return "sedang";
  if (turbidity < 100) return "tinggi";
  return "ekstrem";
}

function classifyPh(ph) {
  if (ph < 5.5) return "sangat rendah";
  if (ph < 6.5) return "rendah";
  if (ph <= 7.2) return "ideal";
  return "tinggi";
}

function classifyAlkalinity(alkalinity) {
  if (alkalinity < 20) return "sangat rendah";
  if (alkalinity < 40) return "rendah-sedang";
  if (alkalinity <= 80) return "cukup";
  return "tinggi";
}

function getProcessRecommendation(data) {
  const category = classifyTurbidity(data.turbidity);

  let rec;
  if (category === "rendah") {
    rec = {
      rapidMix: "100–130 rpm",
      rapidTime: "1–2 menit",
      sodaMix: "80–110 rpm",
      sodaTime: "1–2 menit",
      slowMix: "20–35 rpm",
      slowTime: "10–15 menit",
      settling: "15–20 menit",
      note: "Kondisi relatif ringan"
    };
  } else if (category === "sedang") {
    rec = {
      rapidMix: "130–160 rpm",
      rapidTime: "±2 menit",
      sodaMix: "90–120 rpm",
      sodaTime: "1–2 menit",
      slowMix: "30–45 rpm",
      slowTime: "15–20 menit",
      settling: "20–25 menit",
      note: "Kondisi operasi normal"
    };
  } else if (category === "tinggi") {
    rec = {
      rapidMix: "160–190 rpm",
      rapidTime: "2–3 menit",
      sodaMix: "100–130 rpm",
      sodaTime: "2–3 menit",
      slowMix: "40–55 rpm",
      slowTime: "20–25 menit",
      settling: "25–35 menit",
      note: "Perlu settling lebih lama"
    };
  } else {
    rec = {
      rapidMix: "180–200 rpm",
      rapidTime: "±3 menit",
      sodaMix: "110–140 rpm",
      sodaTime: "2–3 menit",
      slowMix: "45–60 rpm",
      slowTime: "20–25 menit",
      settling: "35–45 menit",
      note: "Wajib jar test"
    };
  }

  if (data.ph < 5.5 || data.alkalinity < 20) {
    rec.sodaMix = "100–140 rpm";
    rec.sodaTime = "2–3 menit";
    rec.note = rec.note + " + kontrol pH ketat";
  }

  return rec;
}

function getDoseStatus(value, max, type) {
  const ratio = value / max;
  if (value <= 0.05) return "Minimum / nol";
  if (ratio < 0.35) return type === "soda" ? "Rendah / koreksi kecil" : "Rendah";
  if (ratio < 0.75) return "Normal";
  if (ratio < 0.92) return "Tinggi";
  return "Mendekati batas atas";
}

function setOverallStatus(kind, title, text, badge) {
  mainStatus.textContent = title;
  mainStatusText.textContent = text;
  statusBadge.className = `status ${kind}`;
  statusBadge.textContent = badge;
}

function buildWarnings(data, result) {
  const list = [];
  const turbidityClass = classifyTurbidity(data.turbidity);
  const phClass = classifyPh(data.ph);
  const alkalinityClass = classifyAlkalinity(data.alkalinity);

  if (data.ph < 5.5) {
    list.push("pH before sangat rendah. Risiko pH drop setelah Alum tinggi. Prioritaskan kontrol Soda Ash.");
  } else if (data.ph < 6.5) {
    list.push("pH before di bawah target. Soda Ash diperlukan agar pH after masuk 6,50–7,20.");
  } else if (data.ph > 7.2) {
    list.push("pH before sudah tinggi. Hindari overdosing Soda Ash.");
  }

  if (data.alkalinity < 20) {
    list.push("Alkalinity sangat rendah. Buffer pH lemah, Alum bisa membuat pH turun cepat.");
  } else if (data.alkalinity < 40) {
    list.push("Alkalinity rendah-sedang. Pantau pH after karena buffer masih terbatas.");
  } else if (data.alkalinity > 80) {
    list.push("Alkalinity tinggi. Soda Ash bisa lebih rendah dan pH after harus dipantau agar tidak melewati target.");
  }

  if (data.turbidity > 100) {
    list.push("Turbidity ekstrem. Model hanya estimasi awal; wajib jar test sebelum diterapkan.");
  } else if (data.turbidity > 60) {
    list.push("Turbidity tinggi. Alum harus cukup, settling diperpanjang, dan Polymer hanya dikoreksi sedikit setelah flok terbentuk.");
  }

  if (result.phAfter < model.phMin) {
    list.push("Prediksi pH after di bawah 6,50. Soda Ash kemungkinan kurang, Alum terlalu tinggi, atau alkalinity terlalu rendah.");
  }

  if (result.phAfter > model.phMax) {
    list.push("Prediksi pH after di atas 7,20. Soda Ash kemungkinan berlebih.");
  }

  if (result.turbidityAfter >= model.turbidityTarget) {
    list.push("Prediksi turbidity after masih di atas 4 NTU. Evaluasi Alum, Polymer, pH, mixing, dan settling.");
  }

  if (result.polymer >= model.limit.polymerMax * 0.85) {
    list.push("Polymer mendekati batas atas. Hati-hati overdosing: flok licin, pecah, sludge lengket, atau settling buruk.");
  }

  if (result.alum >= model.limit.alumMax * 0.9) {
    list.push("Alum mendekati batas atas. Pastikan pH after tidak turun dan alkalinity masih cukup.");
  }

  if (list.length === 0) {
    list.push(`Kualitas before berada pada kategori turbidity ${turbidityClass}, pH ${phClass}, alkalinity ${alkalinityClass}. Tidak ada warning besar.`);
  }

  return list;
}

function buildActions(data, result, rec) {
  const actions = [];

  if (result.phAfter < model.phMin) {
    actions.push("Koreksi Soda Ash secara bertahap sebelum menaikkan Alum atau Polymer.");
  }

  if (result.phAfter > model.phMax) {
    actions.push("Turunkan atau minimalkan Soda Ash, lalu cek ulang pH after.");
  }

  if (result.turbidityAfter >= model.turbidityTarget && result.phAfter >= model.phMin && result.phAfter <= model.phMax) {
    actions.push("pH sudah mendukung. Evaluasi kecukupan Alum, lalu koreksi Polymer sedikit jika flok kecil.");
  }

  if (result.turbidityAfter >= model.turbidityTarget && result.phAfter < model.phMin) {
    actions.push("Jangan fokus ke Polymer dulu. Stabilkan pH ke 6,50–7,20, lalu evaluasi koagulasi.");
  }

  if (data.turbidity > 60) {
    actions.push(`Gunakan rapid mix ${rec.rapidMix} selama ${rec.rapidTime}, lalu slow mix ${rec.slowMix} selama ${rec.slowTime}.`);
  }

  if (data.alkalinity < 20) {
    actions.push("Cek pH after setelah Alum karena alkalinity rendah membuat pH mudah drop.");
  }

  if (result.polymer >= model.limit.polymerMax * 0.85) {
    actions.push("Amati flok visual. Jika flok licin, pecah, atau mengambang, turunkan Polymer.");
  }

  if (data.turbidity > 100 || result.alum === model.limit.alumMax || result.soda === model.limit.sodaMax || result.polymer === model.limit.polymerMax) {
    actions.push("Lakukan jar test karena kualitas air atau dosis berada dekat/di luar range model.");
  }

  if (actions.length === 0) {
    actions.push("Pertahankan dosis simulasi sebagai estimasi awal dan catat hasil pH after serta turbidity after sebagai data kalibrasi.");
    actions.push(`Lakukan settling ${rec.settling}, lalu cek turbidity after. Target < 4 NTU.`);
  }

  return actions;
}

function renderList(element, items) {
  element.className = "message-list muted-message";
  element.innerHTML = `<ul>${items.map(item => `<li>${item}</li>`).join("")}</ul>`;
}

function updateProcess(rec) {
  rapidMix.textContent = rec.rapidMix;
  rapidTime.textContent = rec.rapidTime;
  sodaMix.textContent = rec.sodaMix;
  sodaTime.textContent = rec.sodaTime;
  slowMix.textContent = rec.slowMix;
  slowTime.textContent = rec.slowTime;
  settlingTime.textContent = rec.settling;
  settlingNote.textContent = rec.note;
}

function updateBars(result) {
  const phPercent = clamp(((result.phAfter - 4) / 5) * 100, 0, 100);
  const turbPercent = clamp((1 - result.turbidityAfter / 25) * 100, 0, 100);

  phBar.style.width = `${phPercent}%`;
  turbBar.style.width = `${turbPercent}%`;

  phBar.style.background = result.phAfter >= model.phMin && result.phAfter <= model.phMax ? "#22c55e" : "#f59e0b";
  turbBar.style.background = result.turbidityAfter < model.turbidityTarget ? "#22c55e" : "#ef4444";
}

function updateOverallStatus(data, result) {
  const atTarget = result.phAfter >= model.phMin && result.phAfter <= model.phMax && result.turbidityAfter < model.turbidityTarget;
  const highRisk = data.turbidity > 100 || data.ph < 5.5 || data.alkalinity < 20;
  const atLimit = result.alum === model.limit.alumMax || result.soda === model.limit.sodaMax || result.polymer === model.limit.polymerMax;

  if (atLimit || data.turbidity > 100) {
    setOverallStatus("bad", "Wajib evaluasi / jar test", "Ada kualitas air ekstrem atau dosis menyentuh batas model.", "Risiko tinggi");
  } else if (atTarget && !highRisk) {
    setOverallStatus("good", "Target tercapai", "Prediksi pH after dan turbidity after berada dalam target operasi.", "Aman");
  } else if (highRisk) {
    setOverallStatus("bad", "Risiko kimia tinggi", "pH, alkalinity, atau turbidity menunjukkan kondisi sensitif. Validasi lapangan diperlukan.", "Waspada");
  } else {
    setOverallStatus("warn", "Perlu evaluasi", "Ada parameter after yang belum ideal atau perlu penyesuaian proses.", "Evaluasi");
  }
}

function renderCalculationTable(data, result) {
  calculationTable.innerHTML = `
    <tr>
      <td>Kategori Turbidity</td>
      <td>${classifyTurbidity(data.turbidity)}</td>
      <td>Menentukan intensitas rapid mix, slow mix, dan settling.</td>
    </tr>
    <tr>
      <td>Kategori pH</td>
      <td>${classifyPh(data.ph)}</td>
      <td>Menentukan kebutuhan Soda Ash dan risiko pH drop.</td>
    </tr>
    <tr>
      <td>Kategori Alkalinity</td>
      <td>${classifyAlkalinity(data.alkalinity)}</td>
      <td>Menilai kekuatan buffer pH saat Alum ditambahkan.</td>
    </tr>
    <tr>
      <td>pH Error</td>
      <td>${round(result.phError)}</td>
      <td>ABS(pH before - 6,85), dipakai untuk koreksi Alum.</td>
    </tr>
    <tr>
      <td>pH Gap</td>
      <td>${round(result.phGap)}</td>
      <td>MAX(pH target - pH before, 0), dipakai untuk Soda Ash.</td>
    </tr>
    <tr>
      <td>Alum Raw</td>
      <td>${round(result.alumRaw)} mL</td>
      <td>Hasil regresi sebelum dibatasi range model.</td>
    </tr>
    <tr>
      <td>Soda Ash Raw</td>
      <td>${round(result.sodaRaw)} mL</td>
      <td>Dipengaruhi pH gap, alkalinity, dan Alum.</td>
    </tr>
    <tr>
      <td>Polymer Raw</td>
      <td>${round(result.polymerRaw)} mL</td>
      <td>Dipengaruhi turbidity, Alum, dan alkalinity.</td>
    </tr>
  `;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = {
    ph: n(phBeforeInput),
    turbidity: n(turbidityInput),
    alkalinity: n(alkalinityInput),
    phTarget: n(phTargetInput, 6.85)
  };

  const result = calculateDosing(data);
  const rec = getProcessRecommendation(data);
  const warningList = buildWarnings(data, result);
  const actionList = buildActions(data, result, rec);

  alumDose.textContent = round(result.alum);
  sodaDose.textContent = round(result.soda);
  polymerDose.textContent = round(result.polymer);

  alumStatus.textContent = getDoseStatus(result.alum, model.limit.alumMax, "alum");
  sodaStatus.textContent = getDoseStatus(result.soda, model.limit.sodaMax, "soda");
  polymerStatus.textContent = getDoseStatus(result.polymer, model.limit.polymerMax, "polymer");

  phAfterEl.textContent = round(result.phAfter);
  turbAfterEl.textContent = `${round(result.turbidityAfter)} NTU`;

  updateBars(result);
  updateProcess(rec);
  updateOverallStatus(data, result);
  renderList(warnings, warningList);
  renderList(operatorActions, actionList);
  renderCalculationTable(data, result);
});

resetBtn.addEventListener("click", () => {
  form.reset();
  phTargetInput.value = "6.85";

  mainStatus.textContent = "Belum dihitung";
  mainStatusText.textContent = "Masukkan data kualitas air before untuk menjalankan simulasi.";
  statusBadge.className = "status neutral";
  statusBadge.textContent = "Standby";

  alumDose.textContent = "-";
  sodaDose.textContent = "-";
  polymerDose.textContent = "-";
  alumStatus.textContent = "Belum dihitung";
  sodaStatus.textContent = "Belum dihitung";
  polymerStatus.textContent = "Belum dihitung";

  phAfterEl.textContent = "-";
  turbAfterEl.textContent = "-";
  phBar.style.width = "0%";
  turbBar.style.width = "0%";

  rapidMix.textContent = "-";
  rapidTime.textContent = "-";
  sodaMix.textContent = "-";
  sodaTime.textContent = "-";
  slowMix.textContent = "-";
  slowTime.textContent = "-";
  settlingTime.textContent = "-";
  settlingNote.textContent = "-";

  warnings.className = "message-list muted-message";
  warnings.textContent = "Belum ada warning. Jalankan simulasi terlebih dahulu.";

  operatorActions.className = "message-list muted-message";
  operatorActions.textContent = "Arahan operator akan muncul setelah simulasi.";

  calculationTable.innerHTML = `<tr><td colspan="3">Belum ada perhitungan.</td></tr>`;
});

sampleBtn.addEventListener("click", () => {
  phBeforeInput.value = "5.85";
  turbidityInput.value = "68";
  alkalinityInput.value = "32";
  phTargetInput.value = "6.85";
});
