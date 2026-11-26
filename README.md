# Hotel Booking System

FastAPI + PostgreSQL + SQLAlchemy Core + databases (asyncpg).
Реализованы авторизация, профили и роли, каталог и поиск номеров, бронирования,
учебная оплата с идемпотентностью и React-интерфейс. Контракт модулей описан в
[инструкции](docs/TEAM_GUIDE.md).

## Запуск всего проекта через Docker Compose

Нужен Docker с Compose v2. Все команды выполняются из корня проекта.
Скопируйте `.env.example` в `.env` (`cp .env.example .env` в Linux/macOS,
`Copy-Item .env.example .env` в PowerShell). Сгенерируйте секрет:

```bash
docker run --rm python:3.14-slim python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Вставьте результат в `JWT_SECRET` файла `.env`. Существующий приватный секрет сохраните.
Затем запустите **базу, миграции, backend и frontend** одной командой:

```bash
docker compose up -d --build
```

- Интерфейс: http://localhost:5173
- API / Swagger: http://localhost:8000/docs
- Готовность API: http://localhost:8000/health/ready

Чтобы заполнить пустой каталог шестью демонстрационными номерами, выполните в PowerShell:

```powershell
Get-Content backend/demo_rooms.sql -Raw | docker compose exec -T db psql -U hotel -d hotel -v ON_ERROR_STOP=1
```

В Bash передайте файл через перенаправление `< backend/demo_rooms.sql`. Повторный запуск
пропускает номера, которые уже есть в каталоге.

Если порт занят, задайте `BACKEND_PORT` и/или `FRONTEND_PORT` в `.env`
(например, `BACKEND_PORT=18000`) и повторите запуск. Используйте выбранный порт в URL.

Compose ждёт готовности PostgreSQL, применяет миграции отдельным сервисом `migrate`,
затем запускает API и Nginx с собранным React. Состояние `Exited (0)` у `migrate` нормально.
Frontend обращается к `/api/v1` через Nginx; URL backend в браузере настраивать не нужно.
Внутри контейнеров backend использует `db:5432`, независимо от `POSTGRES_URL` в `.env`,
который предназначен для запуска Python на хосте. Данные PostgreSQL сохраняются в томе `hotel_data`.
Python и Node.js на хосте для этого способа запуска не нужны.

Первый администратор (интерактивный ввод имени, email и пароля):

```bash
docker compose exec backend python -m backend.create_admin
```

Управление:

```bash
docker compose ps -a
docker compose logs -f backend frontend migrate
docker compose down
```

`down` останавливает проект, сохраняя базу. После изменения кода снова выполните
`docker compose up -d --build`; исходники включаются в образы при сборке.
Порты опубликованы только на loopback локального компьютера.

Ниже описан альтернативный запуск для разработки с Python и Node.js на хосте.

## Структура

```text
backend/
  __init__.py
  main.py               # приложение, startup/shutdown
  core/
    config.py           # conf, переменные окружения
    db.py               # metadata, connect/get_session/disconnect
    errors.py           # общие обработчики ошибок
  middlewares/
    tokens.py           # JWT, хеширование паролей
    auth.py             # текущий пользователь, роли, владелец брони
    request_logging.py  # журнал запросов
  migrations/           # Alembic
  models/               # sqlalchemy.Table и общие запросы
  routers/              # endpoints
  tests/
```

Все команды ниже выполняются **из корня проекта**. Требуются Python 3.11+
и запущенный Docker Desktop с Linux containers.

## Установка и запуск

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
```

Вставьте полученную строку в JWT_SECRET файла .env. Шаблонный секрет отвергается.
При обновлении существующего проекта сохраните секрет и замените DATABASE_URL на POSTGRES_URL,
а схему URL — на `postgresql+asyncpg://`.

```powershell
docker compose up -d db
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload
```

Swagger: http://localhost:8000/docs. Health: `/health/live`, `/health/ready`.
PostgreSQL опубликован на `127.0.0.1:15432`. Пароль compose предназначен для локальной разработки.
Подключение открывается в lifespan приложения и закрывается при остановке.
Без подключения get_session() выдаёт RuntimeError. Внутри приложения все запросы асинхронные.
Alembic использует синхронный psycopg с теми же реквизитами.

Миграция 0001 создаёт схему и btree_gist (нужны права CREATE EXTENSION).
Миграция 0002 добавляет генерацию UUID на стороне PostgreSQL, не меняя существующие строки.
Уже применённые миграции не переписываются. create_all при запуске не используется.

## Тесты

Без отдельной тестовой БД выполняются unit-тесты, интеграционные пропускаются:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Для интеграционных тестов создайте отдельную БД (createdb — однократно):

```powershell
docker compose exec -T db createdb -U hotel hotel_test
$env:POSTGRES_URL = 'postgresql+asyncpg://hotel:hotel@127.0.0.1:15432/hotel_test'
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
$env:TEST_DATABASE_URL = $env:POSTGRES_URL
.\.venv\Scripts\python.exe -m pytest -q
Remove-Item Env:POSTGRES_URL
Remove-Item Env:TEST_DATABASE_URL
```

Тесты удаляют только собственные строки. Не используйте рабочую БД для тестов.
Проверены конкурентные бронирования, соседние даты, cancelled, уникальность платежей,
откат транзакции, JWT и RBAC. TestClient выдаёт предупреждение Starlette о переходе с httpx на httpx2.

## Изменение схемы

```powershell
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini revision --autogenerate -m "description"
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini upgrade head
.\.venv\Scripts\python.exe -m alembic -c backend/alembic.ini check
```

Проверяйте сгенерированные миграции вручную, особенно enum и exclusion constraints.
Новый файл модели импортируйте в backend/models/__init__.py, чтобы таблица попала в общие metadata.


## React-интерфейс

Нужен Node.js 22+ и npm. В отдельном терминале из корня проекта:

```bash
npm ci --prefix frontend
cp frontend/.env.example frontend/.env
npm run dev --prefix frontend
```

Откройте http://localhost:5173. Backend должен работать на http://localhost:8000.
`VITE_API_BASE_URL` задаётся при сборке; после изменения перезапустите Vite.
Production-сборка: `npm run build --prefix frontend`, результат — `frontend/dist`.
Для размещения на другом origin добавьте его в `CORS_ORIGINS` backend.
Токен хранится в `sessionStorage`. После перезагрузки вкладки профиль восстанавливается, пока действует токен.
Оплата — симуляция успеха или отказа; реальные деньги и реквизиты карт не используются.
При сетевой ошибке повтор платежа использует прежний ключ; после полученного результата
новая попытка получает новый UUID.

## Первый администратор

После миграций запустите локально:

```bash
.venv/bin/python -m backend.create_admin
```

В Windows используйте `.\.venv\Scripts\python.exe -m backend.create_admin`.
Сначала вводится email. Если аккаунт уже существует, скрипт назначает ему роль
администратора, сохраняя имя, пароль и статус активности. Для нового аккаунта
запрашиваются имя и пароль от 8 до 128 символов; пароль вводится скрыто и подтверждается.
Публичная регистрация всегда создаёт гостя. Администратор создаёт номера во вкладке
«Номера» и управляет ролями во вкладке «Пользователи». Последнего активного
администратора нельзя отключить или понизить через API.

## Запуск на Linux/macOS

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.lock.txt
cp .env.example .env
```

Сгенерируйте `JWT_SECRET` командой из раздела установки и замените шаблон в `.env`.

```bash
docker compose up -d db
.venv/bin/python -m alembic -c backend/alembic.ini upgrade head
.venv/bin/python -m uvicorn backend.main:app --reload
```

Для API-тестов используется отдельная база:

```bash
docker compose exec -T db createdb -U hotel hotel_test
POSTGRES_URL=postgresql+asyncpg://hotel:hotel@127.0.0.1:15432/hotel_test .venv/bin/python -m alembic -c backend/alembic.ini upgrade head
TEST_DATABASE_URL=postgresql+asyncpg://hotel:hotel@127.0.0.1:15432/hotel_test .venv/bin/python -m pytest -q
```

Проверка реализации: 30 тестов прошли на PostgreSQL 17; React production build прошёл.
Проверены регистрация, защита ролей, блокировка аккаунта, последний admin, даты и деньги,
поиск, конкурентная бронь, владение, неудачная и успешная оплата, повтор ключа,
история и гонка отмены с оплатой. Визуальная проверка в браузере в этой среде не выполнена.

### Календарь администратора и отчёты

В панели «Управление отелем» доступны разделы «Календарь занятости» и
«Статистика и отчёты». Период задаётся началом и концом (конец не включается),
максимум 366 ночей. Категория и поиск номера применяются ко всем показателям
и выгрузкам. Кнопка «Обновить данные» повторно загружает номера и бронирования.

- Календарь показывает подтверждённые и ожидающие оплаты брони; день выезда
  свободен. Нажатие на бронь открывает даты, статус и полную стоимость.
- Загрузка — занятые номеро-ночи / доступные номеро-ночи периода. В расчёт
  включаются текущие активные номера, а также скрытые номера с занимающей
  номер бронью в периоде. История изменения номерного фонда не хранится.
- Стоимость подтверждённых ночей распределяется пропорционально полной
  длительности брони и учитывает только ночи внутри периода. Это не отчёт
  о платежах; валюты показаны отдельно.
- Сводный CSV содержит показатели и занятость по дням. CSV бронирований
  содержит все пересекающие период брони, включая отменённые, с их полной
  стоимостью. Формат: UTF-8 с BOM, разделитель `;`, защита от CSV-формул.

Новые экраны используют существующие авторизованные API с загрузкой всех
страниц результатов. Дополнительные зависимости и миграции БД не нужны.
Проверка расчётов и экспорта: `npm --prefix frontend test`.
