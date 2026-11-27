import {describe, test, expect, vi, beforeEach} from 'vitest';
import {api, hasToken, setToken} from './api.js';

function answer(status, data) {
  return {ok: status < 400, status, json: async () => data};
}

beforeEach(() => {
  setToken(null);
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('fetch', vi.fn());
});

describe('api', () => {
  // 13
  test('hasToken follows setToken', () => {
    expect(hasToken()).toBe(false);
    setToken('abc');
    expect(hasToken()).toBe(true);
    setToken(null);
    expect(hasToken()).toBe(false);
  });

  // 14
  test('sends the Authorization header when a token exists', async () => {
    fetch.mockResolvedValue(answer(200, {ok: true}));
    setToken('abc');
    await api('/rooms');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer abc');
  });

  // 15
  test('sends no Authorization header without a token', async () => {
    fetch.mockResolvedValue(answer(200, {ok: true}));
    await api('/rooms');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  // 16
  test('sends a JSON body and the idempotency key', async () => {
    fetch.mockResolvedValue(answer(201, {id: 1}));
    await api('/bookings', {method: 'POST', body: {room_id: 'r1'}, key: 'key-1'});
    const options = fetch.mock.calls[0][1];
    expect(options.method).toBe('POST');
    expect(options.body).toBe('{"room_id":"r1"}');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['Idempotency-Key']).toBe('key-1');
  });

  // 17
  test('room_unavailable gives a clear message about busy dates', async () => {
    fetch.mockResolvedValue(answer(409, {error: {code: 'room_unavailable'}}));
    await expect(api('/bookings', {method: 'POST', body: {}})).rejects.toThrow('уже занят на выбранные даты');
  });

  // 18
  test('a wrong login gives a message about email and password', async () => {
    fetch.mockResolvedValue(answer(401, {error: {code: 'invalid_credentials'}}));
    await expect(api('/auth/login', {method: 'POST', body: {}})).rejects.toThrow('Проверьте почту и пароль');
  });

  // 19
  test('a network failure says the server is not available', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api('/rooms')).rejects.toThrow('Сервер недоступен');
  });

  // 20
  test('a 401 answer with a token fires the session-expired event', async () => {
    fetch.mockResolvedValue(answer(401, {error: {code: 'token_expired'}}));
    const listener = vi.fn();
    window.addEventListener('session-expired', listener);
    setToken('old-token');
    await expect(api('/bookings')).rejects.toThrow('Сессия закончилась');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
