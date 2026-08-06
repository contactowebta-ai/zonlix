import re

with open("src/app/globals.css", "r", encoding="utf-8") as f:
    content = f.read()

# Variables to update in :root
root_updates = {
    "--background": "240 11% 96%;        /* #F5F5F7 (Gris Apple tenue) */",
    "--foreground": "222 47% 11%;       /* #0F172A (Texto oscuro legible) */",
    "--card": "0 0% 100%;               /* #FFFFFF (Tarjetas blancas) */",
    "--card-foreground": "222 47% 11%;  /* #0F172A (Texto de tarjetas oscuro) */",
    "--popover": "0 0% 100%;",
    "--popover-foreground": "222 47% 11%;",
    "--muted": "210 40% 96.1%;",
    "--muted-foreground": "215.4 16.3% 46.9%; /* #64748B (Texto secundario) */",
    "--border": "220 13% 91%;            /* Borde ultra fino claro */",
    "--radius": "1rem;"
}

# Variables to update in .dark
dark_updates = {
    "--background": "224 71% 4%;         /* #090D16 (Negro profundo SaaS) */",
    "--foreground": "210 40% 98%;        /* #F8FAFC (Texto blanco limpio) */",
    "--card": "222 47% 9%;               /* #0F172A (Tarjeta oscura elegante) */",
    "--card-foreground": "210 40% 98%;   /* #F8FAFC (Texto de tarjeta blanco) */",
    "--popover": "222 47% 9%;",
    "--popover-foreground": "210 40% 98%;",
    "--muted": "217.2 32.6% 17.5%;",
    "--muted-foreground": "215 20.2% 65.1%;",
    "--border": "217.2 32.6% 17.5%;      /* Borde fino oscuro */"
}

def replace_vars(block_content, updates):
    for key, value in updates.items():
        pattern = r"(" + key + r":\s*)[^;]+;"
        if re.search(pattern, block_content):
            block_content = re.sub(pattern, r"\g<1>" + value, block_content)
        else:
            block_content = block_content + f"\n  {key}: {value}"
    return block_content

# Find :root block
root_match = re.search(r":root\s*{([^}]+)}", content)
if root_match:
    root_block = root_match.group(1)
    new_root_block = replace_vars(root_block, root_updates)
    content = content.replace(root_block, new_root_block)

# Find .dark block
dark_match = re.search(r"\.dark\s*{([^}]+)}", content)
if dark_match:
    dark_block = dark_match.group(1)
    new_dark_block = replace_vars(dark_block, dark_updates)
    content = content.replace(dark_block, new_dark_block)

# Add html, body to @layer base
layer_base_pattern = r"(@layer base\s*{)([\s\S]*?)(})"
layer_base_match = re.search(layer_base_pattern, content)
if layer_base_match:
    new_layer_base = layer_base_match.group(1) + layer_base_match.group(2) + """
  html, body {
    background-color: hsl(var(--background)) !important;
    color: hsl(var(--foreground)) !important;
  }
""" + layer_base_match.group(3)
    content = content.replace(layer_base_match.group(0), new_layer_base)

with open("src/app/globals.css", "w", encoding="utf-8") as f:
    f.write(content)
