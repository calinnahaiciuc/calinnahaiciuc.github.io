import re

with open('index.html', 'r', encoding='utf-8') as f:
    c = f.read()

c = re.sub(r'(imagini/coper\u021bi albume/[^"]+)\.(jpg|jpeg|png|PNG|JPG)', r'\1.webp', c)
c = re.sub(r'(imagini/coper\u0163i albume/[^"]+)\.(jpg|jpeg|png|PNG|JPG)', r'\1.webp', c)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(c)
