import {Select} from './Select';
import React, {useRef, useState} from 'react';
import {api} from './api';
import {detailsFor, roomDetails} from './roomDetails';
import {count, Feedback, Icon, image, money} from './ui';

const blank = {number: '', room_type: 'standard', capacity: '2', price_per_night: '', currency: 'KZT'};

export function AdminRoomForm({room, onCancel, onSaved}) {
  const [values, setValues] = useState(room ? {...room} : {...blank});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const [title, photo, description] = detailsFor(values);
  const change = event => setValues(current => ({...current, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value}));
  const ready = values.number.trim() && Number.isInteger(Number(values.capacity)) && Number(values.capacity) > 0 && Number(values.price_per_night) > 0;

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const body = {number: values.number.trim(), room_type: values.room_type.trim(), capacity: Number(values.capacity), price_per_night: String(values.price_per_night), currency: values.currency};
      if (room) body.is_active = values.is_active;
      const saved = await api(room ? `/rooms/${room.id}` : '/rooms', {method: room ? 'PATCH' : 'POST', body});
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <div className="admin-create-layout">
    <form className="admin-room-form admin-create-form" onSubmit={submit}>
      <section className="admin-form-panel" aria-labelledby="room-details-title">
        <div className="admin-panel-heading"><span className="admin-panel-icon"><Icon name="bed" size={21}/></span><div><h2 id="room-details-title">Детали номера</h2><p>Место для нового путешествия.</p></div></div>
        <fieldset disabled={busy} className="admin-details-fields"><legend className="sr-only">Основная информация</legend>
          <div className="admin-form-grid">
            <label>Номер комнаты<input autoFocus name="number" placeholder="Например, 207" value={values.number} onChange={change} required maxLength={20} pattern=".*\S.*" aria-describedby="room-number-help"/><small id="room-number-help">Уникальный номер в вашем отеле.</small></label>
            <div className="admin-capacity-field"><label htmlFor="room-capacity">Количество гостей</label><div className="admin-capacity"><button type="button" className="icon-button" aria-label="Уменьшить количество гостей" disabled={Number(values.capacity) <= 1 || !Number.isInteger(Number(values.capacity))} onClick={() => setValues(current => ({...current, capacity: String(Number(current.capacity) - 1)}))}><Icon name="minus" size={16}/></button><input id="room-capacity" name="capacity" type="number" min="1" max="2147483647" step="1" value={values.capacity} onChange={change} required/><button type="button" className="icon-button" aria-label="Увеличить количество гостей" disabled={Number(values.capacity) >= 2147483647 || !Number.isInteger(Number(values.capacity))} onClick={() => setValues(current => ({...current, capacity: String(Math.max(1, Number(current.capacity) + 1))}))}><Icon name="plus" size={16}/></button></div><small>Максимальная вместимость номера.</small></div>
          </div>
        </fieldset>
        <fieldset disabled={busy} className="admin-category-fieldset"><legend>Категория номера</legend><p>Выберите характер будущего отдыха.</p><div className="admin-category-grid">
          {Object.entries(roomDetails).map(([key, [label, picture]]) => <label className={`admin-category ${values.room_type === key ? 'is-selected' : ''}`} key={key}>
            <input type="radio" name="room_type" value={key} checked={values.room_type === key} onChange={change}/><img src={image(picture)} alt="" loading="lazy"/><span>{label}<span className="admin-category-check"><Icon name="check" size={13}/></span></span>
          </label>)}
          {!Object.hasOwn(roomDetails, values.room_type) && <label className="admin-category is-selected"><input type="radio" name="room_type" checked value={values.room_type} onChange={change}/><img src={image(photo)} alt=""/><span>{title}<span className="admin-category-check"><Icon name="check" size={13}/></span></span></label>}
        </div></fieldset>
      </section>
      <section className="admin-form-panel" aria-labelledby="room-price-title">
        <div className="admin-panel-heading"><span className="admin-panel-icon"><Icon name="calendar" size={21}/></span><div><h2 id="room-price-title">Стоимость проживания</h2><p>Одна ночь. Всё необходимое для отдыха.</p></div></div>
        <fieldset disabled={busy} className="admin-details-fields"><legend className="sr-only">Тариф за ночь</legend><div className="admin-form-grid">
          <label>Цена за ночь<input name="price_per_night" type="number" placeholder="25 000" min="0.01" max="9999999999.99" step="0.01" value={values.price_per_night} onChange={change} required/></label>
          <label>Валюта<Select name="currency" value={values.currency} onChange={change}>{[...new Set(['KZT', 'USD', 'EUR', 'RUB', values.currency])].map(currency => <option key={currency}>{currency}</option>)}</Select></label>
        </div></fieldset>
        {room && <label className="check admin-publish-control"><input name="is_active" type="checkbox" checked={values.is_active} onChange={change} disabled={busy}/>Показывать в каталоге и разрешить бронирование</label>}
      </section>
      <Feedback error={error}/>
      <div className="admin-create-actions"><button type="button" disabled={busy} onClick={onCancel}>Отмена</button><button className="primary" disabled={busy} type="submit"><Icon name={room ? 'check' : 'plus'} size={18}/>{busy ? 'Сохраняем…' : room ? 'Сохранить изменения' : 'Добавить номер'}</button></div>
    </form>
    <aside className="admin-live-preview" aria-labelledby="room-preview-title">
      <div className="admin-preview-label"><Icon name="eye" size={18}/><h2 id="room-preview-title">Так увидят гости</h2></div>
      <article className="room"><div className="room-photo"><img src={image(photo)} alt={`Пример интерьера категории «${title}»`}/><span>Пример интерьера</span></div><div className="room-content"><div className="room-info"><span>Номер {values.number || '—'}</span><span><Icon name="guests" size={16}/>{Number(values.capacity) > 0 ? count(Number(values.capacity), 'гость', 'гостя', 'гостей') : '—'}</span></div><h3>{title}</h3><p className="admin-preview-description">{description}</p><div className="admin-preview-price"><span>Стоимость за ночь</span><strong>{Number(values.price_per_night) > 0 ? money(values.price_per_night, values.currency) : 'Укажите цену'}</strong></div></div></article>
      <div className="admin-publish-note"><span><Icon name={room && !values.is_active ? 'eyeOff' : 'check'} size={18}/></span><div><strong>{room && !values.is_active ? 'Номер скрыт' : 'Готов к размещению'}</strong><p>{room && !values.is_active ? 'Номер останется доступен в админке.' : room ? 'Изменения появятся в каталоге после сохранения.' : 'После добавления номер появится в каталоге и станет доступен для бронирования.'}</p></div></div>
      <p className="admin-preview-help">Фотография и описание подбираются по категории номера.</p>
      <div className="admin-form-readiness"><Icon name={ready ? 'check' : 'edit'} size={15}/>{ready ? 'Основные поля заполнены' : 'Заполните номер комнаты и стоимость'}</div>
    </aside>
  </div>;
}
