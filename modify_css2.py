import re
import sys

def modify_css(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        css = f.read()

    # Mute all neon/accent colors in dark theme
    dark_colors = {
        '--brand:': '#ffffff;',
        '--brand-bright:': '#ffffff;',
        '--brand-soft:': '#222222;',
        '--brand-glow:': 'transparent;',

        '--emerald:': '#cccccc;',
        '--emerald-bright:': '#ffffff;',
        '--emerald-soft:': '#222222;',
        '--emerald-glow:': 'transparent;',

        '--cyan:': '#cccccc;',
        '--cyan-bright:': '#ffffff;',
        '--cyan-soft:': '#222222;',
        '--cyan-glow:': 'transparent;',

        '--rose:': '#999999;',
        '--rose-bright:': '#bbbbbb;',
        '--rose-soft:': '#222222;',
        '--rose-glow:': 'transparent;',

        '--amber:': '#aaaaaa;',
        '--amber-bright:': '#cccccc;',
        '--amber-soft:': '#222222;',
        '--amber-glow:': 'transparent;',

        '--blue:': '#cccccc;',
        '--blue-bright:': '#ffffff;',
        '--blue-soft:': '#222222;'
    }

    for key, value in dark_colors.items():
        css = re.sub(rf"({key}.*?;)", f"{key} {value}", css, count=1)


    # Mute all neon/accent colors in light theme
    light_idx = css.find('[data-theme="light"]')
    if light_idx != -1:
        light_css = css[light_idx:]
        light_colors = {
            '--brand:': '#000000;',
            '--brand-bright:': '#000000;',
            '--brand-soft:': '#e5e5e5;',
            '--brand-glow:': 'transparent;',

            '--emerald:': '#333333;',
            '--emerald-bright:': '#000000;',
            '--emerald-soft:': '#e5e5e5;',
            '--emerald-glow:': 'transparent;',

            '--cyan:': '#333333;',
            '--cyan-bright:': '#000000;',
            '--cyan-soft:': '#e5e5e5;',
            '--cyan-glow:': 'transparent;',

            '--rose:': '#666666;',
            '--rose-bright:': '#444444;',
            '--rose-soft:': '#e5e5e5;',
            '--rose-glow:': 'transparent;',

            '--amber:': '#555555;',
            '--amber-bright:': '#333333;',
            '--amber-soft:': '#e5e5e5;',
            '--amber-glow:': 'transparent;',

            '--blue:': '#333333;',
            '--blue-bright:': '#000000;',
            '--blue-soft:': '#e5e5e5;'
        }

        for key, value in light_colors.items():
            light_css = re.sub(rf"({key}.*?;)", f"{key} {value}", light_css, count=1)

        css = css[:light_idx] + light_css

    css = re.sub(r"box-shadow:.*?;", "box-shadow: none;", css)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(css)
    print("CSS colors muted.")

modify_css("src/public/css/styles.css")
