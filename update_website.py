#!/usr/bin/env python3
import os
import re

# Directory containing HTML files
html_dir = r"d:\29GB Material\Shiv\www.forherpilates.com.au"

# Replacements to make
replacements = [
    ("FOR HER PILATES STUDIO", "LANTA PILATES"),
    ("For Her Pilates Studio", "Lanta Pilates"),
    ('alt="FOR HER PILATES STUDIO"', 'alt="LANTA PILATES"'),
]

# HTML files to process
html_files = [
    "index.html",
    "about.html",
    "about-us.html",
    "contact.html",
    "howitworks.html",
    "how it works.html",
    "pricing.html",
    "orientation.html",
    "cart.html",
    "join.html",
    "accesshelp.html",
    "privacypolicy.html",
    "terms.html"
]

for filename in html_files:
    filepath = os.path.join(html_dir, filename)
    if os.path.exists(filepath):
        print(f"Processing {filename}...")
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Apply all replacements
        for old, new in replacements:
            content = content.replace(old, new)
        
        # Write back
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✓ Updated {filename}")
    else:
        print(f"  ✗ File not found: {filename}")

print("\nNext, we need to add the Login button to the header...")
print("This requires manual editing of the header structure in each file.")
