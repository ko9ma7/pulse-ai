(() => {
  const CATEGORIES = ['All','Agent','MCP','Coding','LLM','Local AI','RAG','Computer Use','AI Image','AI Video'];
  const PERIODS = [
    ['24h','24H'],['7d','7D'],['30d','30D'],['90d','90D'],['365d','1Y'],
  ];
  const state = {
    data: null,
    archive: null,
    period: '7d',
    timelinePeriod: '30d',
    detailPeriod: '30d',
    detailMode: 'total',
    archiveGranularity: 'day',
    archiveMetric: 'averageSignal',
    category: 'All',
    query: '',
    sort: 'signal',
    mobile: false,
  };
  const app = document.getElementById('app');
  const fmt = new Intl.NumberFormat('ko-KR');
  const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp = (n,min,max) => Math.min(max,Math.max(min,n));
  const safeNum = (n) => Number.isFinite(Number(n)) ? Number(n) : 0;
  const daysByPeriod = (p) => p==='24h' ? 1 : p==='7d' ? 7 : p==='30d' ? 30 : p==='90d' ? 90 : 365;
  const metricKey = (p) => p==='24h' ? 'star24h' : p==='7d' ? 'star7d' : p==='30d' ? 'star30d' : p==='90d' ? 'star90d' : 'star365d';
  const metricValue = (r,p=state.period) => safeNum(r[metricKey(p)] ?? (p==='90d'||p==='365d' ? r.star30d : 0));
  const periodLabel = (p) => PERIODS.find(x=>x[0]===p)?.[1] || p;
  const watched = () => { try { return JSON.parse(localStorage.getItem('repo-pulse-watchlist') || '[]'); } catch { return []; } };
  const setWatched = (v) => localStorage.setItem('repo-pulse-watchlist', JSON.stringify(v));
  const theme = () => localStorage.getItem('repo-pulse-theme') || 'dark';
  const setTheme = (t) => { localStorage.setItem('repo-pulse-theme', t); document.documentElement.dataset.theme=t; render(); };
  document.documentElement.dataset.theme = theme();

  const icon = (name) => ({
    pulse:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>',
    menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  }[name] || '');

  const toast = (msg) => {
    const el=document.createElement('div'); el.className='toast'; el.textContent=msg; document.body.appendChild(el); setTimeout(()=>el.remove(),1800);
  };
  const route = () => {
    const h=location.hash || '#/';
    if(h.startsWith('#/repo/')) return {name:'repo',fullName:decodeURIComponent(h.slice(7))};
    if(h==='#/timeline') return {name:'timeline'};
    if(h==='#/categories') return {name:'categories'};
    if(h==='#/archive') return {name:'archive'};
    if(h==='#/watchlist') return {name:'watchlist'};
    if(h==='#/methodology') return {name:'methodology'};
    return {name:'home'};
  };

  function freshnessText(iso){
    const ms=Date.now()-new Date(iso).getTime();
    if(!Number.isFinite(ms)) return '갱신 시각 확인 불가';
    const min=Math.max(0,Math.round(ms/60000));
    if(min<60) return `${min}분 전 갱신`;
    const h=Math.round(min/60); if(h<48) return `${h}시간 전 갱신`;
    return `${Math.round(h/24)}일 전 갱신`;
  }

  function shell(content, active='home'){
    const nav = [
      ['home','#/','◉','Radar'],
      ['timeline','#/timeline','⌁','Timeline'],
      ['categories','#/categories','▦','Categories'],
      ['archive','#/archive','◷','Archive'],
      ['watchlist','#/watchlist','☆','Watchlist'],
      ['methodology','#/methodology','∑','Methodology'],
    ];
    return `<aside class="sidebar ${state.mobile?'open':''}" id="sidebar">
      <a class="brand" href="#/"><span class="brand-mark">${icon('pulse')}</span>RepoPulse <b>AI</b></a>
      <nav class="sidebar-nav">${nav.map(([key,href,mark,label])=>`<a class="nav-item ${active===key?'active':''}" href="${href}"><span>${mark}</span>${label}</a>`).join('')}
        <button class="nav-item" id="themeToggle">${theme()==='dark'?'☀ Light mode':'☾ Dark mode'}</button>
      </nav>
      <div class="sidebar-foot"><div class="sidebar-note">자동 수집: <strong>6시간 간격</strong><br>장기 Archive: <strong>최대 730일</strong><br>Repo Star History: <strong>최대 1년</strong></div></div>
    </aside>
    <main class="main"><header class="mobile-header"><a class="brand" href="#/" style="padding:0"><span class="brand-mark">${icon('pulse')}</span>RepoPulse <b>AI</b></a><button id="menuBtn" aria-label="메뉴 열기">${icon('menu')}</button></header>${content}</main>`;
  }

  function periodButtons(selected, attr='period'){
    return `<div class="periods">${PERIODS.map(([p,l])=>`<button class="${selected===p?'active':''}" data-${attr}="${p}">${l}</button>`).join('')}</div>`;
  }

  function filteredRepos(){
    let arr=[...state.data.repositories];
    if(state.category!=='All') arr=arr.filter(r=>r.categories.includes(state.category));
    if(state.query.trim()){
      const q=state.query.toLowerCase();
      arr=arr.filter(r=>`${r.fullName} ${r.description} ${r.language||''} ${r.categories.join(' ')} ${(r.topics||[]).join(' ')}`.toLowerCase().includes(q));
    }
    if(state.sort==='growth') arr.sort((a,b)=>metricValue(b)-metricValue(a));
    else if(state.sort==='accel') arr.sort((a,b)=>safeNum(b.acceleration)-safeNum(a.acceleration));
    else if(state.sort==='stars') arr.sort((a,b)=>safeNum(b.stars)-safeNum(a.stars));
    else arr.sort((a,b)=>safeNum(b.earlySignalScore)-safeNum(a.earlySignalScore));
    return arr;
  }

  function historySlice(repo, period){
    const days=daysByPeriod(period);
    return (repo.history||[]).slice(-days);
  }

  function spark(history=[]){
    if(!history.length) return '';
    const vals=history.slice(-14).map(x=>safeNum(x.total));
    const min=Math.min(...vals), max=Math.max(...vals), range=Math.max(1,max-min);
    const pts=vals.map((v,i)=>`${(i/(vals.length-1||1))*142+2},${38-((v-min)/range)*34}`).join(' ');
    return `<svg viewBox="0 0 146 42" preserveAspectRatio="none"><path d="M${pts.replaceAll(' ',' L')}"/></svg>`;
  }

  function lineChart(points, valueKey='value', aria='Trend chart'){
    if(!points?.length) return '<div class="empty">표시할 이력 데이터가 없습니다.</div>';
    const vals=points.map(p=>safeNum(p[valueKey]));
    const min=Math.min(...vals), max=Math.max(...vals), range=Math.max(1,max-min);
    const coords=vals.map((v,i)=>[20+(i/(vals.length-1||1))*760,250-((v-min)/range)*210]);
    const line=coords.map(p=>p.join(',')).join(' ');
    const area=`20,260 ${line} 780,260`;
    const first=points[0]?.date||'', last=points.at(-1)?.date||'';
    return `<div class="chart"><svg viewBox="0 0 800 280" role="img" aria-label="${esc(aria)}"><path class="grid" d="M20 50H780M20 120H780M20 190H780M20 260H780"/><polygon class="area" points="${area}"/><polyline class="line" points="${line}"/></svg><div class="chart-axis"><span>${esc(first)}</span><strong>${fmt.format(Math.round(max))}</strong><span>${esc(last)}</span></div></div>`;
  }

  function aggregateHistory(repos, period){
    const days=daysByPeriod(period);
    const map=new Map();
    for(const repo of repos){
      for(const p of (repo.history||[]).slice(-days)){
        const current=map.get(p.date)||0;
        map.set(p.date,current+safeNum(p.gained));
      }
    }
    return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,value])=>({date,value}));
  }

  function statCard(label,value,sub=''){
    return `<div><span>${esc(label)}</span><strong>${value}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div>`;
  }

  function dashboard(){
    const d=state.data, repos=filteredRepos();
    const rows=repos.map((r,i)=>{
      const isW=watched().some(w=>w.fullName===r.fullName);
      return `<div class="repo-row">
        <button class="repo-main" data-open="${esc(r.fullName)}"><span class="rank">#${String(i+1).padStart(2,'0')}</span><div><div class="repo-title"><strong>${esc(r.fullName)}</strong>${r.earlySignalScore>=90?'<span class="hot">RISING</span>':''}</div><div class="repo-desc">${esc(r.description)}</div><div class="tags">${r.categories.slice(0,3).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}<span class="tag">${esc(r.language||'Unknown')}</span></div></div></button>
        <div class="metric stars-extra"><span>Stars</span><strong>★ ${fmt.format(r.stars)}</strong></div>
        <div class="metric gain"><span>${periodLabel(state.period)} Growth</span><strong>+${fmt.format(metricValue(r))}</strong><small>${safeNum(r.velocity7d).toFixed(1)}%</small></div>
        <div class="metric acc acc-extra"><span>Acceleration</span><strong>↑ ${safeNum(r.acceleration).toFixed(2)}x</strong></div>
        <div class="spark">${spark(r.history)}</div><div class="score" title="Early Signal Score">${r.earlySignalScore}</div><button class="watch-btn ${isW?'active':''}" data-watch="${esc(r.fullName)}">${isW?'★':'☆'}</button>
      </div>`;
    }).join('');
    return shell(`<section class="page">
      <div class="hero"><div><h1>Today's Fastest Rising <span>AI Repositories</span></h1><p>현재 화면은 스트리밍 실시간 피드가 아니라 GitHub Actions가 주기적으로 갱신하는 정적 스냅샷입니다. 최신 랭킹은 6시간마다 자동 수집되고, Timeline과 Archive에는 장기 기록이 누적됩니다.</p></div><div class="freshness"><i class="status-dot"></i><div><strong>Latest radar snapshot</strong><span>${freshnessText(d.generatedAt)} · 자동 6시간</span></div></div></div>
      <div class="quick-tabs"><a href="#/timeline">⌁ 주·월·년 Timeline</a><a href="#/categories">▦ 카테고리 비교</a><a href="#/archive">◷ 누적 Archive</a><a href="https://github.com/ko9ma7/pulse-ai/actions/workflows/update-radar.yml" target="_blank" rel="noreferrer">↻ 데이터 수집 Action</a><button id="browserRefresh">↻ 화면 다시 읽기</button></div>
      <div class="summary">${statCard('Scanned repositories',fmt.format(d.summary.scannedRepositories),'후보 탐색')}${statCard('Qualified signals',fmt.format(d.summary.qualifiedRepositories),'signal ≥ 65')}${statCard('Average signal',fmt.format(d.summary.averageSignal),'현재 후보 평균')}${statCard('Fastest 24H',esc(d.summary.fastest24hRepo||'—'),'24시간 관측')}</div>
      <div class="panel"><div class="toolbar"><div>${periodButtons(state.period,'period')}</div><div class="tools"><label class="search"><input id="search" value="${esc(state.query)}" placeholder="Repository / topic 검색"></label><label class="sort"><select id="sort"><option value="signal" ${state.sort==='signal'?'selected':''}>Signal</option><option value="growth" ${state.sort==='growth'?'selected':''}>Growth</option><option value="accel" ${state.sort==='accel'?'selected':''}>Acceleration</option><option value="stars" ${state.sort==='stars'?'selected':''}>Stars</option></select></label></div></div>
      <div class="categories">${CATEGORIES.map(c=>`<button class="${state.category===c?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="table-head"><span>Repository</span><span>Stars</span><span>Growth</span><span>Accel</span><span>Trend</span><span>Signal</span><span>Watch</span></div>${rows||'<div class="empty">조건에 맞는 Repository가 없습니다.</div>'}</div>
    </section>`,'home');
  }

  function timelinePage(){
    const repos=state.category==='All' ? state.data.repositories : state.data.repositories.filter(r=>r.categories.includes(state.category));
    const points=aggregateHistory(repos,state.timelinePeriod);
    const key=metricKey(state.timelinePeriod);
    const leaders=[...repos].sort((a,b)=>safeNum(b[key])-safeNum(a[key])).slice(0,12);
    const prior=state.archive?.daily?.length>1 ? state.archive.daily.at(-2) : null;
    const priorMap=new Map((prior?.repositories||[]).map(r=>[r.fullName,r]));
    const movers=repos.map(r=>({repo:r,delta:safeNum(r.earlySignalScore)-safeNum(priorMap.get(r.fullName)?.signal)})).sort((a,b)=>b.delta-a.delta).slice(0,8);
    const sumGain=leaders.reduce((s,r)=>s+metricValue(r,state.timelinePeriod),0);
    return shell(`<section class="page">
      <div class="hero"><div><h1>Growth <span>Timeline</span></h1><p>개별 Repository의 GitHub Star History를 최대 1년까지 되짚고, 현재 Radar 후보군의 일별 Star 증가량을 합산해 주·월·분기·연 단위 흐름을 봅니다.</p></div><div class="freshness"><i class="status-dot"></i><div><strong>${periodLabel(state.timelinePeriod)} 분석</strong><span>${repos.length} repositories</span></div></div></div>
      <div class="analysis-toolbar">${periodButtons(state.timelinePeriod,'timeline-period')}<div class="categories compact">${CATEGORIES.map(c=>`<button class="${state.category===c?'active':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>
      <div class="analytics-grid"><div class="content wide"><div class="section-head"><div><h2>Current-cohort daily Star gains</h2><p>현재 후보군을 기준으로 GitHub Star History 일별 증가량을 합산합니다.</p></div><strong>+${fmt.format(sumGain)}</strong></div>${lineChart(points,'value',`${periodLabel(state.timelinePeriod)} aggregate star gains`)}</div>
      <div class="content"><h2>Signal movers</h2><p class="muted-copy">직전 Archive 스냅샷 대비 Early Signal 변화</p><div class="mini-list">${movers.map(x=>`<button data-open="${esc(x.repo.fullName)}"><span>${esc(x.repo.fullName)}</span><strong class="${x.delta>=0?'up':'down'}">${x.delta>=0?'+':''}${x.delta}</strong></button>`).join('') || '<div class="empty small">Archive가 2회 이상 쌓이면 변화량이 표시됩니다.</div>'}</div></div></div>
      <div class="panel"><div class="table-title"><h2>${periodLabel(state.timelinePeriod)} Growth Leaders</h2><span>표 · Ranking view</span></div>${leaders.map((r,i)=>`<div class="history-row"><button data-open="${esc(r.fullName)}"><span class="rank">#${i+1}</span><strong>${esc(r.fullName)}</strong></button><span>${r.categories.map(c=>`<i>${esc(c)}</i>`).join('')}</span><b>+${fmt.format(metricValue(r,state.timelinePeriod))}</b><em>${safeNum(r.acceleration).toFixed(2)}x</em><strong>${r.earlySignalScore}</strong></div>`).join('')}</div>
    </section>`,'timeline');
  }

  function categoryStats(period){
    const key=metricKey(period);
    return CATEGORIES.slice(1).map(category=>{
      const repos=state.data.repositories.filter(r=>r.categories.includes(category));
      const growth=repos.reduce((s,r)=>s+safeNum(r[key]),0);
      const signal=repos.length?Math.round(repos.reduce((s,r)=>s+safeNum(r.earlySignalScore),0)/repos.length):0;
      const accel=repos.length?repos.reduce((s,r)=>s+safeNum(r.acceleration),0)/repos.length:0;
      const leader=[...repos].sort((a,b)=>safeNum(b[key])-safeNum(a[key]))[0];
      return {category,repos,growth,signal,accel,leader};
    }).sort((a,b)=>b.growth-a.growth);
  }

  function categoriesPage(){
    const stats=categoryStats(state.timelinePeriod);
    const max=Math.max(1,...stats.map(x=>x.growth));
    const heatPeriods=['7d','30d','90d','365d'];
    const heatRows=CATEGORIES.slice(1).map(category=>{
      const repos=state.data.repositories.filter(r=>r.categories.includes(category));
      const vals=heatPeriods.map(p=>repos.reduce((s,r)=>s+metricValue(r,p),0));
      return {category,vals};
    });
    const heatMax=Math.max(1,...heatRows.flatMap(x=>x.vals));
    return shell(`<section class="page"><div class="hero"><div><h1>Category <span>Intelligence</span></h1><p>Agent, MCP, Coding, RAG 등 주제별로 성장량·Signal·Acceleration을 비교합니다. 검색어뿐 아니라 Repository 이름·설명·Topics의 키워드도 함께 사용해 다중 카테고리 분류를 보강합니다.</p></div></div>
      <div class="analysis-toolbar">${periodButtons(state.timelinePeriod,'timeline-period')}</div>
      <div class="category-cards">${stats.map((s,i)=>`<button class="category-card" data-category-jump="${esc(s.category)}"><span>#${i+1} ${esc(s.category)}</span><strong>+${fmt.format(s.growth)}</strong><small>${s.repos.length} repos · avg signal ${s.signal}</small><div class="bar"><i style="width:${Math.max(2,s.growth/max*100)}%"></i></div><em>${s.leader?esc(s.leader.fullName):'—'}</em></button>`).join('')}</div>
      <div class="analytics-grid"><div class="content wide"><h2>Category heatmap</h2><p class="muted-copy">색의 강도는 현재 후보군에서 해당 기간 Star 증가량의 상대 크기입니다.</p><div class="heatmap"><div></div>${heatPeriods.map(p=>`<b>${periodLabel(p)}</b>`).join('')}${heatRows.map(row=>`<strong>${esc(row.category)}</strong>${row.vals.map(v=>`<span style="--heat:${(v/heatMax).toFixed(3)};--heat-pct:${(v/heatMax*100).toFixed(1)}%" title="${fmt.format(v)}">${fmt.format(v)}</span>`).join('')}`).join('')}</div></div>
      <div class="content"><h2>${periodLabel(state.timelinePeriod)} category ranking</h2><div class="mini-list">${stats.map(s=>`<button data-category-jump="${esc(s.category)}"><span>${esc(s.category)}</span><strong>+${fmt.format(s.growth)}</strong></button>`).join('')}</div></div></div>
    </section>`,'categories');
  }

  function archiveBucketKey(iso, granularity){
    const d=new Date(iso);
    if(granularity==='year') return String(d.getUTCFullYear());
    if(granularity==='month') return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
    if(granularity==='week'){
      const x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
      const day=x.getUTCDay()||7; x.setUTCDate(x.getUTCDate()+4-day);
      const yearStart=new Date(Date.UTC(x.getUTCFullYear(),0,1));
      const week=Math.ceil((((x-yearStart)/86400000)+1)/7);
      return `${x.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
    }
    return iso.slice(0,10);
  }

  function aggregateArchive(granularity='day'){
    const source=granularity==='day' ? (state.archive?.daily||[]) : (state.archive?.daily||[]);
    const buckets=new Map();
    for(const snap of source){
      const key=archiveBucketKey(snap.at,granularity);
      const bucket=buckets.get(key)||[]; bucket.push(snap); buckets.set(key,bucket);
    }
    return [...buckets.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([key,items])=>{
      const last=items.at(-1);
      const avg=(field)=>Math.round(items.reduce((s,x)=>s+safeNum(x.summary[field]),0)/items.length);
      const sumField=(field)=>items.reduce((s,x)=>s+safeNum(x.summary[field]),0);
      const categoryGrowth={};
      for(const cat of CATEGORIES.slice(1)) categoryGrowth[cat]=items.reduce((s,x)=>s+safeNum(x.categories?.[cat]?.star24h),0);
      return {
        key,
        at:last.at,
        repositories:avg('repositories'),
        qualifiedRepositories:avg('qualifiedRepositories'),
        averageSignal:avg('averageSignal'),
        star24h:sumField('star24h'),
        star7d:last.summary.star7d,
        fastest24hRepo:last.summary.fastest24hRepo,
        categoryGrowth,
      };
    });
  }

  function archiveMetricValue(row){
    return state.archiveMetric==='star24h' ? row.star24h : state.archiveMetric==='repositories' ? row.repositories : row.averageSignal;
  }

  function archiveMetricLabel(){
    return state.archiveMetric==='star24h' ? 'Observed Star gain' : state.archiveMetric==='repositories' ? 'Tracked repositories' : 'Average Early Signal';
  }

  function archivePage(){
    const a=state.archive;
    const grouped=aggregateArchive(state.archiveGranularity);
    const reversed=[...grouped].reverse();
    const points=grouped.map(s=>({date:s.key,value:archiveMetricValue(s)}));
    const first=a?.trackingStartedAt ? new Date(a.trackingStartedAt).toLocaleDateString('ko-KR') : '—';
    const maxRows=state.archiveGranularity==='day'?120:state.archiveGranularity==='week'?104:60;
    const rows=reversed.slice(0,maxRows).map(s=>`<div class="archive-row"><time>${esc(s.key)}</time><strong>${fmt.format(s.repositories)}</strong><span>${fmt.format(s.qualifiedRepositories)}</span><b>${fmt.format(s.averageSignal)}</b><em>+${fmt.format(s.star24h)}</em><small>${esc(s.fastest24hRepo||'—')}</small></div>`).join('');
    const catTotals=CATEGORIES.slice(1).map(cat=>({cat,value:grouped.reduce((sum,row)=>sum+safeNum(row.categoryGrowth?.[cat]),0)})).sort((a,b)=>b.value-a.value);
    const catMax=Math.max(1,...catTotals.map(x=>x.value));
    return shell(`<section class="page"><div class="hero"><div><h1>Radar <span>Archive</span></h1><p>RepoPulse가 실제 관측한 Radar 스냅샷을 누적합니다. 6시간 Intraday 기록은 최근 30일, 일별 Archive는 최대 730일 보관하며 일·주·월·연 단위로 다시 집계해 볼 수 있습니다.</p></div><div class="freshness"><i class="status-dot"></i><div><strong>Tracking since ${first}</strong><span>${a?.daily?.length||0} daily · ${a?.snapshots?.length||0} intraday</span></div></div></div>
      <div class="quick-tabs"><a href="./data/repositories.json" download>↓ Latest JSON</a><a href="./data/radar-history.json" download>↓ Archive JSON</a><button id="csvExport">↓ Latest CSV</button><a href="https://github.com/ko9ma7/pulse-ai/actions/workflows/update-radar.yml" target="_blank" rel="noreferrer">↻ Actions에서 즉시 갱신</a></div>
      <div class="summary">${statCard('Refresh cadence',`${a?.cadenceHours||6}h`,'GitHub Actions')}${statCard('Intraday archive',fmt.format(a?.snapshots?.length||0),'최근 30일')}${statCard('Daily archive',fmt.format(a?.daily?.length||0),'최대 730일')}${statCard('Repo history','1Y','GitHub Star History')}</div>
      <div class="analysis-toolbar"><div class="periods">${[['day','Day'],['week','Week'],['month','Month'],['year','Year']].map(([k,l])=>`<button class="${state.archiveGranularity===k?'active':''}" data-archive-granularity="${k}">${l}</button>`).join('')}</div><div class="view-switch"><button class="${state.archiveMetric==='averageSignal'?'active':''}" data-archive-metric="averageSignal">Signal</button><button class="${state.archiveMetric==='star24h'?'active':''}" data-archive-metric="star24h">Star Gain</button><button class="${state.archiveMetric==='repositories'?'active':''}" data-archive-metric="repositories">Repo Count</button></div></div>
      <div class="analytics-grid"><div class="content wide"><div class="section-head"><div><h2>${archiveMetricLabel()}</h2><p>저장된 일별 스냅샷을 ${state.archiveGranularity} 단위로 집계한 관측 이력입니다.</p></div></div>${lineChart(points,'value',archiveMetricLabel())}</div><div class="content"><h2>Category observed gains</h2><p class="muted-copy">현재 보관 기간 동안 카테고리별 24H 관측 증가량 합계 · 다중 카테고리 Repository는 중복 집계</p><div class="category-bars">${catTotals.map(x=>`<div><span>${esc(x.cat)}</span><b>+${fmt.format(x.value)}</b><i><u style="width:${Math.max(2,x.value/catMax*100)}%"></u></i></div>`).join('')}</div></div></div>
      ${(a?.daily?.length||0)<2?'<div class="archive-start"><strong>누적 기록을 시작했습니다.</strong><span>자동 액션이 실행될 때마다 이 화면의 일·주·월·연 비교 데이터가 계속 쌓입니다.</span></div>':''}
      <div class="panel"><div class="archive-head"><span>${state.archiveGranularity}</span><span>Repos</span><span>Qualified</span><span>Avg Signal</span><span>Observed Gain</span><span>Fastest</span></div>${rows||'<div class="empty">아직 누적 스냅샷이 없습니다.</div>'}</div>
    </section>`,'archive');
  }

  function detail(fullName){
    const r=state.data.repositories.find(x=>x.fullName===fullName);
    if(!r) return shell('<section class="page"><div class="empty">현재 스냅샷에서 Repository를 찾지 못했습니다.</div></section>','home');
    const points=historySlice(r,state.detailPeriod).map(p=>({date:p.date,value:state.detailMode==='gained'?p.gained:p.total}));
    const firstSeen=(state.archive?.daily||[]).find(s=>s.repositories?.some(x=>x.fullName===r.fullName))?.at;
    const isW=watched().some(w=>w.fullName===r.fullName);
    return shell(`<section class="page"><button class="back" onclick="history.back()">← Radar로</button>
      <div class="detail-hero"><div class="detail-copy"><div class="tags">${r.categories.map(c=>`<span class="tag">${esc(c)}</span>`).join('')}</div><h1>${esc(r.fullName)}</h1><p>${esc(r.description)}</p><div class="cta-row"><a class="primary" href="${esc(r.url)}" target="_blank" rel="noreferrer">GitHub 열기</a><button class="secondary ${isW?'active':''}" data-watch="${esc(r.fullName)}">${isW?'★ Watching':'☆ Watch'}</button><button class="secondary" data-copy="${esc(r.installCommand||'')}">Clone 명령 복사</button></div></div><div class="signal-card"><span>EARLY SIGNAL</span><strong>${r.earlySignalScore}</strong><small>${esc(r.blogRecommendation)}</small></div></div>
      <div class="metric-grid five">${statCard('24H',`+${fmt.format(metricValue(r,'24h'))}`)}${statCard('7D',`+${fmt.format(metricValue(r,'7d'))}`)}${statCard('30D',`+${fmt.format(metricValue(r,'30d'))}`)}${statCard('90D',`+${fmt.format(metricValue(r,'90d'))}`)}${statCard('1Y',`+${fmt.format(metricValue(r,'365d'))}`)}</div>
      <div class="content"><div class="chart-toolbar"><div>${periodButtons(state.detailPeriod,'detail-period')}</div><div class="view-switch"><button class="${state.detailMode==='total'?'active':''}" data-detail-mode="total">Total Stars</button><button class="${state.detailMode==='gained'?'active':''}" data-detail-mode="gained">Daily Gain</button></div></div>${lineChart(points,'value',`${periodLabel(state.detailPeriod)} ${state.detailMode}`)}</div>
      <div class="detail-grid"><div class="content"><h2>WHY TRENDING</h2><ul class="bullet-list">${(r.whyTrending||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><h2 class="subhead">TRY THIS</h2><ul class="bullet-list">${(r.tryThis||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="content"><h2>Repository facts</h2><div class="info"><div class="info-row"><span>Stars</span><strong>${fmt.format(r.stars)}</strong></div><div class="info-row"><span>Acceleration</span><strong>${safeNum(r.acceleration).toFixed(2)}x</strong></div><div class="info-row"><span>Created</span><strong>${new Date(r.createdAt).toLocaleDateString('ko-KR')}</strong></div><div class="info-row"><span>Last push</span><strong>${new Date(r.pushedAt).toLocaleDateString('ko-KR')}</strong></div><div class="info-row"><span>Radar first seen</span><strong>${firstSeen?new Date(firstSeen).toLocaleDateString('ko-KR'):'이번 스냅샷'}</strong></div><div class="info-row"><span>Language / License</span><strong>${esc(r.language||'—')} / ${esc(r.license||'—')}</strong></div><div class="info-row"><span>Test difficulty</span><strong>${esc(r.testingDifficulty)}</strong></div></div></div></div>
      <div class="blog"><div class="blog-head"><div><h2>블로그 글감 평가</h2><p class="muted-copy">${esc(r.blogRecommendation)} · 시계열을 함께 보고 글감 타이밍을 판단하세요.</p></div><div class="blog-score">${r.blogScore} / 100</div></div><div class="angles">${(r.blogAngles||[]).map(x=>`<button class="angle" data-copy="${esc(x)}">${esc(x)} <span>복사</span></button>`).join('')}</div></div>
    </section>`,'home');
  }

  function watchlistPage(){
    const recs=watched();
    const rows=recs.map(w=>{ const r=state.data.repositories.find(x=>x.fullName===w.fullName); if(!r)return''; const gain=r.stars-w.starsAtWatch; return `<div class="watch-row"><button class="repo-main" data-open="${esc(r.fullName)}"><div><div class="repo-title"><strong>${esc(r.fullName)}</strong></div><div class="repo-desc">발견 ${new Date(w.watchedAt).toLocaleDateString('ko-KR')} · 당시 ${fmt.format(w.starsAtWatch)} Stars</div></div></button><div class="metric gain"><span>Since watch</span><strong>+${fmt.format(Math.max(0,gain))}</strong></div><div class="metric"><span>Now</span><strong>${fmt.format(r.stars)}</strong></div><button class="watch-btn active" data-watch="${esc(r.fullName)}">★</button></div>`; }).join('');
    return shell(`<section class="page"><div class="hero"><div><h1>Your <span>Watchlist</span></h1><p>처음 발견한 시점의 Star는 브라우저 LocalStorage에 저장합니다. 서버 계정 없이 현재 값과 비교합니다.</p></div></div><div class="panel watch-list">${rows||'<div class="empty">아직 Watch한 Repository가 없습니다.<br><br><a class="primary" href="#/">Radar에서 후보 보기</a></div>'}</div></section>`,'watchlist');
  }

  function methodology(){
    const rows=[['35%','7일 Star 증가속도','총 Star 수보다 최근 성장 속도를 우선합니다.'],['20%','증가 가속도','이전 7일 대비 최근 7일 증가 속도 변화를 반영합니다.'],['15%','최근 활동','Commit, Push, Release 등 프로젝트 활동성을 반영합니다.'],['10%','프로젝트 신선도','새 프로젝트의 빠른 성장을 초기 신호로 높게 평가합니다.'],['10%','README/메타데이터','설명, 토픽, 라이선스 등 공개 메타데이터 완성도를 반영합니다.'],['10%','직접 테스트 가능성','설치와 재현이 쉬운지를 평가합니다.']];
    return shell(`<section class="page method"><h1>Early Signal Score</h1><p>RepoPulse는 “가장 유명한 저장소”가 아니라 “지금 막 커지는 저장소”를 찾습니다. 데이터는 실시간 스트리밍이 아니라 6시간 주기의 GitHub Actions 스냅샷입니다.</p><div class="data-policy"><strong>데이터 계층</strong><span>Latest snapshot: 현재 랭킹</span><span>GitHub Star History: Repository별 최대 1년 일별 이력</span><span>Radar Archive: RepoPulse가 실제 관측한 6시간/일별 누적 기록</span><span>Daily Archive 보존: 최대 730일</span></div><div class="formula">${rows.map(([w,t,p])=>`<div class="formula-row"><strong>${w}</strong><h2>${t}</h2><p>${p}</p></div>`).join('')}</div></section>`,'methodology');
  }

  function exportCsv(){
    const headers=['fullName','categories','stars','star24h','star7d','star30d','star90d','star365d','acceleration','earlySignalScore'];
    const q=(v)=>`"${String(v??'').replaceAll('"','""')}"`;
    const rows=state.data.repositories.map(r=>headers.map(h=>q(h==='categories'?r.categories.join('|'):r[h])).join(','));
    const blob=new Blob([[headers.join(','),...rows].join('\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`repopulse-${state.data.generatedAt.slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  function render(){
    if(!state.data)return;
    const r=route();
    app.innerHTML = r.name==='repo'?detail(r.fullName):r.name==='timeline'?timelinePage():r.name==='categories'?categoriesPage():r.name==='archive'?archivePage():r.name==='watchlist'?watchlistPage():r.name==='methodology'?methodology():dashboard();
    bind();
  }

  function bind(){
    document.getElementById('themeToggle')?.addEventListener('click',()=>setTheme(theme()==='dark'?'light':'dark'));
    document.getElementById('menuBtn')?.addEventListener('click',()=>{state.mobile=!state.mobile;render();});
    document.getElementById('browserRefresh')?.addEventListener('click',()=>location.reload());
    document.getElementById('csvExport')?.addEventListener('click',exportCsv);
    document.querySelectorAll('[data-period]').forEach(b=>b.addEventListener('click',()=>{state.period=b.dataset.period;render();}));
    document.querySelectorAll('[data-timeline-period]').forEach(b=>b.addEventListener('click',()=>{state.timelinePeriod=b.dataset.timelinePeriod;render();}));
    document.querySelectorAll('[data-detail-period]').forEach(b=>b.addEventListener('click',()=>{state.detailPeriod=b.dataset.detailPeriod;render();}));
    document.querySelectorAll('[data-detail-mode]').forEach(b=>b.addEventListener('click',()=>{state.detailMode=b.dataset.detailMode;render();}));
    document.querySelectorAll('[data-archive-granularity]').forEach(b=>b.addEventListener('click',()=>{state.archiveGranularity=b.dataset.archiveGranularity;render();}));
    document.querySelectorAll('[data-archive-metric]').forEach(b=>b.addEventListener('click',()=>{state.archiveMetric=b.dataset.archiveMetric;render();}));
    document.querySelectorAll('[data-cat]').forEach(b=>b.addEventListener('click',()=>{state.category=b.dataset.cat;render();}));
    document.querySelectorAll('[data-category-jump]').forEach(b=>b.addEventListener('click',()=>{state.category=b.dataset.categoryJump; location.hash='#/';}));
    document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>location.hash='#/repo/'+encodeURIComponent(b.dataset.open)));
    document.querySelectorAll('[data-watch]').forEach(b=>b.addEventListener('click',()=>{ const fullName=b.dataset.watch; const repo=state.data.repositories.find(r=>r.fullName===fullName); let list=watched(); const exists=list.some(w=>w.fullName===fullName); list=exists?list.filter(w=>w.fullName!==fullName):[...list,{fullName,watchedAt:new Date().toISOString(),starsAtWatch:repo?.stars||0}]; setWatched(list); toast(exists?'Watchlist에서 제거했습니다.':'Watchlist에 저장했습니다.'); render(); }));
    document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{ try{await navigator.clipboard.writeText(b.dataset.copy||'');toast('클립보드에 복사했습니다.');}catch{toast('복사에 실패했습니다.');} }));
    const search=document.getElementById('search'); if(search) search.addEventListener('input',e=>{state.query=e.target.value;render();});
    const sort=document.getElementById('sort'); if(sort) sort.addEventListener('change',e=>{state.sort=e.target.value;render();});
  }

  addEventListener('hashchange',()=>{state.mobile=false;render();});
  Promise.all([
    fetch('./data/repositories.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`repositories.json HTTP ${r.status}`);return r.json();}),
    fetch('./data/radar-history.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null),
  ]).then(([data,archive])=>{state.data=data;state.archive=archive;render();}).catch(err=>{app.innerHTML=`<div class="loading-screen"><strong>Radar 데이터를 불러오지 못했습니다.</strong><span>${esc(err.message)}</span><button class="primary" onclick="location.reload()">다시 시도</button></div>`;});
})();
