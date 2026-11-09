const dateKey = date => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei'}).format(new Date());
const escapeText = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function mountCalendar(root, request) {
  let selected = today(), entries = [], generation = 0, loading = false, saving = false;
  const monthStart = offset => {
    const [y,m] = selected.split('-').map(Number);
    return new Date(y,m-1+offset,1,12);
  };
  function render(message='') {
    const start = monthStart(0), end = monthStart(1);
    let cells = '<span></span>'.repeat(start.getDay());
    for (let day = new Date(start); day < end; day.setDate(day.getDate()+1)) {
      const key = dateKey(day), count = entries.filter(e=>e.day===key).length;
      cells += '<button type="button" data-date="'+key+'" aria-pressed="'+(key===selected)+'" class="'+(key===today()?'today':'')+'">'+day.getDate()+'<small>'+(count?count+' 件':'')+'</small></button>';
    }
    const list = entries.filter(e=>e.day===selected);
    root.innerHTML = '<h2>社區行事曆</h2><div class="cal-layout"><section><div class="cal-tools"><button data-month="-1" aria-label="上個月">‹</button><b>'+start.getFullYear()+' 年 '+(start.getMonth()+1)+' 月</b><button data-month="1" aria-label="下個月">›</button><button data-today>今天</button></div><div class="cal-grid">'+Array.from('日一二三四五六',v=>'<strong>'+v+'</strong>').join('')+cells+'</div></section><section class="cal-agenda"><div class="cal-tools"><h3>'+selected.slice(5).replace('-',' 月 ')+' 日記事</h3><button data-add>＋ 新增記事</button></div><div role="status">'+(message?escapeText(message):list.length?'':'當日尚無記事')+'</div>'+list.map(e=>'<article><small>'+escapeText(e.at_time?.slice(0,5)||'全天')+'</small><b>'+(e.reminder?'<span aria-label="需要提醒">🔔</span> ':'')+escapeText(e.title)+'</b><p>'+escapeText(e.note)+'</p><div><button data-edit="'+escapeText(e.id)+'">編輯</button> <button data-delete="'+escapeText(e.id)+'">刪除</button></div></article>').join('')+'<div class="cal-form"></div></section></div>';
  }
  async function load() {
    const seq = ++generation;
    entries=[]; loading=true; render('讀取記事中…');
    try {
      const rows = await request('?select=id,day,title,at_time,note,reminder&day=gte.'+dateKey(monthStart(0))+'&day=lt.'+dateKey(monthStart(1))+'&order=day,at_time.asc.nullsfirst,title');
      if(seq===generation){ entries=rows; loading=false; render(); }
    } catch { if(seq===generation){loading=false;render('無法讀取記事，請重新整理。');} }
  }
  root.onclick = async event => {
    const btn=event.target.closest('button');
    if(!btn || saving || root.querySelector('form [type=submit]:disabled'))return;
    if(btn.dataset.month){selected=dateKey(monthStart(Number(btn.dataset.month)));load();}
    else if(btn.hasAttribute('data-today')){selected=today();load();}
    else if(btn.dataset.date && !loading){selected=btn.dataset.date;render();}
    else if(btn.hasAttribute('data-cancel'))render();
    else if(btn.dataset.delete){
      const entry=entries.find(item=>item.id===btn.dataset.delete);
      if(!entry || !window.confirm('確定刪除 '+entry.day+' 的「'+entry.title+'」嗎？'))return;
      saving=true;
      try {
        await request('?id=eq.'+entry.id, undefined, 'DELETE');
        await load();
      } catch {root.querySelector('[role=status]').textContent='刪除未完成，請重新整理後再試。';}
      finally {saving=false;}
    }
    else if((btn.hasAttribute('data-add') || btn.dataset.edit) && !loading){
      const entry=entries.find(item=>item.id===btn.dataset.edit);
      const holder=root.querySelector('.cal-form');

      holder.innerHTML='<form><h4>'+ (entry?'編輯記事':'新增記事') +'</h4><label>日期<input type="date" name="day" required></label><label>記事標題<input name="title" maxlength="100" required></label><label>時間（選填）<input type="time" name="time"></label><label>交班備註（選填）<textarea name="note" maxlength="1000"></textarea></label><label><input type="checkbox" name="reminder"> 需要提醒</label><div><button type="button" data-cancel>取消</button> <button type="submit" class="primary">儲存記事</button></div><span role="status"></span></form>';
      const form=holder.firstChild,id=crypto.randomUUID();form.elements.day.value=entry?.day||selected;
      form.elements.title.value=entry?.title||'';
      form.elements.time.value=entry?.at_time?.slice(0,5)||'';
      form.elements.note.value=entry?.note||'';
      form.elements.reminder.checked=Boolean(entry?.reminder);
      form.elements.title.focus();
      form.onsubmit=async e=>{
        e.preventDefault();const data=new FormData(form),title=data.get('title').trim();
        if(!title){form.elements.title.focus();return;}
        const save=form.querySelector('[type=submit]');save.disabled=true;
        try {
          const values={day:data.get('day'),title,at_time:data.get('time')||null,note:data.get('note').trim(),reminder:data.has('reminder')};
          if(entry)await request('?id=eq.'+entry.id,values,'PATCH');
          else await request('',{id,...values});
          selected=values.day;
          await load();
        }
        catch {save.disabled=false;form.querySelector('[role=status]').textContent='無法確認是否儲存，請重試。';}
      };
    }
  };
  await load();
}
