"""Simple extra tests. They do not need a database."""
from contextlib import asynccontextmanager
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.dialects import postgresql

from backend.middlewares.tokens import create_access_token, read_access_token
from backend.models.availability import BLOCKING_STATUSES, overlapping_bookings
from backend.routers.bookings import create
from backend.core.errors import ApiError
from backend.schemas import BookingCreate, Register, RoomCreate


class FakeDB:
    """Fake database. It returns prepared answers one by one."""

    def __init__(self, answers):
        self.answers = list(answers)
        self.last_query = None

    @asynccontextmanager
    async def transaction(self):
        yield

    async def fetch_one(self, query):
        self.last_query = query
        return self.answers.pop(0)


def future_dates(days=3):
    start = date.today() + timedelta(days=30)
    return start, start + timedelta(days=days)


def make_body(room_id, days=3):
    start, end = future_dates(days)
    return BookingCreate(room_id=room_id, check_in=start, check_out=end)


# 1. The overlap query compares dates in the right way
def test_overlap_query_uses_date_conditions():
    query = overlapping_bookings(uuid4(), date(2030, 1, 10), date(2030, 1, 13))
    sql = str(query.compile(dialect=postgresql.dialect()))
    assert "bookings.check_in <" in sql
    assert "bookings.check_out >" in sql


# 2. Cancelled bookings do not block a room
def test_cancelled_booking_does_not_block_room():
    assert "cancelled" not in BLOCKING_STATUSES
    assert set(BLOCKING_STATUSES) == {"pending", "confirmed"}


# 3. A room cannot have a price of zero
def test_room_price_must_be_positive():
    with pytest.raises(ValidationError):
        RoomCreate(number="101", room_type="single", capacity=2, price_per_night="0")


# 4. A new room gets KZT as the default currency
def test_room_default_currency_is_kzt():
    room = RoomCreate(number="101", room_type="single", capacity=2, price_per_night="15000.00")
    assert room.currency == "KZT"


# 5. A short password is rejected
def test_short_password_is_rejected():
    with pytest.raises(ValidationError):
        Register(email="a@example.com", password="short", full_name="Osa")


# 6. A wrong email is rejected
def test_wrong_email_is_rejected():
    with pytest.raises(ValidationError):
        Register(email="not-an-email", password="long-enough-password", full_name="Osa")


# 7. A token returns the same user id
def test_token_returns_same_user_id():
    user_id = uuid4()
    assert read_access_token(create_access_token(user_id)) == user_id


# 8. A booking on busy dates gives error 409
async def test_busy_room_gives_409():
    room = {"id": uuid4(), "is_active": True, "price_per_night": Decimal("15000.00"), "currency": "KZT"}
    old_booking = {"id": uuid4()}
    db = FakeDB([room, old_booking])
    with pytest.raises(ApiError) as error:
        await create(make_body(room["id"]), db, {"id": uuid4()})
    assert error.value.status_code == 409
    assert error.value.code == "room_unavailable"


# 9. A free room is booked and the total price is correct
async def test_free_room_is_booked_with_correct_total():
    room = {"id": uuid4(), "is_active": True, "price_per_night": Decimal("15000.00"), "currency": "KZT"}
    db = FakeDB([room, None, {"status": "pending"}])
    result = await create(make_body(room["id"], days=3), db, {"id": uuid4()})
    assert result["status"] == "pending"
    assert db.last_query.compile().params["total_amount"] == Decimal("45000.00")


# 10. An inactive room cannot be booked
async def test_inactive_room_gives_404():
    room = {"id": uuid4(), "is_active": False, "price_per_night": Decimal("15000.00"), "currency": "KZT"}
    db = FakeDB([room])
    with pytest.raises(HTTPException) as error:
        await create(make_body(room["id"]), db, {"id": uuid4()})
    assert error.value.status_code == 404
