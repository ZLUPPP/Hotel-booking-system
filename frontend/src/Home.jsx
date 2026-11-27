import React, {useId, useState} from 'react';
import {BookingCalendar} from './BookingCalendar';
import {detailsFor} from './roomDetails';
import {count, dateLabel, Feedback, Icon, image, Modal, money, stayLength} from './ui';
import {RoomRating} from './Reviews';
import {translate} from './i18n';

const roomType = room => detailsFor(room)[0];


export function RoomEditor({room, save, busy}) {
  const fields = [
    {name: 'number', label: 'Номер', maxLength: 20},
    {name: 'room_type', label: 'Тип', maxLength: 50},
    {name: 'capacity', label: 'Вместимость', type: 'number', min: 1, max: 2147483647},
    {name: 'price_per_night', label: 'Цена за ночь', type: 'number', min: '0.01', step: '0.01'},
    {name: 'currency', label: 'Валюта', pattern: '[A-Z]{3}'},
  ];

  return <details className="room-editor"><summary>{room ? 'Редактировать номер' : 'Добавить номер'}</summary>
    <form className="editor" onSubmit={event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      data.capacity = Number(data.capacity);
      if (room) data.is_active = data.is_active === 'on';
      save(data);
    }}>
      {fields.map(({name, label, ...attrs}) => <label key={name}>{label}
        <input name={name} {...attrs} required defaultValue={room?.[name] ?? (name === 'currency' ? 'KZT' : '')}/>
      </label>)}
      {room && <label className="check"><input type="checkbox" name="is_active" defaultChecked={room.is_active}/>Номер активен</label>}
      <button disabled={busy}>Сохранить номер</button>
    </form>
  </details>;
}

export function Pagination({page, pending, onPage}) {
  if (page.total <= page.limit && page.offset === 0) return null;
  return <div className="pagination" aria-label="Страницы">
    <button disabled={pending || page.offset === 0} onClick={() => onPage(Math.max(0, page.offset - page.limit))}>Назад</button>
    <span>{page.offset + 1}–{Math.min(page.offset + page.limit, page.total)} из {page.total}</span>
    <button disabled={pending || page.offset + page.limit >= page.total} onClick={() => onPage(page.offset + page.limit)}>Далее</button>
  </div>;
}

function RoomCard({room, searched, selectRoom, saveRoom, pending, favoriteIds = [], onToggleFavorite}) {
  const [title, photo, description] = detailsFor(room);
  return <article className="room">
    <div className="room-photo">
      <img src={image(photo)} alt={`Пример интерьера категории «${title}»`} loading="lazy" width="900" height="600"/>
      {!room.is_active && <span>{translate('Номер отключён')}</span>}
      {!saveRoom && <button type="button" className={`room-favorite ${favoriteIds.includes(room.id) ? 'is-saved' : ''}`} aria-pressed={favoriteIds.includes(room.id)}
        aria-label={favoriteIds.includes(room.id) ? translate('Удалить из избранного') : translate('Добавить в избранное')}
        onClick={() => onToggleFavorite?.(room.id)}><Icon name="heart" size={20}/></button>}
    </div>
    <div className="room-content">
      <div className="room-info">
        <span>{translate('Номер')} {room.number}</span>
        <span><Icon name="guests" size={17}/> {translate('До')} {count(room.capacity, 'гостя', 'гостей', 'гостей')}</span>
      </div>
      <h3>{title}</h3>
      <RoomRating room={room}/>
      {description && <p className="room-description">{description}</p>}
      <div className="room-rate">
        <p className="price">{money(room.price_per_night, room.currency)} <small>/ {translate('ночь')}</small></p>
        {searched && <p className="room-total">{money(room.total_amount, room.currency)} {translate('за весь период')}</p>}
      </div>
      <button className="room-action" disabled={pending || !room.is_active} onClick={() => selectRoom(room)}
        aria-label={`${translate(searched ? 'Забронировать' : 'Выбрать даты')}: ${translate('номер')} ${room.number}`}>
        {translate(searched ? 'Забронировать' : 'Выбрать даты')}<Icon name="arrow" size={18}/>
      </button>
      {saveRoom && <RoomEditor room={room} busy={pending} save={body => saveRoom(room.id, body)}/>}
    </div>
  </article>;
}

const questions = [
  ['Как проверить, свободен ли номер?', 'Выберите даты заезда и выезда и укажите число гостей. В списке появятся номера, доступные на весь выбранный период.'],
  ['Как рассчитывается стоимость?', 'В каталоге указана цена за ночь. Когда вы выберете даты, мы сразу покажем стоимость проживания за весь период.'],
  ['Нужен ли аккаунт для бронирования?', 'Свободные номера можно посмотреть без аккаунта. Для подтверждения брони войдите или зарегистрируйтесь. Выбранный номер и даты сохранятся.'],
  ['Где посмотреть или отменить бронь?', 'Войдите и откройте «Мои брони». Там можно проверить статус, посмотреть историю оплаты или отменить бронирование.'],
];

function Question({question, answer}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="question">
    <h3><button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      {question}<Icon name="plus" size={20}/>
    </button></h3>
    <div id={id} className="fold" data-open={open} inert={!open}>
      <div className="fold-content"><p>{answer}</p></div>
    </div>
  </div>;
}

function HotelSections() {
  return <>
    <section id="hotel" className="hotel-story">
      <div className="container story-layout">
        <figure className="story-photo">
          <img src={image('lounge')} alt="Зал с обеденными столами и тёплым освещением" loading="lazy" width="1400" height="900"/>
        </figure>
        <div>
          <span className="section-kicker">Об отеле</span>
          <h2>Гостеприимство в деталях</h2>
          <p>Qonaq по-казахски означает «гость». В этом слове заложена идея нашего отеля: встречать с теплом и оставлять вам пространство для отдыха.</p>
          <p>Дерево, мягкий свет и спокойные оттенки напоминают о природе Заилийского Алатау. Здесь приятно начать день за чашкой кофе или вернуться после прогулки.</p>
          <a className="quiet-link" href="#experiences">Как провести время <Icon name="arrow" size={18}/></a>
        </div>
      </div>
    </section>
    <section id="experiences" className="container experiences">
      <div className="section-heading">
        <div><span className="section-kicker">Впечатления</span><h2>День в своём ритме</h2></div>
        <p>От неспешного завтрака до прогулки среди гор.</p>
      </div>
      <div className="experience-grid">
        <article>
          <img src={image('breakfast')} alt="Горячий завтрак с тостом и томатами" loading="lazy" width="1100" height="720"/>
          <h3>Утро за столом</h3>
          <p>Начните день с горячего завтрака и чашки кофе, прежде чем отправиться на прогулку или заняться делами.</p>
        </article>
        <article>
          <img src={image('mountains')} alt="Лес и горные вершины" loading="lazy" width="1100" height="720"/>
          <h3>Время в горах</h3>
          <p>Выделите день на предгорья Алматы. Возьмите удобную обувь, чтобы гулять дольше и останавливаться там, где открывается вид.</p>
        </article>
      </div>
    </section>
    <section id="faq" className="faq-section">
      <div className="container faq-layout">
        <div><span className="section-kicker">Перед поездкой</span><h2>Частые вопросы</h2></div>
        <div className="questions">{questions.map(([question, answer]) =>
          <Question key={question} question={question} answer={answer}/>)}</div>
      </div>
    </section>
    <section className="closing">
      <div className="container closing-inner">
        <div><h2>До встречи в Qonaq</h2><p>Выберите даты вашего следующего заезда.</p></div>
        <a className="light-button" href="#search">Запланировать поездку <Icon name="arrow" size={19}/></a>
      </div>
    </section>
  </>;
}

export function Home({filters, setFilters, onSearch, searched, page, pending, loading, onPage, selectRoom,
  saveRoom, error, catalogError, retry, preferredRoom, clearRoom, searchAll, favoriteIds, onToggleFavorite}) {
  const empty = !page.items.length && !loading && !pending;
  return <main id="main">
    <section className="hero">
      <img className="hero-image" src={image('qonaq-alatau')} alt="" fetchPriority="high" width="1942" height="809"/>
      <div className="container hero-inner">
        <span className="hero-location"><Icon name="pin" size={17}/> {translate('Алматы, Казахстан')}</span>
        <h1>{translate('У подножия гор, вдали от спешки')}</h1>
        <p>{translate('Qonaq Hotel в предгорьях Алатау. Тёплый приём, спокойные вечера и время для себя.')}</p>
        <div className="hero-actions">
          <a href="#search" className="light-button">{translate('Выбрать даты')} <Icon name="arrow" size={19}/></a>
          <a href="#rooms" className="hero-link">{translate('Посмотреть номера')} <Icon name="down" size={17}/></a>
        </div>
      </div>
    </section>
    <div className="welcome">
      <div className="container welcome-inner">
        <div className="welcome-mark"><Icon name="mark" size={28}/><span>Qonaq Hotel</span></div>
          <p>{translate('Бутик-отель в предгорьях Заилийского Алатау')}</p>
        <a href="#hotel" className="quiet-link">{translate('Об отеле')} <Icon name="arrow" size={18}/></a>
      </div>
    </div>
    <BookingCalendar filters={filters} setFilters={setFilters} onSearch={onSearch} pending={pending}
      error={error} preferredRoom={preferredRoom} clearRoom={clearRoom}/>
    <section id="rooms" className="container rooms-section" aria-labelledby="rooms-title" aria-busy={loading || pending}>
      <div className="section-heading">
        <div><span className="section-kicker">Проживание</span>
          <h2 id="rooms-title" tabIndex={-1}>{translate(searched ? 'Свободные номера' : 'Номера и люксы')}</h2>
          <p>{searched ? `${dateLabel(searched.check_in, true)} — ${dateLabel(searched.check_out, true)} · ${count(Number(searched.capacity), 'гость', 'гостя', 'гостей')}` :
            'От уютного классического номера до просторной резиденции.'}</p></div>
        {!loading && !catalogError && <span className="result-count" role="status">{count(page.total, 'номер', 'номера', 'номеров')}</span>}
      </div>
      {searched?.room_id && <div className="result-tools">
        <button className="secondary" onClick={searchAll} disabled={pending}>Все номера на эти даты <Icon name="arrow" size={17}/></button>
      </div>}
      <Feedback error={catalogError}/>
      {loading && <p className="empty" role="status">Загружаем номера…</p>}
      {empty && <div className="empty">
        <Icon name="bed" size={31}/>
        <h3>{catalogError ? 'Каталог недоступен' : searched?.room_id ? 'Номер недоступен на этих условиях' : searched ? 'На эти даты мест нет' : 'Каталог пока пуст'}</h3>
        <p>{catalogError ? 'Попробуйте загрузить номера ещё раз.' : searched ? 'Измените даты, число гостей или фильтры.' : 'Доступные для бронирования номера появятся здесь.'}</p>
        {catalogError ? <button onClick={retry}>Обновить каталог</button> : searched && <a className="secondary" href="#search">Изменить поиск</a>}
      </div>}
      <div className="room-grid">{page.items.map(room => <RoomCard key={room.id} room={room} searched={searched}
        selectRoom={selectRoom} saveRoom={saveRoom} pending={pending} favoriteIds={favoriteIds} onToggleFavorite={onToggleFavorite}/>)}</div>
      {page.items.length > 0 && <p className="photo-note">Фотографии показывают примеры интерьеров.</p>}
      <Pagination page={page} pending={pending} onPage={onPage}/>
      {saveRoom && <RoomEditor save={body => saveRoom(null, body)} busy={pending}/>}
    </section>
    <HotelSections/>
  </main>;
}


export function BookingDialog({draft, user, pending, error, close, confirm}) {
  const {room, dates} = draft;
  const nights = stayLength(dates.check_in, dates.check_out);

  return <Modal title={roomType(room)} onClose={close}>
    <p className="dialog-type">Номер {room.number}</p>
    <dl className="booking-summary">
      <div><dt>Заезд</dt><dd>{dateLabel(dates.check_in, true)}</dd></div>
      <div><dt>Выезд</dt><dd>{dateLabel(dates.check_out, true)}</dd></div>
      <div><dt>Гости</dt><dd>{dates.capacity}</dd></div>
      <div><dt>За {count(nights, 'ночь', 'ночи', 'ночей')}</dt><dd>{money(room.total_amount, room.currency)}</dd></div>
    </dl>
    <Feedback error={error}/>
    {!user && <p className="dialog-hint">Войдите или создайте аккаунт. Выбранный номер и даты сохранятся.</p>}
    <button className="primary dialog-confirm" onClick={confirm} disabled={pending}>
      {pending ? 'Создаём бронь…' : user ? 'Подтвердить бронирование' : 'Войти и продолжить'} <Icon name="arrow" size={18}/>
    </button>
  </Modal>;
}
