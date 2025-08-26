"""
Unified diff parsing utilities
Extracted from git service to avoid redundancy
"""

import logging
import re
from typing import Optional, List, Tuple

logger = logging.getLogger(__name__)


class DiffParser:
    """Parse and apply unified diff patches"""
    
    @staticmethod
    def parse_hunks(patch_lines: List[str]) -> List[Tuple[int, int, List[str]]]:
        """Parse patch into hunks with line numbers and content"""
        hunks = []
        i = 0
        
        while i < len(patch_lines):
            line = patch_lines[i]
            
            # Skip headers
            if line.startswith('---') or line.startswith('+++'):
                i += 1
                continue
            
            # Parse hunk header
            if line.startswith('@@'):
                match = re.match(r'@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@', line)
                if match:
                    old_start = int(match.group(1))
                    old_count = int(match.group(2)) if match.group(2) else 1
                    new_start = int(match.group(3))
                    new_count = int(match.group(4)) if match.group(4) else 1
                    
                    # Collect hunk lines
                    i += 1
                    hunk_lines = []
                    while i < len(patch_lines) and not patch_lines[i].startswith('@@'):
                        hunk_lines.append(patch_lines[i])
                        i += 1
                    
                    hunks.append((old_start, new_start, hunk_lines))
                    continue
            
            i += 1
        
        return hunks
    
    @staticmethod
    def apply_patch(original_code: str, patch: str) -> Optional[str]:
        """Apply a unified diff patch to the original code"""
        try:
            lines = original_code.split('\n')
            patch_lines = patch.strip().split('\n')
            
            # Parse patch into hunks
            hunks = DiffParser.parse_hunks(patch_lines)
            
            # Apply hunks in reverse order to preserve line numbers
            for old_start, new_start, hunk_lines in reversed(hunks):
                # Calculate what to remove and add
                removals = []
                additions = []
                context_count = 0
                
                for hunk_line in hunk_lines:
                    if hunk_line.startswith('-'):
                        removals.append(context_count)
                    elif hunk_line.startswith('+'):
                        additions.append(hunk_line[1:])
                    elif hunk_line.startswith(' '):
                        context_count += 1
                
                # Apply changes
                # Remove lines (in reverse to maintain indices)
                for idx in reversed(removals):
                    if old_start - 1 + idx < len(lines):
                        lines.pop(old_start - 1 + idx)
                
                # Add new lines
                insert_pos = old_start - 1
                for addition in additions:
                    lines.insert(insert_pos, addition)
                    insert_pos += 1
            
            return '\n'.join(lines)
            
        except Exception as e:
            logger.error(f"Error applying patch: {e}")
            return None
    
    @staticmethod
    def apply_simple_patch(original_code: str, patch: str) -> Optional[str]:
        """Apply a simple unified diff patch (alternative implementation)"""
        try:
            lines = original_code.split('\n')
            patch_lines = patch.strip().split('\n')
            
            result = []
            original_idx = 0
            
            i = 0
            while i < len(patch_lines):
                line = patch_lines[i]
                
                # Handle diff header lines
                if line.startswith('---') or line.startswith('+++'):
                    i += 1
                    continue
                
                # Parse hunk header
                if line.startswith('@@'):
                    match = re.match(r'@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@', line)
                    if match:
                        old_start = int(match.group(1)) - 1
                        
                        # Add unchanged lines before this hunk
                        while original_idx < old_start and original_idx < len(lines):
                            result.append(lines[original_idx])
                            original_idx += 1
                        
                        # Process hunk content
                        i += 1
                        while i < len(patch_lines) and not patch_lines[i].startswith('@@'):
                            hunk_line = patch_lines[i]
                            if hunk_line.startswith('+'):
                                # Add new line
                                result.append(hunk_line[1:])
                            elif hunk_line.startswith('-'):
                                # Skip removed line
                                original_idx += 1
                            elif hunk_line.startswith(' '):
                                # Context line
                                result.append(hunk_line[1:])
                                original_idx += 1
                            i += 1
                        continue
                i += 1
            
            # Add remaining unchanged lines
            while original_idx < len(lines):
                result.append(lines[original_idx])
                original_idx += 1
            
            return '\n'.join(result)
            
        except Exception as e:
            logger.error(f"Error applying simple patch: {e}")
            return None
    
    @staticmethod
    def extract_file_info(patch: str) -> Tuple[Optional[str], bool]:
        """Extract filename and whether it's a new file from patch"""
        lines = patch.strip().split('\n')
        filename = None
        is_new_file = False
        
        for line in lines:
            if line.startswith('--- '):
                if line == '--- /dev/null':
                    is_new_file = True
            elif line.startswith('+++ '):
                # Extract filename from +++ line
                filename = line.replace('+++ ', '').replace('b/', '').strip()
                break
        
        return filename, is_new_file
    
    @staticmethod
    def create_unified_diff(old_content: str, new_content: str, filename: str = "file") -> str:
        """Create a unified diff from old and new content"""
        import difflib
        
        old_lines = old_content.splitlines(keepends=True)
        new_lines = new_content.splitlines(keepends=True)
        
        diff = difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile=f"a/{filename}",
            tofile=f"b/{filename}",
            lineterm=''
        )
        
        return ''.join(diff)


# Global instance
diff_parser = DiffParser()