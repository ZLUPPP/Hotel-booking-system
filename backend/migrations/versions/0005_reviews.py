"""Room reviews: one rating and optional comment per completed booking."""
import sqlalchemy as sa
from alembic import op

revision = '0005_reviews'
down_revision = '0004_merge_booking_and_refresh'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'reviews',
        sa.Column('id', sa.Uuid(), primary_key=True,
                  server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('booking_id', sa.Uuid(),
                  sa.ForeignKey('bookings.id', ondelete='CASCADE'), nullable=False),
        sa.Column('room_id', sa.Uuid(),
                  sa.ForeignKey('rooms.id', ondelete='CASCADE'), nullable=False),
        sa.Column('guest_id', sa.Uuid(),
                  sa.ForeignKey('guests.id', ondelete='CASCADE'), nullable=False),
        sa.Column('rating', sa.SmallInteger(), nullable=False),
        sa.Column('comment', sa.String(length=1000), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint('rating BETWEEN 1 AND 5', name='ck_review_rating'),
        sa.UniqueConstraint('booking_id', name='uq_review_booking'),
    )
    op.create_index('ix_reviews_room_created', 'reviews', ['room_id', 'created_at'])
    op.create_index('ix_reviews_guest', 'reviews', ['guest_id'])


def downgrade():
    op.drop_index('ix_reviews_guest', table_name='reviews')
    op.drop_index('ix_reviews_room_created', table_name='reviews')
    op.drop_table('reviews')
