const form=document.getElementById("dosingForm");const resetBtn=document.getElementById("resetBtn");const sampleBtn=document.getElementById("sampleBtn");const phBeforeInput=document.getElementById("phBefore");const turbidityInput=document.getElementById("turbidity");const alkalinityInput=document.getElementById("alkalinity");const phTargetInput=document.getElementById("phTarget");const turbTargetInput=document.getElementById("turbTarget");const turbModeInput=document.getElementById("turbMode");const mainStatus=document.getElementById("mainStatus");const mainStatusText=document.getElementById("mainStatusText");const statusBadge=document.getElementById("statusBadge");const alumDose=document.getElementById("alumDose");const sodaDose=document.getElementById("sodaDose");const polymerDose=document.getElementById("polymerDose");const alumStatus=document.getElementById("alumStatus");const sodaStatus=document.getElementById("sodaStatus");const polymerStatus=document.getElementById("polymerStatus");const phAfterEl=document.getElementById("phAfter");const turbAfterEl=document.getElementById("turbAfter");const turbTargetLabel=document.getElementById("turbTargetLabel");const phBar=document.getElementById("phBar");const turbBar=document.getElementById("turbBar");const rapidMix=document.getElementById("rapidMix");const rapidTime=document.getElementById("rapidTime");const sodaMix=document.getElementById("sodaMix");const sodaTime=document.getElementById("sodaTime");const slowMix=document.getElementById("slowMix");const slowTime=document.getElementById("slowTime");const settlingTime=document.getElementById("settlingTime");const settlingNote=document.getElementById("settlingNote");const warnings=document.getElementById("warnings");const operatorActions=document.getElementById("operatorActions");const calculationTable=document.getElementById("calculationTable");

const model={phOptimum:6.85,phMin:6.5,phMax:7.2,alum:{intercept:.90,turbGap:.092,turbidity:.028,phError:.35,alkalinity:-.008},soda:{intercept:.15,phGap:2.10,alkalinity:-.012,alum:.155},polymer:{intercept:.18,turbGap:.006,alum:.065,residualGap:.018,alkalinity:-.002},limit:{alumMin:0,alumMax:16,sodaMin:0,sodaMax:12,polymerMin:0,polymerMax:4.5}};

function n(input,fallback=0){const value=parseFloat(input.value);return Number.isFinite(value)?value:fallback}
function round(value,digits=2){return Number(value).toFixed(digits)}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function modeFactor(mode){if(mode==="aggressive")return 1.12;if(mode==="conservative")return .88;return 1}

function calculateDosing(data){
  const factor=modeFactor(data.mode);
  const phError=Math.abs(data.ph-model.phOptimum);
  const phGap=Math.max(data.phTarget-data.ph,0);
  const turbidityGap=Math.max(data.turbidity-data.turbTarget,0);
  const turbidityLoad=turbidityGap*factor;

  const alumRaw=model.alum.intercept+model.alum.turbGap*turbidityLoad+model.alum.turbidity*data.turbidity+model.alum.phError*phError+model.alum.alkalinity*data.alkalinity;
  const alum=clamp(alumRaw,model.limit.alumMin,model.limit.alumMax);

  const expectedRemovalByAlum=2.05*alum;
  const residualTurbidityGap=Math.max(turbidityGap-expectedRemovalByAlum,0);

  const sodaRaw=model.soda.intercept+model.soda.phGap*phGap+model.soda.alkalinity*data.alkalinity+model.soda.alum*alum;
  const soda=clamp(sodaRaw,model.limit.sodaMin,model.limit.sodaMax);

  const polymerRaw=model.polymer.intercept+model.polymer.turbGap*turbidityLoad+model.polymer.alum*alum+model.polymer.residualGap*residualTurbidityGap+model.polymer.alkalinity*data.alkalinity;
  const polymer=clamp(polymerRaw,model.limit.polymerMin,model.limit.polymerMax);

  const phAfter=clamp(data.ph+.30*soda-.050*alum+.0020*data.alkalinity,4,9);
  const removalByAlum=2.15*alum;
  const removalByPolymer=1.35*polymer;
  const lowBufferPenalty=.020*Math.max(30-data.alkalinity,0);
  const turbidityAfter=Math.max(data.turbidity-removalByAlum-removalByPolymer+lowBufferPenalty,.2);

  return {phError,phGap,turbidityGap,turbidityLoad,expectedRemovalByAlum,residualTurbidityGap,alumRaw,alum,sodaRaw,soda,polymerRaw,polymer,phAfter,turbidityAfter}
}

function classifyTurbidityGap(gap){if(gap<16)return"rendah";if(gap<56)return"sedang";if(gap<96)return"tinggi";return"ekstrem"}
function classifyPh(ph){if(ph<5.5)return"sangat rendah";if(ph<6.5)return"rendah";if(ph<=7.2)return"ideal";return"tinggi"}
function classifyAlkalinity(a){if(a<20)return"sangat rendah";if(a<40)return"rendah-sedang";if(a<=80)return"cukup";return"tinggi"}
function doseStatus(v,max,type){const r=v/max;if(v<=.05)return"Minimum / nol";if(r<.35)return type==="soda"?"Rendah / koreksi kecil":"Rendah";if(r<.75)return"Normal";if(r<.92)return"Tinggi";return"Mendekati batas atas"}

function getProcessRecommendation(result,data){
  const category=classifyTurbidityGap(result.turbidityGap);
  let rec;
  if(category==="rendah"){rec={rapidMix:"100–130 rpm",rapidTime:"1–2 menit",sodaMix:"80–110 rpm",sodaTime:"1–2 menit",slowMix:"20–35 rpm",slowTime:"10–15 menit",settling:"15–20 menit",note:"Turbidity gap rendah"}}
  else if(category==="sedang"){rec={rapidMix:"130–160 rpm",rapidTime:"±2 menit",sodaMix:"90–120 rpm",sodaTime:"1–2 menit",slowMix:"30–45 rpm",slowTime:"15–20 menit",settling:"20–25 menit",note:"Turbidity gap sedang"}}
  else if(category==="tinggi"){rec={rapidMix:"160–190 rpm",rapidTime:"2–3 menit",sodaMix:"100–130 rpm",sodaTime:"2–3 menit",slowMix:"40–55 rpm",slowTime:"20–25 menit",settling:"25–35 menit",note:"Turbidity gap tinggi"}}
  else{rec={rapidMix:"180–200 rpm",rapidTime:"±3 menit",sodaMix:"110–140 rpm",sodaTime:"2–3 menit",slowMix:"45–60 rpm",slowTime:"20–25 menit",settling:"35–45 menit",note:"Turbidity gap ekstrem + jar test"}}
  if(data.ph<5.5||data.alkalinity<20){rec.sodaMix="100–140 rpm";rec.sodaTime="2–3 menit";rec.note+=" + kontrol pH ketat"}
  if(result.turbidityAfter>data.turbTarget){rec.note+=" + evaluasi flok"}
  return rec
}

function setOverallStatus(kind,title,text,badge){mainStatus.textContent=title;mainStatusText.textContent=text;statusBadge.className=`status ${kind}`;statusBadge.textContent=badge}
function renderList(el,items){el.className="message-list muted-message";el.innerHTML=`<ul>${items.map(i=>`<li>${i}</li>`).join("")}</ul>`}

function buildWarnings(data,result){
  const list=[];
  if(result.turbidityGap<=0)list.push("Turbidity before sudah di bawah/sama dengan target. Alum dan Polymer harus rendah agar tidak overdosing.");
  if(result.turbidityGap>96)list.push("Turbidity gap ekstrem. Formula hanya estimasi awal dan wajib jar test.");
  else if(result.turbidityGap>56)list.push("Turbidity gap tinggi. Alum harus cukup dan settling diperpanjang.");
  if(result.residualTurbidityGap>20)list.push("Estimasi sisa gap turbidity masih besar setelah efek Alum. Polymer membantu, tetapi jangan dijadikan pengganti Alum.");
  if(data.ph<6.5)list.push("pH before rendah. Soda Ash diperlukan untuk menjaga pH after 6,50–7,20.");
  if(data.ph>7.2)list.push("pH before tinggi. Hindari Soda Ash berlebih.");
  if(data.alkalinity<20)list.push("Alkalinity sangat rendah. Risiko pH drop tinggi setelah Alum.");
  else if(data.alkalinity<40)list.push("Alkalinity rendah-sedang. pH after wajib dipantau.");
  if(result.phAfter<model.phMin)list.push("Prediksi pH after di bawah target. Koreksi Soda Ash sebelum menaikkan Alum/Polymer.");
  if(result.phAfter>model.phMax)list.push("Prediksi pH after di atas target. Soda Ash kemungkinan berlebih.");
  if(result.turbidityAfter>data.turbTarget)list.push("Prediksi turbidity after belum mencapai target. Evaluasi Alum, Polymer, mixing, dan settling.");
  if(result.polymer>=model.limit.polymerMax*.85)list.push("Polymer mendekati batas atas. Hati-hati flok licin, pecah, atau sludge lengket.");
  if(list.length===0)list.push("Tidak ada warning besar. Tetap validasi dengan pH after dan turbidity after aktual.");
  return list
}

function buildActions(data,result,rec){
  const actions=[];
  if(result.turbidityAfter>data.turbTarget&&result.phAfter>=model.phMin&&result.phAfter<=model.phMax)actions.push("pH sudah mendukung. Fokus evaluasi Alum, Polymer kecil bertahap, slow mixing, dan settling.");
  if(result.turbidityAfter>data.turbTarget&&result.phAfter<model.phMin)actions.push("Jangan fokus ke Polymer dulu. Stabilkan pH ke 6,50–7,20, lalu evaluasi koagulasi.");
  if(result.phAfter<model.phMin)actions.push("Naikkan Soda Ash bertahap dan cek pH after.");
  if(result.phAfter>model.phMax)actions.push("Kurangi Soda Ash atau gunakan Soda Ash minimum.");
  if(result.turbidityGap>56)actions.push(`Gunakan rapid mix ${rec.rapidMix} selama ${rec.rapidTime}, slow mix ${rec.slowMix} selama ${rec.slowTime}, settling ${rec.settling}.`);
  if(result.residualTurbidityGap>20)actions.push("Jika flok kecil, Polymer dapat dinaikkan sedikit. Jika flok licin/pecah, Polymer harus diturunkan.");
  if(data.alkalinity<20)actions.push("Cek pH after setelah Alum karena buffer rendah.");
  if(result.turbidityGap>96||result.alum===model.limit.alumMax||result.polymer===model.limit.polymerMax)actions.push("Lakukan jar test karena beban turbidity atau dosis mendekati batas model.");
  if(actions.length===0){actions.push("Pertahankan estimasi dosis sebagai acuan awal.");actions.push(`Lakukan settling ${rec.settling}, lalu cek turbidity after. Target < ${round(data.turbTarget)} NTU.`)}
  return actions
}

function updateProcess(rec){rapidMix.textContent=rec.rapidMix;rapidTime.textContent=rec.rapidTime;sodaMix.textContent=rec.sodaMix;sodaTime.textContent=rec.sodaTime;slowMix.textContent=rec.slowMix;slowTime.textContent=rec.slowTime;settlingTime.textContent=rec.settling;settlingNote.textContent=rec.note}
function updateBars(result,data){const phPercent=clamp(((result.phAfter-4)/5)*100,0,100);const turbPercent=clamp((1-result.turbidityAfter/Math.max(data.turbidity,10))*100,0,100);phBar.style.width=`${phPercent}%`;turbBar.style.width=`${turbPercent}%`;phBar.style.background=result.phAfter>=model.phMin&&result.phAfter<=model.phMax?"#22c55e":"#f59e0b";turbBar.style.background=result.turbidityAfter<=data.turbTarget?"#22c55e":"#ef4444"}

function updateOverallStatus(data,result){
  const atTarget=result.phAfter>=model.phMin&&result.phAfter<=model.phMax&&result.turbidityAfter<=data.turbTarget;
  const highRisk=result.turbidityGap>96||data.ph<5.5||data.alkalinity<20;
  const atLimit=result.alum===model.limit.alumMax||result.soda===model.limit.sodaMax||result.polymer===model.limit.polymerMax;
  if(atLimit||result.turbidityGap>96)setOverallStatus("bad","Wajib evaluasi / jar test","Turbidity gap ekstrem atau dosis menyentuh batas model.","Risiko tinggi");
  else if(atTarget&&!highRisk)setOverallStatus("good","Target pH & turbidity tercapai","Prediksi pH after dan turbidity after berada dalam target operasi.","Aman");
  else if(highRisk)setOverallStatus("bad","Risiko kimia tinggi","pH, alkalinity, atau turbidity gap menunjukkan kondisi sensitif.","Waspada");
  else setOverallStatus("warn","Perlu evaluasi","Ada parameter after yang belum ideal atau perlu penyesuaian proses.","Evaluasi")
}

function renderCalculationTable(data,result){
  calculationTable.innerHTML=`
    <tr><td>Turbidity Gap</td><td>${round(result.turbidityGap)} NTU</td><td>MAX(Turbidity before - target turbidity, 0). Ini dasar utama koreksi Alum dan Polymer.</td></tr>
    <tr><td>Kategori Turbidity Gap</td><td>${classifyTurbidityGap(result.turbidityGap)}</td><td>Menentukan intensitas mixing dan settling.</td></tr>
    <tr><td>pH Error</td><td>${round(result.phError)}</td><td>ABS(pH before - 6,85), koreksi kondisi pH untuk Alum.</td></tr>
    <tr><td>pH Gap</td><td>${round(result.phGap)}</td><td>MAX(pH target - pH before, 0), dasar Soda Ash.</td></tr>
    <tr><td>Expected Removal by Alum</td><td>${round(result.expectedRemovalByAlum)} NTU</td><td>Estimasi kontribusi Alum dalam menurunkan turbidity.</td></tr>
    <tr><td>Residual Turbidity Gap</td><td>${round(result.residualTurbidityGap)} NTU</td><td>Sisa gap turbidity yang menjadi pertimbangan Polymer.</td></tr>
    <tr><td>Alum Raw</td><td>${round(result.alumRaw)} mL</td><td>Hasil formula sebelum batas minimum/maksimum.</td></tr>
    <tr><td>Soda Ash Raw</td><td>${round(result.sodaRaw)} mL</td><td>Fokus pada pH gap, alkalinity, dan efek Alum.</td></tr>
    <tr><td>Polymer Raw</td><td>${round(result.polymerRaw)} mL</td><td>Membaca turbidity gap, Alum, dan residual turbidity gap.</td></tr>
  `
}

form.addEventListener("submit",event=>{
  event.preventDefault();
  const data={ph:n(phBeforeInput),turbidity:n(turbidityInput),alkalinity:n(alkalinityInput),phTarget:n(phTargetInput,6.85),turbTarget:n(turbTargetInput,4),mode:turbModeInput.value};
  const result=calculateDosing(data);
  const rec=getProcessRecommendation(result,data);
  const warningList=buildWarnings(data,result);
  const actionList=buildActions(data,result,rec);

  alumDose.textContent=round(result.alum);sodaDose.textContent=round(result.soda);polymerDose.textContent=round(result.polymer);
  alumStatus.textContent=doseStatus(result.alum,model.limit.alumMax,"alum");sodaStatus.textContent=doseStatus(result.soda,model.limit.sodaMax,"soda");polymerStatus.textContent=doseStatus(result.polymer,model.limit.polymerMax,"polymer");
  phAfterEl.textContent=round(result.phAfter);turbAfterEl.textContent=`${round(result.turbidityAfter)} NTU`;turbTargetLabel.textContent=round(data.turbTarget);
  updateBars(result,data);updateProcess(rec);updateOverallStatus(data,result);renderList(warnings,warningList);renderList(operatorActions,actionList);renderCalculationTable(data,result)
});

resetBtn.addEventListener("click",()=>{
  form.reset();phTargetInput.value="6.85";turbTargetInput.value="4.00";turbModeInput.value="normal";
  mainStatus.textContent="Belum dihitung";mainStatusText.textContent="Masukkan kualitas air before dan target turbidity untuk menjalankan simulasi.";statusBadge.className="status neutral";statusBadge.textContent="Standby";
  alumDose.textContent="-";sodaDose.textContent="-";polymerDose.textContent="-";alumStatus.textContent="Belum dihitung";sodaStatus.textContent="Belum dihitung";polymerStatus.textContent="Belum dihitung";
  phAfterEl.textContent="-";turbAfterEl.textContent="-";phBar.style.width="0%";turbBar.style.width="0%";turbTargetLabel.textContent="4";
  rapidMix.textContent="-";rapidTime.textContent="-";sodaMix.textContent="-";sodaTime.textContent="-";slowMix.textContent="-";slowTime.textContent="-";settlingTime.textContent="-";settlingNote.textContent="-";
  warnings.textContent="Belum ada warning. Jalankan simulasi terlebih dahulu.";operatorActions.textContent="Arahan operator akan muncul setelah simulasi.";calculationTable.innerHTML=`<tr><td colspan="3">Belum ada perhitungan.</td></tr>`
});

sampleBtn.addEventListener("click",()=>{phBeforeInput.value="5.85";turbidityInput.value="68";alkalinityInput.value="32";phTargetInput.value="6.85";turbTargetInput.value="4.00";turbModeInput.value="normal"});
