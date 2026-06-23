const form=document.getElementById("dosingForm");
const resetBtn=document.getElementById("resetBtn");
const sampleBtn=document.getElementById("sampleBtn");

const phBeforeInput=document.getElementById("phBefore");
const turbidityInput=document.getElementById("turbidity");
const alkalinityInput=document.getElementById("alkalinity");
const phTargetInput=document.getElementById("phTarget");
const turbTargetInput=document.getElementById("turbTarget");
const sampleVolumeInput=document.getElementById("sampleVolume");
const alumStockInput=document.getElementById("alumStock");
const sodaStockInput=document.getElementById("sodaStock");
const polymerStockInput=document.getElementById("polymerStock");
const operationModeInput=document.getElementById("operationMode");

const mainStatus=document.getElementById("mainStatus");
const mainStatusText=document.getElementById("mainStatusText");
const statusBadge=document.getElementById("statusBadge");

const alumMl=document.getElementById("alumMl");
const sodaMl=document.getElementById("sodaMl");
const polymerMl=document.getElementById("polymerMl");
const alumPpm=document.getElementById("alumPpm");
const sodaPpm=document.getElementById("sodaPpm");
const polymerPpm=document.getElementById("polymerPpm");

const phAfterEl=document.getElementById("phAfter");
const turbAfterEl=document.getElementById("turbAfter");
const flocScoreEl=document.getElementById("flocScore");
const flocText=document.getElementById("flocText");
const phBar=document.getElementById("phBar");
const turbBar=document.getElementById("turbBar");
const flocBar=document.getElementById("flocBar");
const turbTargetLabel=document.getElementById("turbTargetLabel");

const goalFloc=document.getElementById("goalFloc");
const goalFlocText=document.getElementById("goalFlocText");
const goalPh=document.getElementById("goalPh");
const goalPhText=document.getElementById("goalPhText");
const goalTurb=document.getElementById("goalTurb");
const goalTurbText=document.getElementById("goalTurbText");

const rapidMix=document.getElementById("rapidMix");
const rapidTime=document.getElementById("rapidTime");
const sodaMix=document.getElementById("sodaMix");
const sodaTime=document.getElementById("sodaTime");
const slowMix=document.getElementById("slowMix");
const slowTime=document.getElementById("slowTime");
const settlingTime=document.getElementById("settlingTime");
const settlingNote=document.getElementById("settlingNote");

const warnings=document.getElementById("warnings");
const operatorActions=document.getElementById("operatorActions");
const calculationTable=document.getElementById("calculationTable");

const model={
  phMin:6.5,
  phMax:7.2,
  phOptimum:6.85,
  ppmLimit:{
    alumMin:0,
    alumMax:75,
    sodaMin:0,
    sodaMax:45,
    polymerMin:0,
    polymerMax:1.8
  }
};

function n(input,fallback=0){const value=parseFloat(input.value);return Number.isFinite(value)?value:fallback}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function round(v,d=2){return Number(v).toFixed(d)}
function toMl(ppm, sampleMl, stockPpm){return ppm*sampleMl/stockPpm}

function modeFactor(mode){
  if(mode==="turbidity") return {alum:1.10,soda:1.00,polymer:1.12};
  if(mode==="ph") return {alum:0.95,soda:1.12,polymer:0.95};
  if(mode==="conservative") return {alum:0.90,soda:0.95,polymer:0.85};
  return {alum:1.00,soda:1.00,polymer:1.00};
}

function calculate(data){
  const factor=modeFactor(data.mode);
  const phError=Math.abs(data.ph-model.phOptimum);
  const phGap=Math.max(data.phTarget-data.ph,0);
  const turbidityGap=Math.max(data.turbidity-data.turbTarget,0);

  // Alum mengejar beban turbidity, tetapi tetap dikoreksi oleh pH dan alkalinity.
  const alumRaw=(8 + 0.42*turbidityGap + 2.0*phError - 0.045*data.alkalinity)*factor.alum;
  const alum=clamp(alumRaw,model.ppmLimit.alumMin,model.ppmLimit.alumMax);

  // Estimasi gap yang masih tersisa setelah koagulasi Alum.
  const expectedRemovalByAlum=1.55*alum;
  const residualGap=Math.max(turbidityGap-expectedRemovalByAlum,0);

  // Soda Ash mengejar target pH dan mengimbangi efek Alum.
  const sodaRaw=(4 + 12*phGap - 0.05*data.alkalinity + 0.18*alum)*factor.soda;
  const soda=clamp(sodaRaw,model.ppmLimit.sodaMin,model.ppmLimit.sodaMax);

  // Polymer ppm kecil karena larutan stok 100 ppm. Fungsi utamanya memperkuat flok, bukan menggantikan Alum.
  const polymerRaw=(0.05 + 0.010*turbidityGap + 0.012*alum + 0.020*residualGap - 0.0008*data.alkalinity)*factor.polymer;
  const polymer=clamp(polymerRaw,model.ppmLimit.polymerMin,model.ppmLimit.polymerMax);

  // Prediksi after. Ini model simulasi proses, bukan pengganti jar test.
  const phAfter=clamp(data.ph + 0.055*soda - 0.020*alum + 0.0015*data.alkalinity,4,9);
  const lowBufferPenalty=0.020*Math.max(30-data.alkalinity,0);
  const turbidityAfter=Math.max(data.turbidity - 1.45*alum - 13.0*polymer + lowBufferPenalty,0.2);

  // Skor flok: optimum jika Alum cukup, Polymer cukup namun tidak berlebih, pH after masuk range, dan alkalinity tidak terlalu rendah.
  const alumAdequacy=clamp(alum/Math.max(0.35*turbidityGap+8,1),0,1.15);
  const polymerAdequacy=clamp(polymer/Math.max(0.010*turbidityGap+0.25,0.15),0,1.25);
  const phScore=(phAfter>=model.phMin&&phAfter<=model.phMax)?1:clamp(1-Math.min(Math.abs(phAfter-model.phOptimum)/1.2,1),0,1);
  const alkScore=clamp(data.alkalinity/40,0,1);
  const overPolymerPenalty=polymer>1.35?Math.min((polymer-1.35)/0.45,1)*0.30:0;
  const flocScore=clamp((0.34*alumAdequacy+0.28*polymerAdequacy+0.26*phScore+0.12*alkScore-overPolymerPenalty)*100,0,100);

  return {phError,phGap,turbidityGap,alumRaw,alum,expectedRemovalByAlum,residualGap,sodaRaw,soda,polymerRaw,polymer,phAfter,turbidityAfter,flocScore}
}

function classifyGap(gap){if(gap<16)return"rendah";if(gap<56)return"sedang";if(gap<96)return"tinggi";return"ekstrem"}
function classifyFloc(score){if(score>=82)return"Optimal";if(score>=65)return"Cukup";if(score>=45)return"Kurang stabil";return"Tidak optimal"}

function getProcess(data,result){
  const cat=classifyGap(result.turbidityGap);
  let rec;
  if(cat==="rendah") rec={rapidMix:"100–130 rpm",rapidTime:"1–2 menit",sodaMix:"80–110 rpm",sodaTime:"1–2 menit",slowMix:"20–35 rpm",slowTime:"10–15 menit",settling:"15–20 menit",note:"Beban turbidity rendah"};
  else if(cat==="sedang") rec={rapidMix:"130–160 rpm",rapidTime:"±2 menit",sodaMix:"90–120 rpm",sodaTime:"1–2 menit",slowMix:"30–45 rpm",slowTime:"15–20 menit",settling:"20–25 menit",note:"Beban turbidity sedang"};
  else if(cat==="tinggi") rec={rapidMix:"160–190 rpm",rapidTime:"2–3 menit",sodaMix:"100–130 rpm",sodaTime:"2–3 menit",slowMix:"40–55 rpm",slowTime:"20–25 menit",settling:"25–35 menit",note:"Beban turbidity tinggi"};
  else rec={rapidMix:"180–200 rpm",rapidTime:"±3 menit",sodaMix:"110–140 rpm",sodaTime:"2–3 menit",slowMix:"45–60 rpm",slowTime:"25 menit",settling:"35–45 menit",note:"Beban ekstrem, wajib jar test"};

  if(data.alkalinity<20||data.ph<5.5){rec.sodaMix="100–140 rpm";rec.sodaTime="2–3 menit";rec.note+=" + kontrol pH ketat"}
  if(result.flocScore<65){rec.note+=" + evaluasi flok visual"}
  return rec
}

function setOverall(kind,title,text,badge){
  mainStatus.textContent=title;
  mainStatusText.textContent=text;
  statusBadge.className=`status ${kind}`;
  statusBadge.textContent=badge;
}

function renderList(el,items){
  el.className="message-list muted-message";
  el.innerHTML=`<ul>${items.map(x=>`<li>${x}</li>`).join("")}</ul>`;
}

function buildWarnings(data,result){
  const list=[];
  if(result.turbidityGap<=0) list.push("Turbidity before sudah di bawah/sama dengan target. Dosis Alum dan Polymer harus rendah agar tidak overdosing.");
  if(result.turbidityGap>96) list.push("Turbidity gap ekstrem. Formula hanya estimasi awal; wajib jar test.");
  else if(result.turbidityGap>56) list.push("Turbidity gap tinggi. Alum menjadi chemical utama, settling harus diperpanjang.");
  if(data.ph<5.5) list.push("pH before sangat rendah. Risiko pH drop tinggi setelah Alum; Soda Ash harus dikawal.");
  else if(data.ph<6.5) list.push("pH before di bawah target. Soda Ash diperlukan untuk membawa pH after ke 6,50–7,20.");
  if(data.ph>7.2) list.push("pH before sudah tinggi. Hindari Soda Ash berlebih.");
  if(data.alkalinity<20) list.push("Alkalinity sangat rendah. Buffer pH lemah, pH mudah drop saat Alum ditambahkan.");
  else if(data.alkalinity<40) list.push("Alkalinity rendah-sedang. Pantau pH after karena buffer masih terbatas.");
  if(result.phAfter<model.phMin) list.push("Prediksi pH after belum memenuhi syarat bawah. Koreksi Soda Ash sebelum menaikkan Polymer.");
  if(result.phAfter>model.phMax) list.push("Prediksi pH after melebihi target atas. Soda Ash berpotensi berlebih.");
  if(result.turbidityAfter>data.turbTarget) list.push("Prediksi turbidity after belum memenuhi target. Evaluasi kecukupan Alum, kondisi flok, Polymer, dan settling.");
  if(result.polymer>1.35) list.push("Polymer ppm tinggi. Hati-hati overdosing: flok licin, flok pecah, sludge lengket, settling buruk.");
  if(result.flocScore<65) list.push("Skor flok belum optimal. Cek pH, kecukupan Alum, dosis Polymer, RPM slow mix, dan waktu settling.");
  if(list.length===0) list.push("Tidak ada warning besar. Tetap lakukan validasi dengan pH after, turbidity after, dan observasi flok aktual.");
  return list
}

function buildActions(data,result,rec){
  const actions=[];
  const phOk=result.phAfter>=model.phMin&&result.phAfter<=model.phMax;
  const turbOk=result.turbidityAfter<=data.turbTarget;
  const flocOk=result.flocScore>=82;

  if(!phOk && result.phAfter<model.phMin) actions.push("Fokus pertama: naikkan Soda Ash bertahap sampai pH after masuk 6,50–7,20.");
  if(!phOk && result.phAfter>model.phMax) actions.push("Kurangi Soda Ash. Jangan mengejar pH terlalu tinggi karena koagulasi bisa tidak optimum.");
  if(phOk && !turbOk) actions.push("pH sudah mendukung. Fokus kedua: evaluasi Alum, Polymer kecil bertahap, slow mix, dan settling.");
  if(!flocOk && phOk) actions.push("Jika flok kecil/halus, Polymer dapat dinaikkan sedikit. Jika flok licin/pecah/mengambang, Polymer harus diturunkan.");
  if(data.alkalinity<20) actions.push("Karena alkalinity rendah, cek pH after segera setelah Alum. Jangan menambah Alum agresif tanpa kontrol pH.");
  if(result.turbidityGap>56) actions.push(`Gunakan rapid mix ${rec.rapidMix} selama ${rec.rapidTime}, slow mix ${rec.slowMix} selama ${rec.slowTime}, dan settling ${rec.settling}.`);
  if(result.turbidityGap>96 || result.alum>=model.ppmLimit.alumMax || result.polymer>=model.ppmLimit.polymerMax) actions.push("Lakukan jar test karena kondisi mendekati batas model atau beban turbidity ekstrem.");
  if(actions.length===0){
    actions.push("Kondisi simulasi memenuhi tujuan: pH tercapai, turbidity tercapai, dan flok diprediksi baik.");
    actions.push("Gunakan dosis sebagai acuan awal, lakukan settling sesuai rekomendasi, lalu catat hasil aktual sebagai data kalibrasi.");
  }
  return actions
}

function updateGoals(data,result){
  const phOk=result.phAfter>=model.phMin&&result.phAfter<=model.phMax;
  const turbOk=result.turbidityAfter<=data.turbTarget;
  const flocClass=classifyFloc(result.flocScore);
  const flocOk=result.flocScore>=82;

  goalFloc.textContent=flocOk?"Memenuhi":"Perlu evaluasi";
  goalFlocText.textContent=flocOk?
    "Skor flok menunjukkan kombinasi Alum, Polymer, pH, dan alkalinity cukup mendukung flok besar, padat, dan mudah settling.":
    `Skor flok ${flocClass}. Tujuan belum kuat; evaluasi kecukupan Alum, Polymer, pH, dan slow mixing.`;

  goalPh.textContent=phOk?"Memenuhi":"Belum memenuhi";
  goalPhText.textContent=phOk?
    `pH after ${round(result.phAfter)} berada dalam range 6,50–7,20.`:
    `pH after ${round(result.phAfter)} berada di luar range. Soda Ash perlu dikoreksi.`;

  goalTurb.textContent=turbOk?"Memenuhi":"Belum memenuhi";
  goalTurbText.textContent=turbOk?
    `Turbidity after ${round(result.turbidityAfter)} NTU sudah berada di bawah target ${round(data.turbTarget)} NTU.`:
    `Turbidity after ${round(result.turbidityAfter)} NTU masih di atas target ${round(data.turbTarget)} NTU.`;
}

function updateBars(data,result){
  const phPercent=clamp(((result.phAfter-4)/5)*100,0,100);
  const turbPercent=clamp((1-result.turbidityAfter/Math.max(data.turbidity,10))*100,0,100);
  phBar.style.width=`${phPercent}%`;
  turbBar.style.width=`${turbPercent}%`;
  flocBar.style.width=`${result.flocScore}%`;
  phBar.style.background=(result.phAfter>=model.phMin&&result.phAfter<=model.phMax)?"#22c55e":"#f59e0b";
  turbBar.style.background=(result.turbidityAfter<=data.turbTarget)?"#22c55e":"#ef4444";
  flocBar.style.background=(result.flocScore>=82)?"#22c55e":(result.flocScore>=65?"#f59e0b":"#ef4444");
}

function updateOverall(data,result){
  const phOk=result.phAfter>=model.phMin&&result.phAfter<=model.phMax;
  const turbOk=result.turbidityAfter<=data.turbTarget;
  const flocOk=result.flocScore>=82;
  if(phOk&&turbOk&&flocOk){
    setOverall("good","Kondisi air memenuhi syarat","Tujuan proses tercapai: flok optimal, pH target tercapai, dan turbidity target tercapai.","Memenuhi");
  } else if(result.turbidityGap>96||data.alkalinity<20||data.ph<5.5){
    setOverall("bad","Risiko tinggi, wajib validasi","Kualitas before sensitif atau ekstrem. Gunakan hasil sebagai acuan awal dan lakukan jar test.","Waspada");
  } else {
    setOverall("warn","Perlu penyetelan proses","Salah satu tujuan belum optimal. Perbaiki berdasarkan arahan pH, turbidity, atau flok.","Evaluasi");
  }
}

function updateProcess(rec){
  rapidMix.textContent=rec.rapidMix;
  rapidTime.textContent=rec.rapidTime;
  sodaMix.textContent=rec.sodaMix;
  sodaTime.textContent=rec.sodaTime;
  slowMix.textContent=rec.slowMix;
  slowTime.textContent=rec.slowTime;
  settlingTime.textContent=rec.settling;
  settlingNote.textContent=rec.note;
}

function updateTable(data,result){
  calculationTable.innerHTML=`
    <tr><td>Volume sampel</td><td>${round(data.sampleVolume,0)} mL</td><td>Dipakai untuk konversi ppm ke mL larutan.</td></tr>
    <tr><td>Konversi Alum</td><td>${round(result.alum)} ppm = ${round(toMl(result.alum,data.sampleVolume,data.alumStock))} mL</td><td>Larutan Alum ${round(data.alumStock,0)} ppm.</td></tr>
    <tr><td>Konversi Soda Ash</td><td>${round(result.soda)} ppm = ${round(toMl(result.soda,data.sampleVolume,data.sodaStock))} mL</td><td>Larutan Soda Ash ${round(data.sodaStock,0)} ppm.</td></tr>
    <tr><td>Konversi Polymer</td><td>${round(result.polymer,3)} ppm = ${round(toMl(result.polymer,data.sampleVolume,data.polymerStock))} mL</td><td>Larutan Polymer ${round(data.polymerStock,0)} ppm, sehingga mL lebih besar walau ppm kecil.</td></tr>
    <tr><td>Turbidity Gap</td><td>${round(result.turbidityGap)} NTU</td><td>MAX(turbidity before - target turbidity, 0). Ini dasar utama Alum dan Polymer.</td></tr>
    <tr><td>pH Gap</td><td>${round(result.phGap)}</td><td>MAX(pH target - pH before, 0). Ini dasar utama Soda Ash.</td></tr>
    <tr><td>pH Error</td><td>${round(result.phError)}</td><td>ABS(pH before - 6,85). Menilai jarak dari zona kerja terbaik.</td></tr>
    <tr><td>Residual Gap</td><td>${round(result.residualGap)} NTU</td><td>Sisa beban turbidity setelah estimasi kontribusi Alum, menjadi pertimbangan Polymer.</td></tr>
    <tr><td>Skor Flok</td><td>${round(result.flocScore,0)} / 100</td><td>Gabungan kecukupan Alum, Polymer, pH after, dan alkalinity.</td></tr>
  `;
}

form.addEventListener("submit", (event)=>{
  event.preventDefault();

  const data={
    ph:n(phBeforeInput),
    turbidity:n(turbidityInput),
    alkalinity:n(alkalinityInput),
    phTarget:n(phTargetInput,6.85),
    turbTarget:n(turbTargetInput,4),
    sampleVolume:n(sampleVolumeInput,1000),
    alumStock:n(alumStockInput,10000),
    sodaStock:n(sodaStockInput,10000),
    polymerStock:n(polymerStockInput,100),
    mode:operationModeInput.value
  };

  const result=calculate(data);
  const rec=getProcess(data,result);

  alumPpm.textContent=`${round(result.alum)} ppm`;
  sodaPpm.textContent=`${round(result.soda)} ppm`;
  polymerPpm.textContent=`${round(result.polymer,3)} ppm`;

  alumMl.textContent=round(toMl(result.alum,data.sampleVolume,data.alumStock));
  sodaMl.textContent=round(toMl(result.soda,data.sampleVolume,data.sodaStock));
  polymerMl.textContent=round(toMl(result.polymer,data.sampleVolume,data.polymerStock));

  phAfterEl.textContent=round(result.phAfter);
  turbAfterEl.textContent=`${round(result.turbidityAfter)} NTU`;
  turbTargetLabel.textContent=round(data.turbTarget);
  flocScoreEl.textContent=`${round(result.flocScore,0)} / 100`;
  flocText.textContent=`Kategori flok: ${classifyFloc(result.flocScore)}.`;

  updateBars(data,result);
  updateGoals(data,result);
  updateOverall(data,result);
  updateProcess(rec);
  renderList(warnings,buildWarnings(data,result));
  renderList(operatorActions,buildActions(data,result,rec));
  updateTable(data,result);
});

resetBtn.addEventListener("click",()=>{
  form.reset();
  phTargetInput.value="6.85";
  turbTargetInput.value="4.00";
  sampleVolumeInput.value="1000";
  alumStockInput.value="10000";
  sodaStockInput.value="10000";
  polymerStockInput.value="100";
  operationModeInput.value="balanced";

  mainStatus.textContent="Belum dihitung";
  mainStatusText.textContent="Masukkan kualitas air before, target, volume sampel, dan konsentrasi larutan stok.";
  statusBadge.className="status neutral";
  statusBadge.textContent="Standby";

  [alumMl,sodaMl,polymerMl,phAfterEl,turbAfterEl,flocScoreEl].forEach(el=>el.textContent="-");
  alumPpm.textContent="- ppm";
  sodaPpm.textContent="- ppm";
  polymerPpm.textContent="- ppm";
  flocText.textContent="Belum dihitung.";
  phBar.style.width="0%";
  turbBar.style.width="0%";
  flocBar.style.width="0%";
  turbTargetLabel.textContent="4";

  goalFloc.textContent="-";
  goalFlocText.textContent="Belum dihitung.";
  goalPh.textContent="-";
  goalPhText.textContent="Belum dihitung.";
  goalTurb.textContent="-";
  goalTurbText.textContent="Belum dihitung.";

  rapidMix.textContent="-"; rapidTime.textContent="-";
  sodaMix.textContent="-"; sodaTime.textContent="-";
  slowMix.textContent="-"; slowTime.textContent="-";
  settlingTime.textContent="-"; settlingNote.textContent="-";

  warnings.textContent="Belum ada warning.";
  operatorActions.textContent="Arahan akan muncul setelah simulasi.";
  calculationTable.innerHTML=`<tr><td colspan="3">Belum ada perhitungan.</td></tr>`;
});

sampleBtn.addEventListener("click",()=>{
  phBeforeInput.value="5.85";
  turbidityInput.value="68";
  alkalinityInput.value="32";
  phTargetInput.value="6.85";
  turbTargetInput.value="4.00";
  sampleVolumeInput.value="1000";
  alumStockInput.value="10000";
  sodaStockInput.value="10000";
  polymerStockInput.value="100";
  operationModeInput.value="balanced";
});
