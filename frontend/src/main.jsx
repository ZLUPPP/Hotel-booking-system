import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {api, hasToken, setToken} from './api';
import {Account} from './Account';
import {Admin} from './Admin';
import {Dashboard, emptyPage, pageSize} from './Dashboard';
import {BookingDialog, Home} from './Home';
import {roomSearchParams, stayQuery} from './roomSearch';
import {Brand, Icon, today} from './ui';
import './style.css';
import './hotel.css';
import './interactions.css';

function AccountMenu({user, pending, onProfile, onAdmin, onLogout}) {
  const menu = useRef(null);
  useEffect(() => {
    const dismiss = event => {
      if (!menu.current?.contains(event.target)) close();
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  function close() {
    if (menu.current) menu.current.open = false;
  }

  return <details className="account-menu" ref={menu}
    onBlur={event => {if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close();}}
    onKeyDown={event => {
      if (event.key !== 'Escape' || !menu.current.open) return;
      event.preventDefault();
      close();
      menu.current.querySelector('summary').focus();
    }}>
    <summary className="header-account"><Icon name="guests" size={18}/><span>{user.full_name}</span><Icon name="down" size={15}/></summary>
    <div className="account-menu-panel">
      {user.role === 'admin' && <button disabled={pending} onClick={() => {close(); onAdmin();}}><Icon name="sliders" size={16}/>Управление отелем</button>}
      <button disabled={pending} onClick={() => {close(); onProfile();}}>Профиль</button>
      <button disabled={pending} onClick={() => {close(); onLogout();}}>Выйти</button>
    </div>
  </details>;
}

function App() {
  const [user, setUser] = useState(null);
  const [restoringSession, setRestoringSession] = useState(hasToken);
  const [view, setView] = useState('home');
  const [mode, setMode] = useState('login');
  const [filters, setFilters] = useState({check_in: '', check_out: '', capacity: '2', room_type: '', min_price: '', max_price: ''});
  const [catalog, setCatalog] = useState(emptyPage);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [preferredRoom, setPreferredRoom] = useState(null);
  const [draft, setDraft] = useState(null);
  const [created, setCreated] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const operation = useRef(false);
  const attempts = useRef({});
  const destination = useRef('top');
  const previousView = useRef(view);
  const isAdmin = user?.role === 'admin';
  const authorizedView = ['users', 'admin'].includes(view) && !isAdmin ? 'profile' : view;

  async function run(work) {
    if (operation.current) return;
    operation.current = true;
    setPending(true);
    setError('');
    try {
      await work();
    } catch (err) {
      setError(err.message);
    } finally {
      operation.current = false;
      setPending(false);
    }
  }

  function scrollToSection(target, viewChanged = false) {
    window.requestAnimationFrame(() => {
      if (target === 'top') {
        window.scrollTo({top: 0, behavior: viewChanged ? 'instant' : 'auto'});
        const heading = document.querySelector('main h1');
        heading?.setAttribute('tabindex', '-1');
        heading?.focus({preventScroll: true});
      } else {
        const section = document.getElementById(target);
        section?.scrollIntoView({block: 'start'});
        const heading = section?.querySelector('h2');
        heading?.setAttribute('tabindex', '-1');
        heading?.focus({preventScroll: true});
      }
    });
  }

  function navigate(next, target = 'top') {
    setError('');
    if (next !== 'auth' && next !== 'home') setDraft(null);
    if (next !== 'bookings') setCreated(false);
    destination.current = target;
    if (view === next) scrollToSection(target);
    setView(next);
  }

  function goHome(event) {
    event?.preventDefault();
    if (operation.current) return;
    const target = event?.currentTarget.hash.slice(1) || 'top';
    setDraft(null);
    navigate('home', target);
  }

  useEffect(() => {
    if (previousView.current !== view) {
      previousView.current = view;
      scrollToSection(destination.current, true);
    }
  }, [view]);

  useEffect(() => {
    function expired() {
      setToken(null);
      setUser(null);
      attempts.current = {};
      setMode('login');
      destination.current = 'top';
      setView('auth');
      setError('Сессия закончилась. Войдите снова.');
    }
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, []);

  useEffect(() => {
    if (!hasToken()) return;
    const controller = new AbortController();
    api('/users/me', {signal: controller.signal}).then(profile => {
      if (!controller.signal.aborted) setUser(profile);
    }).catch(() => {
      // An expired token is handled by session-expired. A network error allows another attempt on reload.
    }).finally(() => {
      if (!controller.signal.aborted) setRestoringSession(false);
    });
    return () => controller.abort();
  }, []);

  async function loadCatalog(offset = 0, signal) {
    const result = await api(`/rooms?limit=${pageSize}&offset=${offset}`, {signal});
    if (!signal?.aborted) setCatalog(result);
  }

  useEffect(() => {
    const controller = new AbortController();
    setCatalogLoading(true);
    setCatalogError('');
    setCatalog(emptyPage);
    loadCatalog(0, controller.signal).catch(err => {
      if (!controller.signal.aborted) setCatalogError(err.message);
    }).finally(() => {
      if (!controller.signal.aborted) setCatalogLoading(false);
    });
    return () => controller.abort();
  }, [isAdmin]);

  async function find(query, offset = 0) {
    const params = roomSearchParams(query);
    params.set('limit', String(pageSize));
    params.set('offset', String(offset));
    const page = await api('/rooms/available?' + params);
    setSearchResult({query, page});
    scrollToSection('rooms');
    return page;
  }

  function search() {
    run(async () => {
      if (!filters.check_in || filters.check_in < today() || filters.check_out <= filters.check_in) {
        throw new Error('Проверьте даты. Выезд должен быть позже заезда.');
      }
      if (filters.min_price && filters.max_price && Number(filters.min_price) > Number(filters.max_price)) {
        throw new Error('Минимальная цена должна быть меньше максимальной или равна ей.');
      }
      const query = stayQuery(filters, preferredRoom);
      const result = await find(query);
      if (preferredRoom && result.items.length) setDraft({room: result.items[0], dates: query});
    });
  }

  function selectRoom(room) {
    if (!searchResult) {
      setPreferredRoom(room);
      setError('');
      scrollToSection('search');
      return;
    }
    setError('');
    setDraft({room, dates: searchResult.query});
  }

  function updateFilters(update) {
    setFilters(update);
    setError('');
    setSearchResult(null);
  }

  function clearRoom() {
    setPreferredRoom(null);
    setSearchResult(null);
    setError('');
  }

  function searchAll() {
    setPreferredRoom(null);
    const {room_id, ...query} = searchResult.query;
    run(() => find(query));
  }

  function closeDraft() {
    if (operation.current) return;
    setDraft(null);
    setError('');
  }

  function openAuth() {
    setMode('login');
    navigate('auth');
  }

  function submitAccount(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    run(async () => {
      if (mode === 'register') await api('/auth/register', {method: 'POST', body});
      try {
        const result = await api('/auth/login', {method: 'POST', body: {email: body.email, password: body.password}});
        setToken(result.access_token);
        setUser(await api('/users/me'));
      } catch (err) {
        setToken(null);
        if (mode === 'register') {
          setMode('login');
          throw new Error('Аккаунт создан. Войдите с указанной почтой и паролем.');
        }
        throw err;
      }
      navigate('home', draft ? 'rooms' : 'top');
    });
  }

  function confirmBooking() {
    if (!user) {
      openAuth();
      return;
    }
    run(async () => {
      const {room, dates} = draft;
      await api('/bookings', {method: 'POST', body: {
        room_id: room.id, check_in: dates.check_in, check_out: dates.check_out, guest_count: Number(dates.capacity),
      }});
      setCreated(true);
      setSearchResult(null);
      setPreferredRoom(null);
      navigate('bookings');
    });
  }

  function logout() {
    setToken(null);
    setUser(null);
    attempts.current = {};
    goHome();
  }

  const page = searchResult?.page || catalog;

  return <>
    <a className="skip-link" href="#main">К основному содержанию</a>
    <header id="top" className="site-header">
      <div className="container header-inner">
        <Brand onClick={goHome}/>
        <nav aria-label="Основная навигация">
          <a href="#rooms" onClick={goHome}>Номера</a>
          <a href="#hotel" onClick={goHome}>Об отеле</a>
          {!user && <a href="#experiences" onClick={goHome}>Впечатления</a>}
          {user && <>
            <button className="nav-button" disabled={pending} aria-current={view === 'bookings' ? 'page' : undefined} onClick={() => navigate('bookings')}>
              {user.role === 'guest' ? 'Мои брони' : 'Все брони'}
            </button>
          </>}
        </nav>
        <div className="header-actions">
          {user ? <AccountMenu user={user} pending={pending} onProfile={() => navigate('profile')} onAdmin={() => navigate('admin')} onLogout={logout}/> :
            <button className="header-account" disabled={pending || restoringSession} onClick={openAuth}>
              <Icon name="guests" size={18}/>{restoringSession ? 'Аккаунт' : 'Войти'}
            </button>}
          <a className="primary header-book" href="#search" onClick={goHome}>Забронировать</a>
        </div>
      </div>
    </header>
    {view === 'home' && <Home filters={filters} setFilters={updateFilters} onSearch={search} page={page}
      searched={searchResult?.query} loading={catalogLoading && !searchResult} pending={pending} selectRoom={selectRoom}
      error={draft ? '' : error} catalogError={!searchResult && catalogError}
      preferredRoom={preferredRoom} clearRoom={clearRoom} searchAll={searchAll}
      retry={() => run(async () => {
        await loadCatalog();
        setCatalogError('');
      })}
      onPage={offset => run(() => searchResult ? find(searchResult.query, offset) : loadCatalog(offset))}/>}
    {view === 'auth' && <Account mode={mode} draft={draft} pending={pending} error={error}
      returnHome={goHome} onSubmit={submitAccount} switchMode={next => {setMode(next); setError('');}}/>}
    {user && authorizedView === 'admin' && <Admin user={user} updateUser={setUser} goHome={goHome} attempts={attempts}
      onChanged={() => {setSearchResult(null); loadCatalog(0).catch(err => setCatalogError(err.message));}}/>}
    {user && !['home', 'auth', 'admin'].includes(authorizedView) && <Dashboard key={authorizedView} view={authorizedView} user={user}
      updateUser={updated => setUser(current => current?.id === updated.id ? updated : current)}
      created={created} goHome={goHome} attempts={attempts}/>}
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand"><Brand onClick={goHome}/><span><Icon name="pin" size={17}/> Алматы, Казахстан</span></div>
        <nav aria-label="Навигация в подвале">
          <a href="#rooms" onClick={goHome}>Номера и люксы</a>
          <a href="#hotel" onClick={goHome}>Об отеле</a>
          <a href="#faq" onClick={goHome}>Частые вопросы</a>
        </nav>
        <small>Демонстрационный сайт Qonaq Hotel</small>
      </div>
    </footer>
    {view === 'home' && draft && <BookingDialog draft={draft} user={user} pending={pending} error={error}
      close={closeDraft} confirm={confirmBooking}/>}
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
