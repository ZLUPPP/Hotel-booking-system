import {Select} from './Select';
import React, {useEffect, useState} from 'react';
import {api} from './api';
import {Dashboard} from './Dashboard';
import {AdminUsers} from './AdminUsers';
import {AdminOperations} from './AdminOperations';
import {detailsFor} from './roomDetails';
import {AdminRoomForm} from './AdminRoomForm';
import {Feedback, Icon, image, money} from './ui';
import './admin.css';

function Rooms({onChanged}) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    (async () => {
      const items = [];
      let result;
      do {
        result = await api(`/rooms?include_inactive=true&limit=100&offset=${items.length}`, {signal: controller.signal});
        items.push(...result.items);
      } while (items.length < result.total && result.items.length);
      if (!controller.signal.aborted) setRooms(items);
    })().catch(err => {if (!controller.signal.aborted) setError(err.message);}).finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [revision]);

  const active = rooms.filter(room => room.is_active).length;
  const filtered = rooms.filter(room => (status === 'all' || room.is_active === (status === 'active')) && (!category || room.room_type === category) && `${room.number} ${detailsFor(room)[0]}`.toLowerCase().includes(search.trim().toLowerCase()));
  const offset = Math.min(page * 8, Math.max(0, Math.ceil(filtered.length / 8) - 1) * 8);
  return <>
    <div className="admin-page-heading"><div><span className="section-kicker">ВАШ ОТЕЛЬ ПОД КОНТРОЛЕМ</span><h1>{editor !== null ? editor.id ? `Номер ${editor.number}` : 'Новый номер' : 'Номерной фонд'}</h1><p>{editor !== null ? 'Создайте пространство, в которое захочется вернуться.' : 'Место, где начинается гостеприимство.'}</p></div>{editor === null && <button className="primary" onClick={() => {setNotice(''); setEditor({});}} disabled={loading || Boolean(error)}><Icon name="plus" size={18}/>Добавить номер</button>}</div>
    {editor === null && <div className="admin-stats" aria-label="Статистика номерного фонда">{[['bed', 'Всего номеров', rooms.length], ['check', 'В каталоге', active], ['eyeOff', 'Скрыто', rooms.length - active]].map(([icon, label, value]) => <div className="admin-stat" key={label}><span className="admin-stat-icon"><Icon name={icon} size={22}/></span><div><span>{label}</span><strong>{loading || error ? '—' : value}</strong></div></div>)}</div>}
    <Feedback error={error} notice={notice}/>
    {editor !== null ? <AdminRoomForm key={editor.id || 'new'} room={editor.id ? editor : null} onCancel={() => setEditor(null)} onSaved={saved => {
      setRooms(current => [...current.filter(room => room.id !== saved.id), saved].sort((a, b) => a.number.localeCompare(b.number, 'ru', {numeric: true})));
      setNotice(editor.id ? `Номер ${saved.number}: изменения сохранены.` : `Номер ${saved.number} добавлен в каталог.`);
      setEditor(null); setSearch(''); setStatus('all'); setCategory(''); setPage(0); onChanged();
    }}/> : <section className="admin-inventory" aria-labelledby="inventory-title">
      <div className="admin-inventory-heading"><h2 id="inventory-title">Номера отеля <span>{rooms.length}</span></h2><span>Qonaq Hotel · Алматы</span></div>
      <div className="admin-toolbar"><label className="admin-search"><Icon name="search" size={19}/><input aria-label="Поиск номера" placeholder="Найти номер или категорию" value={search} onChange={event => {setSearch(event.target.value); setPage(0);}}/></label><label><span className="sr-only">Категория</span><Select value={category} onChange={event => {setCategory(event.target.value); setPage(0);}}><option value="">Все категории</option>{[...new Set(rooms.map(room => room.room_type))].map(type => <option key={type} value={type}>{detailsFor({room_type: type})[0]}</option>)}</Select></label><label><span className="sr-only">Статус</span><Select value={status} onChange={event => {setStatus(event.target.value); setPage(0);}}><option value="all">Все статусы</option><option value="active">В каталоге</option><option value="hidden">Скрытые</option></Select></label></div>
      {loading ? <div className="admin-empty" role="status">Загружаем номера…</div> : error ? <div className="admin-empty"><p>Не удалось загрузить номерной фонд.</p><button onClick={() => setRevision(value => value + 1)}>Попробовать снова</button></div> : filtered.length ? <>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th scope="col">Номер / категория</th><th scope="col">Гостей</th><th scope="col">Цена за ночь</th><th scope="col">Статус</th><th scope="col"><span className="sr-only">Действия</span></th></tr></thead><tbody>{filtered.slice(offset, offset + 8).map(room => {const [title, photo] = detailsFor(room); return <tr key={room.id}><td><div className="admin-room-cell"><img src={image(photo)} alt=""/><div><strong>№ {room.number}</strong><span>{title}</span></div></div></td><td><span className="admin-guests"><Icon name="guests" size={16}/>{room.capacity}</span></td><td><strong>{money(room.price_per_night, room.currency)}</strong></td><td><span className={`admin-badge ${room.is_active ? '' : 'is-hidden'}`}><Icon name={room.is_active ? 'check' : 'eyeOff'} size={14}/>{room.is_active ? 'В каталоге' : 'Скрыт'}</span></td><td><button className="icon-button" aria-label={`Редактировать номер ${room.number}`} onClick={() => {setNotice(''); setEditor(room);}}><Icon name="edit" size={18}/></button></td></tr>;})}</tbody></table></div>
        <div className="admin-table-footer"><span>Показано {offset + 1}–{Math.min(offset + 8, filtered.length)} из {filtered.length}</span><div><button className="icon-button" aria-label="Предыдущая страница" disabled={offset === 0} onClick={() => setPage(offset / 8 - 1)}><Icon name="left" size={17}/></button><button className="icon-button" aria-label="Следующая страница" disabled={offset + 8 >= filtered.length} onClick={() => setPage(offset / 8 + 1)}><Icon name="right" size={17}/></button></div></div>
      </> : <div className="admin-empty"><Icon name="bed" size={35}/><h3>{rooms.length ? 'Номера не найдены' : 'Всё начинается с первого номера'}</h3><p>{rooms.length ? 'Попробуйте другой запрос или сбросьте фильтры.' : 'Добавьте номер, чтобы гости могли забронировать проживание.'}</p><button onClick={() => {if (!rooms.length) setEditor({}); else {setSearch(''); setCategory(''); setStatus('all');}}}>{rooms.length ? 'Сбросить фильтры' : 'Добавить первый номер'}</button></div>}
    </section>}
    <p className="admin-footnote"><Icon name="lock" size={15}/>Изменения номерного фонда доступны только администраторам.</p>
  </>;
}

export function Admin({user, updateUser, goHome, attempts, onChanged}) {
  const [section, setSection] = useState('rooms');
  if (user.role !== 'admin') return null;
  return <main id="main" className="admin-shell"><aside className="admin-sidebar"><div className="admin-sidebar-title"><span className="admin-monogram"><Icon name="mark" size={25}/></span><div><strong>Qonaq Hotel</strong><span>Панель управления</span></div></div><span className="admin-nav-label">УПРАВЛЕНИЕ</span><nav aria-label="Разделы админки">{[['rooms', 'bed', 'Номерной фонд'], ['bookings', 'calendar', 'Бронирования'], ['calendar', 'calendar', 'Календарь занятости'], ['reports', 'chart', 'Статистика и отчёты'], ['users', 'guests', 'Пользователи']].map(([key, icon, label]) => <button key={key} aria-current={section === key ? 'page' : undefined} onClick={() => setSection(key)}><Icon name={icon} size={20}/>{label}</button>)}</nav><div className="admin-sidebar-bottom"><Icon name="pin" size={18}/><span>Алматы, Казахстан<small>Искусство быть дома</small></span></div></aside><div className="admin-workspace"><div className="admin-breadcrumb">Управление отелем <span>/</span> {section === 'rooms' ? 'Номерной фонд' : section === 'users' ? 'Пользователи' : section === 'calendar' ? 'Календарь занятости' : section === 'reports' ? 'Статистика и отчёты' : 'Бронирования'}</div>{section === 'rooms' ? <Rooms onChanged={onChanged}/> : section === 'users' ? <AdminUsers user={user}/> : section === 'calendar' || section === 'reports' ? <AdminOperations key={section} view={section}/> : <Dashboard embedded key={section} view={section} user={user} updateUser={updateUser} goHome={goHome} attempts={attempts}/>}</div></main>;
}
