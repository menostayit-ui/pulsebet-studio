import re
import sys

def modify_css(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        css = f.read()

    # 1. Update Fonts
    css = re.sub(r"--font-sans: 'Plus Jakarta Sans',", r"--font-sans: 'Inter',", css)

    # 2. Update Border Radii
    css = re.sub(r"--radius-xs:\s*\d+px;", "--radius-xs: 0px;", css)
    css = re.sub(r"--radius-sm:\s*\d+px;", "--radius-sm: 0px;", css)
    css = re.sub(r"--radius-md:\s*\d+px;", "--radius-md: 2px;", css)
    css = re.sub(r"--radius-lg:\s*\d+px;", "--radius-lg: 2px;", css)
    css = re.sub(r"--radius-xl:\s*\d+px;", "--radius-xl: 4px;", css)
    css = re.sub(r"--radius-pill:\s*\d+px;", "--radius-pill: 2px;", css)

    # 3. Modify shadows to be flat
    css = re.sub(r"--shadow-xs:.*?;\n", "--shadow-xs: none;\n", css)
    css = re.sub(r"--shadow-sm:.*?;\n", "--shadow-sm: none;\n", css)
    css = re.sub(r"--shadow-md:.*?;\n", "--shadow-md: none;\n", css)
    css = re.sub(r"--shadow-luxury:.*?;\n", "--shadow-luxury: none;\n", css)
    css = re.sub(r"--shadow-neon-emerald:.*?;\n", "--shadow-neon-emerald: none;\n", css)
    css = re.sub(r"--shadow-neon-brand:.*?;\n", "--shadow-neon-brand: none;\n", css)

    # 4. Monochromatic palette for dark mode
    css = re.sub(r"(--bg-base:.*?)\n", r"--bg-base: #000000;\n", css, count=1)
    css = re.sub(r"(--bg-surface:.*?)\n", r"--bg-surface: #111111;\n", css, count=1)
    css = re.sub(r"(--bg-card:.*?)\n", r"--bg-card: #0a0a0a;\n", css, count=1)
    css = re.sub(r"(--bg-card-hover:.*?)\n", r"--bg-card-hover: #1a1a1a;\n", css, count=1)
    css = re.sub(r"(--bg-elevated:.*?)\n", r"--bg-elevated: #151515;\n", css, count=1)
    css = re.sub(r"(--bg-elevated-hover:.*?)\n", r"--bg-elevated-hover: #222222;\n", css, count=1)
    css = re.sub(r"(--bg-glass:.*?)\n", r"--bg-glass: rgba(0, 0, 0, 0.9);\n", css, count=1)
    css = re.sub(r"(--bg-hero:.*?)\n", r"--bg-hero: #0a0a0a;\n", css, count=1)

    # 5. Monochromatic palette for light mode (starts after [data-theme="light"])
    light_idx = css.find('[data-theme="light"]')
    if light_idx != -1:
        light_css = css[light_idx:]
        light_css = re.sub(r"(--bg-base:.*?)\n", r"--bg-base: #ffffff;\n", light_css, count=1)
        light_css = re.sub(r"(--bg-surface:.*?)\n", r"--bg-surface: #f5f5f5;\n", light_css, count=1)
        light_css = re.sub(r"(--bg-card:.*?)\n", r"--bg-card: #f9f9f9;\n", light_css, count=1)
        light_css = re.sub(r"(--bg-card-hover:.*?)\n", r"--bg-card-hover: #eeeeee;\n", light_css, count=1)
        light_css = re.sub(r"(--bg-elevated:.*?)\n", r"--bg-elevated: #eeeeee;\n", light_css, count=1)
        light_css = re.sub(r"(--bg-elevated-hover:.*?)\n", r"--bg-elevated-hover: #dddddd;\n", light_css, count=1)
        light_css = re.sub(r"(--bg-glass:.*?)\n", r"--bg-glass: rgba(255, 255, 255, 0.9);\n", light_css, count=1)
        light_css = re.sub(r"(--bg-hero:.*?)\n", r"--bg-hero: #f9f9f9;\n", light_css, count=1)
        css = css[:light_idx] + light_css

    # 6. Simplify gradients across the file
    css = re.sub(r"linear-gradient\(.*?\)", "transparent", css)
    css = re.sub(r"radial-gradient\(.*?\)", "transparent", css)

    # 7. Disable animations
    css = re.sub(r"animation:.*?;", "animation: none;", css)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(css)
    print("CSS modified successfully.")

modify_css("src/public/css/styles.css")
