import isAnimated from 'animated-gif-detector';
import request from 'request';
import uuid from 'uuid';
import fs from 'fs';
import probe from 'probe-image-size';
import path from 'path';
import Job from 'bull/lib/job';

import imageProcessor from './imageProcessor';
import animationProcessor from './animationProcessor';

const contentTypes = ['image/jpg', 'image/jpeg', 'image/png', 'image/gif'];


export let processorRouter = (job, done) => {
    // TODO: refactor processors for promises
    let media = job.data;
    request.head(media.exchangePath, (err, res, body) => {
        if (err) done(err);
        
        let contentType = res.headers['content-type'];
        
        if (contentTypes.indexOf(contentType) == -1) {
            done('Wrong file format');
        }

        let _req = request(job.data.exchangePath);        

        let originalFileName = uuid.v4() + '.' + contentType.split('/')[1];
        let originalFilePath = path.join(process.env.EXCHANGE_DIR, originalFileName);
        let originalWriteStream = fs.createWriteStream(originalFilePath);
    
        originalWriteStream.on('error', err => {
            done(err);
        });

        originalWriteStream.on('finish', () => {
            let _stream = fs.createReadStream(originalFilePath);
            let _streamClone = fs.createReadStream(originalFilePath);
            
            probe(_stream).then(info => {
                job.update({...job.data,
                    original: {
                        path: originalFileName,
                        width: info.width,
                        height: info.height,
                        format: info.type,
                        size: parseInt(res.headers['content-length'])
                    }
                }).then(() => {
                    Job.fromId(job.queue, job.id).then(_job => {
                        switch (contentType) {
                            case 'image/gif':
                                let processed = false;
                                _streamClone.pipe(isAnimated())
                                    .once('animated', () => {
                                        processed = true;
                                        animationProcessor(_job, done);
                                    })
                                    .once('finish', () => {
                                        if (!processed) {
                                            imageProcessor(_job, done);
                                        }
                                    });
                                break;
                            case 'image/jpeg':
                            case 'image/jpg':
                            case 'image/png':
                                imageProcessor(_job, done);
                                break;
                        }                
                    });
                });
            }).catch(err => {
                done(err);
            });
            
        });

        _req.pipe(originalWriteStream);
    });
}