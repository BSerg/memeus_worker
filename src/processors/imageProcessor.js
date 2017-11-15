import sharp from 'sharp';
import uuid from 'uuid';
import path from 'path';
import fs from 'fs';
import request from 'request';

import {uploadFile, uploadFiles} from '../uploader';


let getDimensions = sizesString => {
    return sizesString.split('x').map(value => {return parseInt(value)});
}

let getFileName = (relPath = null) => {
    if (relPath === null) {
        return uuid.v4() + '.jpeg';
    } else {
        return path.join(relPath, uuid.v4() + '.jpeg');
    }
}

export let _processImage = (imageStream, width = null, height = null) => {
    return new Promise((resolve, reject) => {
        let filePath = getFileName();
        let result = {path: filePath};

        let _sharp = width || height ? sharp().resize(width, height) : sharp();
        
        let sharpPipe = _sharp
            .toFormat(process.env.OUTPUT_FORMAT)
            .on('info', info => {
                result.width = info.width;
                result.height = info.height;
                result.size = info.size;
                result.format = info.format;
            })
            .on('error', err => {
                console.error('ERROR', err);
                reject(err);
            });

        let outStream = fs.createWriteStream(path.join(process.env.EXCHANGE_DIR, filePath));
        
        outStream.on('finish', () => {
            resolve(result);
        });

        outStream.on('error', err => {
            reject(err);
        });

        imageStream.pipe(sharpPipe).pipe(outStream);
    });
};

export default (job, done) => {
    let imageStream;

    try {
        imageStream = fs.createReadStream(path.join(process.env.EXCHANGE_DIR, job.data.original.path));
    } catch(err) {
        done(err);
        return;
    }

    switch (job.data.route) {
        case 'post':
            let [previewWidth, previewHeight] = getDimensions(process.env.THUMBNAIL_SIZE_PREVIEW);
            let [width, height] = getDimensions(process.env.THUMBNAIL_SIZE_DEFAULT);
        
            Promise.all([
                _processImage(imageStream, previewWidth), 
                _processImage(imageStream, width),
            ]).then(([previewOutput, defaultOutput]) => {
                
                uploadFiles([previewOutput.path, defaultOutput.path, job.data.original.path]).then(() => {
                    done(null, {...job.data, 
                        preview: previewOutput,
                        default: defaultOutput,
                        type: 'photo'
                    });
                }).catch(err => {
                    done(err);
                })
                
                
            }).catch(err => {
                done(err);
            });
            break;
        case 'avatar':
            let [avatarWidth, avatarHeight] = getDimensions(process.env.AVATAR_SIZE_DEFAULT);
            _processImage(imageStream, avatarWidth, avatarHeight).then(output => {
                uploadFile(output.path).then(() => {
                    done(null, {
                        ...job.data,
                        default: output,
                        type: 'photo'
                    })
                }).catch(err => {
                    done(err);
                });
            });
    }

    
};