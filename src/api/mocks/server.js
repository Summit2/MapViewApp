import { createServer, Model, hasMany, belongsTo, Response } from 'miragejs'

import { polygonData, woodData, treeData, userData } from './data';
const sign = require('jwt-encode');

export const keyName = 'Token';

export default function () {
    createServer({
        models: {
            wood: Model,

            tree: Model.extend({
                polygon: belongsTo(),
            }),

            polygon: Model.extend({
                tree: hasMany(),
            }),

            user: Model,
        },

        seeds(server) {
            let polygonShema = [];
            polygonData.forEach((polygon) => {
                polygonShema.push(server.create('polygon', { ...polygon }));
            });

            woodData.forEach((wood) => {
                server.create('wood', { ...wood });
            })

            treeData.forEach((treeArray, index) => {
                treeArray.forEach((tree) => {
                    server.create('tree', { 
                        ...tree, 
                        polygon: polygonShema[index] 
                    });
                });
            });

            userData.forEach((user) => {
                server.create('user', { ...user });
            });
        },

        routes() {
            this.get('/api/polygons/', (schema) => {

                return schema.all('polygon');
            })

            this.get('/api/polygons/:id', (schema, request) => {
                const id = request.params.id;

                return schema.find('polygon', id);
            })

            this.post('/api/polygons', (schema, request) => {
                const attrs = JSON.parse(request.requestBody);

                return schema.create('polygon', attrs);
            })

            this.delete('/api/polygons/:id', (schema, request) => {
                const id = request.params.id;

                return schema.find('polygon', id).destroy();
            })

            this.get('/api/trees', (schema) => {
                return schema.all('tree');
            })

            this.get('/api/trees/:id', (schema, request) => {
                const id = request.params.id;

                return schema.find('tree', id);
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

            this.get('/api/logout', (shema, request) => {
                document.cookie = ['access_token=', 'expires=Thu, 01 Jan 1970 00:00:01 GMT'].join('; ');
                document.cookie = ['gis_name=', 'expires=Thu, 01 Jan 1970 00:00:01 GMT'].join('; ');
                document.cookie = ['gis_status=', 'expires=Thu, 01 Jan 1970 00:00:01 GMT'].join('; ');
            
                return new Response(200, {}, { message: 'Success' });
            })

            this.patch('api/polygons/:id', (schema, request) => {
                const id = request.params.id;
                const attrs = JSON.parse(request.requestBody);

                return schema.find('polygon', id).update(attrs);
            })

            this.delete('api/polygons/:id', (schema, request) => {
                let id = request.params.id;

                return schema.find('polygon', id).destroy();
            })

            this.post('api/polygons', (schema, request) => {
                const attrs = JSON.parse(request.requestBody);

                return schema.create('polygon', { attrs });
            });

            this.patch('api/trees/:id', (schema, request) => {
                const id = request.params.id;
                const attrs = this.normalizedRequestAttrs();

                return schema.find('tree', id).update(attrs);
            })
        },
    })
}