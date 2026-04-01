with open('index.html', 'r') as f:
    src = f.read()

src = src.replace(
    '<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>',
    '<script src="firebase-app-compat.js"></script>'
)
src = src.replace(
    '<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js"></script>',
    '<script src="firebase-database-compat.js"></script>'
)
src = src.replace(
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js"></script>',
    '<script src="chess.min.js"></script>'
)

with open('index.html', 'w') as f:
    f.write(src)
print('Done')
