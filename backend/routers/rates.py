"""Official KZT exchange rate lookup from the National Bank of Kazakhstan."""
from datetime import datetime
from decimal import Decimal, InvalidOperation
from time import monotonic
from xml.etree import ElementTree
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix='/rates', tags=['rates'])
_cache: dict | None = None
_cache_at = 0.0


class ExchangeRate(BaseModel):
    base: str = 'USD'
    quote: str = 'KZT'
    rate: Decimal
    date: str
    source: str = 'National Bank of Kazakhstan'


def parse_usd_kzt(xml: str) -> tuple[Decimal, str]:
    root = ElementTree.fromstring(xml)
    date = root.findtext('date') or ''
    for item in root.findall('item'):
        if (item.findtext('title') or '').strip().upper() != 'USD':
            continue
        try:
            value = Decimal(item.findtext('description', '').strip())
            quantity = Decimal(item.findtext('quant', '1').strip())
        except (InvalidOperation, AttributeError) as error:
            raise ValueError('Invalid USD rate') from error
        if value <= 0 or quantity <= 0:
            raise ValueError('Invalid USD rate')
        return value / quantity, date
    raise ValueError('USD rate missing from National Bank response')


@router.get('/usd-kzt', response_model=ExchangeRate)
async def usd_kzt():
    global _cache, _cache_at
    if _cache and monotonic() - _cache_at < 6 * 60 * 60:
        return _cache
    today = datetime.now(ZoneInfo('Asia/Almaty')).date()
    date_param = today.strftime('%d.%m.%Y')
    url = f'https://nationalbank.kz/rss/get_rates.cfm?fdate={date_param}'
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
        rate, date = parse_usd_kzt(response.text)
        _cache = ExchangeRate(rate=rate, date=date or date_param).model_dump()
        _cache_at = monotonic()
        return _cache
    except (httpx.HTTPError, ElementTree.ParseError, ValueError):
        if _cache:
            return _cache
        raise HTTPException(503, detail='Exchange rate is temporarily unavailable')
