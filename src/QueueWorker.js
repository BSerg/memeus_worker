import dotenv from 'dotenv';
dotenv.config();

import Queue from 'bull';
import cluster from 'cluster';

const resultQueue = new Queue(process.env.RESULT_QUEUE, process.env.REDIS_URL);

let sendResult = result => {
    resultQueue.add(result);
}

class QueueWorker {
    constructor({
        queueName, 
        queueOpts = {}, 
        processor, 
        redisOpts = {
            host: process.env.REDIS_HOST, 
            port: process.env.REDIS_PORT,
            db: process.env.REDIS_DB,
            password: process.env.REDIS_PASSWORD
        }, 
        concurrency = 1
    }) {
        this.queueName = queueName;
        this.queueOpts = queueOpts;
        this.processor = processor;
        this.redisOpts = redisOpts;
        this.concurrency = concurrency;
        this.init();
    }

    init() {
        this.queue = new Queue(this.queueName, {settings: this.queueOpts, redis: this.redisOpts});
        this.queue.on('completed', this.onCompleted);
        this.queue.on('progress', this.onProgress);
        this.queue.on('failed', this.onFailed);
        this.queue.on('error', this.onError);
        this.queue.on('stalled', job => {
            console.log('STALLED', job.id);
        })
        this.queue.process(this.processor);
    }

    onCompleted(job, result) {
        sendResult(result);
        console.log('COMPLETED', job.id);
    }

    onProgress(job, progress) {
        console.log('PROGRESS:', job.id, progress);
    }

    onFailed(job, err) {
        let errorResult = {
            postId: job.data.postId,
            mediaIndex: job.data.mediaIndex,
            exchangePath: job.data.exchangePath,
            error: 'There are some errors in media processing flow... We are fixing this!'
        }
        console.log('FAILED', job.id, err);
    }

    onError(job, result) {
        console.log('ERROR', job.id);
    }

}

export default QueueWorker;