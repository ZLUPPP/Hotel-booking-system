import {describe, test, expect} from 'vitest';
import {stayQuery, roomSearchParams} from './roomSearch.js';

const filters = {check_in: '2030-01-10', check_out: '2030-01-13', room_type: '  suite  '};

describe('roomSearch', () => {
  // 1
  test('stayQuery trims the room type when no room is chosen', () => {
    const query = stayQuery(filters, null);
    expect(query.room_type).toBe('suite');
    expect(query.room_id).toBe('');
  });

  // 2
  test('stayQuery clears the room type when a room is chosen', () => {
    const query = stayQuery(filters, {id: 'room-1'});
    expect(query.room_type).toBe('');
    expect(query.room_id).toBe('room-1');
  });

  // 3
  test('roomSearchParams drops empty values', () => {
    const params = roomSearchParams({check_in: '2030-01-10', room_type: '', room_id: ''});
    expect(params.toString()).toBe('check_in=2030-01-10');
  });

  // 4
  test('roomSearchParams keeps all filled values', () => {
    const params = roomSearchParams({check_in: '2030-01-10', check_out: '2030-01-13'});
    expect(params.get('check_in')).toBe('2030-01-10');
    expect(params.get('check_out')).toBe('2030-01-13');
  });
});
