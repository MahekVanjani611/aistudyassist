"""add collections and note revisions

Revision ID: 19d6d8b1f2aa
Revises: c297091e7da0
Create Date: 2026-03-19 00:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "19d6d8b1f2aa"
down_revision: Union[str, None] = "c297091e7da0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _column_exists(inspector, table_name: str, column_name: str) -> bool:
    if not _table_exists(inspector, table_name):
        return False
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _index_exists(inspector, table_name: str, index_name: str) -> bool:
    if not _table_exists(inspector, table_name):
        return False
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def _fk_exists(inspector, table_name: str, constrained_columns: list[str]) -> bool:
    if not _table_exists(inspector, table_name):
        return False
    for fk in inspector.get_foreign_keys(table_name):
        if fk.get("constrained_columns") == constrained_columns:
            return True
    return False


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not _table_exists(inspector, "note_collections"):
        op.create_table(
            "note_collections",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=True,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=True,
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    inspector = inspect(bind)
    if not _index_exists(inspector, "note_collections", "idx_note_collections_user"):
        op.create_index(
            "idx_note_collections_user",
            "note_collections",
            ["user_id"],
            unique=False,
        )

    inspector = inspect(bind)
    if not _column_exists(inspector, "notes", "collection_id"):
        op.add_column("notes", sa.Column("collection_id", sa.UUID(), nullable=True))

    inspector = inspect(bind)
    if (
        _column_exists(inspector, "notes", "collection_id")
        and not _fk_exists(inspector, "notes", ["collection_id"])
    ):
        op.create_foreign_key(
            "fk_notes_collection_id_note_collections",
            "notes",
            "note_collections",
            ["collection_id"],
            ["id"],
        )

    inspector = inspect(bind)
    if not _index_exists(inspector, "notes", "idx_notes_collection_id"):
        op.create_index(
            "idx_notes_collection_id",
            "notes",
            ["collection_id"],
            unique=False,
        )

    inspector = inspect(bind)
    if not _table_exists(inspector, "note_revisions"):
        op.create_table(
            "note_revisions",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("note_id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.UUID(), nullable=False),
            sa.Column("title", sa.String(length=500), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("summary", sa.Text(), nullable=True),
            sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=True,
            ),
            sa.ForeignKeyConstraint(["note_id"], ["notes.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )

    inspector = inspect(bind)
    if not _index_exists(inspector, "note_revisions", "idx_note_revisions_note"):
        op.create_index(
            "idx_note_revisions_note",
            "note_revisions",
            ["note_id", "created_at"],
            unique=False,
        )

    inspector = inspect(bind)
    if not _index_exists(inspector, "note_revisions", "idx_note_revisions_user"):
        op.create_index(
            "idx_note_revisions_user",
            "note_revisions",
            ["user_id", "created_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if _index_exists(inspector, "note_revisions", "idx_note_revisions_user"):
        op.drop_index("idx_note_revisions_user", table_name="note_revisions")

    inspector = inspect(bind)
    if _index_exists(inspector, "note_revisions", "idx_note_revisions_note"):
        op.drop_index("idx_note_revisions_note", table_name="note_revisions")

    inspector = inspect(bind)
    if _table_exists(inspector, "note_revisions"):
        op.drop_table("note_revisions")

    inspector = inspect(bind)
    if _index_exists(inspector, "notes", "idx_notes_collection_id"):
        op.drop_index("idx_notes_collection_id", table_name="notes")

    inspector = inspect(bind)
    if _fk_exists(inspector, "notes", ["collection_id"]):
        op.drop_constraint(
            "fk_notes_collection_id_note_collections", "notes", type_="foreignkey"
        )

    inspector = inspect(bind)
    if _column_exists(inspector, "notes", "collection_id"):
        op.drop_column("notes", "collection_id")

    inspector = inspect(bind)
    if _index_exists(inspector, "note_collections", "idx_note_collections_user"):
        op.drop_index("idx_note_collections_user", table_name="note_collections")

    inspector = inspect(bind)
    if _table_exists(inspector, "note_collections"):
        op.drop_table("note_collections")
