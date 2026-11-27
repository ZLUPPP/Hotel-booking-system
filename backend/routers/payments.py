from typing import Annotated
from uuid import UUID
import asyncpg
import sqlalchemy as sa
from fastapi import APIRouter, Header, HTTPException
from backend.models import Bookings, Payments, Rooms
from backend.routers.bookings import load_booking
from backend.routers.common import DB, User, Limit, Offset, page
from backend.schemas import Payment, PaymentCreate, PaymentResult, Page, MyPayment

router = APIRouter(prefix='/bookings', tags=['payments'])
account_router = APIRouter(prefix='/payments', tags=['payments'])


async def replay(db, key, booking_id, body, user):
    payment = await db.fetch_one(sa.select(Payments).where(Payments.c.idempotency_key == key))
    if not payment:
        return None
    owner = await db.fetch_one(sa.select(Bookings).where(Bookings.c.id == payment['booking_id']))
    if not owner or owner['guest_id'] != user['id']:
        raise HTTPException(404, 'Payment not found')
    if (payment['booking_id'] != booking_id or payment['status'] != body.outcome
            or payment['method'] != body.method):
        raise HTTPException(409, 'Idempotency key was used with different parameters')
    return dict(payment=dict(payment), booking_status=owner['status'])


@router.post('/{booking_id}/payments', response_model=PaymentResult)
async def pay(booking_id: UUID, body: PaymentCreate, db: DB, user: User,
              idempotency_key: Annotated[UUID, Header()]):
    try:
        async with db.transaction():
            booking = await load_booking(db, booking_id, user, lock=True)
            if booking['guest_id'] != user['id']:
                raise HTTPException(404, 'Booking not found')
            existing = await replay(db, idempotency_key, booking_id, body, user)
            if existing:
                return existing
            if booking['status'] != 'pending':
                raise HTTPException(409, 'Only pending bookings may be paid')
            payment = await db.fetch_one(Payments.insert().values(
                booking_id=booking_id, idempotency_key=idempotency_key,
                amount=booking['total_amount'], currency=booking['currency'],
                status=body.outcome, method=body.method,
                failure_reason='Simulated failure' if body.outcome == 'failed' else None
            ).returning(*Payments.c))
            status = booking['status']
            if body.outcome == 'succeeded':
                await db.execute(Bookings.update().where(Bookings.c.id == booking_id).values(status='confirmed'))
                status = 'confirmed'
            return dict(payment=dict(payment), booking_status=status)
    except asyncpg.UniqueViolationError:
        # The failed transaction has rolled back before reading a concurrent winner.
        existing = await replay(db, idempotency_key, booking_id, body, user)
        if existing:
            return existing
        raise


@router.get('/{booking_id}/payments', response_model=Page[Payment])
async def history(booking_id: UUID, db: DB, user: User, limit: Limit = 20, offset: Offset = 0):
    await load_booking(db, booking_id, user)
    return await page(db, sa.select(Payments).where(Payments.c.booking_id == booking_id)
        .order_by(Payments.c.created_at, Payments.c.id), limit, offset)


@account_router.get('/mine', response_model=list[MyPayment])
async def my_payments(db: DB, user: User):
    query = sa.select(
        Payments.c.id, Payments.c.booking_id, Rooms.c.number.label('room_number'),
        Rooms.c.room_type, Payments.c.amount, Payments.c.currency, Payments.c.status,
        Payments.c.method, Payments.c.created_at,
    ).join_from(Payments, Bookings, Payments.c.booking_id == Bookings.c.id) \
        .join(Rooms, Rooms.c.id == Bookings.c.room_id) \
        .where(Bookings.c.guest_id == user['id']) \
        .order_by(Payments.c.created_at.desc(), Payments.c.id.desc()).limit(500)
    return [dict(row) for row in await db.fetch_all(query)]
