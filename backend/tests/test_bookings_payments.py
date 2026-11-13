"""15 Test Cases: Booking & Payment Management.

Covers:
- Booking creation and server-side amount calculation
- Date validation (past dates, checkout <= checkin)
- Room availability and active status checks
- Overlap prevention (GIST exclusion / room_unavailable 409)
- Adjacent interval booking ([check_in, check_out))
- Privacy and isolation (404 on foreign booking access)
- Staff (receptionist/admin) visibility
- Cancellation and freeing reserved dates
- Idempotent cancellation
- Simulated payments (succeeded / failed)
- Payment idempotency key replay and conflict detection
- Forbidden payment transitions (paying confirmed/cancelled)
"""

import os
from decimal import Decimal
from uuid import uuid4

import databases
import httpx
import pytest
import pytest_asyncio
import sqlalchemy as sa

from backend.core.db import get_session
from backend.main import app
from backend.middlewares.tokens import create_access_token, hash_password
from backend.models import Bookings, Guests, Payments, Rooms


@pytest_asyncio.fixture
async def booking_env():
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL not set (run with test database)")

    async with databases.Database(url) as db:
        roles = ["guest", "other_guest", "receptionist", "admin"]
        ids = {role: uuid4() for role in roles}
        encoded = hash_password("person4-test-password")

        # Seed users
        for role, uid in ids.items():
            db_role = "guest" if role in ("guest", "other_guest") else role
            await db.execute(
                Guests.insert().values(
                    id=uid,
                    email=f"{uid}@example.com",
                    full_name=f"User {role}",
                    password_hash=encoded,
                    role=db_role,
                    is_active=True,
                )
            )

        # Seed active room (15000.00 KZT) and inactive room
        room_id = uuid4()
        inactive_room_id = uuid4()
        await db.execute(
            Rooms.insert().values(
                id=room_id,
                number=f"P4-{str(room_id)[:8]}",
                room_type="deluxe",
                capacity=2,
                price_per_night=Decimal("15000.00"),
                currency="KZT",
                is_active=True,
            )
        )
        await db.execute(
            Rooms.insert().values(
                id=inactive_room_id,
                number=f"INACT-{str(inactive_room_id)[:6]}",
                room_type="standard",
                capacity=1,
                price_per_night=Decimal("10000.00"),
                currency="KZT",
                is_active=False,
            )
        )

        app.dependency_overrides[get_session] = lambda: db
        headers = {
            role: {"Authorization": f"Bearer {create_access_token(uid)}"}
            for role, uid in ids.items()
        }

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            try:
                yield {
                    "client": client,
                    "db": db,
                    "ids": ids,
                    "headers": headers,
                    "room_id": room_id,
                    "inactive_room_id": inactive_room_id,
                }
            finally:
                app.dependency_overrides.clear()
                # Clean up payments, bookings, rooms, guests
                all_guest_ids = list(ids.values())
                bids = sa.select(Bookings.c.id).where(Bookings.c.guest_id.in_(all_guest_ids))
                await db.execute(Payments.delete().where(Payments.c.booking_id.in_(bids)))
                await db.execute(Bookings.delete().where(Bookings.c.guest_id.in_(all_guest_ids)))
                await db.execute(
                    Rooms.delete().where(Rooms.c.id.in_([room_id, inactive_room_id]))
                )
                await db.execute(Guests.delete().where(Guests.c.id.in_(all_guest_ids)))


# -----------------------------------------------------------------------------
# TC-01: Успешное создание бронирования (Happy Path)
# -----------------------------------------------------------------------------
async def test_tc01_successful_booking_creation(booking_env):
    """TC-01: Создание бронирования с расчетом суммы на сервере."""
    c = booking_env["client"]
    h = booking_env["headers"]["guest"]
    room_id = str(booking_env["room_id"])

    # 3 nights: 2030-08-01 -> 2030-08-04. 15000 * 3 = 45000.00 KZT
    resp = await c.post(
        "/api/v1/bookings",
        headers=h,
        json={"room_id": room_id, "check_in": "2030-08-01", "check_out": "2030-08-04"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()

    assert data["status"] == "pending"
    assert data["total_amount"] == "45000.00"
    assert data["currency"] == "KZT"
    assert data["guest_id"] == str(booking_env["ids"]["guest"])
    assert data["room_id"] == room_id


# -----------------------------------------------------------------------------
# TC-02: Отклонение бронирования на прошедшую дату
# -----------------------------------------------------------------------------
async def test_tc02_booking_creation_past_date_rejected(booking_env):
    """TC-02: Запрет бронирования с check_in в прошлом (Asia/Qyzylorda)."""
    c = booking_env["client"]
    h = booking_env["headers"]["guest"]
    room_id = str(booking_env["room_id"])

    resp = await c.post(
        "/api/v1/bookings",
        headers=h,
        json={"room_id": room_id, "check_in": "2020-01-01", "check_out": "2020-01-05"},
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "validation_error"


# -----------------------------------------------------------------------------
# TC-03: Отклонение бронирования, если выезд раньше или равен заезду
# -----------------------------------------------------------------------------
async def test_tc03_booking_creation_invalid_dates_checkout_before_checkin(booking_env):
    """TC-03: Запрет бронирования при check_out <= check_in."""
    c = booking_env["client"]
    h = booking_env["headers"]["guest"]
    room_id = str(booking_env["room_id"])

    # check_out равен check_in (0 ночей)
    resp = await c.post(
        "/api/v1/bookings",
        headers=h,
        json={"room_id": room_id, "check_in": "2030-08-10", "check_out": "2030-08-10"},
    )
    assert resp.status_code == 422

    # check_out раньше check_in
    resp2 = await c.post(
        "/api/v1/bookings",
        headers=h,
        json={"room_id": room_id, "check_in": "2030-08-10", "check_out": "2030-08-05"},
    )
    assert resp2.status_code == 422


# -----------------------------------------------------------------------------
# TC-04: Ошибка при попытке бронирования несуществующего номера
# -----------------------------------------------------------------------------
async def test_tc04_booking_nonexistent_room(booking_env):
    """TC-04: Попытка забронировать несуществующий room_id возвращает 404."""
    c = booking_env["client"]
    h = booking_env["headers"]["guest"]
    random_id = str(uuid4())

    resp = await c.post(
        "/api/v1/bookings",
        headers=h,
        json={"room_id": random_id, "check_in": "2030-08-01", "check_out": "2030-08-03"},
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["message"] == "Room not found"


# -----------------------------------------------------------------------------
# TC-05: Ошибка при попытке бронирования деактивированного номера
# -----------------------------------------------------------------------------
async def test_tc05_booking_inactive_room(booking_env):
    """TC-05: Попытка забронировать отключенный номер (is_active=False) возвращает 404."""
    c = booking_env["client"]
    h = booking_env["headers"]["guest"]
    inact_id = str(booking_env["inactive_room_id"])

    resp = await c.post(
        "/api/v1/bookings",
        headers=h,
        json={"room_id": inact_id, "check_in": "2030-08-01", "check_out": "2030-08-03"},
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["message"] == "Room not found"


# -----------------------------------------------------------------------------
# TC-06: Защита от овербукинга (конфликт дат с активной бронью)
# -----------------------------------------------------------------------------
async def test_tc06_booking_overlap_prevention(booking_env):
    """TC-06: Попытка бронирования на пересекающиеся даты возвращает 409 room_unavailable."""
    c = booking_env["client"]
    h1 = booking_env["headers"]["guest"]
    h2 = booking_env["headers"]["other_guest"]
    room_id = str(booking_env["room_id"])

    # Гость 1 бронирует 10-15 августа
    resp1 = await c.post(
        "/api/v1/bookings",
        headers=h1,
        json={"room_id": room_id, "check_in": "2030-08-10", "check_out": "2030-08-15"},
    )
    assert resp1.status_code == 201

    # Гость 2 пытается забронировать 12-14 августа (внутри интервала)
    resp2 = await c.post(
        "/api/v1/bookings",
        headers=h2,
        json={"room_id": room_id, "check_in": "2030-08-12", "check_out": "2030-08-14"},
    )
    assert resp2.status_code == 409
    assert resp2.json()["error"]["code"] == "room_unavailable"


# -----------------------------------------------------------------------------
# TC-07: Разрешение бронирования «стык в стык» (Adjacent intervals)
# -----------------------------------------------------------------------------
async def test_tc07_adjacent_booking_allowed(booking_env):
    """TC-07: Выезд первого гостя в день заезда второго разрешен ([check_in, check_out))."""
    c = booking_env["client"]
    h1 = booking_env["headers"]["guest"]
    h2 = booking_env["headers"]["other_guest"]
    room_id = str(booking_env["room_id"])

    # Гость 1: 2030-09-01 -> 2030-09-05
    resp1 = await c.post(
        "/api/v1/bookings",
        headers=h1,
        json={"room_id": room_id, "check_in": "2030-09-01", "check_out": "2030-09-05"},
    )
    assert resp1.status_code == 201

    # Гость 2: 2030-09-05 -> 2030-09-10 (выезд гостя 1 = заезд гостя 2)
    resp2 = await c.post(
        "/api/v1/bookings",
        headers=h2,
        json={"room_id": room_id, "check_in": "2030-09-05", "check_out": "2030-09-10"},
    )
    assert resp2.status_code == 201


# -----------------------------------------------------------------------------
# TC-08: Изоляция бронирований гостей (Privacy & ID Enumeration Protection)
# -----------------------------------------------------------------------------
async def test_tc08_booking_guest_isolation_and_privacy(booking_env):
    """TC-08: Чужой гость получает 404 Not Found при обращении к чужой брони по ID."""
    c = booking_env["client"]
    h1 = booking_env["headers"]["guest"]
    h2 = booking_env["headers"]["other_guest"]
    room_id = str(booking_env["room_id"])

    resp1 = await c.post(
        "/api/v1/bookings",
        headers=h1,
        json={"room_id": room_id, "check_in": "2030-10-01", "check_out": "2030-10-04"},
    )
    assert resp1.status_code == 201
    booking_id = resp1.json()["id"]

    # Гость 2 пытается прочитать бронь Гостя 1
    resp_other = await c.get(f"/api/v1/bookings/{booking_id}", headers=h2)
    assert resp_other.status_code == 404
    assert resp_other.json()["error"]["message"] == "Booking not found"


# -----------------------------------------------------------------------------
# TC-09: Фильтрация списка бронирований для гостя
# -----------------------------------------------------------------------------
async def test_tc09_guest_sees_only_own_bookings_in_list(booking_env):
    """TC-09: В GET /bookings гость видит исключительно свои записи."""
    c = booking_env["client"]
    h1 = booking_env["headers"]["guest"]
    h2 = booking_env["headers"]["other_guest"]
    room_id = str(booking_env["room_id"])

    # Создаем бронь от Гостя 1
    await c.post(
        "/api/v1/bookings",
        headers=h1,
        json={"room_id": room_id, "check_in": "2030-11-01", "check_out": "2030-11-03"},
    )

    # Гость 2 запрашивает свой список
    list_resp = await c.get("/api/v1/bookings", headers=h2)
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 0
    assert len(list_resp.json()["items"]) == 0


# -----------------------------------------------------------------------------
# TC-10: Доступ сотрудников (Receptionist / Admin) ко всем бронированиям
# -----------------------------------------------------------------------------
async def test_tc10_staff_can_view_all_bookings(booking_env):
    """TC-10: Ресепшионист и администратор могут просматривать любые бронирования."""
    c = booking_env["client"]
    h_guest = booking_env["headers"]["guest"]
    h_recep = booking_env["headers"]["receptionist"]
    h_admin = booking_env["headers"]["admin"]
    room_id = str(booking_env["room_id"])

    resp = await c.post(
        "/api/v1/bookings",
        headers=h_guest,
        json={"room_id": room_id, "check_in": "2030-12-01", "check_out": "2030-12-03"},
    )
    bid = resp.json()["id"]

    # Ресепшионист читает детали
    r_resp = await c.get(f"/api/v1/bookings/{bid}", headers=h_recep)
    assert r_resp.status_code == 200
    assert r_resp.json()["id"] == bid

    # Администратор получает список броней
    a_resp = await c.get("/api/v1/bookings", headers=h_admin)
    assert a_resp.status_code == 200
    assert any(b["id"] == bid for b in a_resp.json()["items"])


# -----------------------------------------------------------------------------
# TC-11: Отмена бронирования гостем и освобождение дат
# -----------------------------------------------------------------------------
async def test_tc11_booking_cancellation_and_dates_freed(booking_env):
    """TC-11: Отмена бронирования освобождает номер для повторного бронирования."""
    c = booking_env["client"]
    h1 = booking_env["headers"]["guest"]
    h2 = booking_env["headers"]["other_guest"]
    room_id = str(booking_env["room_id"])

    resp1 = await c.post(
        "/api/v1/bookings",
        headers=h1,
        json={"room_id": room_id, "check_in": "2031-01-10", "check_out": "2031-01-15"},
    )
    bid = resp1.json()["id"]

    # Отменяем
    cancel_resp = await c.post(f"/api/v1/bookings/{bid}/cancel", headers=h1)
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "cancelled"

    # Теперь Гость 2 может забронировать этот номер на те же самые даты
    resp2 = await c.post(
        "/api/v1/bookings",
        headers=h2,
        json={"room_id": room_id, "check_in": "2031-01-10", "check_out": "2031-01-15"},
    )
    assert resp2.status_code == 201


# -----------------------------------------------------------------------------
# TC-12: Идемпотентность отмены бронирования
# -----------------------------------------------------------------------------
async def test_tc12_idempotent_cancellation(booking_env):
    """TC-12: Повторный запрос отмены возвращает cancelled без ошибки."""
    c = booking_env["client"]
    h = booking_env["headers"]["guest"]
    room_id = str(booking_env["room_id"])

    resp = await c.post(
        "/api/v1/bookings",
        headers=h,
        json={"room_id": room_id, "check_in": "2031-02-01", "check_out": "2031-02-04"},
    )
    bid = resp.json()["id"]

    cancel1 = await c.post(f"/api/v1/bookings/{bid}/cancel", headers=h)
    assert cancel1.status_code == 200
    assert cancel1.json()["status"] == "cancelled"

    # Второй вызов отмены
    cancel2 = await c.post(f"/api/v1/bookings/{bid}/cancel", headers=h)
    assert cancel2.status_code == 200
    assert cancel2.json()["status"] == "cancelled"


# -----------------------------------------------------------------------------
# TC-13: Успешная симуляция оплаты (Happy Path Payments)
# -----------------------------------------------------------------------------
async def test_tc13_successful_payment_flow(booking_env):
    """TC-13: Успешная оплата переводит бронь в confirmed, а платеж в succeeded."""
    c = booking_env["client"]
    h = booking_env["headers"]["guest"]
    room_id = str(booking_env["room_id"])

    b_resp = await c.post(
        "/api/v1/bookings",
        headers=h,
        json={"room_id": room_id, "check_in": "2031-03-01", "check_out": "2031-03-03"},
    )
    bid = b_resp.json()["id"]
    expected_amount = b_resp.json()["total_amount"]

    pay_headers = {**h, "Idempotency-Key": str(uuid4())}
    pay_resp = await c.post(
        f"/api/v1/bookings/{bid}/payments",
        headers=pay_headers,
        json={"outcome": "succeeded"},
    )
    assert pay_resp.status_code == 200, pay_resp.text
    body = pay_resp.json()

    assert body["booking_status"] == "confirmed"
    assert body["payment"]["status"] == "succeeded"
    assert body["payment"]["amount"] == expected_amount
    assert body["payment"]["currency"] == "KZT"

    # Проверяем обновленный статус через GET /bookings/{id}
    check = await c.get(f"/api/v1/bookings/{bid}", headers=h)
    assert check.json()["status"] == "confirmed"


# -----------------------------------------------------------------------------
# TC-14: Неуспешная оплата и сохранение статуса pending
# -----------------------------------------------------------------------------
async def test_tc14_failed_payment_flow(booking_env):
    """TC-14: Неуспешная оплата сохраняет попытку как failed, бронь остается pending."""
    c = booking_env["client"]
    h = booking_env["headers"]["guest"]
    room_id = str(booking_env["room_id"])

    b_resp = await c.post(
        "/api/v1/bookings",
        headers=h,
        json={"room_id": room_id, "check_in": "2031-04-01", "check_out": "2031-04-03"},
    )
    bid = b_resp.json()["id"]

    pay_headers = {**h, "Idempotency-Key": str(uuid4())}
    pay_resp = await c.post(
        f"/api/v1/bookings/{bid}/payments",
        headers=pay_headers,
        json={"outcome": "failed"},
    )
    assert pay_resp.status_code == 200
    body = pay_resp.json()

    assert body["booking_status"] == "pending"
    assert body["payment"]["status"] == "failed"
    assert body["payment"]["failure_reason"] == "Simulated failure"

    # Проверяем историю попыток: попытка должна быть сохранена
    history = await c.get(f"/api/v1/bookings/{bid}/payments", headers=h)
    assert history.status_code == 200
    assert history.json()["total"] == 1
    assert history.json()["items"][0]["status"] == "failed"


# -----------------------------------------------------------------------------
# TC-15: Идемпотентность платежа и запрет оплаты не-pending броней
# -----------------------------------------------------------------------------
async def test_tc15_payment_idempotency_and_forbidden_states(booking_env):
    """TC-15: Проверка повтора Idempotency-Key, конфликта параметров и оплаты confirmed/cancelled."""
    c = booking_env["client"]
    h = booking_env["headers"]["guest"]
    room_id = str(booking_env["room_id"])

    b_resp = await c.post(
        "/api/v1/bookings",
        headers=h,
        json={"room_id": room_id, "check_in": "2031-05-01", "check_out": "2031-05-03"},
    )
    bid = b_resp.json()["id"]

    idem_key = str(uuid4())
    headers_with_key = {**h, "Idempotency-Key": idem_key}

    # 1. Первый платеж (успех)
    first_pay = await c.post(
        f"/api/v1/bookings/{bid}/payments",
        headers=headers_with_key,
        json={"outcome": "succeeded"},
    )
    assert first_pay.status_code == 200

    # 2. Replay с тем же ключом и тем же телом -> возвращает тот же результат
    replay_pay = await c.post(
        f"/api/v1/bookings/{bid}/payments",
        headers=headers_with_key,
        json={"outcome": "succeeded"},
    )
    assert replay_pay.status_code == 200
    assert replay_pay.json() == first_pay.json()

    # 3. Тот же ключ с другими параметрами (outcome: failed) -> 409 Conflict
    conflict_pay = await c.post(
        f"/api/v1/bookings/{bid}/payments",
        headers=headers_with_key,
        json={"outcome": "failed"},
    )
    assert conflict_pay.status_code == 409
    assert "Idempotency key was used with different parameters" in conflict_pay.json()["error"]["message"]

    # 4. Попытка оплатить уже confirmed бронь с НОВЫМ ключом -> 409 Conflict
    new_key_headers = {**h, "Idempotency-Key": str(uuid4())}
    pay_confirmed = await c.post(
        f"/api/v1/bookings/{bid}/payments",
        headers=new_key_headers,
        json={"outcome": "succeeded"},
    )
    assert pay_confirmed.status_code == 409
    assert "Only pending bookings may be paid" in pay_confirmed.json()["error"]["message"]
