import React, {useEffect, useMemo, useState} from 'react';
import {api} from './api';
import {Select} from './Select';
import {Feedback, Icon, Modal, dateLabel, money, today} from './ui';
import {detailsFor} from './roomDetails';
import {addDays, nightsBetween, overlaps, occupied, summarize, statuses, downloadCsv} from './adminReports';
import './admin-operations.css';

async function loadAll(path, signal) {
  const items = [];
  let page;
  do {
    page = await api(`${path}${path.includes('?') ? '&' : '?'}limit=100&offset=${items.length}`, {signal});
    items.push(...page.items);
  } while (items.length < page.total && page.items.length);
  return items;
}

export function AdminOperations({view}) {
  const calendar = view === 'calendar';
  const [start, setStart] = useState(() => today().slice(0, 8) + '01');
  const [end, setEnd] = useState(() => {
    const first = today().slice(0, 8) + '01';
    return addDays(first, 32).slice(0, 8) + '01';
  });
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setNotice(''); setSelected(null);
    Promise.all([loadAll('/rooms?include_inactive=true', controller.signal), loadAll('/bookings', controller.signal)])
      .then(([rooms, bookings]) => {if (!controller.signal.aborted) setData({rooms, bookings});})
      .catch(err => {if (!controller.signal.aborted) setError(err.message);})
      .finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [revision]);
  const days = nightsBetween(start, end);
  const valid = Boolean(start && end && days > 0 && days <= 366);
  const rooms = useMemo(() => (data?.rooms || []).filter(room => (!category || room.room_type === category) && room.number.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => a.number.localeCompare(b.number, 'ru', {numeric: true})), [data, category, search]);
  const report = useMemo(() => valid && data ? summarize(rooms, data.bookings.filter(booking => rooms.some(room => room.id === booking.room_id)), start, end) : null, [rooms, data, start, end, valid]);
  const ready = !loading && !error && report;
  const currentDay = today();
  function shiftPeriod(direction) {
    setStart(addDays(start, direction * days)); setEnd(addDays(end, direction * days)); setSelected(null);
  }
  function exportReport(kind) {
    const rows = kind === 'bookings' ? [
      ['Бронирование', 'Номер', 'Категория', 'Заезд', 'Выезд', 'Статус', 'Полная стоимость брони', 'Валюта'],
      ...report.selected.map(booking => [booking.id, booking.room_number, detailsFor({room_type: booking.room_type})[0], booking.check_in, booking.check_out, statuses[booking.status], booking.total_amount, booking.currency]),
    ] : [
      ['Период с', start, 'До (не включая)', end],
      ['Категория', category || 'Все категории', 'Поиск номера', search],
      ['Номеров в расчёте', report.inventory], ['Бронирований с проживанием в периоде', report.selected.length],
      ['Занятых номеро-ночей', report.roomNights], ['Загрузка, %', report.occupancy.toFixed(2)],
      ...Object.entries(report.amounts).map(([currency, amount]) => ['Стоимость подтверждённых ночей', amount.toFixed(2), currency]),
      [], ['Дата', 'Занято номеров', 'Номеров в расчёте'],
      ...report.daily.map(day => [day.day, day.occupied, report.inventory]),
    ];
    downloadCsv(`qonaq-${kind}-${start}-${end}.csv`, rows);
    setNotice('CSV-отчёт подготовлен к скачиванию.');
  }
  return <section className="admin-operations">
    <div className="admin-page-heading"><div><h1>{calendar ? 'Календарь занятости' : 'Статистика и отчёты'}</h1><p>{calendar ? 'Все номера и бронирования на одной временной шкале.' : 'Загрузка отеля и стоимость проживаний за выбранный период.'}</p></div><button onClick={() => setRevision(value => value + 1)} disabled={loading}>Обновить данные</button></div>
    <div className="operations-filters">
      <label>Начало периода<input type="date" value={start} onChange={event => {setStart(event.target.value); setSelected(null);}}/></label>
      <label>Конец, не включая<input type="date" value={end} onChange={event => {setEnd(event.target.value); setSelected(null);}}/></label>
      <label>Категория<Select value={category} onChange={event => setCategory(event.target.value)}><option value="">Все категории</option>{[...new Set((data?.rooms || []).map(room => room.room_type))].map(type => <option key={type} value={type}>{detailsFor({room_type: type})[0]}</option>)}</Select></label>
      <label>Номер<input placeholder="Например, 101" value={search} onChange={event => setSearch(event.target.value)}/></label>
    </div>
    {!valid && <p className="alert" role="alert">Выберите период от 1 до 366 ночей. Конец периода должен быть позже начала.</p>}
    <Feedback error={error} notice={notice}/>
    {loading ? <div className="admin-empty" role="status">Загружаем занятость и бронирования…</div> : error ? <div className="admin-empty"><p>Не удалось получить данные для отчёта.</p><button onClick={() => setRevision(value => value + 1)}>Попробовать снова</button></div> : ready && <>
      <div className="operations-summary" aria-label="Показатели периода">
        <div><span>Загрузка</span><strong>{report.occupancy.toFixed(1)}<small>%</small></strong></div>
        <div><span>Занятых ночей</span><strong>{report.roomNights}</strong></div>
        <div><span>Бронирований</span><strong>{report.selected.length}</strong></div>
        <div><span>Номеров в расчёте</span><strong>{report.inventory}</strong></div>
      </div>
      {calendar ? <section className="operations-panel">
        <div className="operations-panel-heading"><div><h2>{dateLabel(start)} — {dateLabel(addDays(end, -1), true)}</h2><p>Нажмите на бронь, чтобы посмотреть детали.</p></div><div className="operations-actions"><button className="icon-button" aria-label="Предыдущий период" onClick={() => shiftPeriod(-1)} disabled={Number(start.slice(0, 4)) < 2}><Icon name="left"/></button><button onClick={() => {setStart(currentDay); setEnd(addDays(currentDay, 14));}}>Сегодня</button><button className="icon-button" aria-label="Следующий период" onClick={() => shiftPeriod(1)} disabled={Number(end.slice(0, 4)) >= 9998}><Icon name="right"/></button></div></div>
        <div className="occupancy-legend"><span className="confirmed">Подтверждено</span><span className="pending">Ожидает оплаты</span><span>Пустая ячейка — свободно</span></div>
        {rooms.length ? <div key={`${start}-${end}`} className="occupancy-scroll" tabIndex={0} role="region" aria-label="Календарь номеров, прокрутка по горизонтали"><table className="occupancy-table"><caption className="sr-only">Занятость номеров с {start} до {end}, день выезда свободен</caption><thead><tr><th scope="col">Номер</th>{report.daily.map(({day}) => <th key={day} scope="col" aria-current={day === currentDay ? 'date' : undefined}><span>{dateLabel(day)}</span><small>{new Intl.DateTimeFormat('ru', {weekday: 'short', timeZone: 'UTC'}).format(new Date(day))}</small></th>)}</tr></thead><tbody>{rooms.map(room => {
          const bookings = report.active.filter(booking => booking.room_id === room.id);
          const cells = [];
          let i = 0;
          while (i < days) {
            const day = addDays(start, i);
            const booking = bookings.find(item => overlaps(item, day, addDays(day, 1)));
            if (!booking) {cells.push(<td key={day} className={day === currentDay ? 'is-today' : ''}><span className="sr-only">Свободно: {dateLabel(day)}</span></td>); i++; continue;}
            const span = nightsBetween(day, booking.check_out < end ? booking.check_out : end);
            cells.push(<td key={day} colSpan={span} className="occupancy-booked"><button className={`stay-block ${booking.status}`} onClick={() => setSelected(booking)} aria-label={`Номер ${room.number}, ${statuses[booking.status]}, ${dateLabel(booking.check_in)} — ${dateLabel(booking.check_out)}`}><Icon name={booking.status === 'confirmed' ? 'check' : 'calendar'} size={14}/><span>{statuses[booking.status]}<small>{dateLabel(booking.check_in)} — {dateLabel(booking.check_out)}</small></span></button></td>);
            i += span;
          }
          return <tr key={room.id}><th scope="row"><strong>№ {room.number}</strong><small>{detailsFor(room)[0]}{!room.is_active && ' · Скрыт'}</small></th>{cells}</tr>;
        })}</tbody></table></div> : <div className="admin-empty"><h3>Номера не найдены</h3><p>Измените фильтры или добавьте номера в номерной фонд.</p></div>}
        <p className="operations-note">Ожидающие оплаты брони тоже занимают номер. День выезда свободен. Отменённые брони не показаны.</p>
      </section> : <>
        <section className="operations-panel"><div className="operations-panel-heading"><div><h2>Стоимость подтверждённых ночей</h2><p>Только ночи внутри выбранного периода, пропорционально стоимости брони.</p></div><Icon name="card" size={25}/></div><div className="operations-revenue">{Object.keys(report.amounts).length ? Object.entries(report.amounts).map(([currency, amount]) => <strong key={currency}>{money(amount, currency)}</strong>) : <p>В этом периоде нет подтверждённых проживаний.</p>}</div><p className="operations-note">Это стоимость проживания, а не полученные платежи. Валюты рассчитываются отдельно. Ожидающие оплаты и отменённые брони в сумму не входят.</p></section>
        <section className="operations-panel"><div className="operations-panel-heading"><div><h2>Занятость по дням</h2><p>Подтверждённые брони и ожидающие оплаты. Всего номеров в расчёте: {report.inventory}.</p></div></div><div className="operations-chart" role="img" aria-label={`Загрузка за период ${report.occupancy.toFixed(1)} процента. Точные значения доступны в сводном CSV.`}>{report.daily.map(day => <div key={day.day} title={`${dateLabel(day.day)}: ${day.occupied} из ${report.inventory}`}><span style={{height: `${report.inventory ? day.occupied / report.inventory * 100 : 0}%`}}/></div>)}</div><div className="operations-chart-axis"><span>{dateLabel(start)}</span><span>{dateLabel(addDays(end, -1))}</span></div></section>
        <section className="operations-panel"><div className="operations-panel-heading"><div><h2>Выгрузить отчёт</h2><p>CSV с текущими фильтрами, кодировкой UTF-8 и разделителем «;» для Excel.</p></div></div><div className="operations-downloads"><button className="primary" onClick={() => exportReport('summary')}><Icon name="download" size={18}/>Сводный отчёт</button><button onClick={() => exportReport('bookings')}><Icon name="download" size={18}/>Бронирования · {report.selected.length}</button></div><p className="operations-note">В список входят все брони, пересекающие период, включая отменённые. Для каждой указана полная стоимость. Загрузка рассчитана по текущему номерному фонду; скрытые номера с активной бронью также учтены.</p></section>
      </>}
    </>}
    {selected && <Modal title={`Бронирование · № ${selected.room_number}`} onClose={() => setSelected(null)} className="operations-modal"><span className={`booking-state ${selected.status}`}>{statuses[selected.status]}</span><dl><dt>Заезд</dt><dd>{dateLabel(selected.check_in, true)}</dd><dt>Выезд</dt><dd>{dateLabel(selected.check_out, true)}</dd><dt>Гостей</dt><dd>{selected.guest_count ?? 'Не указано'}</dd><dt>Полная стоимость</dt><dd>{money(selected.total_amount, selected.currency)}</dd><dt>Номер бронирования</dt><dd>{selected.id}</dd></dl><button onClick={() => setSelected(null)}>Закрыть</button></Modal>}
  </section>;
}
