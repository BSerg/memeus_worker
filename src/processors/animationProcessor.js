import dotenv from 'dotenv';
dotenv.config();

import os from 'os';
import fs, { mkdir } from 'fs';
import path from 'path';
import uuid from 'uuid';
import request from 'request';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import mkdirp from 'mkdirp';

import {uploadFile, uploadFiles} from '../uploader';
import {getFileName, getDimensions} from './index';


export default (job, done) => {
    let originalFilePath = path.join(process.env.EXCHANGE_DIR, job.data.original.path);

    let fileName = getFileName('media', 'mp4');
    
    let filePath = path.join(process.env.EXCHANGE_DIR, fileName);
    let [width, height] = getDimensions(process.env.VIDEO_SIZE_DEFAULT);

    ffmpeg(originalFilePath)
        .setFfmpegPath(process.env.FFMPEG_PATH)
        .inputFormat('gif')
        .outputOptions([
            '-movflags faststart',
            '-pix_fmt yuv420p',
        ])
        .size(`${width}x?`)  
        .toFormat('mp4')
        .on('error', function(err, stdout, stderr) {
            console.log('Cannot process video: ' + err.message);
            done(err);
        })
        .on('end', function() {

            let getInfo = () => {
                return new Promise((resolve, reject) => {
                    let _result = {path: fileName};
                    ffmpeg.ffprobe(filePath, (err, meta) => {
                        if (err) reject(err);
                        _result.format = 'mp4';
                        if (meta.streams && meta.streams.length) {
                            meta.streams.forEach(stream => {
                                if (stream.codec_type == 'video') {
                                    _result.width = stream.width;
                                    _result.height = stream.height;
                                }
                            });
                        }
                        if (meta.format && meta.format.size) {
                            _result.size = meta.format.size;
                        }
                        resolve(_result);
                    });
                });
            }

            let createThumbnail = () => {
                let tempPreviewFileName = getFileName('media/images', 'png');
                let tempPreviewFilePath = path.join(process.env.EXCHANGE_DIR, tempPreviewFileName);
                let previewFileName = getFileName('media/images', 'jpg');
                let previewFilePath = path.join(process.env.EXCHANGE_DIR, previewFileName);
                let [previewWidth, previewHeight] = getDimensions(process.env.THUMBNAIL_SIZE_PREVIEW);
                return new Promise((resolve, reject) => {
                    ffmpeg(filePath)
                        .on('error', err => {
                            reject(err);
                        })
                        .on('end', () => {
                            sharp(tempPreviewFilePath)
                                .min()
                                .toFormat(process.env.OUTPUT_FORMAT)
                                .toFile(previewFilePath, (err, info) => {
                                    if (err) reject(err);
                                    resolve({
                                        path: previewFileName,
                                        width: info.width,
                                        height: info.height,
                                        size: info.size,
                                        format: info.format
                                    })
                                    fs.unlink(tempPreviewFilePath, () => {});
                                });
                        })
                        .thumbnail({
                            count: 1,
                            filename: tempPreviewFileName,
                            folder: process.env.EXCHANGE_DIR,
                            size: `${previewWidth}x?`
                        });
                });
            }

            Promise
                .all([getInfo(), createThumbnail()])
                .then(([defaultData, previewData]) => {

                    uploadFiles([previewData.path, defaultData.path, job.data.original.path]).then(() => {
                        done(null, {...job.data, 
                            preview: previewData,
                            default: defaultData,
                            type: 'animation'
                        });
                    }).catch(err => {
                        done(err);
                    })

                }).catch(err => {
                    done(err);
                });

            console.log('Media processing finished');
        })
        .save(filePath);
}