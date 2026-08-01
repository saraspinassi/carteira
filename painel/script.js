Chart.defaults.color = '#8D98B3';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.borderColor = '#212D45';
const PALETTE = ['#C9A84C','#60A5FA','#34D399','#F87171','#A78BFA','#FBBF24','#38BDF8','#FB923C','#4ADE80','#F472B6','#94A3B8','#22D3EE'];

let HIST=null, METAS=null, CONFIG=null;
let charts = {};

function fmtBRL(v){ return 'R$ ' + v.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}); }
function fmtPct(v){ return v.toFixed(2).replace('.',',') + '%'; }
function cardHTML(label, value, delta, deltaClass, progress){
  let html = `<div class="card"><div class="card-label">${label}</div><div class="card-value">${value}</div>`;
  if(delta) html += `<div class="card-delta ${deltaClass||'neutral'}">${delta}</div>`;
  if(progress!==undefined) html += `<div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>`;
  html += `</div>`;
  return html;
}
function destroyChart(id){ if(charts[id]){ charts[id].destroy(); delete charts[id]; } }
function pieChart(canvasId, dataObj){
  destroyChart(canvasId);
  const labels = Object.keys(dataObj), values = Object.values(dataObj);
  charts[canvasId] = new Chart(document.getElementById(canvasId), {
    type:'doughnut',
    data:{ labels, datasets:[{ data:values, backgroundColor:PALETTE, borderColor:'#0A0F1A', borderWidth:2 }]},
    options:{ plugins:{legend:{position:'right', labels:{boxWidth:10, usePointStyle:true, font:{size:11}}}}, cutout:'62%' }
  });
}

/* ================= LOAD DATA ================= */
async function tryAutoLoad(){
  try{
    const [h,m,c] = await Promise.all([
      fetch('../dados/historico.json').then(r=>{if(!r.ok) throw 0; return r.json();}),
      fetch('../dados/metas.json').then(r=>{if(!r.ok) throw 0; return r.json();}),
      fetch('../dados/configuracoes.json').then(r=>{if(!r.ok) throw 0; return r.json();}),
    ]);
    HIST=h; METAS=m; CONFIG=c;
    boot();
  }catch(e){
    document.getElementById('loadGate').style.display='flex';
  }
}

function setupManualLoad(){
  const files = {historico:null, metas:null, config:null};
  function checkReady(){
    document.getElementById('btnCarregar').disabled = !(files.historico && files.metas && files.config);
  }
  document.getElementById('fileHistorico').addEventListener('change', e=>{
    const r = new FileReader(); r.onload = ()=>{ files.historico = JSON.parse(r.result); checkReady(); };
    r.readAsText(e.target.files[0]);
  });
  document.getElementById('fileMetas').addEventListener('change', e=>{
    const r = new FileReader(); r.onload = ()=>{ files.metas = JSON.parse(r.result); checkReady(); };
    r.readAsText(e.target.files[0]);
  });
  document.getElementById('fileConfig').addEventListener('change', e=>{
    const r = new FileReader(); r.onload = ()=>{ files.config = JSON.parse(r.result); checkReady(); };
    r.readAsText(e.target.files[0]);
  });
  document.getElementById('btnCarregar').addEventListener('click', ()=>{
    HIST=files.historico; METAS=files.metas; CONFIG=files.config;
    document.getElementById('loadGate').style.display='none';
    boot();
  });
}

function boot(){
  document.getElementById('app').style.display='flex';
  const latest = HIST.snapshots[HIST.snapshots.length-1];
  document.getElementById('sidebarFoot').innerHTML = `Posição de referência<br><b style="color:var(--text)">${fmtDate(latest.data)}</b>`;
  setupNav();
  setupPeriodFilter();
  renderAll();
}

function fmtDate(iso){ const [y,m,d]=iso.split('-'); return `${d}/${m}/${y}`; }

/* ================= NAV ================= */
function setupNav(){
  document.querySelectorAll('.nav-item').forEach(el=>{
    el.addEventListener('click', ()=>{
      document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('view-'+el.dataset.view).classList.add('active');
    });
  });
}

/* ================= PERIOD FILTER ================= */
function allMonths(){ return Object.keys(HIST.dividendos_mensais).sort(); }

function setupPeriodFilter(){
  const typeSel = document.getElementById('periodType');
  const valSel = document.getElementById('periodValue');
  const customFrom = document.getElementById('customFrom');
  const customTo = document.getElementById('customTo');
  const customToLabel = document.getElementById('customToLabel');

  function populateValues(){
    const type = typeSel.value;
    valSel.innerHTML = '';
    valSel.style.display = (type==='tudo'||type==='custom') ? 'none' : 'inline-block';
    customFrom.style.display = customTo.style.display = customToLabel.style.display = (type==='custom') ? 'inline-block' : 'none';
    if(type==='tudo' || type==='custom'){ renderAll(); return; }
    const months = allMonths();
    const years = [...new Set(months.map(m=>m.slice(0,4)))].sort().reverse();
    if(type==='ano'){
      years.forEach(y=> valSel.appendChild(new Option(y,y)));
    } else if(type==='mes'){
      months.slice().reverse().forEach(m=>{
        const [y,mm]=m.split('-');
        const nomes=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        valSel.appendChild(new Option(nomes[parseInt(mm)-1]+'/'+y, m));
      });
    } else if(type==='trimestre'){
      years.forEach(y=>{ for(let t=4;t>=1;t--) valSel.appendChild(new Option('T'+t+'/'+y, y+'-T'+t)); });
    } else if(type==='semestre'){
      years.forEach(y=>{ for(let s=2;s>=1;s--) valSel.appendChild(new Option('S'+s+'/'+y, y+'-S'+s)); });
    }
    renderAll();
  }
  typeSel.addEventListener('change', populateValues);
  valSel.addEventListener('change', renderAll);
  customFrom.addEventListener('change', renderAll);
  customTo.addEventListener('change', renderAll);
  populateValues();
}

function getSelectedMonths(){
  const type = document.getElementById('periodType').value;
  const val = document.getElementById('periodValue').value;
  const months = allMonths();
  if(type==='tudo') return months;
  if(type==='custom'){
    const from = document.getElementById('customFrom').value, to = document.getElementById('customTo').value;
    if(!from || !to) return months;
    return months.filter(m => m >= from.slice(0,7) && m <= to.slice(0,7));
  }
  if(type==='ano') return months.filter(m=>m.startsWith(val));
  if(type==='mes') return [val];
  if(type==='trimestre'){
    const [y,t] = val.split('-T'); const tn=parseInt(t);
    const startM = (tn-1)*3+1;
    return months.filter(m=>{ const [my,mm]=m.split('-'); return my===y && parseInt(mm)>=startM && parseInt(mm)<startM+3; });
  }
  if(type==='semestre'){
    const [y,s] = val.split('-S'); const sn=parseInt(s);
    const startM = sn===1?1:7;
    return months.filter(m=>{ const [my,mm]=m.split('-'); return my===y && parseInt(mm)>=startM && parseInt(mm)<startM+6; });
  }
  return months;
}

function getSnapshotForPeriod(){
  // usa o snapshot mais recente cuja data <= último mês do período selecionado
  const sel = getSelectedMonths();
  const lastMonth = sel[sel.length-1] || allMonths()[allMonths().length-1];
  const candidates = HIST.snapshots.filter(s => s.data.slice(0,7) <= lastMonth);
  return candidates.length ? candidates[candidates.length-1] : HIST.snapshots[HIST.snapshots.length-1];
}

/* ================= RENDER ================= */
function renderAll(){
  const snap = getSnapshotForPeriod();
  const months = getSelectedMonths();
  document.getElementById('periodHint').textContent =
    months.length>1 ? `${months.length} mês(es) — carteira referência: ${fmtDate(snap.data)}` : `Carteira referência: ${fmtDate(snap.data)}`;
  document.getElementById('asofBadge').innerHTML = `Posição em <b>${fmtDate(snap.data)}</b>`;
  document.getElementById('fxBadge').innerHTML = `Câmbio de referência: <b>R$${CONFIG.cambio_usd_brl_referencia.toFixed(2)}/USD</b>`;

  renderPrincipal(snap, months);
  renderCarteira(snap);
  renderDividendos(snap, months);
  renderDiversificacao(snap);
  renderMetas(snap);
  renderReserva();
  renderProjecoes();
}

function computeAggregates(snap){
  const total_mercado = snap.ativos.reduce((s,a)=>s+a.valor_mercado_brl,0);
  const total_invest = snap.ativos.reduce((s,a)=>s+a.patrimonio_investido_brl,0);
  const rows = snap.ativos.map(a=>({
    ...a, lucro: a.valor_mercado_brl - a.patrimonio_investido_brl,
    pct: a.valor_mercado_brl/total_mercado*100,
    div2026: HIST.dividendos_por_ativo_2026[a.ticker] || 0
  }));
  return {total_mercado, total_invest, rows};
}

function sumMonths(obj, months){ return months.reduce((s,m)=>s+(obj[m]||0),0); }

function renderPrincipal(snap, months){
  const {total_mercado, total_invest} = computeAggregates(snap);
  const lucro = total_mercado - total_invest;
  const lucroPct = lucro/total_invest*100;
  const divPeriodo = sumMonths(HIST.dividendos_mensais, months);
  const last12 = allMonths().slice(-12);
  const div12m = sumMonths(HIST.dividendos_mensais, last12);

  document.getElementById('cards-principal').innerHTML = [
    cardHTML('Patrimônio Investido', fmtBRL(total_invest), 'custo pelo preço médio'),
    cardHTML('Patrimônio Aportado', fmtBRL(snap.patrimonio_aportado), 'capital efetivamente investido'),
    cardHTML('Valor de Mercado', fmtBRL(total_mercado), (lucroPct>=0?'▲ ':'▼ ')+fmtPct(Math.abs(lucroPct))+' vs. custo', lucroPct>=0?'up':'down'),
    cardHTML('Lucro/Prejuízo Não Realizado', (lucro>=0?'':'-')+fmtBRL(Math.abs(lucro)), null, lucro>=0?'up':'down'),
    cardHTML('Quantidade de Ativos', snap.ativos.length, '3 classes: FIIs, Ações, REITs'),
    cardHTML('Renda Passiva Mensal', fmtBRL(div12m/12), 'média últimos 12 meses'),
    cardHTML('Dividendos no Período', fmtBRL(divPeriodo), months.length+' mês(es) selecionado(s)'),
    cardHTML('Reserva de Emergência', '€ 0,00', 'meta: €1.500 · 0% concluído', 'neutral', 0),
  ].join('');

  destroyChart('chartEvolucaoDiv');
  const nomes=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  charts['chartEvolucaoDiv'] = new Chart(document.getElementById('chartEvolucaoDiv'), {
    type:'line',
    data:{ labels:months.map(m=>{const [y,mm]=m.split('-'); return nomes[parseInt(mm)-1]+'/'+y.slice(2);}),
      datasets:[{ label:'Dividendos', data:months.map(m=>HIST.dividendos_mensais[m]||0), borderColor:'#C9A84C', backgroundColor:'#C9A84C22', tension:0.3, fill:true, borderWidth:3 }]},
    options:{ plugins:{legend:{display:false}}, scales:{ y:{grid:{color:'#1a2438'}}, x:{grid:{display:false}} } }
  });

  const {rows} = computeAggregates(snap);
  const porClasse={}, porPais={};
  rows.forEach(r=>{ porClasse[r.categoria]=(porClasse[r.categoria]||0)+r.valor_mercado_brl; porPais[r.pais]=(porPais[r.pais]||0)+r.valor_mercado_brl; });
  pieChart('chartClassePrincipal', porClasse);
  pieChart('chartPaisPrincipal', porPais);
}

let sortKey='valor_mercado_brl', sortDir=-1;
function renderCarteira(snap){
  const {total_mercado, total_invest, rows} = computeAggregates(snap);
  const lucro = total_mercado-total_invest, lucroPct = lucro/total_invest*100;
  const last12 = allMonths().slice(-12);
  const div12m = sumMonths(HIST.dividendos_mensais, last12);
  document.getElementById('cards-carteira').innerHTML = [
    cardHTML('Patrimônio Investido', fmtBRL(total_invest)),
    cardHTML('Valor de Mercado', fmtBRL(total_mercado), (lucroPct>=0?'▲ ':'▼ ')+fmtPct(Math.abs(lucroPct)), lucroPct>=0?'up':'down'),
    cardHTML('Yield on Cost (12m)', fmtPct(div12m/snap.patrimonio_aportado*100), 'sobre patrimônio aportado'),
    cardHTML('Dividend Yield Atual (12m)', fmtPct(div12m/total_mercado*100), 'sobre valor de mercado'),
  ].join('');

  window._carteiraRows = rows;
  const search = document.getElementById('tableSearch');
  const filt = document.getElementById('filterClasse');
  function draw(){
    let out = window._carteiraRows.filter(r=> r.ticker.includes(search.value.toUpperCase()) && (filt.value===''||r.categoria===filt.value));
    out.sort((a,b)=> (a[sortKey]>b[sortKey]?1:-1)*sortDir);
    document.getElementById('mainTableBody').innerHTML = out.map(r=>{
      const badgeClass = r.categoria==='FIIs'?'badge-fii':(r.categoria==='Ações'?'badge-acao':'badge-reit');
      const lucroClass = r.lucro>=0?'up':'down';
      return `<tr>
        <td><b>${r.ticker}</b></td><td><span class="badge ${badgeClass}">${r.categoria}</span></td>
        <td>${r.setor}</td><td class="pill-country">${r.pais}</td>
        <td class="mono">${r.quantidade.toLocaleString('pt-BR')}</td>
        <td class="mono">${r.moeda==='USD'?'US$':'R$'} ${r.preco_medio.toFixed(2)}</td>
        <td class="mono">${r.moeda==='USD'?'US$':'R$'} ${r.preco_atual.toFixed(2)}</td>
        <td class="mono">${fmtBRL(r.valor_mercado_brl)}</td>
        <td class="mono">${fmtPct(r.pct)}</td>
        <td class="mono ${lucroClass}">${r.lucro>=0?'+':'-'}${fmtBRL(Math.abs(r.lucro))}</td>
        <td class="mono">${fmtBRL(r.div2026)}</td>
      </tr>`;
    }).join('');
  }
  search.oninput = draw; filt.onchange = draw;
  document.querySelectorAll('#mainTable thead th').forEach(th=>{
    th.onclick = ()=>{ const key=th.dataset.key; if(sortKey===key) sortDir*=-1; else {sortKey=key; sortDir=1;} draw(); };
  });
  draw();
}

function renderDividendos(snap, months){
  const divPeriodo = sumMonths(HIST.dividendos_mensais, months);
  const last12 = allMonths().slice(-12);
  const div12m = sumMonths(HIST.dividendos_mensais, last12);
  document.getElementById('cards-dividendos').innerHTML = [
    cardHTML('Renda Passiva Mensal (média 12m)', fmtBRL(div12m/12)),
    cardHTML('Renda Passiva Anual (12m)', fmtBRL(div12m)),
    cardHTML('Yield on Cost', fmtPct(div12m/snap.patrimonio_aportado*100)),
    cardHTML('Dividendos no Período', fmtBRL(divPeriodo)),
  ].join('');

  destroyChart('chartDivMensal');
  const nomes=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  charts['chartDivMensal'] = new Chart(document.getElementById('chartDivMensal'), {
    type:'bar',
    data:{ labels:months.map(m=>{const [y,mm]=m.split('-'); return nomes[parseInt(mm)-1]+'/'+y.slice(2);}),
      datasets:[{ data:months.map(m=>HIST.dividendos_mensais[m]||0), backgroundColor:'#C9A84C' }] },
    options:{ plugins:{legend:{display:false}}, scales:{ y:{grid:{color:'#1a2438'}}, x:{grid:{display:false}} } }
  });

  const divAtivo = Object.entries(HIST.dividendos_por_ativo_2026).filter(([k,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  destroyChart('chartDivAtivo');
  charts['chartDivAtivo'] = new Chart(document.getElementById('chartDivAtivo'), {
    type:'bar',
    data:{ labels:divAtivo.map(d=>d[0]), datasets:[{ data:divAtivo.map(d=>d[1]), backgroundColor:'#C9A84C' }]},
    options:{ indexAxis:'y', plugins:{legend:{display:false}}, scales:{ x:{grid:{color:'#1a2438'}}, y:{grid:{display:false}} } }
  });

  const porSetorDiv = {};
  Object.entries(HIST.dividendos_por_ativo_2026).forEach(([tk,v])=>{
    const setor = CONFIG.classificacao_setorial[tk] || 'Outro';
    porSetorDiv[setor] = (porSetorDiv[setor]||0) + v;
  });
  pieChart('chartDivSetor', porSetorDiv);
}

function renderDiversificacao(snap){
  const {total_mercado, rows} = computeAggregates(snap);
  const porClasse={}, porPais={}, porMoeda={}, porSetor={};
  rows.forEach(r=>{
    porClasse[r.categoria]=(porClasse[r.categoria]||0)+r.valor_mercado_brl;
    porPais[r.pais]=(porPais[r.pais]||0)+r.valor_mercado_brl;
    porMoeda[r.moeda]=(porMoeda[r.moeda]||0)+r.valor_mercado_brl;
    porSetor[r.setor]=(porSetor[r.setor]||0)+r.valor_mercado_brl;
  });
  pieChart('chartClasseFull', porClasse);
  pieChart('chartSetorFull', porSetor);
  pieChart('chartPaisFull', porMoeda);

  const fiiPct = (porClasse['FIIs']||0)/total_mercado*100;
  const logisticaPct = ((porSetor['Logística']||0) + (porSetor['Híbrido (Log + Escritórios BTS)']||0)*0.5) / total_mercado * 100;
  document.getElementById('alertsDiv').innerHTML = `
    <div class="alert ${fiiPct>70?'alert-warn':'alert-info'}">${fiiPct>70?'⚠':'ℹ'} FIIs representam <b>${fmtPct(fiiPct)}</b> da carteira. Diversificação-alvo definida: 25% por classe.</div>
    <div class="alert alert-ok">✓ Exposição ao setor de Logística (incl. híbridos) em torno de <b>${fmtPct(logisticaPct)}</b> — dentro do teto de 40–45% definido para conter o viés de familiaridade.</div>`;

  const top10 = [...rows].sort((a,b)=>b.pct-a.pct).slice(0,10);
  destroyChart('chartTop10');
  charts['chartTop10'] = new Chart(document.getElementById('chartTop10'), {
    type:'bar',
    data:{ labels:top10.map(r=>r.ticker), datasets:[{ data:top10.map(r=>r.pct), backgroundColor:PALETTE }]},
    options:{ plugins:{legend:{display:false}}, scales:{ y:{grid:{color:'#1a2438'}, ticks:{callback:v=>v+'%'}}, x:{grid:{display:false}} } }
  });
}

function renderMetas(snap){
  const goalsHTML = METAS.patrimonio_aportado.map(g=>{
    const pct = Math.min(snap.patrimonio_aportado/g.meta*100,100);
    const restante = Math.max(g.meta-snap.patrimonio_aportado,0);
    return `<div class="goal-card">
      <div class="goal-head"><div class="goal-name">Meta ${g.ano} <span style="color:var(--text-dim); font-size:0.75rem; font-weight:400;">— até ${fmtDate(g.prazo)}</span></div><div class="goal-pct">${pct.toFixed(1)}%</div></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="goal-meta"><div>Meta: <b>${fmtBRL(g.meta)}</b></div><div>Aportado: <b>${fmtBRL(snap.patrimonio_aportado)}</b></div><div>Restante: <b>${fmtBRL(restante)}</b></div></div>
    </div>`;
  }).join('');
  document.getElementById('goalsList').innerHTML = goalsHTML;

  destroyChart('chartMetas');
  charts['chartMetas'] = new Chart(document.getElementById('chartMetas'), {
    type:'bar',
    data:{ labels:METAS.patrimonio_aportado.map(g=>g.ano),
      datasets:[
        { label:'Meta', data:METAS.patrimonio_aportado.map(g=>g.meta), backgroundColor:'#212D45' },
        { label:'Aportado Atual', data:METAS.patrimonio_aportado.map(()=>snap.patrimonio_aportado), backgroundColor:'#C9A84C' },
      ]},
    options:{ scales:{ y:{grid:{color:'#1a2438'}}, x:{grid:{display:false}} } }
  });
}

function renderReserva(){
  const movs = HIST.reserva_emergencia.movimentacoes || [];
  const atual = movs.length ? movs[movs.length-1].saldo : 0;
  const meta = METAS.reserva_emergencia.meta;
  document.getElementById('cards-reserva').innerHTML = [
    cardHTML('Saldo Atual', '€ '+atual.toLocaleString('pt-BR',{minimumFractionDigits:2}), movs.length?'':'Zerada — reconstrução em andamento'),
    cardHTML('Meta ('+METAS.reserva_emergencia.criterio+')', '€ '+meta.toLocaleString('pt-BR',{minimumFractionDigits:2})),
    cardHTML('Progresso', fmtPct(Math.min(atual/meta*100,100)), null, 'neutral', Math.min(atual/meta*100,100)),
  ].join('');
  destroyChart('chartReserva');
  charts['chartReserva'] = new Chart(document.getElementById('chartReserva'), {
    type:'line',
    data:{ labels: movs.length?movs.map(m=>fmtDate(m.data)):['Sem movimentações'], datasets:[{ label:'Saldo (EUR)', data: movs.length?movs.map(m=>m.saldo):[0], borderColor:'#34D399', backgroundColor:'#34D39922', fill:true, tension:0.3 }]},
    options:{ scales:{ y:{grid:{color:'#1a2438'}}, x:{grid:{display:false}} } }
  });
  document.getElementById('reservaNote').innerHTML = 'ℹ ' + (METAS.reserva_emergencia.ritmo_aporte==='irregular (renda extra, sem valor mensal fixo)'
    ? 'Aporte via renda extra, sem valor mensal fixo comprometido. "Necessário por mês" e "previsão de conclusão" ficam indisponíveis até haver um padrão real de aportes.'
    : 'Ritmo de aporte definido: ' + METAS.reserva_emergencia.ritmo_aporte);
}

function renderProjecoes(){
  const anos=[2027,2028,2029,2030];
  const aportado=[164553.13,196953.13,229353.13,261753.13];
  const projetado=[177762.62,227476.96,281665.59,340731.20];
  const metasArr=[174000,240000,319000,null];
  destroyChart('chartProjecao');
  charts['chartProjecao'] = new Chart(document.getElementById('chartProjecao'), {
    type:'line',
    data:{ labels:anos, datasets:[
      { label:'Patrimônio Aportado (real)', data:aportado, borderColor:'#60A5FA', backgroundColor:'#60A5FA22', tension:0.3, fill:true },
      { label:'Patrimônio Projetado (c/ reinvest. 9%aa)', data:projetado, borderColor:'#C9A84C', backgroundColor:'#C9A84C22', tension:0.3, fill:true, borderWidth:3 },
      { label:'Meta Definida', data:metasArr, borderColor:'#F87171', borderDash:[6,4], pointRadius:4 },
    ]},
    options:{ scales:{ y:{grid:{color:'#1a2438'}}, x:{grid:{display:false}} } }
  });
  document.getElementById('cards-projecao').innerHTML = anos.map((ano,i)=>
    cardHTML('Fim de '+ano, fmtBRL(projetado[i]), 'aportado: '+fmtBRL(aportado[i]), 'neutral')
  ).join('');
}

/* ================= BOOTSTRAP ================= */
setupManualLoad();
tryAutoLoad();
