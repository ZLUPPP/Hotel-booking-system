"""Keep the selected payment method with each payment record."""
import sqlalchemy as sa
from alembic import op

revision = '0006_payment_method'
down_revision = '0005_reviews'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('payments', sa.Column('method', sa.String(length=16), server_default='card', nullable=False))
    op.create_check_constraint('ck_payment_method', 'payments', "method IN ('card', 'kaspi', 'wallet')")


def downgrade():
    op.drop_constraint('ck_payment_method', 'payments', type_='check')
    op.drop_column('payments', 'method')
