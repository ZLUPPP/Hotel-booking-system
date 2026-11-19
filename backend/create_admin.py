"""Run locally: python -m backend.create_admin. No password in command arguments."""
import asyncio
from getpass import getpass
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import insert
from pydantic import ValidationError
from backend.core.db import connect, disconnect, get_session
from backend.models import Guests
from backend.middlewares.tokens import hash_password
from backend.schemas import EmailInput, Register


async def create(data):
    """Create an admin, preserving existing account details on an email conflict."""
    await connect()
    try:
        db = get_session()
        async with db.transaction():
            await db.execute(sa.text('SELECT pg_advisory_xact_lock(724031)'))
            statement = insert(Guests).values(email=data.email, full_name=data.full_name,
                password_hash=hash_password(data.password), role='admin')
            await db.execute(statement.on_conflict_do_update(
                index_elements=[Guests.c.email], set_={'role': 'admin'}))
    finally:
        await disconnect()


async def promote_existing(email):
    """Promote an existing account without changing its password or active status."""
    await connect()
    try:
        db = get_session()
        async with db.transaction():
            await db.execute(sa.text('SELECT pg_advisory_xact_lock(724031)'))
            return await db.fetch_one(Guests.update().where(Guests.c.email == email)
                .values(role='admin').returning(Guests.c.id, Guests.c.is_active))
    finally:
        await disconnect()


def main():
    email = EmailInput(email=input('Email: ')).email
    existing = asyncio.run(promote_existing(email))
    if existing:
        print('Administrator role assigned. Existing name and password preserved.')
        if not existing['is_active']:
            print('This account is inactive; its active status has not been changed.')
        return

    name = input('Full name: ')
    password = getpass('Password (8–128 characters): ')
    if password != getpass('Confirm password: '):
        raise SystemExit('Passwords do not match')
    data = Register(email=email, full_name=name, password=password)
    asyncio.run(create(data))
    print('Administrator ready. If the account already existed, its name and password were preserved.')


if __name__ == '__main__':
    try:
        main()
    except ValidationError as exc:
        # Do not echo Pydantic's input values: they can contain a password.
        messages = '; '.join(f"{'.'.join(map(str, error['loc']))}: {error['msg']}"
            for error in exc.errors(include_input=False))
        raise SystemExit(messages) from None
