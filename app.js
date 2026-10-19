const appState = {
  view: 'home',
  reviews: {
    airbnb: {
      eyebrow: 'NEEDS CLARIFICATION',
      title: '参考 Airbnb 的界面设计',
      summary: '客户提供了明确的网站，但没有说明需要参考哪些设计维度。系统将其保留为“待确认”，不会自动生成正式任务。',
      quote: '“I like Airbnb. Please make the Homesday app feel more like this.”',
      source: 'Teams · Client · Today 10:42 AM',
      impact: '暂不能评估',
      action: '复制澄清消息'
    },
    map: {
      eyebrow: 'CONFIRMED REQUIREMENT',
      title: '新增地图搜索与区域筛选',
      summary: '老板已在会议中确认加入地图。它会影响移动端的信息架构、筛选和预订流程。',
      quote: '“Students should be able to see where every homestay is located directly on a map.”',
      source: 'Teams Meeting · Boss · Oct 17',
      impact: '移动端 · 预计增加 2 天',
      action: '加入待办'
    },
    campaign: {
      eyebrow: 'POSSIBLE SCOPE CHANGE',
      title: '增加活动落地页视觉',
      summary: '原始项目基线包含移动端、响应式官网和基础 Logo，没有单独的营销活动页面。',
      quote: '“Could we also prepare a campaign landing page for the November launch?”',
      source: 'Outlook · Marketing · Oct 17',
      impact: 'Web · 可能影响交付日期',
      action: '生成范围确认文字'
    },
    research: { eyebrow:'TASK DETAIL', title:'竞品与用户流', summary:'梳理留学生、中介和住宿合作方的关键路径，并形成下一轮原型依据。', quote:'Internal task', source:'Homesday · Research', impact:'1h 30m', action:'标记完成' },
    logo: { eyebrow:'TASK DETAIL', title:'Logo 精修', summary:'整理方案 B 的字标比例和最小使用尺寸。', quote:'Internal task', source:'Northline · Brand', impact:'1h 30m', action:'打开任务' },
    motion: { eyebrow:'TASK DETAIL', title:'动态分镜', summary:'根据营销部的新尺寸要求调整社交媒体动画分镜。', quote:'Marketing request', source:'Orbit · Motion', impact:'2h', action:'打开任务' },
    review: { eyebrow:'MILESTONE', title:'Homesday 原型评审', summary:'与客户确认地图流程、界面语气和下一轮交付范围。', quote:'Prototype review', source:'Client meeting · Today', impact:'45m', action:'查看会议准备' }
  }
};

const views = [...document.querySelectorAll('.view')];
const navButtons = [...document.querySelectorAll('[data-nav]')];
const toast = document.getElementById('toast');
const modal = document.getElementById('captureModal');
const drawer = document.getElementById('detailDrawer');

function navigate(name) {
  const target = document.querySelector(`[data-view="${name}"]`);
  if (!target) return;
  appState.view = name;
  views.forEach(view => view.classList.toggle('active', view === target));
  document.querySelectorAll('.rail-item').forEach(button => button.classList.toggle('active', button.dataset.nav === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

navButtons.forEach(button => button.addEventListener('click', () => navigate(button.dataset.nav)));
document.querySelectorAll('[data-open-project]').forEach(button => button.addEventListener('click', () => navigate('project')));

document.querySelectorAll('[data-project-panel]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-project-panel]').forEach(item => item.classList.remove('active'));
  document.querySelectorAll('[data-project-content]').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  document.querySelector(`[data-project-content="${button.dataset.projectPanel}"]`)?.classList.add('active');
}));

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 1800);
}

function openDetail(key) {
  const item = appState.reviews[key] || appState.reviews.airbnb;
  document.getElementById('drawerEyebrow').textContent = item.eyebrow;
  document.getElementById('drawerBody').innerHTML = `
    <h2>${item.title}</h2>
    <p>${item.summary}</p>
    <div class="detail-source"><small>来源</small><b>${item.source}</b></div>
    <div class="detail-quote">${item.quote}</div>
    <div class="detail-source"><small>可能影响</small><b>${item.impact}</b></div>
    <div class="drawer-actions"><button data-drawer-action>${item.action}</button><button data-close-drawer-inner>暂时保留</button></div>`;
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  document.querySelector('[data-drawer-action]').addEventListener('click', () => {
    if (key === 'airbnb' || key === 'campaign') {
      navigator.clipboard?.writeText(key === 'airbnb'
        ? 'Hi, thanks for sharing the Airbnb reference. Could you confirm which parts you would like us to follow—layout, typography, color palette, photography style, or interaction pattern?'
        : 'Hi, I reviewed the campaign landing page request. This item was not included in the current project baseline. Could you confirm whether it should be added to this delivery and whether the deadline should be adjusted?');
      showToast('澄清消息已复制');
    } else showToast('已加入今天的待办');
  });
  document.querySelector('[data-close-drawer-inner]').addEventListener('click', closeDrawer);
}

function closeDrawer() { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); }
document.querySelectorAll('[data-detail]').forEach(button => button.addEventListener('click', () => openDetail(button.dataset.detail)));
document.querySelectorAll('[data-close-drawer]').forEach(button => button.addEventListener('click', closeDrawer));

function reviewDetail(key = 'airbnb') {
  const item = appState.reviews[key];
  const container = document.getElementById('reviewDetail');
  container.innerHTML = `<span class="eyebrow">${item.eyebrow}</span><h2>${item.title}</h2><p>${item.summary}</p><blockquote>${item.quote}</blockquote><dl><div><dt>来源</dt><dd>${item.source}</dd></div><div><dt>影响</dt><dd>${item.impact}</dd></div></dl><button data-review-action>${item.action}</button>`;
  container.querySelector('[data-review-action]').addEventListener('click', () => {
    openDetail(key);
  });
}
reviewDetail();
document.querySelectorAll('[data-review]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-review]').forEach(item => item.classList.remove('selected'));
  button.classList.add('selected');
  reviewDetail(button.dataset.review);
}));

document.querySelectorAll('[data-open-capture]').forEach(button => button.addEventListener('click', () => {
  modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
}));
document.querySelectorAll('[data-close-modal]').forEach(button => button.addEventListener('click', () => {
  modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true');
}));
document.querySelectorAll('[data-capture-tab]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-capture-tab]').forEach(item => item.classList.remove('active'));
  document.querySelectorAll('[data-capture-content]').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  document.querySelector(`[data-capture-content="${button.dataset.captureTab}"]`).classList.add('active');
}));
document.getElementById('analyzeButton').addEventListener('click', () => {
  const preview = document.getElementById('analysisPreview');
  preview.innerHTML = '<span>✓</span><div><b>识别完成：3 个信息块</b><p>1 个参考信息 · 1 个待确认要求 · 1 个建议任务。没有自动加入正式计划。</p></div>';
  document.getElementById('analyzeButton').textContent = '加入审核队列';
  document.getElementById('analyzeButton').onclick = () => { modal.classList.remove('open'); showToast('已加入 Homesday 审核队列'); navigate('reviews'); };
});

document.querySelector('[data-copy-message]').addEventListener('click', () => {
  navigator.clipboard?.writeText('Hi, thanks for sharing the Airbnb reference. Could you confirm which parts you would like us to follow—layout, typography, color palette, photography style, or interaction pattern?');
  showToast('澄清消息已复制');
});

const searchData = [
  { icon:'P', title:'Homesday App Design', meta:'项目 · 刚刚更新', action:() => navigate('project') },
  { icon:'T', title:'地图预订流程', meta:'任务 · Homesday · 今天 2:00 PM', action:() => navigate('calendar') },
  { icon:'R', title:'Airbnb 视觉方向', meta:'待确认 · 来自客户', action:() => { navigate('reviews'); reviewDetail('airbnb'); } },
  { icon:'S', title:'Homesday business plan.pdf', meta:'来源 · Outlook', action:() => navigate('project') }
];
const search = document.getElementById('globalSearch');
const searchPopover = document.getElementById('searchPopover');
function renderSearch() {
  const query = search.value.trim().toLowerCase();
  const items = searchData.filter(item => !query || `${item.title} ${item.meta}`.toLowerCase().includes(query));
  searchPopover.innerHTML = items.map((item, index) => `<button class="search-result" data-search-index="${index}"><i>${item.icon}</i><span><b>${item.title}</b><small>${item.meta}</small></span></button>`).join('') || '<div class="search-result">没有找到匹配内容</div>';
  searchPopover.classList.add('open');
  searchPopover.querySelectorAll('[data-search-index]').forEach((button, index) => button.addEventListener('click', () => { items[index].action(); searchPopover.classList.remove('open'); search.blur(); }));
}
search.addEventListener('focus', renderSearch);
search.addEventListener('input', renderSearch);
document.addEventListener('click', event => { if (!event.target.closest('.search-wrap')) searchPopover.classList.remove('open'); });
document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); search.focus(); } if (event.key === 'Escape') { closeDrawer(); modal.classList.remove('open'); searchPopover.classList.remove('open'); } });

document.querySelectorAll('#calendarSegments button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('#calendarSegments button').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  if (button.dataset.calendarMode !== 'week') showToast(`${button.textContent}视图将在下一轮原型中展开；当前保留周视图`);
}));

document.querySelectorAll('.task-item input').forEach(input => input.addEventListener('change', () => showToast(input.checked ? '完成一项，做得很好 ✦' : '任务已恢复')));


// V2 enhancements
const v2Confirmations = {
  airbnb: { title:'确认 Airbnb 参考范围', project:'Homesday', context:'客户提供了明确的网站，但没有说明希望参考布局、字体、配色、摄影还是交互方式。', message:'Hi, thanks for sharing the Airbnb reference. Could you clarify which design dimensions you would like us to follow—layout, typography, colour palette, photography style, interaction patterns, or the overall booking flow?' },
  print: { title:'确认包装印刷方式', project:'Northline', context:'客户要求颜色更准确，但没有确认印刷预算和具体工艺。', message:'Hi, before I finalise the packaging colour specifications, could you confirm whether production will use spot colours or standard CMYK printing? This will affect the colour values and files I prepare.' },
  vertical: { title:'确认竖屏视频交付范围', project:'Orbit', context:'营销部新增了 9:16 版本，但原始交付物只有 16:9 和 1:1。', message:'Hi team, could you confirm whether the new 9:16 vertical video should be included in the current delivery? The original scope includes 16:9 and 1:1 formats, so adding 9:16 may affect the production schedule.' },
  ai: { title:'确认 AI 匹配功能', project:'Homesday', context:'电话中提到 AI 匹配，但没有明确匹配对象和判断依据。', message:'Could you clarify what the AI matching feature should match—students with homes, students with agents, or homes with schools? It would also help to confirm which information should be used for the match.' },
  tone: { title:'确认品牌语气', project:'Northline', context:'客户认为标题“感觉不够对”，但没有提供清晰方向。', message:'Could you clarify whether the revised brand voice should feel more professional and established, or warmer and more approachable? If possible, please share one or two examples of the tone you prefer.' },
  deadline: { title:'确认提前交付的优先级', project:'Orbit', context:'发布时间提前两天，但交付内容没有同步减少。', message:'Since the launch date has moved forward by two days, could you confirm which deliverables should be prioritised first? I can then update the schedule and identify anything that should move to a later delivery.' }
};
function v2OpenConfirm(key) {
  const c = v2Confirmations[key] || v2Confirmations.airbnb;
  document.getElementById('drawerEyebrow').textContent = c.project.toUpperCase() + ' · AI CLARIFICATION';
  document.getElementById('drawerBody').innerHTML = '<h2>'+c.title+'</h2><p>'+c.context+'</p><div class="confirm-message" contenteditable="true">'+c.message+'</div><div class="drawer-actions"><button id="v2Copy">复制文字</button><button data-close-drawer-inner>暂时保留</button></div>';
  drawer.classList.add('open'); drawer.setAttribute('aria-hidden','false');
  document.getElementById('v2Copy').onclick = () => { navigator.clipboard?.writeText(c.message); showToast('澄清文字已复制'); };
  document.querySelector('[data-close-drawer-inner]').onclick = closeDrawer;
}
function v2OpenEditor(title='编辑任务') {
  document.getElementById('drawerEyebrow').textContent = 'EDIT SCHEDULE';
  document.getElementById('drawerBody').innerHTML = '<h2>'+title+'</h2><div class="center-form"><label class="wide">任务名称<input value="'+title+'"></label><label>日期<input type="date" value="2026-10-18"></label><label>项目<select><option>Homesday App Design</option><option>Northline Brand Refresh</option><option>Orbit Motion Campaign</option></select></label><label>开始时间<input type="time" value="09:00"></label><label>结束时间<input type="time" value="11:00"></label><label>项目颜色<input type="color" value="#72a3bf"></label><label>状态<select><option>未完成</option><option>已完成</option></select></label><label class="wide">备注<textarea>点击保存后更新项目时间线。</textarea></label></div><div class="drawer-actions"><button id="v2Save">保存修改</button><button data-close-drawer-inner>取消</button></div>';
  drawer.classList.add('open'); drawer.setAttribute('aria-hidden','false');
  document.getElementById('v2Save').onclick=()=>{showToast('时间安排已更新');closeDrawer()};
  document.querySelector('[data-close-drawer-inner]').onclick=closeDrawer;
}
document.querySelectorAll('.cal-event,.timeline-strip,.roadbar,.matrix-task').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();v2OpenEditor(el.innerText.trim().split('\n')[0])},true));
if(document.getElementById('floatingCapture')) document.getElementById('floatingCapture').onclick=()=>{modal.classList.add('open');modal.setAttribute('aria-hidden','false')};

const reviewScreen=document.createElement('section');
reviewScreen.className='view'; reviewScreen.id='reviewsScreen'; reviewScreen.dataset.view='reviews';
reviewScreen.innerHTML='<div class="page"><header class="topbar"><h1>待确认</h1><button class="icon-btn" data-open-capture>＋</button></header><p style="font-size:16px;color:#65747a;margin:0 0 20px">AI 已经整理好问题；确认内容后即可复制给对应的人。</p><div class="reviews-grid">'+[
 ['airbnb','Homesday','参考 Airbnb 的哪些设计维度？','客户 · Teams'],
 ['print','Northline','包装是否使用专色印刷？','客户 · Outlook'],
 ['vertical','Orbit','9:16 竖屏视频是否纳入本期？','营销部 · Teams'],
 ['ai','Homesday','AI 匹配具体解决什么问题？','老板 · 电话'],
 ['tone','Northline','品牌语气更专业还是更亲切？','客户 · Meeting'],
 ['deadline','Orbit','提前发布后哪些内容优先？','老板 · 电话']
].map(x=>'<article class="review-line"><span class="status-orb pending"></span><div><h3>'+x[2]+'</h3><p>'+x[3]+'</p></div><small>'+x[1]+' · AI 已生成文字</small><button class="confirm-action" data-v2-confirm="'+x[0]+'">去确认</button></article>').join('')+'</div></div>';
document.getElementById('profileScreen')?.before(reviewScreen);
const rail=document.querySelector('.rail-nav'); if(rail){const b=document.createElement('button');b.className='rail-item';b.dataset.nav='reviews';b.innerHTML='<span class="rail-icon">◇</span><small>确认</small><i class="nav-dot">6</i>';rail.insertBefore(b,rail.lastElementChild);b.onclick=()=>navigate('reviews')}
const bottom=document.querySelector('.bottom-nav'); if(bottom){const b=document.createElement('button');b.className='nav-btn';b.dataset.go='reviews';b.innerHTML='<b>◇</b><span>Confirm</span>';bottom.insertBefore(b,bottom.lastElementChild);b.onclick=()=>navigate('reviews')}
document.querySelectorAll('[data-v2-confirm]').forEach(b=>b.onclick=()=>v2OpenConfirm(b.dataset.v2Confirm));

document.querySelectorAll('.change-item').forEach((row,i)=>{if(!row.querySelector('.confirm-action')){const btn=document.createElement('button');btn.className='confirm-action';btn.textContent=i%2?'去确认':'查看';btn.onclick=e=>{e.stopPropagation();v2OpenConfirm(i%2?'airbnb':'vertical')};row.appendChild(btn)}});

const realGrid=document.querySelector('.reference-lab .reference-grid');
if(realGrid) realGrid.innerHTML =
 '<article class="reference-card"><img class="real-reference" src="https://images.surferseo.art/3f8cb604-8969-4281-a3ab-9d7bdc45044f.png" alt="Airbnb 搜索与地图真实界面"><div><span class="ref-tag">客户参考</span><b>Airbnb search + map</b><small>地图与房源列表并列</small><a class="real-source" href="https://www.igms.com/airbnb-categories/" target="_blank">来源：iGMS ↗</a></div></article>'+
 '<article class="reference-card"><img class="real-reference" src="https://static.semrush.com/blog/uploads/media/fc/26/fc26ae301fa27027cceec50e2bb2b5b6/d490c29786ceb453a40c83df128ce547/AD_4nXenUFzRT8EuzXb1KdOCvoGnhYaezX-oTTY9UENDFdSFXBdAeAbWdt71_jCoO3Xl57ukEmCodvP7ER1q9F106fVDayDRChzCiWd3XCkdSa-t9adntfZbh7029vjj_1XR3s6Kx5FieUliPGtbaOsHSNAKKGq3.png" alt="Airbnb 房源层级真实界面"><div><span class="ref-tag">AI 延伸</span><b>Listing hierarchy</b><small>图片优先、圆角卡片、轻量筛选</small><a class="real-source" href="https://www.semrush.com/blog/ux-design-examples/" target="_blank">来源：Semrush ↗</a></div></article>'+
 '<article class="reference-card"><img class="real-reference" src="https://www.hostfully.com/wp-content/uploads/2022/12/Airbnb-search-results-page.jpg" alt="Airbnb 房源结果真实界面"><div><span class="ref-tag">AI 延伸</span><b>Result comparison</b><small>位置、价格与评分同时比较</small><a class="real-source" href="https://www.hostfully.com/blog/how-to-automate-airbnb/" target="_blank">来源：Hostfully ↗</a></div></article>';

const calendarViews={day:document.getElementById('dayView'),week:document.getElementById('weekView'),month:document.getElementById('monthView')};
if(calendarViews.day){calendarViews.day.innerHTML='<div class="day-focus"><button class="event-block e1" data-edit-task><b>竞品与用户流</b><small>9:00–10:30 · Homesday</small></button><button class="event-block e2 gray" data-edit-task><b>Logo 精修</b><small>11:30–1:00 · Northline</small></button><button class="event-block e3" data-edit-task><b>动态分镜</b><small>2:00–4:30 · Orbit</small></button></div>'}
document.querySelectorAll('#calendarSegments button').forEach(button=>button.addEventListener('click',()=>{Object.values(calendarViews).forEach(v=>v?.classList.remove('active'));calendarViews[button.dataset.view]?.classList.add('active')}));
document.querySelectorAll('[data-edit-task]').forEach(el=>el.onclick=()=>v2OpenEditor(el.innerText.trim().split('\n')[0]));

const projectData={
 northline:{title:'Northline Brand Refresh',sub:'Northline Studio · Brand System · In progress',deadline:'Oct 29',tasks:['导出 Logo 方案 B','完成品牌色规范','整理包装刀模','确认印刷专色'],changes:['品牌主色改为暖黄色','增加社交媒体模板','包装印刷工艺待确认']},
 orbit:{title:'Orbit Motion Campaign',sub:'Orbit Labs · Motion Design · Scheduling',deadline:'Nov 02',tasks:['完成 15s 动态分镜','确认竖屏视频比例','输出字幕安全区','准备音乐节奏标记'],changes:['新增 9:16 竖屏视频','发布时间提前','增加无声字幕版本']}
};
document.querySelectorAll('.project-card').forEach(card=>{const id=card.classList.contains('northline')?'northline':card.classList.contains('orbit')?'orbit':'homesday';card.dataset.v2Project=id;card.onclick=()=>{const d=projectData[id];if(d){document.querySelector('.project-hero h1').textContent=d.title;document.querySelector('.project-hero>p').textContent=d.sub;document.querySelector('.hero-stats .hero-stat b').textContent=d.deadline;document.querySelectorAll('.kanban-col article b').forEach((el,i)=>el.textContent=d.tasks[i%d.tasks.length]);document.querySelectorAll('.change-table-row h4,.change-table-row b').forEach((el,i)=>{if(d.changes[i])el.textContent=d.changes[i]})}else{document.querySelector('.project-hero h1').textContent='Homesday App Design'}navigate('project')}});

document.querySelectorAll('.primary-button').forEach(btn=>{if(btn.textContent.includes('新增')||btn.textContent.includes('Add'))btn.addEventListener('click',e=>{if(btn.hasAttribute('data-open-capture'))return;e.preventDefault();v2OpenEditor('新增任务')})});
document.querySelectorAll('.task-item input').forEach(input=>input.addEventListener('change',()=>showToast(input.checked?'任务已完成 ✓':'任务已恢复')));

/* V2 FINAL NAVIGATION — handled by scoped review listener */
/* V2 CLEAN REVIEW ROWS */
document.querySelectorAll('.change-item').forEach((row,index)=>{
  row.querySelectorAll('.confirm-action').forEach(x=>x.remove());
  const action=row.querySelector('em');
  if(action) action.textContent=index===1?'查看':'去确认';
  const clean=row.cloneNode(true);
  row.replaceWith(clean);
  clean.addEventListener('click',()=>v2OpenConfirm(index===0?'airbnb':index===1?'map':'tone'));
});

/* V2 REVIEW NAV FIX */
document.querySelectorAll('[data-nav="reviews"]').forEach(control=>{
  control.addEventListener('click',(event)=>{
    event.preventDefault();event.stopImmediatePropagation();
    document.querySelectorAll('.view').forEach(view=>view.classList.toggle('active',view.dataset.view==='reviews'));
    document.querySelectorAll('.rail-item').forEach(item=>item.classList.toggle('active',item.dataset.nav==='reviews')); document.querySelectorAll('.bottom-nav [data-go]').forEach(item=>item.classList.toggle('active',item.dataset.go==='reviews'));
    window.scrollTo({top:0,behavior:'smooth'});
  },true);
});
