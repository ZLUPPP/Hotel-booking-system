import {Select} from './Select';
import React, {useEffect, useState} from 'react';
import {api} from './api';
import {Pagination} from './Home';
import {BookingCard} from './BookingCard';
import {PaymentModal} from './PaymentModal';
import {MyReviews, ReviewFormModal} from './Reviews';
import {Feedback, Icon, money} from './ui';
import {currentLanguage, currencyPreference, languages, setDisplayCurrency, translate} from './i18n';

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

export function Dashboard({view, user, updateUser, created, goHome, onBookings, onLogout, onDisplaySettingsChange, favoriteIds = [], onToggleFavorite, attempts, embedded = false}) {
  const [profilePanel, setProfilePanel] = useState('personal');
  const [profileRooms, setProfileRooms] = useState([]);
  const [profileRoomsLoaded, setProfileRoomsLoaded] = useState(false);
  const [travelers, setTravelers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('qonaq.travelers') || '[]'); } catch { return []; }
  });
  const [newsletter, setNewsletter] = useState(() => localStorage.getItem('qonaq.newsletter') === 'true');
  const [profileExtras, setProfileExtras] = useState(() => {
    try { return JSON.parse(localStorage.getItem('qonaq.profile-details') || '{}'); } catch { return {}; }
  });
  const [personalizedOffers, setPersonalizedOffers] = useState(() => localStorage.getItem('qonaq.personalized-offers') === 'true');
  const [defaultGuests, setDefaultGuests] = useState(() => localStorage.getItem('qonaq.default-guests') || '2');
  const [myPayments, setMyPayments] = useState(null);
  const [paymentError, setPaymentError] = useState('');
  const [exchangeRate, setExchangeRate] = useState(() => {
    const rate = Number(localStorage.getItem('qonaq.usd-kzt'));
    return rate > 0 ? {rate, date: localStorage.getItem('qonaq.usd-kzt-date') || ''} : null;
  });
  const [rateError, setRateError] = useState(false);
  const [page, setPage] = useState(emptyPage);
  const [busy, setBusy] = useState(view !== 'profile');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(created ? 'Бронь создана. Её можно оплатить в личном кабинете.' : '');
  const [history, setHistory] = useState({});
  const [cancelId, setCancelId] = useState(null);
  const [reviews, setReviews] = useState({});
  const [reviewTarget, setReviewTarget] = useState(null);
  const [payingBooking, setPayingBooking] = useState(null);
  const titles = {bookings: user.role === 'guest' ? 'Мои бронирования' : 'Все бронирования', users: 'Пользователи', profile: 'Мой профиль'};

  useEffect(() => {
    if (view !== 'profile' || profilePanel !== 'favorites' || profileRoomsLoaded) return;
    api('/rooms?limit=100&offset=0').then(result => setProfileRooms(result.items)).catch(err => setError(err.message))
      .finally(() => setProfileRoomsLoaded(true));
  }, [view, profilePanel, profileRoomsLoaded]);

  useEffect(() => {
    if (view !== 'profile' || profilePanel !== 'payments' || myPayments !== null) return;
    let active = true;
    api('/payments/mine').then(items => {if (active) setMyPayments(items);})
      .catch(err => {if (active) setPaymentError(err.message);});
    return () => {active = false;};
  }, [view, profilePanel, myPayments]);

  useEffect(() => {
    if (view !== 'profile' || profilePanel !== 'preferences' || exchangeRate) return;
    let active = true;
    api('/rates/usd-kzt').then(result => {
      if (!active) return;
      const value = {rate: Number(result.rate), date: result.date};
      setExchangeRate(value);
      setRateError(false);
      localStorage.setItem('qonaq.usd-kzt', String(value.rate));
      localStorage.setItem('qonaq.usd-kzt-date', value.date);
      onDisplaySettingsChange?.();
    }).catch(() => {if (active) setRateError(true);});
    return () => {active = false;};
  }, [view, profilePanel, exchangeRate, onDisplaySettingsChange]);

  useEffect(() => {
    if (view !== 'bookings') return;
    let active = true;
    api('/reviews/mine').then(list => {
      if (active) setReviews(Object.fromEntries(list.map(item => [item.booking_id, item])));
    }).catch(() => {});
    return () => {active = false;};
  }, [view]);

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
    if (key === 'favorites') {
      // Показываем только сохранённые номера, а не весь каталог.
      const favoriteRooms = profileRooms.filter(room => favoriteIds.includes(room.id));
      return <>
        {!profileRoomsLoaded ? <p role="status">{translate('Загружаем номера…')}</p> :
          favoriteRooms.length === 0 ? <div className="profile-empty-state">
            <Icon name="heart" size={25}/>
            <strong>{translate('Пока нет избранных номеров')}</strong>
            <span>{translate('Нажмите на сердечко у номера в каталоге, и он появится здесь.')}</span>
            <a className="secondary" href="#rooms" onClick={goHome}>{translate('Перейти в каталог')}</a>
          </div> :
          <div className="profile-favorite-list">{favoriteRooms.map(room => <div className="profile-favorite-row" key={room.id}>
            <span><strong>{translate('Номер')} {room.number}</strong><small>{translate(roomTypeLabel(room.room_type))} · {money(room.price_per_night, room.currency)} {translate('за ночь')}</small></span>
            <button type="button" className="favorite-toggle is-saved" aria-pressed="true" onClick={() => onToggleFavorite?.(room.id)}>
              <Icon name="heart" size={18}/>{translate('Убрать')}
            </button>
          </div>)}</div>}
      </>;
    }
    if (key === 'reviews') return <MyReviews onBookings={onBookings}/>;
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
      <div className="account-data-row"><strong>{translate('Гостей по умолчанию')}</strong><span><select aria-label={translate('Гостей по умолчанию')} value={defaultGuests} onChange={event => {setDefaultGuests(event.target.value); localStorage.setItem('qonaq.default-guests', event.target.value);}}>{[1,2,3,4,5,6].map(value => <option key={value} value={value}>{value} {translate(value === 1 ? 'гость' : 'гостя')}</option>)}</select></span><span className="account-row-note">{translate('Сохраняется в этом браузере.')}</span></div>
      <div className="account-data-row"><strong>{translate('Отображать цены в')}</strong><span><select aria-label={translate('Отображать цены в')} value={currencyPreference()} disabled={!exchangeRate} onChange={event => {setDisplayCurrency(event.target.value); onDisplaySettingsChange?.();}}><option value="KZT">{translate('Тенге (KZT)')}</option><option value="USD">{translate('Доллары США (USD)')}</option></select></span><span className="account-row-note">{translate('При выборе USD стоимость брони и оплаты не меняется — пересчитывается только отображение.')}</span></div>
      <div className="account-data-row"><strong>{translate('Язык')}</strong><span><select aria-label={translate('Язык')} value={currentLanguage()} onChange={event => {localStorage.setItem('qonaq.language', event.target.value); document.documentElement.lang = event.target.value; onDisplaySettingsChange?.();}}>{languages.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></span><span className="account-row-note">{translate('Язык интерфейса сайта.')}</span></div>
      <div className="account-data-row"><strong>{translate('Курс валюты')}</strong><span>{exchangeRate ? `${translate('1 USD ≈')} ${Number(exchangeRate.rate).toLocaleString({ru:'ru-KZ',en:'en-US',kk:'kk-KZ'}[currentLanguage()])} ${translate('тенге')}` : rateError ? translate('Не удалось загрузить курс валют. Показываем исходные цены.') : translate('Загружаем…')}</span>{exchangeRate?.date && <span className="account-row-note">{translate('Обновлено')}: {exchangeRate.date} · National Bank of Kazakhstan</span>}</div>
    </div>;
    if (key === 'payments') return <div className="account-data-list">
      <p className="payment-privacy-note">{translate('Сведения о платежах по вашим бронированиям. Номер карты не сохраняется.')}</p>
      <Feedback error={paymentError}/>
      {myPayments === null && !paymentError && <p role="status">{translate('Загружаем платежи…')}</p>}
      {myPayments?.length === 0 && <div className="profile-empty-state"><Icon name="card" size={25}/><strong>{translate('Платежей пока нет')}</strong><span>{translate('Оплата появится здесь после бронирования номера.')}</span></div>}
      {myPayments?.length > 0 && <div className="my-payment-list">{myPayments.map(payment => <article className="my-payment" key={payment.id}>
        <div><strong>{translate('Бронирование')} · № {payment.room_number}</strong><span>{translate(roomTypeLabel(payment.room_type))} · {new Date(payment.created_at).toLocaleDateString({ru:'ru-KZ',en:'en-US',kk:'kk-KZ'}[currentLanguage()])}</span></div>
        <strong>{money(payment.amount, payment.currency)}</strong>
        <span className={`payment-state ${payment.status}`}>{translate(({succeeded:'Успешно',failed:'Отклонён',pending:'Ожидает оплаты'})[payment.status] || payment.status)}</span>
        <small>{translate('Способ')}: {translate(({card:'Банковская карта',kaspi:'Kaspi QR / Pay',wallet:'Apple / Google Pay'})[payment.method] || payment.method)}</small>
      </article>)}</div>}
    </div>;
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
      <Icon name={icon} size={22}/><span>{translate(label)}</span><Icon name="right" size={19}/>
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

  async function pay(booking, outcome, method = 'card') {
    const apiMethod = method === 'pay' ? 'wallet' : method;
    // Ключ идемпотентности привязан к конкретной попытке (результат + способ).
    // Если пользователь сменил способ или повторил после ошибки, нужен новый ключ,
    // иначе сервер увидит тот же ключ с другим телом запроса и вернёт 409/422.
    let attempt = attempts.current[booking.id];
    if (!attempt || attempt.outcome !== outcome || attempt.method !== apiMethod) {
      attempt = {key: crypto.randomUUID(), outcome, method: apiMethod};
      attempts.current[booking.id] = attempt;
    }
    let result;
    try {
      result = await api(`/bookings/${booking.id}/payments`, {method: 'POST', body: {outcome: attempt.outcome, method: attempt.method}, key: attempt.key});
    } catch (err) {
      // Ключ сохраняем только при обрыве сети: повтор того же запроса безопасен.
      if (!String(err.message).startsWith('Сервер недоступен')) delete attempts.current[booking.id];
      throw err;
    }
    delete attempts.current[booking.id];
    hideHistory(booking.id);
    // Список платежей в профиле нужно перечитать при следующем открытии.
    setMyPayments(null);
    if (result.payment.status === 'succeeded') {
      setNotice('Оплата прошла успешно! Бронь подтверждена.');
    }
    await load(page.offset);
    return result;
  }

  const Container = embedded ? 'section' : 'main';
  return <Container id={embedded ? undefined : "main"} className={`container dashboard ${view === 'profile' ? 'profile-dashboard' : ''}`}>
    {view === 'profile' ? <>
      <div className="profile-heading">
        <div><span className="section-kicker">{translate('Ваш Qonaq аккаунт')}</span><h1 tabIndex={-1}>{translate('Профиль гостя')}</h1>
          <p>{translate('Личные данные и всё необходимое для следующей поездки.')}</p></div>
        <button type="button" className="secondary profile-bookings-link" onClick={onBookings}><Icon name="calendar"/>{translate('Мои бронирования')}<Icon name="right" size={17}/></button>
      </div>
      <Feedback error={error} notice={notice}/>
      <div className="profile-welcome">
        <div className="profile-avatar" aria-hidden="true">{user.full_name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toLocaleUpperCase('ru')).join('')}</div>
        <div className="profile-welcome-copy"><span className="profile-eyebrow">{translate('Рады видеть вас снова')}</span><h2>{user.full_name}</h2>
          <p>{translate('Гость Qonaq Hotel')} <span className="profile-member"><Icon name="check" size={14}/>{translate('Аккаунт активен')}</span></p></div>
      </div>
      <div className="account-center">
        <aside className="panel profile-sidebar" aria-label="Настройки аккаунта">
          <section className="profile-menu-group"><h2>{translate('Мои путешествия')}</h2>
            {profileRow('trips', 'Поездки и бронирования', 'briefcase')}
            {profileRow('favorites', 'Избранное', 'heart')}
            {profileRow('reviews', 'Мои отзывы', 'chat')}
          </section>
          <section className="profile-menu-group"><h2>{translate('Управление аккаунтом')}</h2>
            {profileRow('personal', 'Личные данные', 'guests')}
            {profileRow('security', 'Настройки безопасности', 'lock')}
            {profileRow('travelers', 'Другие путешественники', 'people')}
          </section>
          <section className="profile-menu-group"><h2>{translate('Настройки')}</h2>
            {profileRow('preferences', 'Настройки отображения', 'sliders')}
            {profileRow('payments', 'Способы оплаты', 'card')}
            {profileRow('newsletter', 'Настройка получения рассылок', 'mail')}
          </section>
          <section className="profile-menu-group"><h2>{translate('Юридические данные и конфиденциальность')}</h2>
            {profileRow('privacy', 'Конфиденциальность и управление данными', 'shield')}
          </section>
        </aside>
        <section className="panel account-settings-content" aria-live="polite">
          <h2>{translate(profileTitles[profilePanel])}</h2><p className="account-settings-description">{translate(profileDescriptions[profilePanel])}</p>
          <div className="profile-panel-content">{profilePanelContent(profilePanel)}</div>
        </section>
      </div>
    </> : <><h1>{titles[view]}</h1>
    <Feedback error={error} notice={notice}/>
    <div className="stack">
      {busy && page.items.length === 0 && <p role="status">Загрузка…</p>}
      {view === 'bookings' && page.items.map(booking => <div key={booking.id}>
        <BookingCard booking={booking} user={user} busy={busy} history={history[booking.id]}
          review={reviews[booking.id]} onReview={() => setReviewTarget(booking)}
          onCancel={() => setCancelId(booking.id)} onPay={() => setPayingBooking(booking)} onHistory={() => {
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
        <h2>{translate(view === 'bookings' ? 'Бронирований пока нет' : 'Пользователей пока нет')}</h2>
        {view === 'bookings' && <a className="secondary" href="#rooms" onClick={goHome}>{translate('Выбрать номер')}</a>}
      </div>}
      <Pagination page={page} pending={busy} onPage={offset => run(() => load(offset))}/>
    </div></>}
    {reviewTarget && <ReviewFormModal bookingId={reviewTarget.id} roomType={reviewTarget.room_type}
      roomNumber={reviewTarget.room_number} review={reviews[reviewTarget.id]} onClose={() => setReviewTarget(null)}
      onSaved={saved => {
        setReviews(current => ({...current, [saved.booking_id]: saved}));
        setReviewTarget(null);
        setNotice('Спасибо! Ваш отзыв сохранён.');
      }}/>}
    {payingBooking && (
      <PaymentModal
        booking={payingBooking}
        busy={busy}
        onClose={() => setPayingBooking(null)}
        onPay={(outcome, method) => pay(payingBooking, outcome, method)}
      />
    )}
  </Container>;
}
