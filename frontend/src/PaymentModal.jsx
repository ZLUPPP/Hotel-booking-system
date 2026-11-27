import React, {useState} from 'react';
import {Icon, money, Modal} from './ui';
import './payment-modal.css';

export function PaymentModal({booking, onClose, onPay, busy}) {
  const [method, setMethod] = useState('card'); // 'card' | 'kaspi' | 'pay'
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [clientError, setClientError] = useState('');
  const [paymentState, setPaymentState] = useState('idle'); // 'idle' | 'processing' | 'failed' | 'success'
  const [failureReason, setFailureReason] = useState('');

  // Форматирование номера карты (16 цифр c пробелами)
  function handleCardNumber(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
    setCardNumber(formatted);
    if (clientError) setClientError('');
  }

  // Форматирование срока действия (MM/YY)
  function handleExpiry(e) {
    let val = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (val.length >= 3) {
      val = val.slice(0, 2) + '/' + val.slice(2);
    }
    setExpiry(val);
    if (clientError) setClientError('');
  }

  // CVV
  function handleCvv(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCvv(val);
    if (clientError) setClientError('');
  }

  function fillPreset(type) {
    if (type === 'success') {
      setCardNumber('4400 1234 5678 9010');
      setExpiry('12/28');
      setCvv('123');
      setCardHolder('YERNAZAR SARSEMKHAN');
    } else {
      setCardNumber('4000 0000 0000 0002');
      setExpiry('01/21'); // Истёкший
      setCvv('000'); // Тестовый отказ
      setCardHolder('DECLINED TEST');
    }
    setClientError('');
  }

  async function processPayment(outcome, failMsg) {
    setPaymentState('processing');
    setClientError('');

    try {
      const res = await onPay(outcome, method);
      if (res && res.payment && res.payment.status === 'failed') {
        setPaymentState('failed');
        setFailureReason(failMsg || 'Банк-эмитент отклонил операцию. Проверьте реквизиты карты, баланс или попробуйте другую карту.');
      } else if (res && res.payment && res.payment.status === 'succeeded') {
        setPaymentState('success');
      }
    } catch (err) {
      // Показываем настоящую причину, а не общую фразу: так видно, что ответил сервер.
      console.error('payment failed', err);
      setPaymentState('failed');
      setFailureReason(err?.message || 'Произошла ошибка при обработке платежа. Пожалуйста, повторите попытку.');
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setClientError('');

    if (method === 'kaspi') {
      processPayment('succeeded');
      return;
    }

    if (method === 'pay') {
      processPayment('succeeded');
      return;
    }

    // Проверка карты
    const rawNumber = cardNumber.replace(/\s/g, '');
    if (rawNumber.length < 13) {
      setClientError('Введите корректный номер карты (от 13 до 16 цифр)');
      return;
    }
    if (expiry.length < 5) {
      setClientError('Укажите срок действия карты в формате MM/YY');
      return;
    }
    const [month, yearStr] = expiry.split('/').map(Number);
    if (!month || month < 1 || month > 12) {
      setClientError('Некорректный месяц срока действия карты');
      return;
    }
    if (!cvv || cvv.length < 3) {
      setClientError('Укажите корректный CVV/CVC код (3-4 цифры)');
      return;
    }

    const currentYear = new Date().getFullYear() % 100;
    const isExpired = yearStr < currentYear;

    let isDeclined = false;
    let declineMessage = '';

    if (isExpired) {
      isDeclined = true;
      declineMessage = 'Срок действия карты истёк. Операция отклонена банком.';
    } else if (cvv === '000') {
      isDeclined = true;
      declineMessage = 'Неверный CVV/CVC код. Банк отклонил платёж.';
    } else if (rawNumber.endsWith('0002') || rawNumber === '0000000000000000') {
      isDeclined = true;
      declineMessage = 'Карта заблокирована или на ней недостаточно средств. Повторите попытку с другой картой.';
    }

    if (isDeclined) {
      processPayment('failed', declineMessage);
    } else {
      processPayment('succeeded');
    }
  }

  return (
    <Modal title={paymentState === 'failed' ? 'Ошибка оплаты' : 'Оплата бронирования'} className="payment-dialog" onClose={onClose}>
      <div className="payment-modal-content">
        <div className="payment-summary-bar">
          <div>
            <span className="payment-summary-title">К оплате:</span>
            <strong className="payment-summary-price">{money(booking.total_amount, booking.currency)}</strong>
          </div>
          <span className="payment-booking-badge">Бронь #{booking.id.slice(0, 8)}</span>
        </div>

        {/* Экран ошибки платежа */}
        {paymentState === 'failed' && (
          <div className="payment-failed-screen">
            <div className="payment-failed-icon">✕</div>
            <h3>Платёж не удался</h3>
            <p className="payment-failed-desc">
              {failureReason || 'Банк отклонил транзакцию. Деньги не были списаны.'}
            </p>
            <div className="payment-failed-info">
              <span>Статус бронирования:</span> <strong>Ожидает оплаты (pending)</strong>
            </div>
            <div className="payment-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={onClose}
              >
                Закрыть
              </button>
              <button
                type="button"
                className="btn-pay primary"
                onClick={() => {
                  setPaymentState('idle');
                  setClientError('');
                }}
              >
                🔄 Попробовать снова
              </button>
            </div>
          </div>
        )}

        {/* Экран успешной оплаты */}
        {paymentState === 'success' && (
          <div className="payment-success-screen">
            <div className="payment-success-icon">✓</div>
            <h3>Оплата прошла успешно!</h3>
            <p>Бронирование подтверждено. Номер зарезервирован за вами.</p>
            <div className="payment-actions">
              <button
                type="button"
                className="btn-pay primary"
                onClick={onClose}
              >
                Отлично, перейти к бронированиям
              </button>
            </div>
          </div>
        )}

        {/* Обычный экран оплаты */}
        {paymentState !== 'failed' && paymentState !== 'success' && (
          <>
            {/* Вкладки методов оплаты */}
            <div className="payment-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={method === 'card'}
                className={`payment-tab ${method === 'card' ? 'active' : ''}`}
                onClick={() => { setMethod('card'); setClientError(''); }}
                disabled={busy || paymentState === 'processing'}
              >
                <span className="payment-tab-icon">💳</span>
                <span>Банковская карта</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={method === 'kaspi'}
                className={`payment-tab ${method === 'kaspi' ? 'active' : ''}`}
                onClick={() => { setMethod('kaspi'); setClientError(''); }}
                disabled={busy || paymentState === 'processing'}
              >
                <span className="payment-tab-icon kaspi-badge">К</span>
                <span>Kaspi QR / Pay</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={method === 'pay'}
                className={`payment-tab ${method === 'pay' ? 'active' : ''}`}
                onClick={() => { setMethod('pay'); setClientError(''); }}
                disabled={busy || paymentState === 'processing'}
              >
                <span className="payment-tab-icon"> / G</span>
                <span>Apple / Google Pay</span>
              </button>
            </div>

            {clientError && <div className="payment-alert" role="alert">{clientError}</div>}

            {/* Форма 1: Банковская карта */}
            {method === 'card' && (
              <form className="payment-card-form" onSubmit={handleSubmit}>
                <div className="card-mockup">
                  <div className="card-mockup-top">
                    <span className="card-chip"></span>
                    <span className="card-brand-logo">VISA / Mastercard</span>
                  </div>
                  <div className="card-mockup-number">
                    {cardNumber || '•••• •••• •••• ••••'}
                  </div>
                  <div className="card-mockup-bottom">
                    <div className="card-mockup-holder">
                      <small>Владелец</small>
                      <span>{cardHolder || 'CARDHOLDER NAME'}</span>
                    </div>
                    <div className="card-mockup-exp">
                      <small>Срок</small>
                      <span>{expiry || 'MM/YY'}</span>
                    </div>
                  </div>
                </div>

                <div className="payment-presets">
                  <span>Быстрое заполнение для теста:</span>
                  <div className="payment-preset-buttons">
                    <button type="button" className="preset-btn success" onClick={() => fillPreset('success')}>
                      ✓ Успешная карта
                    </button>
                    <button type="button" className="preset-btn fail" onClick={() => fillPreset('fail')}>
                      ✕ Тестовый отказ
                    </button>
                  </div>
                </div>

                <label className="payment-field">
                  <span>Номер банковской карты</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChange={handleCardNumber}
                    required
                    disabled={busy || paymentState === 'processing'}
                  />
                </label>

                <div className="payment-row">
                  <label className="payment-field">
                    <span>Срок действия</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      placeholder="MM/YY"
                      value={expiry}
                      onChange={handleExpiry}
                      required
                      disabled={busy || paymentState === 'processing'}
                    />
                  </label>

                  <label className="payment-field">
                    <span>CVV / CVC</span>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      placeholder="•••"
                      maxLength={4}
                      value={cvv}
                      onChange={handleCvv}
                      required
                      disabled={busy || paymentState === 'processing'}
                    />
                  </label>
                </div>

                <label className="payment-field">
                  <span>Имя и фамилия владельца</span>
                  <input
                    type="text"
                    autoComplete="cc-name"
                    placeholder="IVAN IVANOV"
                    value={cardHolder}
                    onChange={e => setCardHolder(e.target.value.toUpperCase())}
                    required
                    disabled={busy || paymentState === 'processing'}
                  />
                </label>

                <div className="payment-footnote">
                  🔒 Безопасное TLS-соединение. Учебная симуляция: данные реальных карт не передаются.
                </div>

                <div className="payment-actions">
                  <button type="button" className="btn-cancel" onClick={onClose} disabled={busy || paymentState === 'processing'}>
                    Отмена
                  </button>
                  <button type="submit" className="btn-pay primary" disabled={busy || paymentState === 'processing'}>
                    {busy || paymentState === 'processing' ? 'Обработка платежа…' : `Оплатить ${money(booking.total_amount, booking.currency)}`}
                  </button>
                </div>
              </form>
            )}

            {/* Форма 2: Kaspi QR */}
            {method === 'kaspi' && (
              <div className="payment-qr-view">
                <div className="kaspi-qr-header">
                  <span className="kaspi-red-badge">Kaspi.kz</span>
                  <h3>Оплата через Kaspi QR</h3>
                  <p>Отсканируйте QR-код в мобильном приложении Kaspi.kz для мгновенной оплаты</p>
                </div>

                <div className="kaspi-qr-box">
                  <div className="mock-qr-code">
                    <svg viewBox="0 0 100 100" width="160" height="160">
                      <rect x="0" y="0" width="100" height="100" fill="#ffffff" />
                      <rect x="10" y="10" width="25" height="25" fill="#e11c2a" rx="4"/>
                      <rect x="15" y="15" width="15" height="15" fill="#ffffff" rx="2"/>
                      <rect x="18" y="18" width="9" height="9" fill="#e11c2a"/>
                      <rect x="65" y="10" width="25" height="25" fill="#e11c2a" rx="4"/>
                      <rect x="70" y="15" width="15" height="15" fill="#ffffff" rx="2"/>
                      <rect x="73" y="18" width="9" height="9" fill="#e11c2a"/>
                      <rect x="10" y="65" width="25" height="25" fill="#e11c2a" rx="4"/>
                      <rect x="15" y="70" width="15" height="15" fill="#ffffff" rx="2"/>
                      <rect x="18" y="73" width="9" height="9" fill="#e11c2a"/>
                      <circle cx="48" cy="20" r="3" fill="#222"/>
                      <circle cx="40" cy="30" r="4" fill="#222"/>
                      <circle cx="55" cy="40" r="3" fill="#222"/>
                      <circle cx="45" cy="55" r="5" fill="#e11c2a"/>
                      <circle cx="70" cy="50" r="4" fill="#222"/>
                      <circle cx="80" cy="65" r="3" fill="#222"/>
                      <circle cx="50" cy="75" r="4" fill="#222"/>
                      <circle cx="68" cy="80" r="3" fill="#222"/>
                    </svg>
                    <span className="qr-scan-pulse"></span>
                  </div>
                  <span className="kaspi-amount">{money(booking.total_amount, booking.currency)}</span>
                </div>

                <p className="kaspi-instructions">
                  После сканирования подтвердите оплату в приложении
                </p>

                <div className="payment-actions">
                  <button type="button" className="btn-cancel" onClick={onClose} disabled={busy || paymentState === 'processing'}>
                    Отмена
                  </button>
                  <button type="button" className="btn-pay kaspi-btn" onClick={handleSubmit} disabled={busy || paymentState === 'processing'}>
                    {busy || paymentState === 'processing' ? 'Подтверждение…' : 'Подтвердить оплату в Kaspi'}
                  </button>
                </div>
              </div>
            )}

            {/* Форма 3: Apple Pay / Google Pay */}
            {method === 'pay' && (
              <div className="payment-fast-view">
                <div className="fast-pay-card">
                  <div className="fast-pay-icons">
                    <span className="apple-badge"> Pay</span>
                    <span className="google-badge">G Pay</span>
                  </div>
                  <h3>Быстрая оплата в 1 клик</h3>
                  <p>Используйте карту, привязанную к вашему устройству или аккаунту Google / Apple</p>
                  <div className="fast-pay-total">
                    <span>Итоговая сумма</span>
                    <strong>{money(booking.total_amount, booking.currency)}</strong>
                  </div>
                </div>

                <div className="payment-actions">
                  <button type="button" className="btn-cancel" onClick={onClose} disabled={busy || paymentState === 'processing'}>
                    Отмена
                  </button>
                  <button type="button" className="btn-pay apple-pay-btn" onClick={handleSubmit} disabled={busy || paymentState === 'processing'}>
                    {busy || paymentState === 'processing' ? 'Авторизация биометрии…' : `Оплатить через  / G Pay`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
