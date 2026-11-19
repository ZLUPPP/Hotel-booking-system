import React, {useEffect, useState} from 'react';
import {api} from './api';
import {detailsFor} from './roomDetails';
import {count, Feedback, Icon, Modal} from './ui';
import './reviews.css';

const starPath = 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1-4.4-4.3 6.1-.9Z';
const ratingLabels = ['', 'Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично'];
const reviewsLabel = number => count(number, 'отзыв', 'отзыва', 'отзывов');
const dayLabel = value => new Date(value).toLocaleDateString('ru', {day: 'numeric', month: 'long', year: 'numeric'});

function Star({filled, size}) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24"
    className={filled ? 'star is-filled' : 'star'}><path d={starPath}/></svg>;
}

export function Stars({value, size = 16}) {
  const rounded = Math.round(value);
  return <span className="stars" role="img" aria-label={`Оценка ${value} из 5`}>
    {[1, 2, 3, 4, 5].map(number => <Star key={number} filled={number <= rounded} size={size}/>)}
  </span>;
}

/* Средние оценки номеров грузятся одним запросом и общие для всех карточек. */
let ratings = null;
let loading = null;
const listeners = new Set();

function loadRatings() {
  if (!loading) {
    loading = api('/reviews/ratings')
      .then(list => {ratings = Object.fromEntries(list.map(item => [item.room_id, item]));})
      .catch(() => {})
      .finally(() => {
        loading = null;
        listeners.forEach(listener => listener());
      });
  }
  return loading;
}

function useRating(roomId) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick(value => value + 1);
    listeners.add(update);
    loadRatings();
    return () => listeners.delete(update);
  }, []);
  return ratings ? ratings[roomId] || null : undefined;
}

function ReviewItem({review}) {
  return <li>
    <div className="review-head"><strong>{review.author}</strong><time dateTime={review.created_at}>{dayLabel(review.created_at)}</time></div>
    <Stars value={review.rating} size={14}/>
    {review.comment && <p>{review.comment}</p>}
  </li>;
}

function RoomReviewsModal({room, onClose}) {
  const [data, setData] = useState({items: [], total: 0, average: null});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [title] = detailsFor(room);

  async function load(offset) {
    setBusy(true);
    setError('');
    try {
      const result = await api(`/rooms/${room.id}/reviews?limit=10&offset=${offset}`);
      setData(current => {
        const known = new Set(offset ? current.items.map(item => item.id) : []);
        const fresh = result.items.filter(item => !known.has(item.id));
        return {...result, items: offset ? [...current.items, ...fresh] : fresh};
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {load(0);}, []);

  return <Modal title="Отзывы" onClose={onClose}>
    <p className="dialog-type">{title} · номер {room.number}</p>
    {data.average != null && <div className="reviews-summary">
      <strong>{data.average.toFixed(1)}</strong>
      <div><Stars value={data.average} size={18}/><small>{reviewsLabel(data.total)}</small></div>
    </div>}
    <Feedback error={error}/>
    {busy && !data.items.length && <p className="reviews-empty" role="status">Загружаем отзывы…</p>}
    {!busy && !error && !data.items.length && <p className="reviews-empty">Пока нет отзывов. Они появятся после первых поездок гостей.</p>}
    {data.items.length > 0 && <ul className="review-list">{data.items.map(item => <ReviewItem key={item.id} review={item}/>)}</ul>}
    {data.items.length > 0 && data.items.length < data.total &&
      <button type="button" className="secondary review-more" disabled={busy} onClick={() => load(data.items.length)}>
        {busy ? 'Загружаем…' : 'Показать ещё'}
      </button>}
  </Modal>;
}

/* Строка рейтинга в карточке номера. */
export function RoomRating({room}) {
  const rating = useRating(room.id);
  const [open, setOpen] = useState(false);
  if (rating === undefined) return null;
  if (rating === null) return <p className="rating-line rating-none">Пока нет отзывов</p>;
  return <>
    <button type="button" className="rating-line rating-link" onClick={() => setOpen(true)}
      aria-label={`Рейтинг ${rating.average.toFixed(1)} из 5, ${reviewsLabel(rating.count)}. Открыть отзывы`}>
      <Stars value={rating.average} size={15}/><strong>{rating.average.toFixed(1)}</strong><span>· {reviewsLabel(rating.count)}</span>
    </button>
    {open && <RoomReviewsModal room={room} onClose={() => setOpen(false)}/>}
  </>;
}

/* Форма отзыва: создаёт отзыв или обновляет уже существующий. */
export function ReviewFormModal({bookingId, roomType, roomNumber, review, onClose, onSaved}) {
  const [rating, setRating] = useState(review?.rating || 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(review?.comment || '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [title] = detailsFor({room_type: roomType});
  const shown = hover || rating;

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    if (!rating) {
      setError('Выберите оценку от 1 до 5.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const saved = await api(`/bookings/${bookingId}/review`, {
        method: 'POST', body: {rating, comment: comment.trim() || null},
      });
      loadRatings();
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setPending(false);
    }
  }

  return <Modal title={review ? 'Ваш отзыв' : 'Оставить отзыв'} onClose={onClose}>
    <p className="dialog-type">{title} · номер {roomNumber}</p>
    <form className="review-form" onSubmit={submit}>
      <fieldset className="rating-input" onMouseLeave={() => setHover(0)}>
        <legend>Ваша оценка</legend>
        <div className="rating-input-stars">
          {[1, 2, 3, 4, 5].map(number => <label key={number} onMouseEnter={() => setHover(number)}>
            <input type="radio" name="rating" value={number} checked={rating === number}
              onChange={() => {setRating(number); setError('');}}/>
            <Star filled={number <= shown} size={34}/>
            <span className="review-sr">{number} из 5</span>
          </label>)}
        </div>
        <p className="rating-hint" aria-live="polite">{ratingLabels[shown] || 'Нажмите на звезду'}</p>
      </fieldset>
      <label className="review-comment">Комментарий <small>(необязательно)</small>
        <textarea value={comment} maxLength={1000} rows={4} placeholder="Что вам понравилось? Что можно улучшить?"
          onChange={event => setComment(event.target.value)}/>
        <span className="review-counter">{comment.length} / 1000</span>
      </label>
      <Feedback error={error}/>
      <button className="primary dialog-confirm" disabled={pending}>
        {pending ? 'Сохраняем…' : review ? 'Сохранить изменения' : 'Опубликовать отзыв'}
      </button>
    </form>
  </Modal>;
}

/* Раздел «Мои отзывы» в профиле. */
export function MyReviews({onBookings}) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    let active = true;
    api('/reviews/mine').then(list => {if (active) setItems(list);})
      .catch(err => {if (active) setError(err.message);});
    return () => {active = false;};
  }, []);

  return <>
    <p>Здесь собраны отзывы, которыми вы поделились после поездок.</p>
    <Feedback error={error}/>
    {!items && !error && <p role="status">Загружаем отзывы…</p>}
    {items && !items.length && <div className="profile-empty-state"><Icon name="chat" size={25}/>
      <strong>Пока нет опубликованных отзывов</strong>
      <span>После завершённой поездки откройте «Мои бронирования» и нажмите «Оставить отзыв».</span></div>}
    {items && items.length > 0 && <div className="my-review-list">{items.map(item => <article className="my-review" key={item.id}>
      <div className="review-head"><strong>{detailsFor({room_type: item.room_type})[0]} · номер {item.room_number}</strong>
        <time dateTime={item.updated_at}>{dayLabel(item.updated_at)}</time></div>
      <Stars value={item.rating} size={16}/>
      {item.comment && <p>{item.comment}</p>}
      <button type="button" className="text-button" onClick={() => setEditing(item)}>Изменить отзыв</button>
    </article>)}</div>}
    <button type="button" className="secondary" onClick={onBookings}>Перейти к поездкам <Icon name="arrow" size={17}/></button>
    {editing && <ReviewFormModal bookingId={editing.booking_id} roomType={editing.room_type}
      roomNumber={editing.room_number} review={editing} onClose={() => setEditing(null)}
      onSaved={saved => {
        setItems(current => current.map(item => item.id === saved.id ? {...item, ...saved} : item));
        setEditing(null);
      }}/>}
  </>;
}
