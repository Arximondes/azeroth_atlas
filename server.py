"""
Локальный сервер для атласа Азерота.
Раздаёт статические файлы + принимает POST /save-json для записи zones.json.

Запуск:
    python server.py

Открой: http://localhost:5500/regions/azeroth.html?edit=1
"""

import http.server
import socketserver
import os

PORT = 5500
ZONES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'zones.json')


class AtlasHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/save-json':
            try:
                length = int(self.headers.get('Content-Length', 0))
                data = self.rfile.read(length)

                # Проверяем, что это валидный JSON
                import json
                json.loads(data)

                # Записываем в файл
                with open(ZONES_FILE, 'wb') as f:
                    f.write(data)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"ok": true}')
                print(f'[server] ✅ Сохранено в zones.json ({len(data)} байт)')
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(f'{{"error": "{str(e)}"}}'.encode('utf-8'))
                print(f'[server] ❌ Ошибка: {e}')
        else:
            self.send_error(404)

    def end_headers(self):
        # Отключаем кэш для HTML/CSS/JS, чтобы изменения подхватывались
        if self.path.endswith(('.html', '.css', '.js', '.json')):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def log_message(self, format, *args):
        # Не спамим консоль каждым запросом
        if '/save-json' in self.path or self.command == 'POST':
            pass
        # Но показываем ошибки
        elif args and len(args) > 1 and str(args[1]).startswith('4'):
            print(f'[server] {self.address_string()} - {format % args}')


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('', PORT), AtlasHandler) as httpd:
        print('=' * 50)
        print(f'🚀 Сервер запущен: http://localhost:{PORT}/')
        print(f'   Атлас:  http://localhost:{PORT}/regions/azeroth.html')
        print(f'   Редактор: http://localhost:{PORT}/regions/azeroth.html?edit=1')
        print(f'   Файл:   {ZONES_FILE}')
        print('=' * 50)
        print('Ctrl+C — остановить')
        print()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n[server] Остановлен')