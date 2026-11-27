from decimal import Decimal

import pytest
from pydantic import ValidationError

from backend.routers.rates import parse_usd_kzt
from backend.schemas import PaymentCreate


def test_parse_usd_kzt_uses_quantity_and_returns_published_date():
    xml = '''<rates><date>26.11.2026</date>
    <item><title>EUR</title><description>590.00</description><quant>1</quant></item>
    <item><title>USD</title><description>512.50</description><quant>1</quant></item>
    </rates>'''

    rate, date = parse_usd_kzt(xml)

    assert rate == Decimal('512.50')
    assert date == '26.11.2026'


def test_parse_usd_kzt_rejects_missing_or_invalid_rate():
    with pytest.raises(ValueError, match='USD rate missing'):
        parse_usd_kzt('<rates><date>26.11.2026</date></rates>')
    with pytest.raises(ValueError, match='Invalid USD rate'):
        parse_usd_kzt('<rates><item><title>USD</title><description>oops</description></item></rates>')


def test_payment_method_accepts_supported_methods_only():
    assert PaymentCreate(outcome='succeeded', method='kaspi').method == 'kaspi'
    assert PaymentCreate(outcome='succeeded', method='wallet').method == 'wallet'
    with pytest.raises(ValidationError):
        PaymentCreate(outcome='succeeded', method='visa-number')
