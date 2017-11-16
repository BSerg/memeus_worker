import dotenv from 'dotenv';
dotenv.config();

import newrelic from 'newrelic';

import Queue from 'bull';

import QueueWorker from './QueueWorker';
import {processorRouter} from './processors';
import imageProcessor from './processors/imageProcessor';
import animationProcessor from './processors/animationProcessor';

const mediaQueue = new QueueWorker({
    queueName: process.env.MEDIA_QUEUE,
    processor: processorRouter,
});


console.log('MEDIA WORKER STARTED');