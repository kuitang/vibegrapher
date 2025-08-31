"""
Unified diff parsing utilities using difflib
Based on Aider's approach to diff parsing
"""

import difflib
import logging

logger = logging.getLogger(__name__)


class DiffParser:
    """Parse and apply unified diff patches using difflib"""

    @staticmethod
    def apply_patch(original_code: str, patch: str) -> str | None:
        """Apply a unified diff patch to the original code using difflib

        This follows a similar approach to Aider's diff parsing.
        """
        try:
            # Split into lines for processing
            original_lines = original_code.splitlines(keepends=True)
            patch_lines = patch.splitlines(keepends=True)

            # Parse the patch
            result_lines = []
            i = 0
            original_idx = 0

            while i < len(patch_lines):
                line = patch_lines[i]

                # Skip file headers
                if line.startswith("---") or line.startswith("+++"):
                    i += 1
                    continue

                # Parse hunk header
                if line.startswith("@@"):
                    # Extract line numbers from hunk header
                    # Format: @@ -old_start,old_count +new_start,new_count @@
                    import re

                    match = re.match(
                        r"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", line
                    )
                    if not match:
                        i += 1
                        continue

                    old_start = int(match.group(1)) - 1  # Convert to 0-based index
                    int(match.group(2)) if match.group(2) else 1

                    # Add any unchanged lines before this hunk
                    while original_idx < old_start and original_idx < len(
                        original_lines
                    ):
                        result_lines.append(original_lines[original_idx])
                        original_idx += 1

                    # Process the hunk content
                    i += 1
                    while i < len(patch_lines) and not patch_lines[i].startswith("@@"):
                        hunk_line = patch_lines[i]

                        if hunk_line.startswith("-"):
                            # Line to remove - skip it in the original
                            original_idx += 1
                        elif hunk_line.startswith("+"):
                            # Line to add
                            result_lines.append(hunk_line[1:])
                        elif hunk_line.startswith(" "):
                            # Context line - copy from original
                            if original_idx < len(original_lines):
                                result_lines.append(original_lines[original_idx])
                                original_idx += 1
                        else:
                            # Might be a continued line without prefix
                            if original_idx < len(original_lines):
                                result_lines.append(original_lines[original_idx])
                                original_idx += 1

                        i += 1
                    continue

                i += 1

            # Add any remaining unchanged lines
            while original_idx < len(original_lines):
                result_lines.append(original_lines[original_idx])
                original_idx += 1

            # Join the result
            return "".join(result_lines)

        except Exception as e:
            # Let the error propagate with context
            logger.error(f"Failed to apply patch: {e}", exc_info=True)
            raise ValueError(f"Failed to apply patch: {e}") from e

    @staticmethod
    def create_unified_diff(
        old_content: str, new_content: str, filename: str = "file"
    ) -> str:
        """Create a unified diff from old and new content using difflib"""
        old_lines = old_content.splitlines(keepends=True)
        new_lines = new_content.splitlines(keepends=True)

        # Use difflib to generate unified diff
        diff = difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile=f"a/{filename}",
            tofile=f"b/{filename}",
            lineterm="",
        )

        return "".join(diff)

    @staticmethod
    def extract_file_info(patch: str) -> tuple[str | None, bool]:
        """Extract filename and whether it's a new file from patch"""
        lines = patch.strip().split("\n")
        filename = None
        is_new_file = False

        for line in lines:
            if line.startswith("--- "):
                if line == "--- /dev/null":
                    is_new_file = True
            elif line.startswith("+++ "):
                # Extract filename from +++ line
                filename = line.replace("+++ ", "").replace("b/", "").strip()
                break

        return filename, is_new_file


# Global instance
diff_parser = DiffParser()
