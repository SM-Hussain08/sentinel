from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.database.session import Base

# Import models so SQLAlchemy knows which tables belong to Base.metadata.
from app.models import Employee, Event  # noqa: F401


# Alembic configuration object.
config = context.config


# Use SENTINEL's DATABASE_URL from the root .env file instead of
# hardcoding database credentials inside alembic.ini.
config.set_main_option(
    "sqlalchemy.url",
    settings.database_url,
)


if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# This metadata is used by Alembic's autogeneration system to detect
# changes in our SQLAlchemy models.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Run migrations without establishing a live database connection.
    """

    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations using a live database connection.
    """

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()