"""Build a clean HaiKan submission from the project source files."""
import argparse
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("student_id", nargs="?", default="รหัสนักศึกษา")
args = parser.parse_args()
if args.student_id != "รหัสนักศึกษา" and not args.student_id.isdecimal():
    parser.error("Enter a numeric student ID")

files = [
    ".gitignore", "README.md", "package.json", "package-lock.json",
    "client/package.json", "client/tsconfig.json", "client/vite.config.ts",
    "client/index.html", "server/package.json", "server/tsconfig.json",
    "server/.env.example", "scripts/package_submission.py",
]
trees = {
    "client/src": {".ts", ".tsx", ".css"},
    "client/public": {".svg", ".png", ".webp", ".jpg", ".jpeg", ".ico"},
    "server/src": {".ts"}, "server/tests": {".ts"},
    "server/prisma": {".prisma", ".sql", ".toml", ".ts"},
}
if (root / "docs").is_dir():
    trees["docs"] = {".md", ".svg", ".png", ".jpg", ".pdf", ".pptx"}

for folder, extensions in trees.items():
    directory = root / folder
    if not directory.is_dir():
        raise FileNotFoundError(directory)
    for path in sorted(directory.rglob("*")):
        relative = path.relative_to(root)
        if any(part.startswith(".") or part in {"node_modules", "dist"} for part in relative.parts):
            continue
        if path.is_file() and not path.is_symlink() and path.suffix.lower() in extensions:
            files.append(relative.as_posix())

output = root / f"final_proj_{args.student_id}.zip"
with TemporaryDirectory(dir=root) as temp:
    draft = Path(temp) / "submission.zip"
    with ZipFile(draft, "w", compression=ZIP_DEFLATED) as archive:
        for name in files:
            archive.write(root / name, name)
    with ZipFile(draft) as archive:
        if archive.testzip() is not None:
            raise ValueError("ZIP integrity check failed")
    draft.replace(output)
print(output.name)
