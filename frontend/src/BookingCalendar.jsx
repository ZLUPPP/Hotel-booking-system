import React, {useEffect, useRef, useState} from 'react';
import {RoomFilters} from './RoomFilters';
import {StayPrice} from './StayPrice';
import {dateLabel, Feedback, Icon, today} from './ui';
import {currentLanguage, translate} from './i18n';

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const asDate = day => new Date(day + 'T00:00:00Z');
const iso = date => date.toISOString().slice(0, 10);
const monthOf = day => day.slice(0, 7) + '-01';

function shiftMonth(day, amount, keepDay = false) {
  const date = asDate(monthOf(day));
  date.setUTCMonth(date.getUTCMonth() + amount);
  if (keepDay) {
    const lastDay = new Date(date.getTime());
    lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
    date.setUTCDate(Math.min(asDate(day).getUTCDate(), lastDay.getUTCDate()));
  }
  return iso(date);
}

function shiftDay(day, amount) {
  const date = asDate(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return iso(date);
}

function monthTitle(month) {
  const locale = {ru: 'ru-KZ', en: 'en-US', kk: 'kk-KZ'}[currentLanguage()];
  return new Intl.DateTimeFormat(locale, {month: 'long', timeZone: 'UTC'}).format(asDate(month)) + ' ' + month.slice(0, 4);
}

function Month({month, minimum, start, end, activeDay, preview, onFocus, onSelect, onKey, setPreview}) {
  const startColumn = (asDate(month).getUTCDay() + 6) % 7;
  const lastDay = asDate(month);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
  const days = lastDay.getUTCDate();
  const cells = Array.from({length: 42}, (_, index) => {
    const number = index - startColumn + 1;
    return number >= 1 && number <= days ? number : null;
  });
  const shownEnd = end || (preview > start ? preview : '');

  return <div className="calendar-month" role="group" aria-label={monthTitle(month)}>
    <h3>{monthTitle(month)}</h3>
    <div className="calendar-grid">
      {weekdays.map(day => <span className="calendar-weekday" key={day} aria-hidden="true">{translate(day)}</span>)}
      {cells.map((number, index) => {
        if (!number) return <span key={index} aria-hidden="true"/>;
        const day = month.slice(0, 8) + String(number).padStart(2, '0');
        const selected = day === start || day === end;
        const range = start && day >= start && day <= shownEnd;
        const column = index % 7;
        return <button key={index} type="button" className="calendar-day" data-date={day}
          data-range={range || undefined} data-start={day === start || undefined} data-end={day === end || undefined}
          data-band-start={range && (day === start || column === 0 || number === 1) || undefined}
          data-band-end={range && (day === shownEnd || column === 6 || number === days) || undefined}
          aria-label={dateLabel(day, true)} aria-pressed={selected} aria-current={day === minimum ? 'date' : undefined}
          tabIndex={day === activeDay ? 0 : -1} disabled={day < minimum || (!start || end) && day === '9999-12-31'}
          onFocus={() => onFocus(day)} onPointerEnter={event => {
            if (event.pointerType === 'mouse') setPreview(day);
          }} onClick={() => onSelect(day)} onKeyDown={event => onKey(event, day)}>
          <span>{number}</span>
        </button>;
      })}
    </div>
  </div>;
}

export function BookingCalendar({filters, setFilters, onSearch, pending, error, preferredRoom, clearRoom}) {
  const minimum = today();
  const start = filters.check_in;
  const end = filters.check_out;
  const [month, setMonth] = useState(() => monthOf(start || minimum));
  const [focusDay, setFocusDay] = useState(start || minimum);
  const [preview, setPreview] = useState('');
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 730px)').matches);
  const grid = useRef(null);
  const lastMonth = compact ? month : shiftMonth(month, 1);
  const visibleFocus = focusDay >= minimum && monthOf(focusDay) >= month && monthOf(focusDay) <= lastMonth
    ? focusDay : month < minimum ? minimum : month;
  const update = (key, value) => setFilters(current => ({...current, [key]: value}));

  useEffect(() => {
    const query = window.matchMedia('(max-width: 730px)');
    const resize = event => setCompact(event.matches);
    query.addEventListener('change', resize);
    setCompact(query.matches);
    return () => query.removeEventListener('change', resize);
  }, []);

  function select(day) {
    if (!end && day > start && start) {
      setFilters(current => ({...current, check_out: day}));
    } else {
      setFilters(current => ({...current, check_in: day, check_out: ''}));
    }
    setPreview('');
  }

  function onKey(event, day) {
    const weekday = (asDate(day).getUTCDay() + 6) % 7;
    const offsets = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday};
    let next;
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      next = shiftMonth(day, event.key === 'PageUp' ? -1 : 1, true);
    } else if (Object.hasOwn(offsets, event.key)) {
      next = shiftDay(day, offsets[event.key]);
    } else {
      return;
    }
    event.preventDefault();
    next = next < minimum ? minimum : next;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
    const nextMonth = monthOf(next);
    if (nextMonth < month || nextMonth > lastMonth) {
      setMonth(nextMonth === '9999-12-01' && !compact ? '9999-11-01' : nextMonth);
    }
    setFocusDay(next);
    setPreview('');
    window.requestAnimationFrame(() => grid.current?.querySelector(`[data-date="${next}"]`)?.focus());
  }

  function changeMonth(amount) {
    setMonth(current => shiftMonth(current, amount));
    setPreview('');
  }

  return <section id="search" className="stay-section" aria-labelledby="stay-title">
    <div className="container stay-container">
      <div className="stay-heading">
        <div><span className="section-kicker"><Icon name="calendar" size={17}/> {translate('Бронирование')}</span>
          <h2 id="stay-title" tabIndex={-1}>{translate('Когда вас ждать?')}</h2></div>
        <p>{translate('Выберите день заезда и день выезда. Мы покажем свободные номера и стоимость за весь период.')}</p>
      </div>
      <form onSubmit={event => {event.preventDefault(); onSearch();}} aria-busy={pending}>
        <fieldset className="stay-form" disabled={pending} aria-label={translate('Даты и параметры проживания')}>
          <div className="calendar" ref={grid} onPointerLeave={() => setPreview('')}>
            <div className="calendar-navigation">
              <button type="button" className="icon-button calendar-nav" disabled={month <= monthOf(minimum)}
                onClick={() => changeMonth(-1)} aria-label={translate('Предыдущий месяц')}><Icon name="left" size={18}/></button>
              <button type="button" className="icon-button calendar-nav" disabled={lastMonth >= '9999-12-01'}
                onClick={() => changeMonth(1)} aria-label={translate('Следующий месяц')}><Icon name="right" size={18}/></button>
            </div>
            <div className="calendar-months">
              {(compact ? [month] : [month, lastMonth]).map(value => <Month key={value} month={value} minimum={minimum}
                start={start} end={end} activeDay={visibleFocus} preview={preview} onFocus={setFocusDay}
                onSelect={select} onKey={onKey} setPreview={setPreview}/>)}
            </div>
            <div className="calendar-footer">
              <p role="status">{translate(end ? 'Можно выбрать новый период' : start ? 'Теперь выберите дату выезда' : 'Выберите дату заезда')}</p>
              <button className="text-button" type="button" disabled={!start} onClick={() => {
                setFilters(current => ({...current, check_in: '', check_out: ''}));
                setPreview('');
              }}>{translate('Сбросить даты')}</button>
            </div>
          </div>
          <div className="stay-summary">
            <h3>{translate('Ваше проживание')}</h3>
            {preferredRoom && <div className="chosen-room">
              <span><Icon name="bed" size={17}/> {translate('Номер')} {preferredRoom.number}</span>
              <button type="button" className="icon-button" onClick={clearRoom} aria-label={translate('Искать среди всех номеров')}><Icon name="close" size={16}/></button>
            </div>}
            <dl className="stay-dates" aria-live="polite">
              <div><dt>{translate('Заезд')}</dt><dd>{start ? dateLabel(start, true) : translate('Выберите дату')}</dd></div>
              <div><dt>{translate('Выезд')}</dt><dd>{end ? dateLabel(end, true) : translate('Выберите дату')}</dd></div>
            </dl>
            <div className="stay-guests">
              <label htmlFor="guests">{translate('Гости')}</label>
              <div className="guest-control">
                <button className="icon-button" type="button" aria-label={translate('Уменьшить число гостей')} disabled={Number(filters.capacity) <= 1}
                  onClick={() => update('capacity', String(Number(filters.capacity) - 1))}><Icon name="minus" size={16}/></button>
                <input id="guests" type="number" min="1" max="2147483647" value={filters.capacity} required
                  onChange={e => update('capacity', e.target.value)}/>
                <button className="icon-button" type="button" aria-label={translate('Увеличить число гостей')} disabled={Number(filters.capacity) >= 2147483647}
                  onClick={() => update('capacity', String(Number(filters.capacity) + 1))}><Icon name="plus" size={16}/></button>
              </div>
            </div>
            <RoomFilters filters={filters} setFilters={setFilters} preferredRoom={preferredRoom}/>
            <Feedback error={error}/>
            <StayPrice filters={filters} preferredRoom={preferredRoom}/>
            <button className="primary stay-submit" disabled={pending || !end}>
              {translate(pending ? 'Проверяем даты…' : preferredRoom ? 'Проверить номер' : 'Найти номера')}<Icon name="arrow" size={19}/>
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  </section>;
}
