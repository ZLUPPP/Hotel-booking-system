const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const tokenKey = 'qonaq.access-token';
let token = null;
try {
  token = window.sessionStorage.getItem(tokenKey);
} catch {
  // The current page can still use an in-memory session when storage is unavailable.
}

export function hasToken() {
  return Boolean(token);
}

export function setToken(value) {
  token = value;
  try {
    if (value) window.sessionStorage.setItem(tokenKey, value);
    else window.sessionStorage.removeItem(tokenKey);
  } catch {
    // Storage can be blocked by the browser.
  }
}

function errorMessage(path, status, code) {
  if (path === '/auth/login' && status === 401) return 'Проверьте почту и пароль и попробуйте снова.';
  if (code === 'email_taken' || (path === '/auth/register' && code === 'data_conflict')) {
    return 'Аккаунт с такой почтой уже есть.';
  }
  if (code === 'room_number_taken') return 'Комната с таким номером уже существует.';
  if (code === 'self_change_forbidden') return 'Нельзя изменить свою роль или отключить собственный аккаунт.';
  if (code === 'review_not_allowed') return 'Отзыв можно оставить только после завершённого проживания по подтверждённой брони.';
  if (code === 'room_unavailable') return 'Этот номер уже занят на выбранные даты. Закройте окно и обновите поиск.';
  return {
    401: 'Сессия закончилась. Войдите снова.',
    403: 'Для этого действия недостаточно прав.',
    404: 'Запись больше недоступна. Обновите страницу.',
    409: 'Данные изменились. Обновите список и повторите действие.',
    422: 'Проверьте введённые данные.',
  }[status] || 'Не удалось выполнить запрос. Попробуйте ещё раз.';
}

export async function api(path, {method = 'GET', body, key, signal} = {}) {
  const requestToken = token;
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      signal,
      headers: {
        ...(body !== undefined ? {'Content-Type': 'application/json'} : {}),
        ...(requestToken ? {Authorization: `Bearer ${requestToken}`} : {}),
        ...(key ? {'Idempotency-Key': key} : {}),
      },
      ...(body !== undefined ? {body: JSON.stringify(body)} : {}),
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new Error('Сервер недоступен. Проверьте соединение и попробуйте снова.');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && !signal?.aborted && requestToken && token === requestToken) window.dispatchEvent(new Event('session-expired'));
    throw new Error(errorMessage(path, response.status, data?.error?.code));
  }
  if (data === null) throw new Error('Сервер вернул неожиданный ответ. Попробуйте снова.');
  return data;
}
