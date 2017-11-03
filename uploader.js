import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import s3 from 's3';

export const client = s3.createClient({
    s3Options: {
        accessKeyId: process.env.S3_KEY,
        secretAccessKey: process.env.S3_SECRET,
        endpoint: process.env.S3_ENDPOINT,
        sslEnabled: false
      },
});

export let uploadFile = (fileName, onProgress = progress => {}) => {
    return new Promise((resolve, reject) => {
        let uploader = client.uploadFile({
            localFile: path.join(process.env.EXCHANGE_DIR, fileName),
            s3Params: {
                Bucket: process.env.S3_BUCKET,
                Key: fileName,
                ACL: 'public-read'
            }
        })
    
        uploader.on('error', err => {
            reject(err);
        });

        uploader.on('progress', () => {
            onProgress(parseInt(uploader.progressAmount * 100 / uploader.progressTotal));
        });

        uploader.on('end', () => {
            resolve();
        });
    });
};

export let uploadFiles = (filePaths, onProgress = progress => {}) => {

    let progressArray = [];

    let calcAvgProgress = () => {
        return parseInt(progressArray.reduce(function(sum, a) { return sum + a || 0 }, 0) / (progressArray.length || 1));
    };
    
    return Promise.all(filePaths.map((filePath, index) => {
        return uploadFile(filePath, progress => {
            progressArray[index] = progress;
            onProgress(calcAvgProgress);
        });
    }));
};