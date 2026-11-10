const roles = {
  system_admin: '系統管理員', manager: '社區經理',
  security: '社區保全', committee: '社區委員'
};

export async function mountAccounts(root, rpc) {
  if (await rpc('my_role', {}) !== 'system_admin' || !root.isConnected) return;
  root.innerHTML = '<h2>系統管理</h2><button type="button" class="module-entry">帳號與權限 →</button>';
  root.querySelector('button').onclick = async () => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-label','帳號與權限');
    dialog.style.cssText='width:min(42rem,92vw);max-height:85vh;overflow:auto;padding:clamp(18px,3vw,32px);border:1px solid #bfd5ce;border-radius:18px;color:#173934';
    dialog.innerHTML = '<h2>帳號與權限</h2><button data-add>新增帳號權限</button> <button data-close>關閉</button><div data-list></div><form hidden><p data-note></p><label class="field">電子郵件<input type="email" required></label><label class="field">角色<select></select></label><label><input type="checkbox"> 啟用帳號</label><button class="primary">儲存</button></form><p role="status"></p>';
    document.body.append(dialog);
    dialog.onclose = () => dialog.remove();
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    const form = dialog.querySelector('form');
    const email = form.querySelector('[type=email]');
    const enabled = form.querySelector('[type=checkbox]');
    const role = form.querySelector('select');
    const status = dialog.querySelector('[role=status]');
    for (const [key,label] of Object.entries(roles)) role.add(new Option(label,key));
    function edit(account) {
      form.hidden = false;
      email.readOnly = Boolean(account);
      form.querySelector('[data-note]').textContent=account?'編輯角色與啟用狀態':'請輸入已在測試專案建立的登入信箱。';
      email.value = account?.email || '';
      role.value = account?.role || 'security';
      enabled.checked = account?.enabled ?? true;
      status.textContent = '';
      (account ? role : email).focus();
    }
    async function refresh() {
      const accounts = await rpc('accounts',{});
      const list = dialog.querySelector('[data-list]');
      list.replaceChildren();
      for (const account of accounts) {
        const row = document.createElement('p');
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.textContent = '編輯';
        editButton.onclick = () => edit(account);
        row.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #d6e4df;padding:12px 0;overflow-wrap:anywhere';
        row.append(account.email + ' · ' + roles[account.role] + ' · ' + (account.enabled?'啟用':'停用') + ' ',editButton);
        list.append(row);
      }
    }
    dialog.querySelector('[data-add]').onclick = () => edit(null);
    form.onsubmit = async event => {
      event.preventDefault();
      const save = form.querySelector('button');
      save.disabled = true;
      try {
        await rpc('save_account',{p_email:email.value.trim(),p_role:role.value,p_enabled:enabled.checked,p_create:!email.readOnly});
        form.hidden = true;
        await refresh();
        status.textContent = '已儲存';
      } catch (error) { status.textContent = error.message; }
      finally { save.disabled = false; }
    };
    dialog.showModal();
    try { await refresh(); } catch (error) { status.textContent = error.message; }
  };
}
