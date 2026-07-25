import os

REPLACEMENTS = {
    "PlanBro": "BrewPlans",
    "planbro": "brewplans",
    "PLANBRO": "BREWPLANS",
    "Planbro": "Brewplans",
}

IGNORE_DIRS = {
    ".git",
    "node_modules",
    ".next",
    "__pycache__",
    ".venv",
    "venv",
    "build",
    "dist"
}

IGNORE_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".mp4", ".ico", ".svg", ".pdf", ".zip", ".tar", ".gz", ".woff", ".woff2", ".ttf", ".eot"
}

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = content
        for old_str, new_str in REPLACEMENTS.items():
            new_content = new_content.replace(old_str, new_str)
            
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated: {filepath}")
    except Exception as e:
        pass

def main():
    root_dir = os.getcwd()
    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Remove ignored directories from traversal
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
        
        for filename in filenames:
            ext = os.path.splitext(filename)[1].lower()
            if ext in IGNORE_EXTENSIONS:
                continue
                
            filepath = os.path.join(dirpath, filename)
            if "rename_brewplans.py" in filename:
                continue
            
            process_file(filepath)

if __name__ == "__main__":
    main()
