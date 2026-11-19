from datetime import date, datetime
from decimal import Decimal
from typing import Generic, Literal, TypeVar
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Input(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class EmailInput(Input):
    email: str = Field(max_length=254)

    @field_validator('email')
    @classmethod
    def normalize_email(cls, value):
        import re
        if value is None:
            raise ValueError('Email cannot be null')
        value = value.lower()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
            raise ValueError('Invalid email')
        return value


class Register(EmailInput):
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)


class Login(EmailInput):
    password: str = Field(min_length=1, max_length=128)


class ProfilePatch(EmailInput):
    email: str | None = None
    full_name: str | None = Field(default=None, min_length=1, max_length=200)

    @model_validator(mode='after')
    def no_null(self):
        if any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError('Null fields are not supported')
        return self


class AdminPatch(Input):
    role: Literal['guest', 'receptionist', 'admin'] | None = None
    is_active: bool | None = None

    @model_validator(mode='after')
    def no_null(self):
        if any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError('Null fields are not supported')
        return self


class Profile(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = 'bearer'
    refresh_token: str | None = None

class RefreshRequest(Input):
    refresh_token: str = Field(min_length=20, max_length=200)


class RoomCreate(Input):
    number: str = Field(min_length=1, max_length=20)
    room_type: str = Field(min_length=1, max_length=50)
    capacity: int = Field(gt=0)
    price_per_night: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    currency: str = Field(default='KZT', pattern=r'^[A-Z]{3}$')


class RoomPatch(Input):
    number: str | None = Field(default=None, min_length=1, max_length=20)
    room_type: str | None = Field(default=None, min_length=1, max_length=50)
    capacity: int | None = Field(default=None, gt=0)
    price_per_night: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    currency: str | None = Field(default=None, pattern=r'^[A-Z]{3}$')
    is_active: bool | None = None

    @model_validator(mode='after')
    def no_null(self):
        if any(getattr(self, key) is None for key in self.model_fields_set):
            raise ValueError('Null fields are not supported')
        return self


class Room(RoomCreate):
    id: UUID
    is_active: bool


class AvailableRoom(Room):
    total_amount: Decimal


class StayPrice(BaseModel):
    currency: str
    total_amount: Decimal


def validate_dates(check_in, check_out):
    if check_out <= check_in or check_in < datetime.now(ZoneInfo('Asia/Qyzylorda')).date():
        raise ValueError('Dates must be future dates spanning at least one night')


class BookingCreate(Input):
    room_id: UUID
    check_in: date
    check_out: date
    guest_count: int | None = Field(default=None, ge=1, le=2147483647)

    @model_validator(mode='after')
    def valid_dates(self):
        validate_dates(self.check_in, self.check_out)
        return self


class Booking(BaseModel):
    id: UUID
    guest_id: UUID
    room_id: UUID
    check_in: date
    check_out: date
    guest_count: int | None = None
    status: str
    total_amount: Decimal
    currency: str
    created_at: datetime


class BookingSummary(Booking):
    room_number: str
    room_type: str
    room_capacity: int


class PaymentCreate(Input):
    outcome: Literal['succeeded', 'failed']


class Payment(BaseModel):
    id: UUID
    booking_id: UUID
    idempotency_key: UUID
    amount: Decimal
    currency: str
    status: str
    failure_reason: str | None
    created_at: datetime


class PaymentResult(BaseModel):
    payment: Payment
    booking_status: str


T = TypeVar('T')


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


class ReviewCreate(Input):
    rating: int = Field(strict=True, ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)

    @field_validator('comment')
    @classmethod
    def blank_comment(cls, value):
        return value or None


class Review(BaseModel):
    id: UUID
    booking_id: UUID
    room_id: UUID
    rating: int
    comment: str | None = None
    created_at: datetime
    updated_at: datetime


class MyReview(Review):
    room_number: str
    room_type: str


class PublicReview(BaseModel):
    id: UUID
    rating: int
    comment: str | None = None
    author: str
    created_at: datetime


class RoomRating(BaseModel):
    room_id: UUID
    average: float
    count: int


class RoomReviews(Page[PublicReview]):
    average: float | None = None
