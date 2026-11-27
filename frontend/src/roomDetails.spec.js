import {describe, test, expect} from 'vitest';
import {roomDetails, detailsFor} from './roomDetails.js';

describe('roomDetails', () => {
  // 5
  test('a known room type gets its Russian title and style', () => {
    const [title, style] = detailsFor({room_type: 'suite'});
    expect(title).toBe('Люкс');
    expect(style).toBe('room-suite');
  });

  // 6
  test('the room type does not depend on letter case', () => {
    expect(detailsFor({room_type: 'DELUXE'})[0]).toBe('Делюкс');
  });

  // 7
  test('an unknown room type keeps its own name and a standard style', () => {
    const [title, style, text] = detailsFor({room_type: 'Penthouse'});
    expect(title).toBe('Penthouse');
    expect(style).toBe('room-standard');
    expect(text).toBe('');
  });

  // 8
  test('names like constructor are not treated as room types', () => {
    expect(detailsFor({room_type: 'constructor'})[0]).toBe('constructor');
    expect(Object.keys(roomDetails)).toHaveLength(6);
  });
});
