from flask import Flask, request, jsonify
from io import BytesIO
import rasterio
import numpy as np
import cv2
from onnx_model import OnnxModel
from image_preparation import prepareImage, prepareMask
from polygons_preparation import simplifyPolygons, polygonsToGeopolygons
from flask_cors import CORS
import psycopg2
import json
import time

from datetime import datetime

# Инициализация модели
MODEL_PATH = "model_unet.onnx"
model = OnnxModel(MODEL_PATH)

app = Flask(__name__)
CORS(app)
# CORS(app, resources={r"/api/*": {"origins": "http://127.0.0.1:3000"}})
# Конфигурация БД
DB_CONFIG = {
    'dbname': 'gis_db',
    'user': 'gis_user',
    'password': 'gis_password',
    'host': 'localhost',
    'port': '5432'
}
'''
sudo kill -9 `sudo lsof -t -i:5432` 
sudo docker compose build --no-cache
sudo docker compose up -d


source ./env/bin/activate &&  flask --app app.py run
curl -X POST -F "file1=@output1.tif" -F "file2=@output2.tif" http://127.0.0.1:5000/get_polygons/
'''
def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)

def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.close()
    conn.close()

init_db()

# Pipeline обработки изображений (остается без изменений)
def pipeline(dataImg1: dict, dataImg2: dict):
    """Обрабатывает изображения и возвращает полигоны в географических координатах."""
    img1, img2 = np.transpose(dataImg1['img'], axes=(1, 2, 0)), np.transpose(dataImg2['img'], axes=(1, 2, 0))
    
    concatedImage = np.concatenate((img1, img2), axis=2)
    preparedImage = prepareImage(concatedImage)[np.newaxis, ...]
    
    assert preparedImage.shape == (1, 256, 256, 16), f"Неправильная размерность подготовленной картинки: {preparedImage.shape}"
    
    mask = model.predict(preparedImage)[0][0]
    preparedMask = prepareMask(mask)
    polygons = simplifyPolygons(preparedMask, epsilon=0.05)
    geo_polygons = polygonsToGeopolygons(polygons, dataImg1['transform'], dataImg1['coordinatesType'])
    
    return geo_polygons

@app.route("/get_polygons/", methods=["POST"])
def process_geotiff():
    """Обрабатывает два GeoTIFF файла и возвращает сегментированные полигоны."""
    if "file1" not in request.files or "file2" not in request.files:
        return jsonify({"error": "Необходимо передать два файла: file1 и file2"}), 400

    file1, file2 = request.files["file1"], request.files["file2"]
    dataImg1, dataImg2 = dict(), dict()

    try:
        # Чтение файлов
        with BytesIO(file1.read()) as f1, rasterio.open(f1) as dataset1:
            dataImg1 = {
                'img': dataset1.read(),
                'bounds': dataset1.bounds,
                'coordinatesType': dataset1.crs,
                'transform': dataset1.transform
            }
        
        with BytesIO(file2.read()) as f2, rasterio.open(f2) as dataset2:
            dataImg2 = {
                'img': dataset2.read(),
                'bounds': dataset2.bounds,
                'coordinatesType': dataset2.crs,
                'transform': dataset2.transform
            }

        # Проверки
        if dataImg1['img'].shape != dataImg2['img'].shape:
            return jsonify({"error": "Изображения должны иметь одинаковую размерность"}), 400
        if dataImg1['bounds'] != dataImg2['bounds']:
            return jsonify({"error": "Изображения должны быть в одинаковых границах"}), 400

        # Обработка
        polygons = pipeline(dataImg1, dataImg2)
        
        result = [{
            "id" : int(datetime.now().timestamp() * 1000) % 10000000 + i,
            "points": polygon,
            "name": f"Полигон №{i+1}_{ datetime.now() }",
            "tree_count": 0  # По умолчанию 0 деревьев
        } for i, polygon in enumerate(polygons)] if polygons else []
        
        conn = get_db_connection()
        cur = conn.cursor()

        for data in result:
            print(data['id'])
            polygon = {
                "id" : data.get("id"),#, int(datetime.now().timestamp() * 1000)) % 1000000,
                "name": data.get("name", "Unnamed Polygon"),
                "points": data["points"],
                "tree_count": data.get("tree_count", 0)
            }
            
            
            cur.execute(
                "INSERT INTO polygons (id, name, points, tree_count) VALUES (%s,%s, %s, %s) RETURNING id;",
                (polygon["id"], polygon["name"], json.dumps(polygon["points"]), polygon["tree_count"]) )
            polygon_id = cur.fetchone()[0]
            conn.commit()
        cur.close()
        conn.close()

        return jsonify(result)
    

    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 400

# CRUD операции для полигонов
@app.route("/api/polygons", methods=["GET"])
def get_polygons():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, name, points, tree_count FROM polygons;")
    columns = [desc[0] for desc in cur.description]
    polygons = [dict(zip(columns, row)) for row in cur.fetchall()]
    cur.close()
    conn.close()
    return jsonify(polygons)

@app.route("/api/polygons/<int:polygon_id>", methods=["GET"])
def get_polygon(polygon_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id, name, points, tree_count FROM polygons WHERE id = %s;", (polygon_id,))
    polygon = cur.fetchone()
    cur.close()
    conn.close()
    
    if polygon:
        return jsonify({
            "id": polygon[0],
            "name": polygon[1],
            "points": polygon[2],
            "tree_count": polygon[3]
        })
    return jsonify({"error": "Polygon not found"}), 404

@app.route("/api/polygons", methods=["POST", "OPTIONS"])
def create_polygon():
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        return jsonify({}), 200
    

    data = request.get_json()
    if not data or 'points' not in data:
        return jsonify({"error": "Missing points data"}), 400
    
    print("id", int(datetime.now().timestamp() * 1000) % 1000000)
    polygon = {
        "id" : data.get("id", int(datetime.now().timestamp() * 1000) % 1000000 ),
        "name": data.get("name", "Unnamed Polygon"),
        "points": data["points"],
        "tree_count": data.get("tree_count", 0)
    }
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO polygons (id,name, points, tree_count) VALUES (%s,%s, %s, %s) RETURNING id;",
        (polygon['id'],polygon["name"], json.dumps(polygon["points"]), polygon["tree_count"]) )
    polygon_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({"id": polygon_id, **polygon}), 201

@app.route("/api/polygons/<int:polygon_id>", methods=["PUT"])
def update_polygon(polygon_id):
    data = request.get_json()
    if not data or 'points' not in data:
        return jsonify({"error": "Missing points data"}), 400
    
    updates = {
        
        "name": data.get("name"),
        "points": data["points"],
        "tree_count": data.get("tree_count")
    }
    
    # Подготовка SQL запроса
    set_clauses = []
    params = []
    for field, value in updates.items():
        if value is not None:
            set_clauses.append(f"{field} = %s")
            params.append(json.dumps(value) if field == "points" else value)
    params.append(polygon_id)
    
    if not set_clauses:
        return jsonify({"error": "No fields to update"}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        f"UPDATE polygons SET {', '.join(set_clauses)} WHERE id = %s RETURNING *;",
        params)
    
    updated_polygon = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    
    if not updated_polygon:
        return jsonify({"error": "Polygon not found"}), 404
    
    return jsonify({
        "id": updated_polygon[0],
        "name": updated_polygon[1],
        "points": updated_polygon[2],
        "tree_count": updated_polygon[3]
    })

@app.route("/api/polygons/<int:polygon_id>", methods=["DELETE"])
def delete_polygon(polygon_id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM polygons WHERE id = %s RETURNING id;", (polygon_id,))
    deleted_id = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    
    if not deleted_id:
        return jsonify({"error": "Polygon not found"}), 404
    return jsonify({"message": "Polygon deleted", "id": deleted_id[0]})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)