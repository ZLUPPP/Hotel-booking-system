import test from 'node:test';
import assert from 'node:assert/strict';
import {addDays, overlaps, summarize, csvText} from './adminReports.js';

const rooms = [{id: 'a', is_active: true}, {id: 'b', is_active: false}, {id: 'c', is_active: false}];
const booking = (changes = {}) => ({room_id: 'a', check_in: '2026-11-29', check_out: '2026-12-03', total_amount: '40000', currency: 'KZT', status: 'confirmed', ...changes});

test('checkout is exclusive; leap dates advance without timezone drift', () => {
  assert.equal(overlaps(booking(), '2026-12-03', '2026-12-04'), false);
  assert.equal(overlaps(booking(), '2026-11-28', '2026-11-29'), false);
  assert.equal(addDays('2028-02-28', 2), '2028-03-01');
});

test('clips nights and confirmed value to report period and separates currencies', () => {
  const report = summarize(rooms, [booking(), booking({room_id: 'b', currency: 'USD', total_amount: '400'})], '2026-12-01', '2026-12-04');
  assert.equal(report.roomNights, 4);
  assert.deepEqual(report.amounts, {KZT: 20000, USD: 200});
  assert.equal(report.inventory, 2);
  assert.equal(report.occupancy, 4 / 6 * 100);
  assert.deepEqual(report.daily.map(day => day.occupied), [2, 2, 0]);
});

test('pending blocks rooms but adds no value; cancelled is only in booking count', () => {
  const report = summarize(rooms, [booking({status: 'pending'}), booking({room_id: 'b', status: 'cancelled'})], '2026-12-01', '2026-12-04');
  assert.equal(report.selected.length, 2);
  assert.equal(report.roomNights, 2);
  assert.equal(report.inventory, 1);
  assert.deepEqual(report.amounts, {});
});

test('empty inventory produces finite zero occupancy', () => {
  const report = summarize([], [], '2026-12-01', '2026-12-02');
  assert.equal(report.occupancy, 0);
  assert.equal(report.daily[0].occupied, 0);
});

test('CSV preserves Cyrillic, delimiters and quotes and prevents formula injection', () => {
  const csv = csvText([['Номер', '101;102', 'a"b', '=SUM(1)', '  +1', '@test', 'Студия']]);
  assert.equal(csv, '\uFEFF"Номер";"101;102";"a""b";"\'=SUM(1)";"\'  +1";"\'@test";"Студия"');
});
