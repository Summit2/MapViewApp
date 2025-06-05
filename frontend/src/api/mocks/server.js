//server.js
import { createServer, Model, Response } from 'miragejs'

import { polygonData, userData } from './data';
// import { useSelector } from 'react-redux';


const sign = require('jwt-encode');

export const keyName = 'Token';
const API_URL = 'http://127.0.0.1:5000/api';

export default function (initialPolygons = []) {

    createServer({
        models: {
            polygon: Model,
            user: Model,
        },

        seeds(server) {
            let polygonShema = [];
        
            // Синхронный запрос
            const xhr = new XMLHttpRequest();
            xhr.open('GET', `${API_URL}/polygons`, false); // false делает запрос синхронным
            xhr.send();
        
            if (xhr.status !== 200) {
                throw new Error('Failed to fetch polygons');
            }
        
            const realPolygons = JSON.parse(xhr.responseText);
            
            console.log("Добавление полигонов с бэкенда в server.js");
            console.log(realPolygons);
            
            // Добавляем полученные полигоны в Mirage
            realPolygons.forEach((polygon) => {
                const polygonRight = {
                    id: polygon.id,
                    points: polygon.points,
                    name: polygon.name,
                    tree_count: polygon.tree_count
                }
                console.log(polygonRight)
                server.create('polygon', { ...polygonRight });
            });
        
            // Добавляем тестовых пользователей из моковых данных
            userData.forEach((user) => {
                server.create('user', { ...user });
            });
            
          },

        routes() {
            this.passthrough((request) => {
                return request.url.startsWith("http://127.0.0.1:5000/");
              });
            
            this.get('/api/polygons/', (schema) => {

                return schema.all('polygon');
            })

            this.get('/api/polygons/search', (schema, request) => {
                const query = request.queryParams.query;
                return schema.findBy('polygon', { name: query });
                
            })

            this.get('/api/polygons/:id', (schema, request) => {
                const id = request.params.id;

                return schema.find('polygon', id);
            })

            this.post('/api/polygons', (schema, request) => {
                const attrs = JSON.parse(request.requestBody);
                attrs.id = Date.now() % 1000000

                const newPolygon = {
                    points: attrs.points,
                    name: attrs.name || `Новый полигон №${Date.now() % 1000000}`,
                    tree_count: attrs.tree_count || 1
                };

                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${API_URL}/polygons`, false);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.send(JSON.stringify(attrs));
                
                if (xhr.status === 201) {
                    const response = JSON.parse(xhr.responseText);
                    return schema.create('polygon', {
                        id: attrs.id,
                        points: attrs.points,
                        name: attrs.name,
                        tree_count: attrs.tree_count
                    });
                } else {
                    return new Response(400, {}, {
                        errors: ['Ошибка при создании полигона на сервере']
                    });
                }
            
            if (!attrs.id) attrs.id = String(schema.all('polygon').length + 1);
            return schema.create('polygon', attrs);
            
            })

            this.delete('/api/polygons/:id', (schema, request) => {
                const id = request.params.id;

                return schema.find('polygon', id).destroy();
            })

            this.get('/api/trees?polygon_id=:id', (schema, request) => {
                const id = request.params.id;
                const polygonBody = schema.find('polygon', id);

                return polygonBody.trees;
            })

            this.post('/api/login', (shema, request) => {
                const attrs = JSON.parse(request.requestBody);
                const user = shema.findBy('user', { name: attrs.name });

                if (!user) {
                    return new Response(400, {}, {
                        errors: ['Не правильно введён логин. Повторите снова']
                    });
                }

                if (user.password !== attrs.password) {
                    return new Response(400, {}, {
                        errors: ['Не правильно введён пароль. Повторите снова']
                    });
                }
                
                const newToken = sign(user, 'Token');
                let now = new Date();
                let endTime = new Date(now.getTime() + 24 * 3600 * 1000);
                document.cookie = ['access_token=' + encodeURIComponent(newToken), 'expires=' + endTime.toUTCString()].join('; ');
                document.cookie = ['gis_name=' + user.name, 'expires=' + endTime.toUTCString()].join('; ');
                document.cookie = ['gis_status=' + user.status, 'expires=' + endTime.toUTCString()].join('; ');
            
                return { 
                    user: user,
                    access_token: newToken
                };
            })

            this.get('/api/logout', () => {
                document.cookie = ['access_token=', 'expires=Thu, 01 Jan 1970 00:00:01 GMT'].join('; ');
                document.cookie = ['gis_name=', 'expires=Thu, 01 Jan 1970 00:00:01 GMT'].join('; ');
                document.cookie = ['gis_status=', 'expires=Thu, 01 Jan 1970 00:00:01 GMT'].join('; ');
            
                return new Response(200, {}, { message: 'Success' });
            })

            this.patch('/api/polygons/:id', (schema, request) => {
                const id = request.params.id;
                const attrs = JSON.parse(request.requestBody);
                
                // 1. Сначала обновляем на реальном бэкенде
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', `${API_URL}/polygons/${id}`, false);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.send(JSON.stringify(attrs));
                
                if (xhr.status === 200) {
                    // 2. Затем обновляем в Mirage
                    return schema.find('polygon', id).update(attrs);
                } else {
                    return new Response(400, {}, {
                        errors: ['Ошибка при обновлении полигона на сервере']
                    });
                }
            });

            this.delete('/api/polygons/:id', (schema, request) => {
                const id = request.params.id;
                
                // 1. Сначала удаляем на реальном бэкенде
                const xhr = new XMLHttpRequest();
                xhr.open('DELETE', `${API_URL}/polygons/${id}`, false);
                xhr.send();
                
                if (xhr.status === 200) {
                    // 2. Затем удаляем в Mirage
                    return schema.find('polygon', id).destroy();
                } else {
                    return new Response(400, {}, {
                        errors: ['Ошибка при удалении полигона на сервере']
                    });
                }
            });

            this.post('api/polygons', (schema, request) => {
                const attrs = JSON.parse(request.requestBody);
                console.log(attrs);
                return schema.create('polygon', attrs);
            })
        },
    })
}