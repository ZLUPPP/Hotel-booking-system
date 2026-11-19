from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from backend import create_admin
from backend.schemas import Register


def test_existing_email_is_promoted_without_requesting_password(monkeypatch, capsys):
    promote = AsyncMock(return_value={'id': 'existing', 'is_active': True})
    monkeypatch.setattr(create_admin, 'promote_existing', promote)
    monkeypatch.setattr('builtins.input', lambda prompt: ' USER@Example.com ')
    monkeypatch.setattr(create_admin, 'getpass', lambda prompt: pytest.fail('Existing password must be preserved'))
    monkeypatch.setattr(create_admin, 'create', AsyncMock(side_effect=AssertionError('Account already exists')))

    create_admin.main()

    promote.assert_awaited_once_with('user@example.com')
    assert 'Existing name and password preserved' in capsys.readouterr().out


def test_new_admin_accepts_eight_character_password(monkeypatch):
    inputs = iter(['new@example.com', 'New Admin'])
    create = AsyncMock()
    monkeypatch.setattr('builtins.input', lambda prompt: next(inputs))
    monkeypatch.setattr(create_admin, 'getpass', lambda prompt: '12345678')
    monkeypatch.setattr(create_admin, 'promote_existing', AsyncMock(return_value=None))
    monkeypatch.setattr(create_admin, 'create', create)

    create_admin.main()

    create.assert_awaited_once()
    assert create.await_args.args[0].password == '12345678'


def test_short_admin_password_is_rejected(monkeypatch):
    inputs = iter(['new@example.com', 'New Admin'])
    create = AsyncMock()
    monkeypatch.setattr('builtins.input', lambda prompt: next(inputs))
    monkeypatch.setattr(create_admin, 'getpass', lambda prompt: '1234567')
    monkeypatch.setattr(create_admin, 'promote_existing', AsyncMock(return_value=None))
    monkeypatch.setattr(create_admin, 'create', create)

    with pytest.raises(ValidationError):
        create_admin.main()

    create.assert_not_awaited()


async def test_create_conflict_only_updates_role(monkeypatch):
    class Transaction:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    class DB:
        execute = AsyncMock()

        def transaction(self):
            return Transaction()

    db = DB()
    monkeypatch.setattr(create_admin, 'connect', AsyncMock())
    monkeypatch.setattr(create_admin, 'disconnect', AsyncMock())
    monkeypatch.setattr(create_admin, 'get_session', lambda: db)
    monkeypatch.setattr(create_admin, 'hash_password', lambda password: 'new-password-hash')

    await create_admin.create(Register(email='user@example.com', full_name='New Name', password='12345678'))

    statement = db.execute.await_args.args[0]
    update_clause = str(statement).split('DO UPDATE SET ', 1)[1]
    assert update_clause.startswith('role = ')
    assert 'password_hash' not in update_clause
    assert 'full_name' not in update_clause
    assert 'is_active' not in update_clause
