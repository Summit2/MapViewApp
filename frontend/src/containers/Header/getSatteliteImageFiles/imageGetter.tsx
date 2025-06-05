//imageGetter.tsx

import React, { useState, useRef, useEffect } from "react";
import './imageGetter.scss';

import { Text } from "@components/base";

import { useDispatch } from 'react-redux';
import { addPolygon } from "@store/polygonsSlice"; //для добавления полигонов

import { useAddPolygonMutation } from "@api/paths/polygonApi";

export const ImageGetter: React.FC = () => {
    const [opened, setOpened] = useState(false);
    const [files, setFiles] = useState<FileList | null>(null);
    const [error, setError] = useState<string | null>(null);
    const ref = useRef<HTMLDivElement | null>(null);


    const dispatch = useDispatch();//для добавления полигонов


    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
        if (
            ref.current &&
            !ref.current.contains(e.target as Node)
        ) {
            setOpened(false);
        }
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleOutsideClick);
        return () =>
            document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    const isGeoTiff = (file: File) => {
        const name = file.name.toLowerCase();
        return name.endsWith('.tif') || name.endsWith('.tiff');
    };

    const [ addPolygon ] = useAddPolygonMutation();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        setError(null);

        if (!selectedFiles || selectedFiles.length !== 2) {
            setError("Пожалуйста, выберите ровно два файла.");
            setFiles(null);
            return;
        }

        const invalidFiles = Array.from(selectedFiles).filter(file => !isGeoTiff(file));
        if (invalidFiles.length > 0) {
            setError("Все файлы должны быть в формате GeoTIFF (.tif, .tiff).");
            setFiles(null);
            return;
        }

        setFiles(selectedFiles);
        setOpened(false);

        try {
            const formData = new FormData();
            formData.append("file1", selectedFiles[0]);
            formData.append("file2", selectedFiles[1]);
    
            // 1. Отправляем файлы на обработку полигонов
            const processResponse = await fetch("http://127.0.0.1:5000/get_polygons/", {
                method: "POST",
                body: formData
            });
    
            if (!processResponse.ok) {
                const errorData = await processResponse.json();
                throw new Error(errorData.error || "Ошибка при обработке файлов.");
            }
    
            const polygons = await processResponse.json();
            alert(`Распознано полигонов: ${polygons.length}`);
            console.log("Распознаны полигоны:", polygons);
            
            // // 2. Асинхронно сохраняем все полигоны в базу данных
            // const savePromises = polygons.map(async (element: any) => {
                // @ts-ignore
                polygons.forEach(element => {
                    console.log(element)
                    // console.log(element.points)
                    const newPolygon = {
                        // id: String(Date.now()), // Явное указание ID
                        id: element.id,
                        points: element.points,
                        name: element.name,
                        tree_count: element.tree_count
                      };
                    // dispatch(addPolygon(newPolygon)); 
                    addPolygon({ attrs: newPolygon });
                    // добавляем новые полигоны
                });
                
    
        } catch (err: any) {
            setError(err.message || "Неизвестная ошибка.");
            console.error("Ошибка:", err);
        }
        
        
    };

    return (
        <div className="file-upload-block" id="file-upload-trigger">
            <button
                className="upload-button"
                onClick={() => setOpened(!opened)}
            >
                Распознать полигоны
            </button>

            {opened &&
                <div
                    className="file-upload-dropdown box-shadow-bottom"
                    ref={ref}
                >
                    <Text color='gray' type='small-text'>
                        Выберите ровно два файла GeoTIFF (.tif / .tiff)
                    </Text>
                    <input
                        type="file"
                        accept=".tif,.tiff,image/tiff"
                        multiple
                        onChange={handleFileChange}
                        className="file-input"
                    />

                    {error && (
                        <Text color='error' type='small-text'>
                            {error}
                        </Text>
                    )}

                    {files && (
                        <div className="selected-files">
                            {[...files].map((file, index) => (
                                <Text key={index} color="base" type="small-text">
                                    {file.name}
                                </Text>
                            ))}
                        </div>
                    )}
                </div>
            }
        </div>
    );
};
