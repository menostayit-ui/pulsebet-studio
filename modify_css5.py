import re

def modify_css(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        css = f.read()

    css = css.replace('--border-subtle: rgba(255, 255, 255, 0.045);', '--border-subtle: #222222;')
    css = css.replace('--border-light: rgba(255, 255, 255, 0.08);', '--border-light: #333333;')
    css = css.replace('--border-strong: rgba(255, 255, 255, 0.14);', '--border-strong: #444444;')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(css)

modify_css("src/public/css/styles.css")
