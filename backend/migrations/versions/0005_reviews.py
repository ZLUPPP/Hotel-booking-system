import sqlalchemy

from backend.core import db


Reviews = sqlalchemy.Table(
    'reviews',
    db.metadata,
    sqlalchemy.Column(
        'id',
        sqlalchemy.Uuid(),
        primary_key=True,
        server_default=sqlalchemy.text("gen_random_uuid()"),
        nullable=False,
    ),
    sqlalchemy.Column(
        'booking_id',
        sqlalchemy.Uuid(),
        sqlalchemy.ForeignKey('bookings.id', ondelete='CASCADE'),
        nullable=False,
    ),
    sqlalchemy.Column(
        'room_id',
        sqlalchemy.Uuid(),
        sqlalchemy.ForeignKey('rooms.id', ondelete='CASCADE'),
        nullable=False,
    ),
    sqlalchemy.Column(
        'guest_id',
        sqlalchemy.Uuid(),
        sqlalchemy.ForeignKey('guests.id', ondelete='CASCADE'),
        nullable=False,
    ),
    sqlalchemy.Column('rating', sqlalchemy.SmallInteger(), nullable=False),
    sqlalchemy.Column('comment', sqlalchemy.String(length=1000), nullable=True),
    sqlalchemy.Column(
        'created_at',
        sqlalchemy.DateTime(timezone=True),
        server_default=sqlalchemy.func.now(),
        nullable=False,
    ),
    sqlalchemy.Column(
        'updated_at',
        sqlalchemy.DateTime(timezone=True),
        server_default=sqlalchemy.func.now(),
        nullable=False,
    ),
    sqlalchemy.CheckConstraint('rating BETWEEN 1 AND 5', name='ck_review_rating'),
    sqlalchemy.UniqueConstraint('booking_id', name='uq_review_booking'),
    sqlalchemy.Index('ix_reviews_room_created', 'room_id', 'created_at'),
    sqlalchemy.Index('ix_reviews_guest', 'guest_id'),
)
