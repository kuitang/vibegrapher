"""Add missing tool_calls and message_type fields

Revision ID: 1b367083d5a5
Revises: 7fc5bef6e21d
Create Date: 2025-08-27 04:22:54.057053

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1b367083d5a5"
down_revision: str | None = "7fc5bef6e21d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add missing columns for streaming functionality
    op.add_column(
        "conversation_messages", sa.Column("tool_calls", sa.JSON(), nullable=True)
    )
    op.add_column(
        "conversation_messages",
        sa.Column("message_type", sa.String(), nullable=True, default="user_input"),
    )
    op.add_column(
        "conversation_messages", sa.Column("iteration", sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("conversation_messages", "iteration")
    op.drop_column("conversation_messages", "message_type")
    op.drop_column("conversation_messages", "tool_calls")
