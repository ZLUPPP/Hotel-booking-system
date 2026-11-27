import sqlalchemy

from backend.core import db


Payments = sqlalchemy.Table(
    'payments',
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
        sqlalchemy.ForeignKey('bookings.id', ondelete='RESTRICT'),
        nullable=False,
    ),
    sqlalchemy.Column(
        'idempotency_key',
        sqlalchemy.Uuid(),
        nullable=False,
    ),
    sqlalchemy.Column(
        'amount',
        sqlalchemy.Numeric(precision=12, scale=2),
        nullable=False,
    ),
    sqlalchemy.Column(
        'currency',
        sqlalchemy.String(length=3),
        server_default='KZT',
        nullable=False,
    ),
    sqlalchemy.Column(
        'status',
        sqlalchemy.Enum('pending', 'succeeded', 'failed', name='payment_status'),
        server_default='pending',
        nullable=False,
    ),
    sqlalchemy.Column('method', sqlalchemy.String(length=16), server_default='card', nullable=False),
    sqlalchemy.Column(
        'failure_reason',
        sqlalchemy.String(length=500),
        nullable=True,
    ),
    sqlalchemy.Column(
        'created_at',
        sqlalchemy.DateTime(timezone=True),
        server_default=sqlalchemy.func.now(),
        nullable=False,
    ),
    sqlalchemy.CheckConstraint(
        'amount > 0',
        name='ck_payment_amount',
    ),
    sqlalchemy.CheckConstraint("method IN ('card', 'kaspi', 'wallet')", name='ck_payment_method'),
    sqlalchemy.CheckConstraint(
        "currency ~ '^[A-Z]{3}$'",
        name='ck_payment_currency',
    ),
    sqlalchemy.UniqueConstraint('idempotency_key', name='uq_payment_idempotency'),
    sqlalchemy.Index('ix_payments_booking', 'booking_id'),
    sqlalchemy.Index(
        'uq_payment_success',
        'booking_id',
        unique=True,
        postgresql_where=sqlalchemy.text("status = 'succeeded'"),
    ),
)
