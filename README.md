# Веб-приложение сегментации изображений с поврежденными участками леса

Данное приложение предназначено для работы с лесными областями, представленными на онлайн карте в виде полигонов.
Пример:  
Есть Tiff изображения с ground truth маской.  
![image](https://github.com/user-attachments/assets/f4db9009-960e-4e79-ba2a-6074f4ca79dc)  
На фронтенд загружаем 2 снимка одной области. В результате сегментации нейросетью и последующим упрощением полигона мы получим такой результат:  
![Снимок экрана от 2025-06-06 00-55-19](https://github.com/user-attachments/assets/fdd2d7ee-e202-4393-aa2b-b28ddacc723f)



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
### Описание работы алгоритма:  
Алгоритм сегментации и преобразования в полигоны начинается с обработки спутниковых снимков с помощью нейросетевой модели U-Net. Модель принимает 16-канальное изображение размером 256×256 пикселей, включающее спектральные данные и дополнительные признаки, усиливающие контраст между разными типами земной поверхности. После обработки через кодировщик и декодировщик U-Net формирует  бинарную маску. Это позволяет выделить поврежденные участки леса на снимке.  

Далее бинарная маска преобразуется в векторные полигоны с использованием алгоритма поиска контуров. На этом этапе определяются границы поврежденных участков, которые представляются в виде замкнутых контуров. Для оптимизации данных применяется алгоритм Висвалингама-Уайатта, который упрощает полигоны, уменьшая количество точек при сохранении общей формы. Это важно для снижения вычислительной нагрузки и упрощения визуализации.  

Завершающий этап включает преобразование координат полигонов из пиксельной системы в географическую (WGS84). Это позволяет корректно отображать полигоны на карте и использовать их в геоинформационных системах. Результатом работы алгоритма является набор полигонов, которые можно редактировать, анализировать и экспортировать для дальнейшего использования в экологическом мониторинге.  


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
