-- Создаем таблицу пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создаем таблицу полигонов с tree_count
CREATE TABLE IF NOT EXISTS polygons (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    points JSONB NOT NULL,
    tree_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER REFERENCES users(id)
);

-- Создаем таблицу деревьев (если нужно)
CREATE TABLE IF NOT EXISTS trees (
    id SERIAL PRIMARY KEY,
    polygon_id INTEGER REFERENCES polygons(id),
    species VARCHAR(100),
    coordinates JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Функция для автоматического обновления времени
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для полигонов
CREATE TRIGGER update_polygons_timestamp
BEFORE UPDATE ON polygons
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Создаем индексы
CREATE INDEX IF NOT EXISTS idx_polygons_user_id ON polygons(user_id);
CREATE INDEX IF NOT EXISTS idx_trees_polygon_id ON trees(polygon_id);

-- Тестовые данные (опционально)
INSERT INTO users (username, password, status) 
VALUES ('admin', 'admin', 'admin')
ON CONFLICT (username) DO NOTHING;

INSERT INTO polygons (name, points, tree_count, user_id)
VALUES (
    'Область №1', 
    '[[56.11029559576524, 38.372594662072835], [56.11021708098298, 38.37240336062116], [56.110166271889085, 38.37226418095619]]', 
    3, 
    1
)
ON CONFLICT DO NOTHING;