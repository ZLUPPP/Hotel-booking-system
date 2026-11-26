export const DAY = 86400000;
export const statuses = {pending: 'Ожидает оплаты', confirmed: 'Подтверждено', cancelled: 'Отменено'};
export const addDays = (day, count) => new Date(Date.parse(day) + count * DAY).toISOString().slice(0, 10);
export const nightsBetween = (start, end) => Math.round((Date.parse(end) - Date.parse(start)) / DAY);
export const overlaps = (booking, start, end) => booking.check_in < end && booking.check_out > start;
export const occupied = booking => booking.status === 'pending' || booking.status === 'confirmed';

export function summarize(rooms, bookings, start, end) {
  const days = nightsBetween(start, end);
  const selected = bookings.filter(booking => overlaps(booking, start, end));
  const active = selected.filter(occupied);
  // Hidden rooms with reservations still belong to the period's inventory.
  const inventory = rooms.filter(room => room.is_active || active.some(booking => booking.room_id === room.id));
  const nights = booking => nightsBetween(booking.check_in > start ? booking.check_in : start, booking.check_out < end ? booking.check_out : end);
  const roomNights = active.reduce((sum, booking) => sum + nights(booking), 0);
  const amounts = {};
  for (const booking of selected.filter(booking => booking.status === 'confirmed')) {
    const amount = Number(booking.total_amount) * nights(booking) / nightsBetween(booking.check_in, booking.check_out);
    amounts[booking.currency] = (amounts[booking.currency] || 0) + amount;
  }
  return {selected, active, roomNights, amounts, inventory: inventory.length,
    occupancy: inventory.length && days > 0 ? roomNights / (inventory.length * days) * 100 : 0,
    daily: Array.from({length: days}, (_, i) => {
      const day = addDays(start, i);
      return {day, occupied: active.filter(booking => overlaps(booking, day, addDays(day, 1))).length};
    })};
}

export function csvText(rows) {
  const cell = value => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n');
}

export function downloadCsv(filename, rows) {
  const url = URL.createObjectURL(new Blob([csvText(rows)], {type: 'text/csv;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
