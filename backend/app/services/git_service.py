import logging
import os
import shutil
from pathlib import Path

import pygit2

from ..config import settings

logger = logging.getLogger(__name__)


class GitService:
    def __init__(self, base_path: str | None = None) -> None:
        if base_path is None:
            base_path = os.path.join(settings.media_path, "projects")
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _get_repo_path(self, project_slug: str) -> Path:
        """Get repository path for project"""
        return self.base_path / project_slug

    def create_repository(self, project_slug: str) -> str:
        """Initialize git repository for project"""
        repo_path = self._get_repo_path(project_slug)

        # Create directory if it doesn't exist
        repo_path.mkdir(parents=True, exist_ok=True)

        # Initialize git repository
        repo = pygit2.init_repository(str(repo_path), bare=False)

        # Create initial branch configuration
        config = repo.config
        config["user.name"] = "Vibegrapher"
        config["user.email"] = "vibegrapher@example.com"

        logger.info(f"Created git repository at {repo_path}")
        return str(repo_path)

    def get_current_code(self, project_slug: str) -> str | None:
        """Get current code from repository"""
        repo_path = self._get_repo_path(project_slug)

        # First try agents.py (default)
        code_file = repo_path / "agents.py"
        if code_file.exists():
            try:
                return code_file.read_text()
            except Exception as e:
                logger.error(f"Error reading code file: {e}")
                return None

        # If agents.py doesn't exist, find any .py file
        py_files = list(repo_path.glob("*.py"))
        if py_files:
            # Return the first Python file found
            try:
                return py_files[0].read_text()
            except Exception as e:
                logger.error(f"Error reading Python file: {e}")
                return None

        logger.warning(f"No Python files found in {repo_path}")
        return None

    def get_head_commit(self, project_slug: str) -> str | None:
        """Get current HEAD commit SHA"""
        repo_path = self._get_repo_path(project_slug)

        try:
            repo = pygit2.Repository(str(repo_path))
            if repo.is_empty:
                return None
            return str(repo.head.target)
        except Exception as e:
            logger.error(f"Error getting HEAD commit: {e}")
            return None

    def get_current_branch(self, project_slug: str) -> str:
        """Get active branch name"""
        repo_path = self._get_repo_path(project_slug)

        try:
            repo = pygit2.Repository(str(repo_path))
            if repo.is_empty:
                return "main"

            # Get current branch
            if repo.head_is_detached:
                return "detached"

            branch = repo.branches.get(repo.head.shorthand)
            return branch.branch_name if branch else "main"
        except Exception as e:
            logger.error(f"Error getting current branch: {e}")
            return "main"

    def commit_changes(
        self, project_slug: str, content: str, message: str, filename: str = "agents.py"
    ) -> str | None:
        """Create commit with changes"""
        repo_path = self._get_repo_path(project_slug)
        code_file = repo_path / filename

        try:
            # Write content to file
            code_file.write_text(content)

            # Open repository
            repo = pygit2.Repository(str(repo_path))

            # Add file to index
            repo.index.add(filename)
            repo.index.write()

            # Create tree from index
            tree = repo.index.write_tree()

            # Get author and committer
            author = pygit2.Signature("Vibegrapher", "vibegrapher@example.com")

            # Create commit
            if repo.is_empty:
                # First commit
                commit_id = repo.create_commit(
                    "HEAD", author, author, message, tree, []
                )
            else:
                # Subsequent commits
                parent = repo.head.target
                commit_id = repo.create_commit(
                    "HEAD", author, author, message, tree, [parent]
                )

            logger.info(f"Created commit {commit_id} for project {project_slug}")
            return str(commit_id)

        except Exception as e:
            logger.error(f"Error committing changes: {e}")
            return None

    def apply_diff(self, project_slug: str, diff_content: str) -> bool:
        """Apply a diff/patch to the repository"""
        repo_path = self._get_repo_path(project_slug)

        try:
            # First try pygit2's native diff parsing
            try:
                repo = pygit2.Repository(str(repo_path))
                diff = pygit2.Diff.parse_diff(diff_content)
                repo.apply(diff)
                logger.info(f"Applied diff using pygit2 to project {project_slug}")
                return True
            except Exception as pygit_err:
                logger.debug(f"pygit2 parse failed, trying manual apply: {pygit_err}")

                # Fall back to manual parsing and file manipulation
                # This handles simple unified diffs that pygit2 rejects
                return self._apply_diff_manual(project_slug, diff_content)

        except Exception as e:
            logger.error(f"Error applying diff: {e}")
            return False

    def _apply_diff_manual(self, project_slug: str, diff_content: str) -> bool:
        """Manually apply a unified diff using similar logic to Aider"""
        repo_path = self._get_repo_path(project_slug)

        try:
            # Parse the diff to extract file path and changes
            lines = diff_content.strip().split("\n")
            filename = None
            is_new_file = False
            changes = []

            for line in lines:
                if line.startswith("--- "):
                    if line == "--- /dev/null":
                        is_new_file = True
                elif line.startswith("+++ "):
                    # Extract filename from +++ line
                    filename = line.replace("+++ ", "").replace("b/", "").strip()
                elif line.startswith("+") and not line.startswith("+++"):
                    # Content to add
                    changes.append(line[1:])
                elif line.startswith("-") and not line.startswith("---"):
                    # Content to remove (for existing files)
                    pass  # We'll handle this if needed

            if not filename:
                # Default to script.py if no filename found
                filename = "script.py"

            file_path = repo_path / filename

            if is_new_file or not file_path.exists():
                # Create new file
                if changes:
                    file_path.write_text("\n".join(changes) + "\n")
                    logger.info(f"Created new file {file_path} with diff content")
                    return True
            else:
                # Modify existing file (for now, just append)
                existing = file_path.read_text() if file_path.exists() else ""
                new_content = (
                    existing + "\n".join(changes) + "\n" if changes else existing
                )
                file_path.write_text(new_content)
                logger.info(f"Modified {file_path} with diff content")
                return True

            return False

        except Exception as e:
            logger.error(f"Error in manual diff apply: {e}")
            return False

    def get_diff(self, project_slug: str) -> str | None:
        """Get diff of uncommitted changes"""
        repo_path = self._get_repo_path(project_slug)

        try:
            repo = pygit2.Repository(str(repo_path))

            # Get diff between index and working directory
            diff = repo.diff_index_to_workdir()

            return diff.patch if diff.patch else None

        except Exception as e:
            logger.error(f"Error getting diff: {e}")
            return None

    def delete_repository(self, project_slug: str) -> bool:
        """Remove git repository"""
        repo_path = self._get_repo_path(project_slug)

        try:
            if repo_path.exists():
                shutil.rmtree(repo_path)
                logger.info(f"Deleted repository at {repo_path}")
            return True
        except Exception as e:
            logger.error(f"Error deleting repository: {e}")
            return False

    def repository_exists(self, project_slug: str) -> bool:
        """Check if repository exists"""
        repo_path = self._get_repo_path(project_slug)
        git_dir = repo_path / ".git"
        return git_dir.exists()


# Global instance
git_service = GitService()
