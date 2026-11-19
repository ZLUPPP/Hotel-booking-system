import React, {useState} from 'react';
import {detailsFor} from './roomDetails';
import {count, dateLabel, Icon, image, money, stayLength, today} from './ui';
import {Stars} from './Reviews';
import './booking-card.css';

const bookingStatus = {pending: 'Ожидает оплаты', confirmed: 'Подтверждена', cancelled: 'Отменена'};
const paymentStatus = {succeeded: 'Успешно', failed: 'Отклонён'};
const months = new Intl.DateTimeFormat('ru', {month: 'long', year: 'numeric', timeZone: 'UTC'});
const weekdays = [['Пн', 'Понедельник'], ['Вт', 'Вторник'], ['Ср', 'Среда'], ['Чт', 'Четверг'],
  ['Пт', 'Пятница'], ['Сб', 'Суббота'], ['Вс', 'Воскресенье']];

function StayCalendar({start, end}) {
  const [month, setMonth] = useState(start.slice(0, 7));
  const date = new Date(month + '-01T00:00:00Z');
  const firstColumn = (date.getUTCDay() + 6) % 7;
  const last = new Date(date);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  const days = last.getUTCDate();
  const rows = Math.ceil((firstColumn + days) / 7);
  const title = months.format(date);
  const multiple = start.slice(0, 7) !== end.slice(0, 7);

  function move(step) {
    const next = new Date(date);
    next.setUTCMonth(next.getUTCMonth() + step);
    setMonth(next.toISOString().slice(0, 7));
  }

  return <section className="booking-calendar" aria-label="Календарь проживания">
    <div className="booking-calendar-heading">
      <h3 aria-live="polite">{title}</h3>
      {multiple && <div className="booking-month-controls">
        <button type="button" className="icon-button" aria-label="Предыдущий месяц брони"
          disabled={month <= start.slice(0, 7)} onClick={() => move(-1)}><Icon name="left" size={15}/></button>
        <button type="button" className="icon-button" aria-label="Следующий месяц брони"
          disabled={month >= end.slice(0, 7)} onClick={() => move(1)}><Icon name="right" size={15}/></button>
      </div>}
    </div>
    <table aria-label={title}>
      <thead><tr>{weekdays.map(([short, full]) => <th key={short} scope="col" aria-label={full}>{short}</th>)}</tr></thead>
      <tbody>{Array.from({length: rows}, (_, row) => <tr key={row}>
        {Array.from({length: 7}, (_, column) => {
          const day = row * 7 + column - firstColumn + 1;
          if (day < 1 || day > days) return <td key={column}/>;
          const iso = month + '-' + String(day).padStart(2, '0');
          const arrival = iso === start;
          const departure = iso === end;
          const occupied = iso >= start && iso < end;
          const inStay = occupied || departure;
          const first = inStay && (arrival || column === 0 || day === 1);
          const last = inStay && (departure || column === 6 || day === days);
          const edge = arrival ? 'заезд' : departure ? 'выезд' : occupied ? 'ночь проживания' : '';
          return <td key={column} data-night={occupied || undefined} data-stay={inStay || undefined}
            data-first={first || undefined} data-last={last || undefined}
            data-arrival={arrival || undefined} data-departure={departure || undefined}
            aria-label={edge ? `${dateLabel(iso)}, ${edge}` : undefined}>
            <span>{day}</span>
          </td>;
        })}
      </tr>)}</tbody>
    </table>
    <div className="booking-calendar-key"><span><i/> Период проживания</span><span><i/> Выезд</span></div>
  </section>;
}

export function BookingCard({booking: b, user, busy, onCancel, onPay, onHistory, history, review, onReview}) {
  const [title, photo, description] = detailsFor({room_type: b.room_type});
  const nights = count(stayLength(b.check_in, b.check_out), 'ночь', 'ночи', 'ночей');
  const canReview = Boolean(onReview) && b.guest_id === user.id && b.status === 'confirmed' && b.check_out <= today();

  return <article className="booking-card">
    <div className="booking-card-body">
      <div className="booking-room-details">
        <div className="booking-image">
          <img src={image(photo)} alt={`Пример интерьера категории «${title}»`} loading="lazy"/>
          <span className={'status ' + b.status}>{bookingStatus[b.status] || b.status}</span>
        </div>
        <div className="booking-room-heading">
          <div><p>Номер {b.room_number}</p><h2>{title}</h2></div>
          <span><Icon name="guests" size={16}/> До {count(b.room_capacity, 'гостя', 'гостей', 'гостей')}</span>
        </div>
        {description && <p className="booking-description">{description}</p>}
        <dl className="booking-facts">
          <div><dt>Заезд</dt><dd><time dateTime={b.check_in}>{dateLabel(b.check_in, true)}</time></dd></div>
          <div><dt>Выезд</dt><dd><time dateTime={b.check_out}>{dateLabel(b.check_out, true)}</time></dd></div>
          <div><dt>Гости</dt><dd>{b.guest_count == null ? 'Не указано' : count(b.guest_count, 'гость', 'гостя', 'гостей')}</dd></div>
          <div><dt>Проживание</dt><dd>{nights}</dd></div>
        </dl>
      </div>
      <div className="booking-sidebar">
        <StayCalendar start={b.check_in} end={b.check_out}/>
        <div className="booking-amount">
          <span>Стоимость проживания</span>
          <strong>{money(b.total_amount, b.currency)}</strong>
          <small>Бронь № {b.id}</small>
        </div>
      </div>
    </div>
    <div className="booking-actions">
      <button disabled={busy} aria-expanded={Boolean(history)} onClick={onHistory}>{history ? 'Скрыть платежи' : 'История платежей'}</button>
      {canReview && <button disabled={busy} onClick={onReview}>{review ? 'Изменить отзыв' : 'Оставить отзыв'}</button>}
      {b.status !== 'cancelled' && <button disabled={busy} onClick={onCancel}>Отменить бронь</button>}
    </div>
    {review && <div className="booking-review"><span>Ваш отзыв</span><Stars value={review.rating} size={16}/>{review.comment && <p>{review.comment}</p>}</div>}
    {b.status === 'pending' && b.guest_id === user.id && <div className="simulation">
      <small>Учебная оплата. Деньги не списываются.</small>
      <button className="primary" disabled={busy} onClick={() => onPay('succeeded')}>Оплатить успешно</button>
      <button disabled={busy} onClick={() => onPay('failed')}>Симулировать отказ</button>
    </div>}
    {history && <div className="history">{history.length ? history.map(p => <p key={p.id}>
      {paymentStatus[p.status] || p.status} · {money(p.amount, p.currency)} · {new Date(p.created_at).toLocaleString('ru')}
    </p>) : <p>Платежей пока нет.</p>}</div>}
  </article>;
}
