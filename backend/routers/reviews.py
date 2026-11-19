from datetime import datetime
from uuid import UUID
from zoneinfo import ZoneInfo

import sqlalchemy as sa
from fastapi import APIRouter, HTTPException
from sqlalchemy.dialects.postgresql import insert as pg_insert

from backend.core.errors import ApiError
from backend.models import Guests, Reviews, Rooms
from backend.routers.bookings import load_booking
from backend.routers.common import DB, User, Limit, Offset, page
from backend.schemas import MyReview, Review, ReviewCreate, RoomRating, RoomReviews

router = APIRouter(tags=['reviews'])


def local_today():
    return datetime.now(ZoneInfo('Asia/Qyzylorda')).date()


def author_name(full_name: str) -> str:
    """Public name: first name and the initial of the second word (no full names)."""
    parts = (full_name or '').split()
    if not parts:
        return 'Гость'
    return parts[0] if len(parts) == 1 else f'{parts[0]} {parts[1][0].upper()}.'


@router.post('/bookings/{booking_id}/review', response_model=Review)
async def save_review(booking_id: UUID, body: ReviewCreate, db: DB, user: User):
    """Create the review of a finished stay, or update it if it already exists."""
    async with db.transaction():
        booking = await load_booking(db, booking_id, user, lock=True)
        if booking['guest_id'] != user['id']:
            raise HTTPException(404, 'Booking not found')
        if booking['status'] != 'confirmed' or booking['check_out'] > local_today():
            raise ApiError(409, 'review_not_allowed', 'Only completed stays can be reviewed')
        statement = pg_insert(Reviews).values(
            booking_id=booking_id, room_id=booking['room_id'], guest_id=user['id'],
            rating=body.rating, comment=body.comment)
        statement = statement.on_conflict_do_update(
            index_elements=[Reviews.c.booking_id],
            set_=dict(rating=statement.excluded.rating, comment=statement.excluded.comment,
                      updated_at=sa.func.now()),
        ).returning(*Reviews.c)
        return dict(await db.fetch_one(statement))


@router.get('/reviews/mine', response_model=list[MyReview])
async def my_reviews(db: DB, user: User):
    query = sa.select(Reviews, Rooms.c.number.label('room_number'), Rooms.c.room_type) \
        .join_from(Reviews, Rooms, Reviews.c.room_id == Rooms.c.id) \
        .where(Reviews.c.guest_id == user['id']) \
        .order_by(Reviews.c.updated_at.desc(), Reviews.c.id).limit(500)
    return [dict(row) for row in await db.fetch_all(query)]


@router.get('/reviews/ratings', response_model=list[RoomRating])
async def ratings(db: DB):
    query = sa.select(Reviews.c.room_id, sa.func.avg(Reviews.c.rating).label('average'),
                      sa.func.count().label('count')) \
        .join_from(Reviews, Rooms, Reviews.c.room_id == Rooms.c.id) \
        .where(Rooms.c.is_active.is_(True)).group_by(Reviews.c.room_id)
    return [dict(room_id=row['room_id'], average=round(float(row['average']), 1), count=row['count'])
            for row in await db.fetch_all(query)]


@router.get('/rooms/{room_id}/reviews', response_model=RoomReviews)
async def room_reviews(room_id: UUID, db: DB, limit: Limit = 10, offset: Offset = 0):
    room = await db.fetch_one(sa.select(Rooms.c.id).where(Rooms.c.id == room_id, Rooms.c.is_active.is_(True)))
    if not room:
        raise HTTPException(404, 'Room not found')
    query = sa.select(Reviews.c.id, Reviews.c.rating, Reviews.c.comment, Reviews.c.created_at,
                      Guests.c.full_name) \
        .join_from(Reviews, Guests, Reviews.c.guest_id == Guests.c.id) \
        .where(Reviews.c.room_id == room_id) \
        .order_by(Reviews.c.created_at.desc(), Reviews.c.id)
    result = await page(db, query, limit, offset)
    result['items'] = [dict(id=item['id'], rating=item['rating'], comment=item['comment'],
                            created_at=item['created_at'], author=author_name(item['full_name']))
                       for item in result['items']]
    average = await db.fetch_val(sa.select(sa.func.avg(Reviews.c.rating)).where(Reviews.c.room_id == room_id))
    result['average'] = round(float(average), 1) if average is not None else None
    return result
