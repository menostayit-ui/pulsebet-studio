import re

def modify_css(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        css = f.read()

    css = css.replace('--bg-base: #ffffff;', '--bg-base: #f7f7f7;')
    css = css.replace('--bg-surface: #f5f5f5;', '--bg-surface: #ffffff;')
    css = css.replace('--bg-card: #f9f9f9;', '--bg-card: #ffffff;')
    css = css.replace('--bg-elevated: #eeeeee;', '--bg-elevated: #f4f4f4;')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(css)

modify_css("src/public/css/styles.css")
