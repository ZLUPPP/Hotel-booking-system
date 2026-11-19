"""Merge the booking guest count and refresh token migration branches."""

revision = '0004_merge_booking_and_refresh'
down_revision = ('0003_booking_guest_count', '0003_refresh_tokens')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
