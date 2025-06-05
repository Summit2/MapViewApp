# Веб-приложение сегментации изображений с поврежденными участками леса

Данное приложение предназначено для работы с лесными областями, представленными на онлайн карте в виде полигонов.

### Бэкенд

**Остановка занятого порта:**
```bash
sudo kill -9 `sudo lsof -t -i:5432`
```

**Сборка и запуск Docker:**
```bash
sudo docker compose build --no-cache
sudo docker compose up -d
```

**Настройка окружения и запуск Flask:**
```bash
python -m venv env
source ./env/bin/activate && flask --app app.py run
```

**Тестовый запрос (пример):**
```bash
curl -X POST -F "file1=@output1.tif" -F "file2=@output2.tif" http://127.0.0.1:5000/get_polygons/
```

### Фронтенд

**Сборка проекта:**
```bash
yarn build
```

**Запуск dev-сервера:**
```bash
yarn serve
```

**Публикация:**
```bash
yarn deploy
```

**Документация компонентов:**
```bash
yarn storybook
```

---
