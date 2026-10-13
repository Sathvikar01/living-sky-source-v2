import pathlib
s=pathlib.Path('src')
h=(s/'shell.html').read_text()
for k,f in [('/*__CSS__*/','style.css'),('/*__DATA__*/','data.js'),('/*__APP__*/','app.js'),('/*__GL__*/','gl.js')]:
    h=h.replace(k,(s/f).read_text())
pathlib.Path('index.html').write_text(h)
print(len(h.encode()))
