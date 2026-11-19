import {Select} from './Select';
import React, {useEffect, useState} from 'react';
import {api} from './api';
import {Pagination} from './Home';
import {BookingCard} from './BookingCard';
import {Feedback, Icon, money} from './ui';

export const pageSize = 12;
export const emptyPage = {items: [], total: 0, offset: 0, limit: pageSize};

const roles = {guest: 'Гость', receptionist: 'Администратор стойки', admin: 'Администратор системы'};
const roomTypeLabel = type => ({standard: 'Классический', deluxe: 'Делюкс', studio: 'Студия', family: 'Семейный', suite: 'Люкс', residence: 'Резиденция'}[type] || type);

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

export function Dashboard({view, user, updateUser, created, goHome, onBookings, onLogout, attempts, embedded = false}) {
  const [profilePanel, setProfilePanel] = useState('personal');
  const [profileRooms, setProfileRooms] = useState([]);
  const [profileRoomsLoaded, setProfileRoomsLoaded] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('qonaq.favorite-rooms') || '[]'); } catch { return []; }
  });
  const [travelers, setTravelers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('qonaq.travelers') || '[]'); } catch { return []; }
  });
  const [newsletter, setNewsletter] = useState(() => localStorage.getItem('qonaq.newsletter') === 'true');
  const [profileExtras, setProfileExtras] = useState(() => {
    try { return JSON.parse(localStorage.getItem('qonaq.profile-details') || '{}'); } catch { return {}; }
  });
  const [personalizedOffers, setPersonalizedOffers] = useState(() => localStorage.getItem('qonaq.personalized-offers') === 'true');
  const [defaultGuests, setDefaultGuests] = useState(() => localStorage.getItem('qonaq.default-guests') || '2');
  const [page, setPage] = useState(emptyPage);
  const [busy, setBusy] = useState(view !== 'profile');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(created ? 'Бронь создана. Её можно оплатить в личном кабинете.' : '');
  const [history, setHistory] = useState({});
  const [cancelId, setCancelId] = useState(null);
  const titles = {bookings: user.role === 'guest' ? 'Мои бронирования' : 'Все бронирования', users: 'Пользователи', profile: 'Мой профиль'};

  useEffect(() => {
    if (view !== 'profile' || profilePanel !== 'favorites' || profileRoomsLoaded) return;
    api('/rooms?limit=100&offset=0').then(result => setProfileRooms(result.items)).catch(err => setError(err.message))
      .finally(() => setProfileRoomsLoaded(true));
  }, [view, profilePanel, profileRoomsLoaded]);

  function updateFavorites(next) {
    setFavoriteIds(next);
    localStorage.setItem('qonaq.favorite-rooms', JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('qonaq-favorites-changed', {detail: next}));
  }

  function updateTravelers(next) {
    setTravelers(next);
    localStorage.setItem('qonaq.travelers', JSON.stringify(next));
  }

  const profileTitles = {trips: 'Поездки и бронирования', favorites: 'Избранное', reviews: 'Мои отзывы', personal: 'Личные данные', security: 'Настройки безопасности', travelers: 'Другие путешественники', preferences: 'Настройки отображения', payments: 'Способы оплаты', newsletter: 'Настройка получения рассылок', privacy: 'Конфиденциальность и управление данными'};
  const profileDescriptions = {
    trips: 'Проверяйте и меняйте свои бронирования.', favorites: 'Сохранённые номера, к которым вы хотите вернуться.',
    reviews: 'Отзывы о ваших поездках.', personal: 'Обновите свои данные и проверьте, как они используются.',
    security: 'Управляйте безопасностью входа в аккаунт.', travelers: 'Данные людей, которые путешествуют вместе с вами.',
    preferences: 'Выберите параметры для удобного планирования поездок.', payments: 'Сведения об оплате и способах оплаты бронирований.',
    newsletter: 'Выберите, получать ли новости и предложения отеля.', privacy: 'Просматривайте и скачивайте данные своего аккаунта.',
  };

  function profilePanelContent(key) {
    if (key === 'trips') return <><p>Проверяйте даты проживания, статус брони и историю оплаты в одном месте.</p><button type="button" className="primary" onClick={onBookings}>Открыть мои бронирования <Icon name="arrow" size={17}/></button></>;
    if (key === 'favorites') return <><p>Сохраняйте понравившиеся номера, чтобы быстро вернуться к ним.</p>
      {!profileRoomsLoaded ? <p role="status">Загружаем номера…</p> : <div className="profile-favorite-list">{profileRooms.map(room => {
        const favorite = favoriteIds.includes(room.id);
        return <div className="profile-favorite-row" key={room.id}><span><strong>Номер {room.number}</strong><small>{roomTypeLabel(room.room_type)} · {money(room.price_per_night, room.currency)} за ночь</small></span>
          <button type="button" className={favorite ? 'favorite-toggle is-saved' : 'favorite-toggle'} aria-pressed={favorite}
            onClick={() => updateFavorites(favorite ? favoriteIds.filter(id => id !== room.id) : [...favoriteIds, room.id])}>
            <Icon name="heart" size={18}/>{favorite ? 'В избранном' : 'Сохранить'}
          </button></div>;
      })}</div>}</>;
    if (key === 'reviews') return <><p>После проживания здесь будут собраны ваши отзывы об отеле.</p>
      <div className="profile-empty-state"><Icon name="chat" size={25}/><strong>Пока нет опубликованных отзывов</strong><span>Здесь появятся отзывы, которыми вы поделитесь после поездки.</span></div>
      <button type="button" className="secondary" onClick={onBookings}>Перейти к поездкам <Icon name="arrow" size={17}/></button></>;
    if (key === 'personal') return <><p>Контактная информация для ваших бронирований.</p>
      <form id="profile-details" className="account-form profile-form" onSubmit={event => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const body = {full_name: data.get('full_name'), email: data.get('email')};
        const extras = Object.fromEntries(['display_name', 'phone', 'birth_date', 'citizenship', 'gender', 'address'].map(field => [field, data.get(field)]));
        run(async () => {
          updateUser(await api('/users/me', {method: 'PATCH', body}));
          setProfileExtras(extras);
          localStorage.setItem('qonaq.profile-details', JSON.stringify(extras));
          setNotice('Профиль сохранён.');
        });
      }}>
        <div className="profile-personal-grid">
          <label>Имя и фамилия<input name="full_name" autoComplete="name" maxLength={200} required defaultValue={user.full_name}/></label>
          <label>Отображаемое имя<input name="display_name" autoComplete="nickname" maxLength={80} defaultValue={profileExtras.display_name || ''} placeholder="Как к вам обращаться"/></label>
          <label>Электронная почта<input name="email" autoComplete="email" type="email" maxLength={254} required defaultValue={user.email}/></label>
          <label>Номер телефона<input name="phone" autoComplete="tel" type="tel" maxLength={32} defaultValue={profileExtras.phone || ''} placeholder="+7 …"/></label>
          <label>Дата рождения<input name="birth_date" type="date" autoComplete="bday" defaultValue={profileExtras.birth_date || ''}/></label>
          <label>Гражданство<input name="citizenship" autoComplete="country-name" maxLength={80} defaultValue={profileExtras.citizenship || ''} placeholder="Например, Казахстан"/></label>
          <label>Пол<select name="gender" defaultValue={profileExtras.gender || ''}><option value="">Не указано</option><option value="female">Женский</option><option value="male">Мужской</option><option value="other">Другое</option><option value="prefer-not">Не хочу указывать</option></select></label>
          <label className="profile-address-field">Адрес<input name="address" autoComplete="street-address" maxLength={240} defaultValue={profileExtras.address || ''} placeholder="Город, улица, дом"/></label>
        </div>
        <small>Дополнительные поля сохраняются в этом браузере. Имя и электронная почта сохраняются в аккаунте.</small>
        <button className="primary" disabled={busy}><Icon name="check" size={17}/>{busy ? 'Сохраняем…' : 'Сохранить изменения'}</button>
      </form></>;
    if (key === 'security') return <div className="account-data-list">
      <div className="account-data-row"><strong>Пароль</strong><span>••••••••••</span><span className="account-row-note">Для входа используется пароль аккаунта.</span></div>
      <div className="account-data-row"><strong>Активный аккаунт</strong><span>{roles[user.role] || 'Гость'}</span><span className="account-row-note">Вход выполнен на этом устройстве.</span><button type="button" className="text-button" onClick={onLogout}>Выйти</button></div>
      <div className="account-data-row"><strong>Ключи доступа и двухфакторная защита</strong><span>Не подключены</span><span className="account-row-note">В текущей версии сайта доступен вход по паролю.</span></div>
    </div>;
    if (key === 'travelers') return <><p>Добавьте данные спутников, чтобы они были под рукой при планировании поездки.</p>
      <form className="traveler-add-form" onSubmit={event => {event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const name = String(data.get('traveler') || '').trim(); if (name) {updateTravelers([...travelers, {id: crypto.randomUUID(), name}]); form.reset();}}}>
        <label>Имя путешественника<input name="traveler" autoComplete="off" maxLength={120} placeholder="Имя и фамилия" required/></label><button className="primary"><Icon name="plus" size={17}/>Добавить</button></form>
      {travelers.length > 0 && <div className="traveler-list">{travelers.map(person => <div className="profile-detail-row" key={person.id}><strong>{person.name}</strong><button type="button" className="text-button" onClick={() => updateTravelers(travelers.filter(item => item.id !== person.id))}>Удалить</button></div>)}</div>}
      <small>Список хранится в этом браузере.</small></>;
    if (key === 'preferences') return <div className="account-data-list">
      <div className="account-data-row"><strong>Гостей по умолчанию</strong><span><select aria-label="Гостей по умолчанию" value={defaultGuests} onChange={event => {setDefaultGuests(event.target.value); localStorage.setItem('qonaq.default-guests', event.target.value);}}>{[1,2,3,4,5,6].map(value => <option key={value} value={value}>{value} {value === 1 ? 'гость' : 'гостя'}</option>)}</select></span><span className="account-row-note">Сохраняется в этом браузере.</span></div>
      <div className="account-data-row"><strong>Валюта</strong><span>KZT · Казахстанский тенге</span><span className="account-row-note">Цены на сайте показываются в тенге.</span></div>
      <div className="account-data-row"><strong>Язык</strong><span>Русский</span><span className="account-row-note">Язык интерфейса сайта.</span></div>
    </div>;
    if (key === 'payments') return <div className="account-data-list"><div className="account-data-row"><strong>Платёжные карты</strong><span>Нет сохранённых карт</span><span className="account-row-note">Оплата доступна при подтверждении бронирования. Данные карт сайт не хранит.</span></div></div>;
    if (key === 'privacy') return <div className="account-data-list">
      <div className="account-data-row"><strong>Персональные предложения</strong><span>{personalizedOffers ? 'Включены' : 'Отключены'}</span><span className="account-row-note">Разрешить использовать историю поиска и бронирований для более подходящих предложений.</span><label className="privacy-switch"><input type="checkbox" checked={personalizedOffers} onChange={event => {setPersonalizedOffers(event.target.checked); localStorage.setItem('qonaq.personalized-offers', String(event.target.checked));}}/><span>{personalizedOffers ? 'Включено' : 'Выключено'}</span></label></div>
      <div className="account-data-row"><strong>Рассылка</strong><span>{newsletter ? 'Включена' : 'Отключена'}</span><span className="account-row-note">Новости отеля и специальные предложения на вашу почту.</span><button type="button" className="text-button" onClick={() => {const next = !newsletter; setNewsletter(next); localStorage.setItem('qonaq.newsletter', String(next));}}>Изменить</button></div>
      <div className="account-data-row"><strong>Данные аккаунта</strong><span>Профиль и сведения о бронированиях</span><span className="account-row-note">Скачайте копию данных, связанных с вашим аккаунтом.</span><button type="button" className="secondary" onClick={async () => {
        try {
          const [profile, bookings] = await Promise.all([api('/users/me'), api('/bookings?limit=100&offset=0')]);
          const blob = new Blob([JSON.stringify({profile, bookings: bookings.items}, null, 2)], {type: 'application/json'});
          const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'qonaq-account-data.json'; link.click(); URL.revokeObjectURL(url);
        } catch (err) { setError(err.message); }
      }}>Скачать данные</button></div>
      <div className="account-data-row"><strong>Управление данными</strong><span>Запрос копии доступен</span><span className="account-row-note">Пока можно скачать данные аккаунта. Удаление профиля через сайт ещё не подключено.</span></div>
    </div>;
    return <><p>Выберите, получать ли новости отеля и специальные предложения на эту почту.</p>
      <label className="profile-newsletter-toggle"><input type="checkbox" checked={newsletter} onChange={event => {setNewsletter(event.target.checked); localStorage.setItem('qonaq.newsletter', String(event.target.checked));}}/>
        <span><strong>Новости и предложения Qonaq</strong><small>{newsletter ? 'Рассылка включена' : 'Рассылка отключена'}</small></span></label>
      <small>Настройка сохраняется в этом браузере.</small></>;
  }

  function profileRow(key, label, icon) {
    const opened = profilePanel === key;
    return <button type="button" className="profile-menu-row" aria-current={opened ? 'page' : undefined}
      onClick={() => setProfilePanel(key)}>
      <Icon name={icon} size={22}/><span>{label}</span><Icon name="right" size={19}/>
    </button>;
  }

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
  return <Container id={embedded ? undefined : "main"} className={`container dashboard ${view === 'profile' ? 'profile-dashboard' : ''}`}>
    {view === 'profile' ? <>
      <div className="profile-heading">
        <div><span className="section-kicker">Ваш Qonaq аккаунт</span><h1 tabIndex={-1}>Профиль гостя</h1>
          <p>Личные данные и всё необходимое для следующей поездки.</p></div>
        <button type="button" className="secondary profile-bookings-link" onClick={onBookings}><Icon name="calendar"/>Мои бронирования<Icon name="right" size={17}/></button>
      </div>
      <Feedback error={error} notice={notice}/>
      <div className="profile-welcome">
        <div className="profile-avatar" aria-hidden="true">{user.full_name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toLocaleUpperCase('ru')).join('')}</div>
        <div className="profile-welcome-copy"><span className="profile-eyebrow">Рады видеть вас снова</span><h2>{user.full_name}</h2>
          <p>Гость Qonaq Hotel <span className="profile-member"><Icon name="check" size={14}/>Аккаунт активен</span></p></div>
      </div>
      <div className="account-center">
        <aside className="panel profile-sidebar" aria-label="Настройки аккаунта">
          <section className="profile-menu-group"><h2>Мои путешествия</h2>
            {profileRow('trips', 'Поездки и бронирования', 'briefcase')}
            {profileRow('favorites', 'Избранное', 'heart')}
            {profileRow('reviews', 'Мои отзывы', 'chat')}
          </section>
          <section className="profile-menu-group"><h2>Управление аккаунтом</h2>
            {profileRow('personal', 'Личные данные', 'guests')}
            {profileRow('security', 'Настройки безопасности', 'lock')}
            {profileRow('travelers', 'Другие путешественники', 'people')}
          </section>
          <section className="profile-menu-group"><h2>Настройки</h2>
            {profileRow('preferences', 'Настройки отображения', 'sliders')}
            {profileRow('payments', 'Способы оплаты', 'card')}
            {profileRow('newsletter', 'Настройка получения рассылок', 'mail')}
          </section>
          <section className="profile-menu-group"><h2>Юридические данные и конфиденциальность</h2>
            {profileRow('privacy', 'Конфиденциальность и управление данными', 'shield')}
          </section>
        </aside>
        <section className="panel account-settings-content" aria-live="polite">
          <h2>{profileTitles[profilePanel]}</h2><p className="account-settings-description">{profileDescriptions[profilePanel]}</p>
          <div className="profile-panel-content">{profilePanelContent(profilePanel)}</div>
        </section>
      </div>
    </> : <><h1>{titles[view]}</h1>
    <Feedback error={error} notice={notice}/>
    <div className="stack">
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
    </div></>}
  </Container>;
}
