import React, {useEffect, useRef} from 'react';
import {currentLanguage, currencyPreference, translate} from './i18n';

const icons = {
  chart: <><path d="M4 3v18h17M8 16v-4m5 4V8m5 8V5"/></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  edit: <><path d="m14 5 5 5M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15l-1 5Z"/></>,
  arrow: <><path d="M4 12h15"/><path d="m13 6 6 6-6 6"/></>,
  down: <path d="m6 9 6 6 6-6"/>,
  left: <path d="m15 6-6 6 6 6"/>,
  right: <path d="m9 6 6 6-6 6"/>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  guests: <><circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  minus: <path d="M5 12h14"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  bed: <><path d="M3 18v3m18-3v3M3 14V6h18v8M3 18h18v-4H3zm4-4v-4h4v4m2 0v-4h4v4"/></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
  eyeOff: <><path d="m3 3 18 18M10 6.2c.7-.1 1.3-.2 2-.2 6.5 0 10 6 10 6a16 16 0 0 1-3 3.4M6.2 7.7A17 17 0 0 0 2 12s3.5 6 10 6c1.6 0 3-.4 4.2-.9"/></>,
  pin: <><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></>,
  heart: <path d="M20.8 8.7c0 5.5-8.8 11-8.8 11s-8.8-5.5-8.8-11A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z"/>,
  briefcase: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18m-11 0v2h4v-2"/></>,
  chat: <path d="M20.5 11.5a8.5 8.5 0 0 1-12.7 7.4L3 20l1.1-4.2a8.5 8.5 0 1 1 16.4-4.3Z"/>,
  people: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4.6V20"/></>,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
  sliders: <><path d="M4 7h3m5 0h8M4 17h8m5 0h3"/><circle cx="9.5" cy="7" r="2.5"/><circle cx="14.5" cy="17" r="2.5"/></>,
  mark: <><path d="M2 21h20M5 21V10l7-6 7 6v11M9 21v-6l3-3 3 3v6M8 9l4-4 4 4"/></>,
};

export function Icon({name, size = 20}) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg>;
}

export const image = name => import.meta.env.BASE_URL + 'images/' + name + '.webp';
export const money = (amount, currency) => {
  const displayCurrency = currencyPreference();
  let value = Number(amount);
  let rate = 0;
  try { rate = Number(localStorage.getItem('qonaq.usd-kzt')); } catch {}
  let shownCurrency = currency;
  if (rate > 0 && currency === 'KZT' && displayCurrency === 'USD') {
    value /= rate;
    shownCurrency = 'USD';
  } else if (rate > 0 && currency === 'USD' && displayCurrency === 'KZT') {
    value *= rate;
    shownCurrency = 'KZT';
  }
  const locale = {ru: 'ru-KZ', en: 'en-US', kk: 'kk-KZ'}[currentLanguage()] || 'ru-KZ';
  return new Intl.NumberFormat(locale, {style: 'currency', currency: shownCurrency,
    minimumFractionDigits: 0, maximumFractionDigits: shownCurrency === 'KZT' ? 0 : 2}).format(value);
};
export const count = (number, one, few, many) => {
  const lang = currentLanguage();
  if (lang === 'en') return `${number} ${translate(number === 1 ? one : many, lang)}`;
  if (lang === 'kk') return `${number} ${translate(one, lang)}`;
  return number + ' ' + ({one, few, many}[new Intl.PluralRules('ru').select(number)] ?? many);
};
export const today = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Qyzylorda', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());
export const dateLabel = (day, includeYear = false) => new Intl.DateTimeFormat({ru: 'ru-KZ', en: 'en-US', kk: 'kk-KZ'}[currentLanguage()] || 'ru-KZ', {
  day: 'numeric', month: 'long', year: includeYear ? 'numeric' : undefined, timeZone: 'UTC'
}).format(new Date(day + 'T00:00:00Z'));
export const stayLength = (start, end) => (Date.parse(end) - Date.parse(start)) / 86400000;

export function Brand({onClick}) {
  return <a className="brand" href="#top" onClick={onClick} aria-label="Qonaq, главная">
    <Icon name="mark" size={30}/><span>Qonaq <small>hotel</small></span>
  </a>;
}

export function Feedback({error, notice}) {
  return <>{error && <p className="alert" role="alert">{error}</p>}
    {notice && <p className="notice" role="status"><Icon name="check" size={17}/>{notice}</p>}</>;
}

export function Modal({title, onClose, className = '', children}) {
  const dialog = useRef(null);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  return <dialog ref={dialog} className={className} aria-labelledby="dialog-title" onCancel={event => {
    event.preventDefault();
    onClose();
  }}>
    <div className="dialog-heading">
      <h2 id="dialog-title">{title}</h2>
      <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть"><Icon name="close"/></button>
    </div>
    {children}
  </dialog>;
}
