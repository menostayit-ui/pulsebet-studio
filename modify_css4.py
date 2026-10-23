import re

def modify_css(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        css = f.read()

    css = css.replace('--border-subtle: rgba(15, 23, 42, 0.04);', '--border-subtle: #eaeaea;')
    css = css.replace('--border-light: rgba(15, 23, 42, 0.07);', '--border-light: #dddddd;')
    css = css.replace('--border-strong: rgba(15, 23, 42, 0.12);', '--border-strong: #cccccc;')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(css)

modify_css("src/public/css/styles.css")
