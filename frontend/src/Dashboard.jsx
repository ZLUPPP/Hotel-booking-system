import {Select} from './Select';
import React, {useEffect, useState} from 'react';
import {api} from './api';
import {Pagination} from './Home';
import {BookingCard} from './BookingCard';
import {Feedback} from './ui';

export const pageSize = 12;
export const emptyPage = {items: [], total: 0, offset: 0, limit: pageSize};

const roles = {guest: 'Гость', receptionist: 'Администратор стойки', admin: 'Администратор системы'};

function UserEditor({user, busy, save}) {
  return <form className="panel user-editor" onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    save({role: data.get('role'), is_active: data.has('active')});
  }}>
    <div><h2>{user.full_name}</h2><p>{user.email}</p></div>
    <label>Роль<Select name="role" defaultValue={user.role}>
      {Object.entries(roles).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
    </Select></label>
    <label className="check"><input type="checkbox" name="active" defaultChecked={user.is_active}/>Активен</label>
    <button disabled={busy}>Сохранить</button>
  </form>;
}

export function Dashboard({view, user, updateUser, created, goHome, attempts, embedded = false}) {
  const [page, setPage] = useState(emptyPage);
  const [busy, setBusy] = useState(view !== 'profile');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(created ? 'Бронь создана. Её можно оплатить в личном кабинете.' : '');
  const [history, setHistory] = useState({});
  const [cancelId, setCancelId] = useState(null);
  const titles = {bookings: user.role === 'guest' ? 'Мои бронирования' : 'Все бронирования', users: 'Пользователи', profile: 'Мой профиль'};

  async function load(offset = 0, signal) {
    const result = await api(`/${view}?limit=${pageSize}&offset=${offset}`, {signal});
    setPage(result);
  }

  useEffect(() => {
    if (view === 'profile') return;
    const controller = new AbortController();
    load(0, controller.signal).catch(err => {
      if (!controller.signal.aborted) setError(err.message);
    }).finally(() => {
      if (!controller.signal.aborted) setBusy(false);
    });
    return () => controller.abort();
  }, [view]);

  async function run(work) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function hideHistory(id) {
    setHistory(current => {
      const next = {...current};
      delete next[id];
      return next;
    });
  }

  function pay(booking, outcome) {
    run(async () => {
      const attempt = attempts.current[booking.id] || {key: crypto.randomUUID(), outcome};
      attempts.current[booking.id] = attempt;
      const result = await api(`/bookings/${booking.id}/payments`, {method: 'POST', body: {outcome: attempt.outcome}, key: attempt.key});
      delete attempts.current[booking.id];
      hideHistory(booking.id);
      setNotice(result.payment.status === 'failed' ? 'Учебный платёж отклонён. Можно повторить оплату.' : 'Учебная оплата прошла. Бронь подтверждена.');
      await load(page.offset);
    });
  }

  const Container = embedded ? 'section' : 'main';
  return <Container id={embedded ? undefined : "main"} className="container dashboard">
    <h1>{titles[view]}</h1>
    <Feedback error={error} notice={notice}/>
    {view === 'profile' ? <form className="panel account-form profile-form" onSubmit={event => {
      event.preventDefault();
      const body = Object.fromEntries(new FormData(event.currentTarget));
      run(async () => {
        updateUser(await api('/users/me', {method: 'PATCH', body}));
        setNotice('Профиль сохранён.');
      });
    }}>
      <label>Имя и фамилия<input name="full_name" autoComplete="name" maxLength={200} required defaultValue={user.full_name}/></label>
      <label>Электронная почта<input name="email" autoComplete="email" type="email" maxLength={254} required defaultValue={user.email}/></label>
      <button className="primary" disabled={busy}>Сохранить профиль</button>
    </form> : <div className="stack">
      {busy && page.items.length === 0 && <p role="status">Загрузка…</p>}
      {view === 'bookings' && page.items.map(booking => <div key={booking.id}>
        <BookingCard booking={booking} user={user} busy={busy} history={history[booking.id]}
          onCancel={() => setCancelId(booking.id)} onPay={outcome => pay(booking, outcome)} onHistory={() => {
            if (history[booking.id]) {
              hideHistory(booking.id);
              return;
            }
            run(async () => {
              const result = await api(`/bookings/${booking.id}/payments?limit=100`);
              setHistory(current => ({...current, [booking.id]: result.items}));
            });
          }}/>
        {cancelId === booking.id && <div className="panel cancel-confirm">
          <p>Отменить бронирование на эти даты?</p>
          <button disabled={busy} onClick={() => run(async () => {
            await api(`/bookings/${booking.id}/cancel`, {method: 'POST'});
            setCancelId(null);
            setNotice('Бронь отменена.');
            await load(page.offset);
          })}>Подтвердить отмену</button>
          <button disabled={busy} onClick={() => setCancelId(null)}>Оставить бронь</button>
        </div>}
      </div>)}
      {view === 'users' && page.items.map(entry => <UserEditor key={entry.id} user={entry} busy={busy} save={body => run(async () => {
        const updated = await api(`/users/${entry.id}`, {method: 'PATCH', body});
        if (entry.id === user.id) updateUser(updated);
        if (entry.id !== user.id || updated.role === 'admin') await load(page.offset);
        setNotice('Пользователь обновлён.');
      })}/>)}
      {!busy && !error && !page.items.length && <div className="empty">
        <h2>{view === 'bookings' ? 'Бронирований пока нет' : 'Пользователей пока нет'}</h2>
        {view === 'bookings' && <a className="secondary" href="#rooms" onClick={goHome}>Выбрать номер</a>}
      </div>}
      <Pagination page={page} pending={busy} onPage={offset => run(() => load(offset))}/>
    </div>}
  </Container>;
}
