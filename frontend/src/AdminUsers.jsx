import {Select} from './Select';
import React, {useEffect, useRef, useState} from 'react';
import {api} from './api';
import {Feedback, Icon} from './ui';

const roles = {guest: 'Гость', receptionist: 'Сотрудник стойки', admin: 'Администратор'};
const limit = 12;
const initialQuery = {search: '', role: '', active: '', offset: 0};

function UserForm({entry, currentUser, onSaved, onCancel}) {
  const [role, setRole] = useState(entry.role);
  const [active, setActive] = useState(entry.is_active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const isSelf = entry.id === currentUser.id;
  const changed = role !== entry.role || active !== entry.is_active;

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || !changed || isSelf) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const updated = await api(`/users/${entry.id}`, {method: 'PATCH', body: {role, is_active: active}});
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <section className="admin-editor" aria-labelledby="user-form-title">
    <div className="admin-section-heading"><div><span className="section-kicker">ДОСТУП К ОТЕЛЮ</span><h2 id="user-form-title">{entry.full_name}</h2><p>{entry.email}</p></div><button onClick={onCancel} disabled={busy}>Закрыть</button></div>
    <form className="admin-room-form" onSubmit={submit}>
      <fieldset disabled={busy || isSelf}><legend>Права пользователя</legend><p>Роль определяет доступ к бронированиям и управлению отелем.</p>
        <div className="admin-form-grid"><label>Роль<Select autoFocus name="role" value={role} onChange={event => setRole(event.target.value)}>{Object.entries(roles).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select></label></div>
        <p className="admin-role-description">{role === 'admin' ? 'Управление номерами, пользователями и всеми бронированиями.' : role === 'receptionist' ? 'Просмотр всех бронирований, отмена броней и история платежей.' : 'Бронирование номеров и управление собственными бронями.'}</p>
        <label className="check"><input type="checkbox" name="active" checked={active} onChange={event => setActive(event.target.checked)}/>Аккаунт активен</label>
        {!active && <p className="admin-role-description">Пользователь не сможет войти или выполнять действия в аккаунте. История бронирований сохранится.</p>}
      </fieldset>
      {isSelf && <p className="notice">Вы вошли под этим аккаунтом. Изменение собственной роли и отключение доступа недоступны.</p>}
      <Feedback error={error}/>
      <div className="admin-form-actions"><span><Icon name="lock" size={16}/>Изменения применятся сразу</span><button type="submit" className="primary" disabled={busy || !changed || isSelf}>{busy ? 'Сохраняем…' : 'Сохранить изменения'}</button></div>
    </form>
  </section>;
}

export function AdminUsers({user}) {
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState({items: [], total: 0});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({limit: String(limit), offset: String(query.offset)});
      if (query.search.trim()) params.set('search', query.search.trim());
      if (query.role) params.set('role', query.role);
      if (query.active) params.set('is_active', query.active);
      try {
        const result = await api(`/users?${params}`, {signal: controller.signal});
        if (controller.signal.aborted) return;
        if (query.offset && query.offset >= result.total) {
          setQuery(current => ({...current, offset: Math.max(0, Math.ceil(result.total / limit) - 1) * limit}));
          return;
        }
        setPage(result);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {window.clearTimeout(timer); controller.abort();};
  }, [query, revision]);

  function filter(name, value) {
    setLoading(true);
    setQuery(current => ({...current, [name]: value, offset: 0}));
  }

  return <>
    <div className="admin-page-heading"><div><span className="section-kicker">КОМАНДА И ГОСТИ</span><h1>Пользователи</h1><p>Доступ к отелю начинается с нужной роли.</p></div><span className="admin-badge"><Icon name="lock" size={15}/>Только для администратора</span></div>
    <Feedback notice={notice}/>
    {editor ? <UserForm key={editor.id} entry={editor} currentUser={user} onCancel={() => setEditor(null)} onSaved={updated => {
      setEditor(null);
      setNotice(`Права пользователя «${updated.full_name}» сохранены.`);
      setLoading(true);
      setRevision(value => value + 1);
    }}/> : <section className="admin-inventory" aria-labelledby="users-title" aria-busy={loading}>
      <div className="admin-inventory-heading"><h2 id="users-title">Аккаунты <span>{loading ? '…' : error ? '—' : page.total}</span></h2><span>Гости и сотрудники Qonaq</span></div>
      <div className="admin-toolbar">
        <label className="admin-search"><Icon name="search" size={19}/><input aria-label="Поиск пользователей" placeholder="Имя или электронная почта" maxLength={100} value={query.search} onChange={event => filter('search', event.target.value)}/></label>
        <label><span className="sr-only">Роль пользователя</span><Select value={query.role} onChange={event => filter('role', event.target.value)}><option value="">Все роли</option>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></label>
        <label><span className="sr-only">Статус аккаунта</span><Select value={query.active} onChange={event => filter('active', event.target.value)}><option value="">Все статусы</option><option value="true">Активные</option><option value="false">Отключённые</option></Select></label>
      </div>
      {loading ? <div className="admin-empty" role="status">Загружаем пользователей…</div> : error ? <div className="admin-empty"><Feedback error={error}/><button onClick={() => setRevision(value => value + 1)}>Попробовать снова</button></div> : page.items.length ? <>
        <div className="admin-table-wrap"><table className="admin-table admin-users-table"><thead><tr><th scope="col">Пользователь</th><th scope="col">Роль</th><th scope="col">Статус</th><th scope="col"><span className="sr-only">Действия</span></th></tr></thead><tbody>{page.items.map(entry => <tr key={entry.id}>
          <td><div className="admin-user-cell"><span className="admin-avatar" aria-hidden="true">{entry.full_name.trim().slice(0, 1).toLocaleUpperCase('ru')}</span><div><strong>{entry.full_name}{entry.id === user.id && <small> · Вы</small>}</strong><span>{entry.email}</span></div></div></td>
          <td>{roles[entry.role] || entry.role}</td><td><span className={`admin-badge ${entry.is_active ? '' : 'is-hidden'}`}><Icon name={entry.is_active ? 'check' : 'lock'} size={14}/>{entry.is_active ? 'Активен' : 'Отключён'}</span></td>
          <td><button className="icon-button" aria-label={`Изменить права: ${entry.full_name}`} onClick={() => {setNotice(''); setEditor(entry);}}><Icon name="edit" size={18}/></button></td>
        </tr>)}</tbody></table></div>
        <div className="admin-table-footer"><span>Показано {query.offset + 1}–{query.offset + page.items.length} из {page.total}</span><div><button className="icon-button" aria-label="Предыдущая страница пользователей" disabled={!query.offset} onClick={() => {setLoading(true); setQuery(current => ({...current, offset: current.offset - limit}));}}><Icon name="left" size={17}/></button><button className="icon-button" aria-label="Следующая страница пользователей" disabled={query.offset + limit >= page.total} onClick={() => {setLoading(true); setQuery(current => ({...current, offset: current.offset + limit}));}}><Icon name="right" size={17}/></button></div></div>
      </> : <div className="admin-empty"><Icon name="guests" size={35}/><h3>Пользователи не найдены</h3><p>Попробуйте другое имя, почту или сбросьте фильтры.</p><button onClick={() => {setLoading(true); setQuery({...initialQuery});}}>Сбросить фильтры</button></div>}
    </section>}
  </>;
}
